"use client";

import { useSyncExternalStore } from "react";
import { parsePartialJson } from "ai";
import { toast } from "sonner";

import type { AgentPlan, PartialAgentPlan } from "../plan-schema";
import {
  ERROR_SENTINEL,
  PAUSE_SENTINEL,
  RUN_ID_HEADER,
} from "../stream-protocol";

/**
 * Module-level chat store for the Agent page. Lives OUTSIDE React on purpose:
 * a run keeps streaming while the user navigates to other tabs/pages (the page
 * component unmounts, the store doesn't), and conversations are persisted to
 * localStorage so nothing is lost on route changes or reloads.
 *
 * Runs are resumable. Long generations are split into serverless segments
 * (Hobby caps each invocation at 300s); when a segment `paused`s, the client
 * POSTs /api/agent/stream/continue to resume it, chaining until done. The active
 * run is mirrored to localStorage so a full page reload can reconnect to it via
 * /api/agent/stream/status instead of losing the work.
 */

export type ChatMessage =
  | { id: string; role: "user"; content: string }
  | {
      id: string;
      role: "assistant";
      plan: AgentPlan;
      /** The feature this run implemented — drives the PR's branch name. */
      featureId?: string | null;
      /** True when the user stopped the run — the plan is a partial result. */
      cancelled?: boolean;
      prUrl?: string;
      prNumber?: number;
      prBranch?: string;
      prDraft?: boolean;
    };

export type ChatSession = {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  messages: ChatMessage[];
};

export type AgentChatState = {
  /** Newest-first. */
  sessions: ChatSession[];
  /** null = a fresh, not-yet-persisted chat. */
  activeId: string | null;
  /** The in-flight run, if any — at most one at a time, on any session. */
  run: { sessionId: string; livePlan: PartialAgentPlan } | null;
};

export type AgentRunPayload = {
  repositoryId: string;
  provider: string;
  model: string;
  prompt: string;
  featureId: string | null;
  taskIds: string[] | null;
  history: Array<{ role: "user" | "assistant"; content: string }>;
};

const STORAGE_KEY = "VelocityAI.agent.chats.v1";
// Mirror of the in-flight run so a reload can reconnect to it.
const ACTIVE_KEY = "VelocityAI.agent.activerun.v1";
const EMPTY: AgentChatState = { sessions: [], activeId: null, run: null };

const uid = () => Math.random().toString(36).slice(2);

let state: AgentChatState | null = null;
let abortController: AbortController | null = null;
const listeners = new Set<() => void>();

function load(): AgentChatState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return EMPTY;
    const saved = JSON.parse(raw) as Pick<AgentChatState, "sessions" | "activeId">;
    return { sessions: saved.sessions ?? [], activeId: saved.activeId ?? null, run: null };
  } catch {
    return EMPTY;
  }
}

function persist(next: AgentChatState) {
  const save = (sessions: ChatSession[]) =>
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ sessions, activeId: next.activeId }));
  try {
    save(next.sessions);
  } catch {
    // Quota exceeded (file contents can be large) — drop the oldest half of
    // the history and retry once; losing old chats beats losing the new one.
    try {
      save(next.sessions.slice(0, Math.max(1, Math.floor(next.sessions.length / 2))));
    } catch {
      /* storage unavailable — chats stay in-memory for this session */
    }
  }
}

function setState(next: AgentChatState, options?: { skipPersist?: boolean }) {
  state = next;
  if (!options?.skipPersist) persist(next);
  for (const listener of listeners) listener();
}

function getSnapshot(): AgentChatState {
  if (state === null) state = load();
  return state;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** React binding — re-renders on any chat/run change. */
export function useAgentChat(): AgentChatState {
  return useSyncExternalStore(subscribe, getSnapshot, () => EMPTY);
}

// ---------------------------------------------------------------------------
// Active-run mirror (for reload recovery)
// ---------------------------------------------------------------------------

type ActiveRun = {
  runId: string;
  sessionId: string;
  payload: AgentRunPayload;
  /** Best-effort snapshot of the JSON produced so far. */
  jsonText: string;
};

function saveActive(active: ActiveRun) {
  try {
    localStorage.setItem(ACTIVE_KEY, JSON.stringify(active));
  } catch {
    /* text can be large; a failed mirror just means no reload recovery */
  }
}

function clearActive() {
  try {
    localStorage.removeItem(ACTIVE_KEY);
  } catch {
    /* ignore */
  }
}

function loadActive(): ActiveRun | null {
  try {
    const raw = localStorage.getItem(ACTIVE_KEY);
    return raw ? (JSON.parse(raw) as ActiveRun) : null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Plan helpers
// ---------------------------------------------------------------------------

// Fill in whatever the stream didn't finish, so a partial run is still a
// readable (and, if it has files, raisable) message — used on success, on
// cancel, and to keep the generated content visible when a run errors out.
function normalizePlan(p: PartialAgentPlan): AgentPlan {
  return {
    intent: p.intent ?? "implement",
    title: p.title ?? "Untitled change",
    summary: p.summary ?? "",
    questions: (p.questions ?? []).filter((q): q is string => Boolean(q)),
    alreadyImplemented: (p.alreadyImplemented ?? []).filter((a): a is string => Boolean(a)),
    plan: (p.plan ?? []).filter((s): s is string => Boolean(s)),
    files: (p.files ?? []).flatMap((f) =>
      f?.path
        ? [
            {
              path: f.path,
              action: f.action === "modify" ? ("modify" as const) : ("create" as const),
              content: f.content ?? "",
              rationale: f.rationale ?? "",
            },
          ]
        : [],
    ),
    prDescription: p.prDescription ?? "",
    notes: p.notes ?? "",
  };
}

const planHasContent = (p: AgentPlan) =>
  Boolean(p.summary.trim() || p.questions.length > 0 || p.plan.length > 0 || p.files.length > 0);

function touchSession(sessions: ChatSession[], sessionId: string, mutate: (s: ChatSession) => ChatSession) {
  const updated = sessions.map((s) => (s.id === sessionId ? { ...mutate(s), updatedAt: Date.now() } : s));
  // Keep newest-activity-first ordering for the history list.
  return [...updated].sort((a, b) => b.updatedAt - a.updatedAt);
}

// ---------------------------------------------------------------------------
// Public store API
// ---------------------------------------------------------------------------

export const agentChatStore = {
  /** Start a fresh chat (persisted only once the first message is sent). */
  newChat() {
    const s = getSnapshot();
    if (s.run && s.activeId === null) return; // nothing to reset
    setState({ ...s, activeId: null });
  },

  selectChat(id: string) {
    const s = getSnapshot();
    if (s.sessions.some((session) => session.id === id)) setState({ ...s, activeId: id });
  },

  deleteChat(id: string) {
    const s = getSnapshot();
    if (s.run?.sessionId === id) {
      toast.error("That chat has a generation running — stop it first.");
      return;
    }
    setState({
      ...s,
      sessions: s.sessions.filter((session) => session.id !== id),
      activeId: s.activeId === id ? null : s.activeId,
    });
  },

  /** Attach the raised PR to its message so the card flips to "Open #N". */
  markMessagePr(
    sessionId: string,
    messageId: string,
    pr: { prUrl: string; prNumber: number; prBranch: string; prDraft: boolean },
  ) {
    const s = getSnapshot();
    setState({
      ...s,
      sessions: touchSession(s.sessions, sessionId, (session) => ({
        ...session,
        messages: session.messages.map((m) =>
          m.id === messageId && m.role === "assistant" ? { ...m, ...pr } : m,
        ),
      })),
    });
  },

  /** Stop the in-flight run; whatever streamed so far is kept as a message. */
  cancelRun() {
    abortController?.abort();
  },

  /**
   * Send a message and stream the reply. Creates the session if `sessionId`
   * is null. The whole run lives in this module — navigating away from the
   * Agent page does not interrupt it. Returns false if a run is already
   * in flight (one at a time).
   */
  startRun(sessionId: string | null, payload: AgentRunPayload): boolean {
    let s = getSnapshot();
    if (s.run) {
      toast.error("A generation is already running — stop it or wait for it to finish.");
      return false;
    }

    // Create the session on first message; title = the prompt.
    let targetId = sessionId;
    if (!targetId || !s.sessions.some((session) => session.id === targetId)) {
      targetId = uid();
      const now = Date.now();
      const session: ChatSession = {
        id: targetId,
        title: payload.prompt.slice(0, 60),
        createdAt: now,
        updatedAt: now,
        messages: [],
      };
      s = { ...s, sessions: [session, ...s.sessions], activeId: targetId };
    }

    const runSessionId = targetId;
    setState({
      ...s,
      sessions: touchSession(s.sessions, runSessionId, (session) => ({
        ...session,
        messages: [...session.messages, { id: uid(), role: "user", content: payload.prompt }],
      })),
      run: { sessionId: runSessionId, livePlan: {} },
    });

    abortController = new AbortController();
    void driveRun(runSessionId, payload, abortController.signal, {});
    return true;
  },
};

// ---------------------------------------------------------------------------
// Run driver
// ---------------------------------------------------------------------------

type Accumulator = {
  jsonText: string;
  latest: PartialAgentPlan;
  errorText: string | null;
  lastParsedAt: number;
};

type SegmentOutcome = "done" | "paused" | "error" | "cancelled";

/**
 * Read one streamed segment into the accumulator, returning how it ended.
 * The body is raw JSON text; a trailing ERROR/PAUSE sentinel (never valid
 * inside JSON) signals a failed or resumable end.
 */
async function readSegment(
  response: Response,
  acc: Accumulator,
  sessionId: string,
  onProgress: () => void,
  signal: AbortSignal,
): Promise<SegmentOutcome> {
  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  let paused = false;
  let inError = false;

  const parseLatest = async (force: boolean) => {
    const now = Date.now();
    if (!force && now - acc.lastParsedAt < 150) return;
    acc.lastParsedAt = now;
    const { value } = await parsePartialJson(acc.jsonText);
    if (value && typeof value === "object") {
      acc.latest = value as PartialAgentPlan;
      const s = getSnapshot();
      if (s.run?.sessionId === sessionId) {
        setState({ ...s, run: { sessionId, livePlan: acc.latest } }, { skipPersist: true });
      }
      onProgress();
    }
  };

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      const chunk = decoder.decode(value, { stream: true });

      if (inError) {
        acc.errorText = (acc.errorText ?? "") + chunk;
        continue;
      }
      const errIdx = chunk.indexOf(ERROR_SENTINEL);
      if (errIdx >= 0) {
        acc.jsonText += chunk.slice(0, errIdx);
        acc.errorText = (acc.errorText ?? "") + chunk.slice(errIdx + 1);
        inError = true;
        continue;
      }
      const pauseIdx = chunk.indexOf(PAUSE_SENTINEL);
      if (pauseIdx >= 0) {
        acc.jsonText += chunk.slice(0, pauseIdx);
        paused = true;
        await parseLatest(true);
        break;
      }
      acc.jsonText += chunk;
      await parseLatest(false);
    }
    await parseLatest(true);
  } catch {
    if (signal.aborted) return "cancelled";
    // A dropped connection mid-run is recoverable — treat it like a pause so we
    // reconnect via /continue rather than discarding the work.
    try {
      await parseLatest(true);
    } catch {
      /* keep whatever parsed last */
    }
    return "paused";
  }

  if (inError) return "error";
  return paused ? "paused" : "done";
}

/**
 * Drive a run to completion across however many resumable segments it takes.
 * `opts.runId` + `opts.initialText` resume an existing run (reload recovery);
 * omit them to start fresh.
 */
async function driveRun(
  sessionId: string,
  payload: AgentRunPayload,
  signal: AbortSignal,
  opts: { runId?: string; initialText?: string },
) {
  const acc: Accumulator = {
    jsonText: opts.initialText ?? "",
    latest: {},
    errorText: null,
    lastParsedAt: 0,
  };
  let runId = opts.runId ?? null;
  let mode: "start" | "continue" = opts.runId ? "continue" : "start";
  let cancelled = false;

  // Mirror to localStorage for reload recovery. Redis holds the authoritative
  // text, so the local jsonText copy is just a fallback — throttle it (it can be
  // large) but always force a save at segment boundaries.
  let lastMirrorAt = 0;
  const mirror = (force = false) => {
    if (!runId) return;
    const now = Date.now();
    if (!force && now - lastMirrorAt < 3000) return;
    lastMirrorAt = now;
    saveActive({ runId, sessionId, payload, jsonText: acc.jsonText });
  };

  const finish = () => {
    clearActive();
    const s = getSnapshot();
    const plan = normalizePlan(acc.latest);
    // Keep whatever was generated — a failed or cancelled run must never wipe
    // the output. The session may have been deleted meanwhile; then drop it.
    const sessions = planHasContent(plan)
      ? touchSession(s.sessions, sessionId, (session) => ({
          ...session,
          messages: [
            ...session.messages,
            {
              id: uid(),
              role: "assistant" as const,
              plan,
              featureId: payload.featureId,
              ...(cancelled ? { cancelled: true } : {}),
            },
          ],
        }))
      : s.sessions;
    setState({ ...s, sessions, run: null });
    abortController = null;
    if (cancelled) toast.info("Generation stopped — kept what was written so far.");
    else if (acc.errorText?.trim()) toast.error(acc.errorText.trim());
  };

  // Seed the live view from any recovered text.
  if (acc.jsonText) {
    try {
      const { value } = await parsePartialJson(acc.jsonText);
      if (value && typeof value === "object") {
        acc.latest = value as PartialAgentPlan;
        const s = getSnapshot();
        if (s.run?.sessionId === sessionId) {
          setState({ ...s, run: { sessionId, livePlan: acc.latest } }, { skipPersist: true });
        }
      }
    } catch {
      /* keep going — the segment will re-parse */
    }
  }

  for (;;) {
    if (signal.aborted) {
      cancelled = true;
      break;
    }

    let response: Response;
    try {
      const url =
        mode === "start" ? "/api/agent/stream" : "/api/agent/stream/continue";
      const body = mode === "start" ? payload : { ...payload, runId };
      response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal,
      });
    } catch {
      cancelled = signal.aborted;
      // A transient network failure on a run we already have an id for is
      // resumable on the next load; otherwise it's a hard failure.
      if (!cancelled && !runId) acc.errorText = "Network error — couldn't reach the agent.";
      break;
    }

    if (!response.ok || !response.body) {
      const err = (await response.json().catch(() => null)) as { error?: string } | null;
      acc.errorText = err?.error ?? "The agent run failed.";
      break;
    }

    const headerRunId = response.headers.get(RUN_ID_HEADER);
    if (headerRunId) runId = headerRunId;
    mirror(true);

    const outcome = await readSegment(response, acc, sessionId, () => mirror(), signal);
    mirror(true);

    if (outcome === "cancelled") {
      cancelled = true;
      break;
    }
    if (outcome === "error" || outcome === "done") {
      break;
    }
    // paused → continue the same run in another segment.
    if (!runId) {
      // No id to resume with — treat as a stop rather than loop forever.
      acc.errorText = acc.errorText ?? "The run was interrupted and can't be resumed.";
      break;
    }
    mode = "continue";
  }

  finish();
}

// ---------------------------------------------------------------------------
// Reload recovery
// ---------------------------------------------------------------------------

/**
 * On load, reconnect to a run that was interrupted by a reload/navigation.
 * Reads the server-side state: a `paused`/`running` run is resumed via the
 * continue loop; a `done` run is finalized from its stored text; an expired run
 * falls back to whatever text we mirrored locally so nothing visible is lost.
 */
async function resumeActiveRun() {
  const active = loadActive();
  if (!active) return;

  const s = getSnapshot();
  // Already have a live run, or the session is gone — nothing to reconnect to.
  if (s.run) return;
  if (!s.sessions.some((session) => session.id === active.sessionId)) {
    clearActive();
    return;
  }

  let status: string | undefined;
  let text = active.jsonText ?? "";
  try {
    const res = await fetch(`/api/agent/stream/status?runId=${encodeURIComponent(active.runId)}`);
    if (res.ok) {
      const data = (await res.json()) as { status?: string; text?: string };
      status = data.status;
      if (typeof data.text === "string" && data.text.length >= text.length) text = data.text;
    }
  } catch {
    // Couldn't reach the server — leave the mirror in place to retry next load.
    return;
  }

  if (status === undefined) return; // request failed softly; retry next load.

  if (status === "done" || status === "expired" || status === "error") {
    // Finalize from whatever text we have; no more generation is coming.
    clearActive();
    try {
      const { value } = await parsePartialJson(text);
      const plan = normalizePlan((value as PartialAgentPlan) ?? {});
      if (planHasContent(plan)) {
        const snap = getSnapshot();
        setState({
          ...snap,
          sessions: touchSession(snap.sessions, active.sessionId, (session) => ({
            ...session,
            messages: [
              ...session.messages,
              {
                id: uid(),
                role: "assistant" as const,
                plan,
                featureId: active.payload.featureId,
                ...(status === "done" ? {} : { cancelled: true }),
              },
            ],
          })),
        });
      }
    } catch {
      /* nothing parseable — drop it */
    }
    return;
  }

  // paused / running → resume the continue loop from the server's text.
  const snap = getSnapshot();
  setState({ ...snap, run: { sessionId: active.sessionId, livePlan: {} } });
  abortController = new AbortController();
  void driveRun(active.sessionId, active.payload, abortController.signal, {
    runId: active.runId,
    initialText: text,
  });
}

if (typeof window !== "undefined") {
  // Kick reload recovery once, after the module (and localStorage) are ready.
  queueMicrotask(() => {
    void resumeActiveRun();
  });
}

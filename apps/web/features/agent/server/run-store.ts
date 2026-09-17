import "server-only";

import { Redis } from "@upstash/redis";

/**
 * Redis-backed store for resumable agent runs.
 *
 * On the Vercel Hobby plan every serverless invocation is killed at 300s, so a
 * long generation can't live in a single request. This store lets a run survive
 * across invocations: each producer streams for a bounded budget, persists the
 * JSON text it produced, and marks the run `paused`; the client then resumes it
 * from a fresh invocation (see /api/agent/stream/continue). Only run status and
 * the generated JSON text live here — never API keys or repo context, which are
 * rebuilt server-side on every invocation.
 */

export type RunStatus = "running" | "paused" | "done" | "error";

export type RunState = {
  status: RunStatus;
  /** The accumulated JSON text produced so far, oldest-first. */
  text: string;
  /** Present only when status === "error". */
  error?: string;
  /** How many producer invocations have contributed — a runaway guard. */
  segments: number;
};

// Runs are short-lived working state; an hour is plenty and keeps Redis tidy
// even if a client vanishes mid-run.
const TTL_SECONDS = 60 * 60;

// Cap continuations so a stuck/looping model can't burn the user's BYOK quota
// forever. ~7 segments × ~270s ≈ 30 min of wall-clock generation.
export const MAX_SEGMENTS = 7;

let client: Redis | null = null;

function redis(): Redis {
  if (client) return client;
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token || url === "replace-me") {
    throw new Error("Upstash Redis is not configured (UPSTASH_REDIS_REST_URL / _TOKEN).");
  }
  client = new Redis({ url, token });
  return client;
}

/** True when Upstash is configured — lets callers degrade gracefully if not. */
export function runStoreAvailable(): boolean {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  return Boolean(url && token && url !== "replace-me");
}

const metaKey = (id: string) => `agent:run:${id}:meta`;
const textKey = (id: string) => `agent:run:${id}:text`;

type Meta = { status: RunStatus; error?: string; segments: number };

/** Create (or reset) a run as `running` with empty text. */
export async function createRun(id: string): Promise<void> {
  const r = redis();
  const meta: Meta = { status: "running", segments: 0 };
  await Promise.all([
    r.set(metaKey(id), meta, { ex: TTL_SECONDS }),
    r.set(textKey(id), "", { ex: TTL_SECONDS }),
  ]);
}

/** Append newly produced JSON text and keep the run alive. */
export async function appendText(id: string, delta: string): Promise<void> {
  if (!delta) return;
  const r = redis();
  await r.append(textKey(id), delta);
  await r.expire(textKey(id), TTL_SECONDS);
}

/** Mark a run's terminal (or paused) state. Increments the segment counter. */
export async function finalizeSegment(
  id: string,
  status: RunStatus,
  error?: string,
): Promise<void> {
  const r = redis();
  const prev = (await r.get<Meta>(metaKey(id))) ?? { status: "running", segments: 0 };
  const meta: Meta = {
    status,
    segments: prev.segments + 1,
    ...(error ? { error } : {}),
  };
  await r.set(metaKey(id), meta, { ex: TTL_SECONDS });
}

/** Flip a paused/errored run back to `running` for a continuation invocation. */
export async function markRunning(id: string): Promise<void> {
  const r = redis();
  const prev = await r.get<Meta>(metaKey(id));
  if (!prev) throw new Error("Run not found or expired.");
  await r.set(metaKey(id), { ...prev, status: "running", error: undefined }, { ex: TTL_SECONDS });
}

/** Read the full run state, or null if it never existed / expired. */
export async function getRun(id: string): Promise<RunState | null> {
  const r = redis();
  const [meta, text] = await Promise.all([
    r.get<Meta>(metaKey(id)),
    r.get<string>(textKey(id)),
  ]);
  if (!meta) return null;
  return {
    status: meta.status,
    text: text ?? "",
    error: meta.error,
    segments: meta.segments,
  };
}

/** Best-effort read of the segment count without the (larger) text payload. */
export async function getSegments(id: string): Promise<number> {
  const r = redis();
  const meta = await r.get<Meta>(metaKey(id));
  return meta?.segments ?? 0;
}

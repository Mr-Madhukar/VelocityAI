"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight, Check, Copy, Github, LayoutList, Loader2, Lock, Sparkles, Wand2 } from "lucide-react";
import { toast } from "sonner";

import { recommendedStacks } from "@repo/services/shipflow/tech-stacks";

import { Button } from "~/components/ui/button";
import { cn } from "~/lib/utils";
import { trpc } from "~/trpc/client";

// ── View toggle (Board | AI Prompts), mirrors PrdViewToggle ──────────────
export type TasksView = "board" | "prompts";

export function TasksViewToggle({
  view,
  onChange,
}: {
  view: TasksView;
  onChange: (v: TasksView) => void;
}) {
  const promptsActive = view === "prompts";
  return (
    <div className="inline-flex items-center gap-2">
      {/* Board — plain segmented button */}
      <button
        type="button"
        onClick={() => onChange("board")}
        aria-pressed={view === "board"}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors",
          view === "board"
            ? "border-primary/40 bg-primary text-primary-foreground shadow-sm"
            : "border-border bg-foreground/[0.03] text-muted-foreground hover:text-foreground",
        )}
      >
        <LayoutList className="size-3.5" />
        Board
      </button>

      {/* AI Prompts — deliberately highlighted with a pulsing neon border so it
          gets noticed. Solid primary when active, glowing amber when idle. */}
      <motion.button
        type="button"
        onClick={() => onChange("prompts")}
        aria-pressed={promptsActive}
        animate={
          promptsActive
            ? { boxShadow: "0 0 0 0 rgba(0,0,0,0)" }
            : {
                boxShadow: [
                  "0 0 0 1px rgba(251,191,36,0.55), 0 0 10px 1px rgba(251,191,36,0.25)",
                  "0 0 0 1px rgba(251,191,36,0.85), 0 0 16px 3px rgba(251,191,36,0.45)",
                  "0 0 0 1px rgba(251,191,36,0.55), 0 0 10px 1px rgba(251,191,36,0.25)",
                ],
              }
        }
        transition={{ duration: 2.2, repeat: promptsActive ? 0 : Infinity, ease: "easeInOut" }}
        className={cn(
          "relative inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors",
          promptsActive
            ? "border-primary/50 bg-primary text-primary-foreground shadow-sm"
            : "border-amber-400/70 bg-amber-400/[0.08] text-amber-600 dark:text-amber-300",
        )}
      >
        <Sparkles className="size-3.5" />
        AI Prompts
      </motion.button>
    </div>
  );
}

const normalizeStack = (raw: string): string => raw.trim().replace(/\s+/g, " ").toLowerCase();

function CopyButton({ text, label = "Copy" }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
      className="inline-flex items-center gap-1 border border-border px-2 py-1 font-mono text-[10px] uppercase tracking-wider text-muted-foreground transition-colors hover:text-foreground"
    >
      {copied ? <Check className="size-3" /> : <Copy className="size-3" />}
      {copied ? "Copied" : label}
    </button>
  );
}

export function ImplementationPromptsPanel({ featureId }: { featureId: string }) {
  const utils = trpc.useUtils();
  const [selectedStack, setSelectedStack] = useState("");
  const [customStack, setCustomStack] = useState("");
  const [staleDismissed, setStaleDismissed] = useState(false);
  const initializedRef = useRef(false);

  const { data, isLoading, isFetching } = trpc.prompts.getByFeature.useQuery(
    {
      featureId,
      techStack: selectedStack || undefined,
    },
    // Always refetch from the DB on mount so a generated set survives switching
    // tabs/views (the record is persisted server-side; don't serve a stale null).
    { staleTime: 0, refetchOnMount: true },
  );

  const { data: quota } = trpc.prompts.quota.useQuery({ featureId }, { staleTime: 0 });

  // Tech-stack presets scoped to the feature's disciplines: a frontend-only
  // feature shows only frontend frameworks, a backend-only feature only server
  // frameworks, etc. Falls back to the full-stack presets for legacy PRDs.
  const stackPresets = useMemo(() => recommendedStacks(data?.disciplines), [data?.disciplines]);

  // When a repo is connected the stack is authoritative — the prompt is
  // generated against the real codebase, so we lock it to the repo's detected
  // stack (falling back to the project stack while indexing finishes) and hide
  // the manual selector entirely.
  const repoConnected = Boolean(data?.repoConnected);
  const lockedStack = repoConnected
    ? data?.defaults.repoStack ?? data?.defaults.projectTechStack ?? stackPresets[0] ?? ""
    : null;

  // Seed the selected stack once. With a connected repo, lock to the detected
  // stack; otherwise use the project/repo defaults, else the first
  // discipline-appropriate preset.
  useEffect(() => {
    if (initializedRef.current || !data) return;
    initializedRef.current = true;
    setSelectedStack(
      lockedStack ??
        data.defaults.projectTechStack ??
        data.defaults.repoStack ??
        stackPresets[0] ??
        "",
    );
  }, [data, stackPresets, lockedStack]);

  // A cached stack (already generated) is a free switch — flag it on chips.
  const cachedStacks = useMemo(
    () => new Set((data?.availableStacks ?? []).map((s) => s)),
    [data?.availableStacks],
  );
  const isCached = (stack: string) => cachedStacks.has(normalizeStack(stack));

  const generate = trpc.prompts.generate.useMutation({
    onSuccess: () => {
      setStaleDismissed(false);
      void utils.prompts.getByFeature.invalidate({ featureId });
      void utils.prompts.quota.invalidate({ featureId });
    },
    onError: (error) => toast.error(error.message),
  });

  const record = data?.record ?? null;
  const stale = Boolean(data?.stale) && !staleDismissed;
  const generating = generate.isPending;
  const quotaBlocked = Boolean(quota && !quota.canGenerate);

  function runGenerate() {
    const stack = selectedStack.trim();
    if (!stack) {
      toast.error("Choose or enter a tech stack first.");
      return;
    }
    if (quotaBlocked) {
      toast.error(quota?.reason ?? "Prompt generation limit reached.");
      return;
    }
    generate.mutate({ featureId, techStack: stack });
  }

  function applyCustomStack() {
    const stack = customStack.trim();
    if (!stack) return;
    setSelectedStack(stack);
    setCustomStack("");
  }

  const selectedIsPreset = stackPresets.some(
    (p) => normalizeStack(p) === normalizeStack(selectedStack),
  );

  return (
    <div className="space-y-4">
      {/* Stack selector */}
      <div className="space-y-3 border border-border bg-card p-4">
        <div className="flex items-center justify-between">
          <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
            Tech stack
          </p>
          {isFetching && !isLoading ? (
            <Loader2 className="size-3.5 animate-spin text-muted-foreground" />
          ) : null}
        </div>

        {isLoading && !data ? (
          <div className="h-9 animate-pulse rounded-md border border-border bg-foreground/[0.03]" />
        ) : repoConnected ? (
          // Repo connected → stack is locked to the detected stack; no override.
          <div className="space-y-2">
            <div className="flex items-center gap-2 rounded-md border border-border bg-background px-3 py-2.5">
              <Lock className="size-3.5 shrink-0 text-muted-foreground" />
              <span className="min-w-0 flex-1 truncate text-sm text-foreground">
                {selectedStack || "Detecting your repository's stack…"}
              </span>
              <span className="shrink-0 font-mono text-[10px] uppercase tracking-wider text-success">
                From repo
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              {data?.defaults.repoStack
                ? "Locked to your connected repository's detected stack — prompts are generated against your real codebase."
                : "Analyzing your connected repository to detect its stack…"}
            </p>
          </div>
        ) : (
          <>
            {/* No repo connected → nudge the user to connect for sharper output. */}
            <Link
              href="/github"
              className="group flex items-start gap-3 rounded-md border border-dashed border-primary/30 bg-primary/[0.04] p-3 transition-colors hover:border-primary/50 hover:bg-primary/[0.07]"
            >
              <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-md border border-primary/30 bg-background text-primary">
                <Github className="size-4" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-1.5 text-sm font-medium text-foreground">
                  Connect a repository for sharper prompts
                  <ArrowRight className="size-3.5 text-primary transition-transform group-hover:translate-x-0.5" />
                </span>
                <span className="mt-0.5 block text-xs leading-5 text-muted-foreground">
                  Unlocks accurate tech-stack detection, better prompt generation, and full
                  codebase context.
                </span>
              </span>
            </Link>

            <div className="flex flex-wrap gap-2">
              {stackPresets.map((preset) => {
                const active = normalizeStack(preset) === normalizeStack(selectedStack);
                return (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setSelectedStack(preset)}
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs transition-colors",
                      active
                        ? "border-primary/40 bg-primary/10 text-primary"
                        : "border-border bg-background text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {preset}
                    {isCached(preset) ? (
                      <span
                        title="Already generated — instant"
                        className="size-1.5 rounded-full bg-success"
                      />
                    ) : null}
                  </button>
                );
              })}
            </div>

            {/* Custom stack */}
            <div className="flex items-center gap-2">
              <input
                value={customStack}
                onChange={(e) => setCustomStack(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    applyCustomStack();
                  }
                }}
                placeholder="Custom stack, e.g. SvelteKit + Drizzle + Turso"
                maxLength={120}
                className="h-9 flex-1 border border-border bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground/60 focus:border-foreground/30 focus:outline-none"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={applyCustomStack}
                disabled={!customStack.trim()}
                className="h-9 border-border bg-background px-3 text-foreground hover:bg-foreground/10"
              >
                Use
              </Button>
            </div>

            {!selectedIsPreset && selectedStack ? (
              <p className="text-xs text-muted-foreground">
                Selected stack:{" "}
                <span className="font-medium text-foreground">{selectedStack}</span>
              </p>
            ) : null}
          </>
        )}

        <div className="flex items-center justify-between gap-3 pt-1">
          <div className="min-w-0 space-y-1">
            <p className="text-xs text-muted-foreground">
              {record
                ? "The prompt is tailored to the selected stack and cached — switching to a generated stack is instant."
                : "Generate a copy-paste-ready prompt for an AI coding agent."}
            </p>
            {quota ? (
              <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                {quota.featureUsed}/{quota.featureLimit} for this feature ·{" "}
                {quota.periodLimit === -1
                  ? "unlimited"
                  : `${quota.periodUsed}/${quota.periodLimit}`}{" "}
                this month ({quota.planLabel})
              </p>
            ) : null}
          </div>
          <Button
            type="button"
            onClick={runGenerate}
            disabled={generating || !selectedStack.trim() || quotaBlocked}
            title={quotaBlocked ? quota?.reason ?? undefined : undefined}
            className="shrink-0 gap-2 bg-primary text-primary-foreground hover:bg-primary disabled:opacity-50"
          >
            {generating ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Wand2 className="size-4" />
            )}
            {record ? "Regenerate" : "Generate prompt"}
          </Button>
        </div>

        {quotaBlocked ? (
          <div className="flex items-center justify-between gap-3 border-l-2 border-amber-400/50 bg-amber-400/[0.06] px-3 py-2">
            <p className="text-xs text-amber-600 dark:text-amber-300">{quota?.reason}</p>
            <a
              href="/billing"
              className="shrink-0 font-mono text-[10px] uppercase tracking-wider text-primary underline-offset-2 hover:underline"
            >
              Upgrade →
            </a>
          </div>
        ) : null}
      </div>

      {/* Stale banner */}
      {stale ? (
        <div className="flex items-center justify-between gap-3 border-l-2 border-amber-400/50 bg-amber-400/[0.06] px-3 py-2">
          <p className="text-xs text-amber-600 dark:text-amber-300">
            These prompts were generated against an older PRD or task set. Regenerate to refresh
            them.
          </p>
          <button
            type="button"
            onClick={() => setStaleDismissed(true)}
            className="shrink-0 font-mono text-[10px] uppercase tracking-wider text-amber-600/80 hover:text-amber-600 dark:text-amber-300/80 dark:hover:text-amber-300"
          >
            Dismiss
          </button>
        </div>
      ) : null}

      {/* Body */}
      {isLoading ? (
        <div className="flex items-center justify-center border border-border bg-card py-16">
          <Loader2 className="size-5 animate-spin text-muted-foreground" />
        </div>
      ) : record ? (
        <div className="border border-border bg-card">
          <div className="flex items-center justify-between border-b border-border bg-background/50 px-3 py-2">
            <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
              Implementation prompt
            </span>
            <CopyButton text={record.combinedPrompt} />
          </div>
          {/* data-lenis-prevent lets the mouse wheel scroll this natively —
              without it Lenis hijacks the wheel and scrolls the page instead. */}
          <pre
            data-lenis-prevent
            className="max-h-[32rem] overflow-auto overscroll-contain whitespace-pre-wrap px-4 py-3 font-mono text-[11px] leading-relaxed text-foreground/90"
          >
            {record.combinedPrompt}
          </pre>
        </div>
      ) : (
        <div className="rounded-lg border border-foreground/10 bg-foreground/[0.045] p-10 text-center">
          <div className="flex flex-col items-center gap-4">
            <Sparkles className="size-6 text-primary" />
            <div className="space-y-1">
              <p className="text-sm text-foreground/80">
                No prompt generated for{" "}
                <span className="font-medium text-foreground">
                  {selectedStack || "this stack"}
                </span>{" "}
                yet.
              </p>
              <p className="text-xs text-muted-foreground">
                Generate one copy-paste-ready prompt covering the whole feature — tech stack,
                files, build steps, and acceptance criteria.
              </p>
            </div>
            <Button
              type="button"
              onClick={runGenerate}
              disabled={generating || !selectedStack.trim() || quotaBlocked}
              title={quotaBlocked ? quota?.reason ?? undefined : undefined}
              className="gap-2 bg-primary text-primary-foreground hover:bg-primary disabled:opacity-50"
            >
              {generating ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Wand2 className="size-4" />
              )}
              Generate prompt
            </Button>
            {quotaBlocked ? (
              <p className="text-xs text-amber-600 dark:text-amber-300">{quota?.reason}</p>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}

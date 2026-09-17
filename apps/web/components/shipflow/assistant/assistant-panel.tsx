"use client";

import { useEffect, useState, useTransition } from "react";
import {
  Check,
  Copy,
  GitBranch,
  GitPullRequestArrow,
  Loader2,
  RefreshCw,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";

import { useActiveProject } from "~/components/shipflow/project-context";
import { cn } from "~/lib/utils";
import { trpc } from "~/trpc/client";

import {
  generateImplementationAction,
  getRepoContextStatusAction,
  openDraftPrAction,
  refreshRepoContextAction,
} from "~/features/copilot/server/actions";
import type { CopilotPlan } from "~/features/copilot/server/agent";

type Mode = "build" | "fix" | "improve";

const MODES: { value: Mode; label: string; hint: string }[] = [
  { value: "build", label: "Build", hint: "Implement a new feature from a prompt or PRD" },
  { value: "fix", label: "Fix review", hint: "Fix the latest review's open findings" },
  { value: "improve", label: "Improve", hint: "Refactor / harden existing code" },
];

type ContextStatus =
  | { indexed: true; fileCount: number; stack: string; updatedAt: string }
  | { indexed: false }
  | null;

function CopyButton({ text }: { text: string }) {
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
      {copied ? "Copied" : "Copy"}
    </button>
  );
}

export function AssistantPanel({
  onGeneratingChange,
}: {
  onGeneratingChange?: (generating: boolean) => void;
}) {
  const { activeProjectId, ready, isLoading } = useActiveProject();

  const { data: repos = [] } = trpc.github.repositories.useQuery(
    { projectId: activeProjectId ?? undefined },
    { enabled: ready && !isLoading },
  );
  const { data: features = [] } = trpc.feature.list.useQuery(
    { projectId: activeProjectId ?? undefined },
    { enabled: ready && !isLoading },
  );

  const [repoId, setRepoId] = useState<string>("");
  const [featureId, setFeatureId] = useState<string>("");
  const [mode, setMode] = useState<Mode>("build");
  const [prompt, setPrompt] = useState("");
  const [status, setStatus] = useState<ContextStatus>(null);
  const [plan, setPlan] = useState<CopilotPlan | null>(null);

  const [indexing, startIndexing] = useTransition();
  const [generating, startGenerating] = useTransition();
  const [openingPr, startOpeningPr] = useTransition();

  // Surface the thinking state up to the launcher's animated face.
  useEffect(() => {
    onGeneratingChange?.(generating);
  }, [generating, onGeneratingChange]);

  useEffect(() => {
    if (!repoId && repos.length > 0) setRepoId(repos[0]!.id);
  }, [repos, repoId]);

  useEffect(() => {
    if (!repoId) return;
    setStatus(null);
    getRepoContextStatusAction(repoId).then(setStatus);
  }, [repoId]);

  function indexRepo() {
    if (!repoId) return;
    startIndexing(async () => {
      const result = await refreshRepoContextAction(repoId);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(`Indexed ${result.fileCount} files.`);
      setStatus(await getRepoContextStatusAction(repoId));
    });
  }

  function generate() {
    if (!repoId) {
      toast.error("Select a repository.");
      return;
    }
    setPlan(null);
    startGenerating(async () => {
      const result = await generateImplementationAction({
        repositoryId: repoId,
        prompt,
        mode,
        featureId: featureId || null,
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setPlan(result.plan);
    });
  }

  function openPr() {
    if (!plan || !repoId) return;
    startOpeningPr(async () => {
      const result = await openDraftPrAction({
        repositoryId: repoId,
        title: plan.title,
        body: `${plan.plan.map((s, i) => `${i + 1}. ${s}`).join("\n")}\n\n${plan.notes}`,
        files: plan.files.map((f) => ({ path: f.path, content: f.content })),
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(`Opened draft PR #${result.prNumber}`);
      window.open(result.prUrl, "_blank");
    });
  }

  const indexed = status?.indexed === true;

  if (repos.length === 0) {
    return (
      <div className="flex flex-col items-center gap-4 rounded-xl border border-border bg-background/50 p-8 text-center">
        <div className="grid size-12 place-items-center rounded-full border border-amber-400/30 bg-amber-400/10">
          <GitBranch className="size-5 text-amber-500 dark:text-amber-400" />
        </div>
        <div className="space-y-1.5">
          <p className="text-sm font-semibold text-foreground">Connect a GitHub repository</p>
          <p className="mx-auto max-w-sm text-xs leading-relaxed text-muted-foreground">
            Drafting a change needs a connected repo so the assistant can index your codebase for
            context and open a draft PR against it. No repositories are connected to this project
            yet.
          </p>
        </div>
        <a
          href="/github"
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-95"
        >
          <GitBranch className="size-4" />
          Connect GitHub
        </a>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Repo + feature */}
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1 block font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
            Repository
          </span>
          <select
            value={repoId}
            onChange={(e) => setRepoId(e.target.value)}
            className="w-full border border-border bg-background px-2.5 py-1.5 text-xs text-foreground focus:border-foreground/30 focus:outline-none"
          >
            {repos.map((r) => (
              <option key={r.id} value={r.id}>
                {r.fullName}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="mb-1 block font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
            Feature / PRD (optional)
          </span>
          <select
            value={featureId}
            onChange={(e) => setFeatureId(e.target.value)}
            className="w-full border border-border bg-background px-2.5 py-1.5 text-xs text-foreground focus:border-foreground/30 focus:outline-none"
          >
            <option value="">None — freeform</option>
            {features.map((f) => (
              <option key={f.id} value={f.id}>
                {f.title}
              </option>
            ))}
          </select>
        </label>
      </div>

      {/* Index status */}
      <div className="flex flex-wrap items-center justify-between gap-2 border border-border bg-background/50 px-2.5 py-1.5">
        <p className="text-[11px] text-muted-foreground">
          {status === null ? (
            "Checking index…"
          ) : indexed && status.indexed ? (
            <>
              Indexed · <span className="text-foreground">{status.fileCount} files</span> ·{" "}
              {status.stack}
            </>
          ) : (
            "Not indexed yet — build context first."
          )}
        </p>
        <button
          type="button"
          onClick={indexRepo}
          disabled={indexing}
          className="inline-flex items-center gap-1.5 border border-border px-2 py-1 font-mono text-[10px] uppercase tracking-wider text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50"
        >
          {indexing ? <Loader2 className="size-3 animate-spin" /> : <RefreshCw className="size-3" />}
          {indexed ? "Re-index" : "Index repo"}
        </button>
      </div>

      {/* Mode */}
      <div className="flex flex-wrap gap-1.5">
        {MODES.map((m) => (
          <button
            key={m.value}
            type="button"
            onClick={() => setMode(m.value)}
            title={m.hint}
            className={cn(
              "border px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider transition-colors",
              mode === m.value
                ? "border-primary/40 bg-primary/10 text-primary"
                : "border-border bg-background text-muted-foreground hover:text-foreground",
            )}
          >
            {m.label}
          </button>
        ))}
      </div>

      <textarea
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        rows={3}
        placeholder={
          mode === "fix"
            ? "Optionally add guidance — uses the linked feature's open review findings."
            : "e.g. Add a rate-limit guard to the PRD generation endpoint (5/min per org)."
        }
        className="w-full resize-y border border-border bg-background px-2.5 py-2 text-xs text-foreground placeholder:text-muted-foreground/60 focus:border-foreground/30 focus:outline-none"
      />

      <div className="flex items-center justify-between gap-2">
        {!indexed && status !== null ? (
          <p className="text-[11px] text-amber-500 dark:text-amber-400">Index the repo to enable generation.</p>
        ) : (
          <span />
        )}
        <button
          type="button"
          onClick={generate}
          disabled={generating || !indexed}
          className="inline-flex items-center gap-2 bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground transition-opacity hover:opacity-95 disabled:opacity-50"
        >
          {generating ? <Loader2 className="size-3.5 animate-spin" /> : <Sparkles className="size-3.5" />}
          Generate
        </button>
      </div>

      {/* Result */}
      {plan ? (
        <div className="space-y-3 border border-border bg-background/50 p-3">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <h3 className="text-xs font-semibold text-foreground">{plan.title}</h3>
              <p className="mt-0.5 font-mono text-[10px] text-muted-foreground">
                {plan.files.length} file{plan.files.length === 1 ? "" : "s"} proposed
              </p>
            </div>
            <button
              type="button"
              onClick={openPr}
              disabled={openingPr || plan.files.length === 0}
              className="inline-flex items-center gap-1.5 border border-border px-2.5 py-1 text-[11px] font-medium text-foreground transition-colors hover:border-foreground/30 disabled:opacity-50"
            >
              {openingPr ? (
                <Loader2 className="size-3 animate-spin" />
              ) : (
                <GitPullRequestArrow className="size-3" />
              )}
              Open draft PR
            </button>
          </div>

          <section>
            <h4 className="mb-1.5 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
              Plan
            </h4>
            <ol className="space-y-1">
              {plan.plan.map((step, i) => (
                <li key={i} className="flex gap-2 text-[11px] text-foreground/90">
                  <span className="font-mono text-[10px] text-primary">{i + 1}.</span>
                  {step}
                </li>
              ))}
            </ol>
          </section>

          <section className="space-y-2">
            <h4 className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
              Proposed changes
            </h4>
            {plan.files.map((file) => (
              <div key={file.path} className="border border-border">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border bg-background/50 px-2.5 py-1.5">
                  <div className="min-w-0">
                    <span
                      className={cn(
                        "mr-2 font-mono text-[10px] uppercase tracking-wider",
                        file.action === "create" ? "text-success" : "text-amber-500 dark:text-amber-400",
                      )}
                    >
                      {file.action}
                    </span>
                    <span className="font-mono text-[11px] text-foreground">{file.path}</span>
                  </div>
                  <CopyButton text={file.content} />
                </div>
                <pre className="max-h-64 overflow-auto px-2.5 py-2 font-mono text-[10px] leading-relaxed text-foreground/90">
                  {file.content}
                </pre>
              </div>
            ))}
          </section>

          {plan.notes ? (
            <section className="border-l-2 border-amber-400/40 bg-amber-400/[0.05] px-2.5 py-1.5">
              <h4 className="mb-1 font-mono text-[10px] uppercase tracking-wider text-amber-500 dark:text-amber-400">
                Notes
              </h4>
              <p className="whitespace-pre-line text-[11px] text-foreground/80">{plan.notes}</p>
            </section>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

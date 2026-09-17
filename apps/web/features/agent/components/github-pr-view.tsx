"use client";

import { useMemo, useState, type ReactNode } from "react";
import {
  CheckCircle2,
  ChevronDown,
  ExternalLink,
  FileDiff,
  GitCommitHorizontal,
  GitPullRequest,
  GitPullRequestDraft,
  Loader2,
  MessageSquare,
} from "lucide-react";

import { cn } from "~/lib/utils";

/** Partial-tolerant file shape — while streaming, any field may be missing. */
export type PrViewFile = {
  path?: string;
  action?: "create" | "modify";
  content?: string;
  rationale?: string;
};

export type GithubPrViewProps = {
  title?: string;
  /** PR body (markdown source — rendered as plain text, GitHub-comment style). */
  body?: string;
  files: PrViewFile[];
  repoFullName?: string;
  baseBranch: string;
  /** Real branch once the PR is raised; a preview slug before that. */
  headBranch: string;
  authorName?: string;
  /** Raised PR metadata — absent while the change set is still a preview. */
  prNumber?: number;
  prUrl?: string;
  draft?: boolean;
  /** True while the plan is still streaming from the model. */
  streaming?: boolean;
  /** Rendered on the header's right side (e.g. the Raise PR button). */
  actions?: ReactNode;
};

export function BranchChip({ name }: { name: string }) {
  return (
    <span className="rounded-md bg-primary/10 px-1.5 py-0.5 font-mono text-[11px] font-medium text-primary">
      {name}
    </span>
  );
}

function StateBadge({
  prNumber,
  draft,
  streaming,
}: {
  prNumber?: number;
  draft?: boolean;
  streaming?: boolean;
}) {
  if (prNumber) {
    return draft ? (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-foreground/10 px-3 py-1 text-xs font-semibold text-foreground/70">
        <GitPullRequestDraft className="size-3.5" /> Draft
      </span>
    ) : (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-success px-3 py-1 text-xs font-semibold text-white">
        <GitPullRequest className="size-3.5" /> Open
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-foreground/15 bg-foreground/[0.03] px-3 py-1 text-xs font-semibold text-muted-foreground">
      {streaming ? <Loader2 className="size-3.5 animate-spin" /> : <FileDiff className="size-3.5" />}
      Preview
    </span>
  );
}

function FileDiffCard({ file, streaming }: { file: PrViewFile; streaming?: boolean }) {
  const [open, setOpen] = useState(true);
  const lines = useMemo(() => (file.content ?? "").split("\n"), [file.content]);
  const isCreate = file.action !== "modify";

  return (
    <div className="overflow-hidden rounded-lg border border-border">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2 border-border bg-foreground/[0.03] px-3 py-2 text-left"
      >
        <ChevronDown
          className={cn("size-3.5 shrink-0 text-muted-foreground transition-transform", !open && "-rotate-90")}
        />
        <span className="min-w-0 flex-1 truncate font-mono text-xs font-medium text-foreground">
          {file.path ?? "…"}
        </span>
        {streaming && (
          <span className="inline-flex items-center gap-1 text-[10px] text-primary">
            <Loader2 className="size-3 animate-spin" /> writing
          </span>
        )}
        <span className="shrink-0 font-mono text-[11px] font-semibold text-success">
          +{lines.length}
        </span>
        <span
          className={cn(
            "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
            isCreate ? "bg-success/10 text-success" : "bg-amber-500/10 text-amber-600 dark:text-amber-400",
          )}
        >
          {isCreate ? "added" : "modified"}
        </span>
      </button>

      {open && (
        <div
          className="no-scrollbar max-h-96 overflow-auto border-t border-border font-mono text-[11px] leading-5"
          data-lenis-prevent
        >
          <table className="w-full border-collapse">
            <tbody>
              {lines.map((line, i) => (
                <tr key={i} className={isCreate ? "bg-success/[0.07]" : undefined}>
                  <td
                    className={cn(
                      "w-10 select-none border-r px-2 text-right align-top",
                      isCreate
                        ? "border-success/15 bg-success/10 text-success/70"
                        : "border-border bg-foreground/[0.03] text-muted-foreground",
                    )}
                  >
                    {i + 1}
                  </td>
                  <td className="whitespace-pre px-2 text-foreground/85">
                    {isCreate && <span className="mr-1.5 select-none text-success">+</span>}
                    {line}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/**
 * A GitHub-pull-request-page replica for an agent change set: title + state
 * header, merge-direction line, Conversation / Files changed tabs, and
 * per-file diff-styled viewers. Tolerates partial data while streaming.
 */
export function GithubPrView({
  title,
  body,
  files,
  repoFullName,
  baseBranch,
  headBranch,
  authorName,
  prNumber,
  prUrl,
  draft,
  streaming,
  actions,
}: GithubPrViewProps) {
  const [tab, setTab] = useState<"conversation" | "files">("files");
  const visibleFiles = files.filter((f): f is PrViewFile => Boolean(f?.path));
  const totalAdded = visibleFiles.reduce((n, f) => n + (f.content ? f.content.split("\n").length : 0), 0);

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      {/* Header — title, state, merge direction */}
      <div className="border-b border-border px-4 pt-3.5">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <h3 className="min-w-0 text-base font-semibold leading-6 text-foreground">
            {title || (streaming ? "Drafting the change…" : "Untitled change")}
            {prNumber && <span className="ml-1.5 font-normal text-muted-foreground">#{prNumber}</span>}
          </h3>
          <div className="flex shrink-0 items-center gap-2">{actions}</div>
        </div>

        <div className="mt-1.5 flex flex-wrap items-center gap-2">
          <StateBadge prNumber={prNumber} draft={draft} streaming={streaming} />
          <p className="flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
            {authorName ?? "Agent"} wants to merge{" "}
            <GitCommitHorizontal className="size-3.5" /> 1 commit into <BranchChip name={baseBranch} />{" "}
            from <BranchChip name={headBranch} />
          </p>
          {prUrl && (
            <a
              href={prUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
            >
              View on GitHub <ExternalLink className="size-3" />
            </a>
          )}
        </div>

        {/* Tabs */}
        <div className="mt-3 flex items-center gap-1 text-sm">
          {(
            [
              { id: "conversation", label: "Conversation", icon: MessageSquare, count: null },
              { id: "files", label: "Files changed", icon: FileDiff, count: visibleFiles.length },
            ] as const
          ).map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-t-lg border-b-2 px-3 py-2 text-xs transition",
                tab === t.id
                  ? "border-primary font-semibold text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground/80",
              )}
            >
              <t.icon className="size-3.5" />
              {t.label}
              {t.count !== null && (
                <span className="rounded-full bg-foreground/10 px-1.5 py-0.5 text-[10px] font-semibold">
                  {t.count}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {tab === "conversation" ? (
        <div className="p-4">
          {/* GitHub-style first comment: the PR description */}
          <div className="overflow-hidden rounded-lg border border-border">
            <div className="flex items-center gap-2 border-b border-border bg-foreground/[0.03] px-3 py-2">
              <span className="grid size-5 place-items-center rounded-full bg-primary/15 text-[10px] font-bold text-primary">
                {(authorName ?? "A").slice(0, 1).toUpperCase()}
              </span>
              <p className="text-xs text-foreground/80">
                <span className="font-semibold">{authorName ?? "Agent"}</span>{" "}
                <span className="text-muted-foreground">
                  {prNumber ? "commented" : "will open this pull request"}
                  {repoFullName ? ` · ${repoFullName}` : ""}
                </span>
              </p>
            </div>
            <div className="no-scrollbar max-h-96 overflow-auto px-3.5 py-3" data-lenis-prevent>
              <p className="whitespace-pre-wrap text-sm leading-6 text-foreground/90">
                {body || (streaming ? "Writing the PR description…" : "No description yet.")}
              </p>
            </div>
          </div>
          {prNumber && (
            <p className="mt-3 inline-flex items-center gap-1.5 text-xs text-success">
              <CheckCircle2 className="size-3.5" /> Pull request #{prNumber} opened on GitHub.
            </p>
          )}
        </div>
      ) : (
        <div className="space-y-3 p-4">
          <p className="text-xs text-muted-foreground">
            <span className="font-semibold text-foreground/80">{visibleFiles.length}</span> file
            {visibleFiles.length === 1 ? "" : "s"} changed{" "}
            <span className="font-mono font-semibold text-success">+{totalAdded}</span>
          </p>
          {visibleFiles.map((f, i) => (
            <FileDiffCard
              key={f.path ?? i}
              file={f}
              streaming={streaming && i === visibleFiles.length - 1}
            />
          ))}
          {visibleFiles.length === 0 && (
            <p className="py-6 text-center text-xs text-muted-foreground">
              {streaming ? "The agent hasn't written any files yet…" : "No file changes."}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

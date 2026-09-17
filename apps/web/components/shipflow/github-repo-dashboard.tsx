"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ExternalLink,
  GitBranch,
  GitCommitHorizontal,
  GitMerge,
  GitPullRequest,
  GitPullRequestClosed,
  Link2,
  Loader2,
  RefreshCw,
  Sparkles,
  Star,
  GitFork,
  CircleDot,
  Eye,
  Users,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { cn } from "~/lib/utils";
import { trpc } from "~/trpc/client";
import {
  getRepoOverview,
  listRepoCommits,
  listRepoContributors,
  syncRepoPullRequests,
  triggerPrReview,
  type RepoCommit,
  type RepoContributor,
  type RepoOverview,
} from "@/features/github/actions";
import {
  getRepoAiSummaryAction,
  refreshRepoContextAction,
} from "@/features/copilot/server/actions";

export type ConnectedRepo = {
  /** Our repository row id — needed for the AI repo summary (repo_context). */
  id?: string | null;
  fullName: string;
  name: string;
  installationId: number | null;
  defaultBranch: string | null;
  projectId?: string | null;
};

function timeAgo(value: string | Date | null) {
  if (!value) return "";
  const d = new Date(value);
  const diff = Date.now() - d.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return d.toLocaleDateString("en-IN");
}

function StatPill({
  icon,
  label,
  value,
  href,
}: {
  icon: React.ReactNode;
  label: string;
  value: number | string;
  href?: string;
}) {
  const inner = (
    <>
      <div className="text-muted-foreground transition-colors group-hover:text-primary">{icon}</div>
      <div>
        <p className="text-lg font-semibold text-foreground">{value}</p>
        <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
      </div>
    </>
  );

  const base =
    "group flex items-center gap-3 rounded-xl border border-foreground/10 bg-foreground/[0.03] px-4 py-3";

  if (href) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noreferrer"
        className={cn(base, "cursor-pointer transition hover:border-primary/30 hover:bg-foreground/[0.06]")}
        title={`Open ${label.toLowerCase()} on GitHub`}
      >
        {inner}
      </a>
    );
  }

  return <div className={base}>{inner}</div>;
}

function ReviewBadge({ review }: { review: { status: string; overallVerdict: string | null; prdComplianceScore: number | null } | null }) {
  if (!review) {
    return <span className="rounded-full border border-foreground/10 bg-foreground/5 px-2 py-0.5 text-[11px] text-muted-foreground">No review</span>;
  }
  if (review.status === "running") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-primary/20 bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
        <Loader2 className="size-3 animate-spin" /> Reviewing
      </span>
    );
  }
  if (review.overallVerdict === "approve") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-success/20 bg-success/10 px-2 py-0.5 text-[11px] font-medium text-success">
        <CheckCircle2 className="size-3" /> Approved{review.prdComplianceScore != null ? ` · ${review.prdComplianceScore}` : ""}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-destructive/30 bg-destructive/10 px-2 py-0.5 text-[11px] font-medium text-destructive">
      <XCircle className="size-3" /> Changes{review.prdComplianceScore != null ? ` · ${review.prdComplianceScore}` : ""}
    </span>
  );
}

function PrStateBadge({ state }: { state: string }) {
  if (state === "merged") {
    return <span className="inline-flex items-center gap-1 rounded-full bg-purple-500/15 px-2 py-0.5 text-[11px] font-medium text-purple-600 dark:text-purple-300"><GitMerge className="size-3" />Merged</span>;
  }
  if (state === "closed") {
    return <span className="inline-flex items-center gap-1 rounded-full bg-destructive/15 px-2 py-0.5 text-[11px] font-medium text-destructive"><GitPullRequestClosed className="size-3" />Closed</span>;
  }
  return <span className="inline-flex items-center gap-1 rounded-full bg-success/15 px-2 py-0.5 text-[11px] font-medium text-success"><GitPullRequest className="size-3" />Open</span>;
}

function Shimmer() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="h-16 animate-pulse rounded-xl border border-foreground/10 bg-foreground/[0.03]" />
      ))}
    </div>
  );
}

type AiSummary =
  | { indexed: false }
  | {
      indexed: true;
      overview: string;
      stack: string;
      fileCount: number;
      keyFiles: Array<{ path: string; summary: string }>;
      updatedAt: string;
    };

/**
 * AI-generated summary of the repository (from the stored repo_context
 * snapshot). Built automatically on connect; refreshable on demand.
 */
function AiSummaryCard({ repositoryId }: { repositoryId: string }) {
  const [summary, setSummary] = useState<AiSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [building, setBuilding] = useState(false);
  const [showFiles, setShowFiles] = useState(false);

  async function load() {
    const res = await getRepoAiSummaryAction(repositoryId);
    setSummary(res);
    setLoading(false);
  }

  useEffect(() => {
    setLoading(true);
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [repositoryId]);

  async function handleBuild() {
    setBuilding(true);
    const res = await refreshRepoContextAction(repositoryId);
    setBuilding(false);
    if (res.ok) {
      toast.success(`Repository analyzed — ${res.fileCount} source files indexed`);
      await load();
    } else {
      toast.error(res.error);
    }
  }

  const indexed = summary?.indexed === true ? summary : null;

  return (
    <div className="relative overflow-hidden rounded-xl border border-primary/15 bg-gradient-to-br from-primary/[0.06] via-transparent to-transparent p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="inline-flex items-center gap-2 text-sm font-semibold text-foreground">
          <Sparkles className="size-4 text-primary" />
          AI repository summary
        </h3>
        <div className="flex items-center gap-2">
          {indexed && (
            <span className="text-[11px] text-muted-foreground">
              {indexed.fileCount} files · updated {timeAgo(indexed.updatedAt)}
            </span>
          )}
          <button
            type="button"
            onClick={handleBuild}
            disabled={building}
            className="inline-flex items-center gap-1.5 rounded-lg border border-primary/20 bg-primary/10 px-2.5 py-1.5 text-xs font-medium text-primary transition hover:bg-primary/20 disabled:opacity-50"
          >
            {building ? <Loader2 className="size-3.5 animate-spin" /> : <RefreshCw className="size-3.5" />}
            {indexed ? "Refresh" : "Generate summary"}
          </button>
        </div>
      </div>

      {loading ? (
        <div className="mt-3 space-y-2">
          <div className="h-3.5 w-4/5 animate-pulse rounded bg-foreground/10" />
          <div className="h-3.5 w-3/5 animate-pulse rounded bg-foreground/10" />
        </div>
      ) : building ? (
        <p className="mt-3 text-sm text-muted-foreground">
          Reading the repository and generating a summary — this can take a minute…
        </p>
      ) : !indexed ? (
        <p className="mt-3 text-sm text-muted-foreground">
          No summary yet. Generate one to get an AI overview of what this codebase is, its stack,
          and what its key files do — it also powers the coding Agent&apos;s repo context.
        </p>
      ) : (
        <div className="mt-3 space-y-3">
          <p className="text-sm leading-6 text-foreground/85">{indexed.overview}</p>
          {indexed.stack && (
            <p className="text-xs text-muted-foreground">
              <span className="font-medium text-foreground/70">Stack:</span> {indexed.stack}
            </p>
          )}
          {indexed.keyFiles.length > 0 && (
            <div>
              <button
                type="button"
                onClick={() => setShowFiles((v) => !v)}
                className="inline-flex items-center gap-1 text-xs font-medium text-primary transition hover:underline"
              >
                {showFiles ? "Hide key files" : `Key files (${indexed.keyFiles.length})`}
              </button>
              {showFiles && (
                <ul className="mt-2 space-y-1.5">
                  {indexed.keyFiles.map((f) => (
                    <li key={f.path} className="text-xs text-muted-foreground">
                      <span className="font-mono text-foreground/75">{f.path}</span> — {f.summary}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

type Pr = {
  id: string;
  number: number;
  title: string;
  url: string;
  authorLogin: string | null;
  headBranch: string;
  baseBranch: string;
  state: string;
  featureId: string | null;
  headSha: string;
  reviewedCurrentCommit: boolean;
  updatedAt: string | Date | null;
  review: { status: string; overallVerdict: string | null; prdComplianceScore: number | null } | null;
};

function PrRow({
  pr,
  features,
  onChanged,
}: {
  pr: Pr;
  features: Array<{ id: string; title: string }>;
  onChanged: () => void;
}) {
  const [reviewing, setReviewing] = useState(false);
  const [linking, setLinking] = useState(false);
  const [selectedFeatureId, setSelectedFeatureId] = useState<string>(features[0]?.id ?? "");

  // Features load asynchronously — default the picker once they arrive.
  useEffect(() => {
    if (!selectedFeatureId && features.length > 0) {
      setSelectedFeatureId(features[0]!.id);
    }
  }, [features, selectedFeatureId]);

  const linkToFeature = trpc.github.linkPullRequestToFeature.useMutation({
    onSuccess: async () => {
      setLinking(false);
      onChanged();
      if (pr.state !== "open") {
        toast.success("Pull request linked to feature.");
        return;
      }
      // Freshly linked → review against the feature's latest PRD right away.
      toast.success("Pull request linked — reviewing against the latest PRD…");
      setReviewing(true);
      const res = await triggerPrReview(pr.id, { force: true });
      setReviewing(false);
      if (res.ok) {
        toast.success(
          res.status === "passed"
            ? "Review complete — approved"
            : "Review complete — changes requested",
        );
      } else {
        toast.error(res.error ?? "Review failed");
      }
      onChanged();
    },
    onError: (error) => toast.error(error.message),
  });

  const isOpen = pr.state === "open";
  // A review already covers the current commit — offer to view it, not re-run.
  const reviewedCurrent = pr.reviewedCurrentCommit && Boolean(pr.review);

  async function handleRunReview() {
    setReviewing(true);
    const res = await triggerPrReview(pr.id);
    setReviewing(false);
    if (res.ok) {
      if (res.reused) {
        toast.info("No new commits — showing the existing review.");
      } else {
        toast.success(res.status === "passed" ? "Review complete — approved" : "Review complete — changes requested");
      }
      onChanged();
    } else {
      toast.error(res.error ?? "Review failed");
    }
  }

  function handleLink() {
    if (!selectedFeatureId) {
      toast.error("Pick a feature first");
      return;
    }
    linkToFeature.mutate({ pullRequestId: pr.id, featureId: selectedFeatureId });
  }

  return (
    <div className="px-5 py-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <a href={pr.url} target="_blank" rel="noreferrer" className="truncate text-sm font-medium text-foreground hover:text-primary">
              #{pr.number} {pr.title}
            </a>
            <PrStateBadge state={pr.state} />
            {pr.featureId ? (
              <span
                className="inline-flex max-w-[220px] items-center gap-1 truncate rounded-full border border-primary/25 bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary"
                title="Linked feature"
              >
                <Link2 className="size-3 shrink-0" />
                <span className="truncate">
                  {features.find((f) => f.id === pr.featureId)?.title ?? "Linked feature"}
                </span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[11px] font-medium text-amber-700 dark:text-amber-300">
                Not linked
              </span>
            )}
          </div>
          <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            {pr.authorLogin && <span>@{pr.authorLogin}</span>}
            <span className="inline-flex items-center gap-1 font-mono">
              <GitBranch className="size-3" />
              {pr.headBranch} → {pr.baseBranch}
            </span>
            <span>· {timeAgo(pr.updatedAt)}</span>
          </p>
        </div>
        <ReviewBadge
          review={
            reviewing
              ? { status: "running", overallVerdict: null, prdComplianceScore: null }
              : pr.review
          }
        />
        {pr.featureId && (
          <Link
            href={`/features/${pr.featureId}?tab=review-history`}
            className="inline-flex items-center gap-1 rounded-lg border border-primary/20 bg-primary/10 px-2.5 py-1 text-[11px] font-medium text-primary transition hover:bg-primary/20"
          >
            View review
          </Link>
        )}
      </div>

      {/* Actions */}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {isOpen &&
          (reviewedCurrent ? (
            <a
              href={pr.url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-primary/20 bg-primary/10 px-2.5 py-1.5 text-xs font-medium text-primary transition hover:bg-primary/20"
              title="This commit was already reviewed — view the existing review"
            >
              <Sparkles className="size-3.5" />
              View review on GitHub
            </a>
          ) : (
            <button
              type="button"
              onClick={handleRunReview}
              disabled={reviewing}
              className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-primary/20 bg-primary/10 px-2.5 py-1.5 text-xs font-medium text-primary transition hover:bg-primary/20 disabled:opacity-50"
            >
              {reviewing ? <Loader2 className="size-3.5 animate-spin" /> : <Sparkles className="size-3.5" />}
              {pr.review ? "Re-run review" : "Run review"}
            </button>
          ))}

        {isOpen && (
          <button
            type="button"
            onClick={() => setLinking((v) => !v)}
            className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-foreground/10 bg-foreground/5 px-2.5 py-1.5 text-xs text-foreground/80 transition hover:bg-foreground/10"
          >
            <Link2 className="size-3.5" />
            {pr.featureId ? "Change feature" : "Link to feature"}
          </button>
        )}

        <a
          href={pr.url}
          target="_blank"
          rel="noreferrer"
          className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-foreground/10 bg-foreground/5 px-2.5 py-1.5 text-xs text-foreground/80 transition hover:bg-foreground/10"
        >
          <ExternalLink className="size-3.5" />
          Open in GitHub
        </a>
      </div>

      {linking && (
        <div className="mt-3 rounded-lg border border-foreground/10 bg-foreground/[0.03] p-3">
          <p className="mb-2 text-xs text-muted-foreground">
            Link this PR to a feature. Its review history attaches to the feature and future commits stay linked — no branch rename needed.
          </p>
          {pr.featureId ? (
            <p className="mb-2 rounded-md border border-amber-500/30 bg-amber-500/10 px-2.5 py-1.5 text-xs text-amber-700 dark:text-amber-300">
              This PR is already linked to a feature. Relinking moves its review history to the
              new feature (the old feature loses these reviews) and re-runs the review against
              the new feature&apos;s latest PRD.
            </p>
          ) : null}
          {features.length === 0 ? (
            <p className="text-xs text-amber-700 dark:text-amber-300">No features available in this organization yet.</p>
          ) : (
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={selectedFeatureId}
                onChange={(e) => setSelectedFeatureId(e.target.value)}
                className="max-w-[260px] flex-1 cursor-pointer rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs text-foreground outline-none focus:border-primary/40"
              >
                {features.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.title}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={handleLink}
                disabled={linkToFeature.isPending}
                className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-primary px-2.5 py-1.5 text-xs font-semibold text-primary-foreground transition hover:bg-primary disabled:opacity-50"
              >
                {linkToFeature.isPending && <Loader2 className="size-3.5 animate-spin" />}
                Link
              </button>
              <button
                type="button"
                onClick={() => setLinking(false)}
                className="cursor-pointer rounded-lg border border-foreground/10 px-2.5 py-1.5 text-xs text-muted-foreground transition hover:bg-foreground/5"
              >
                Cancel
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function GithubRepoDashboard({ repo, onBack }: { repo: ConnectedRepo; onBack: () => void }) {
  const utils = trpc.useUtils();
  const [overview, setOverview] = useState<RepoOverview | null>(null);
  const [commits, setCommits] = useState<RepoCommit[]>([]);
  const [contributors, setContributors] = useState<RepoContributor[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);

  const prsQuery = trpc.github.pullRequestsByRepo.useQuery({ repoFullName: repo.fullName });
  const prs = prsQuery.data ?? [];
  // Counts come straight from GitHub (getRepoOverview already separates PRs
  // from open_issues_count), so they're right even if our PR sync lags — the
  // old DB-derived subtraction showed PRs as "issues" whenever sync missed.
  const openIssuesOnly = overview?.openIssues ?? 0;
  const openPrCount = overview?.openPrs ?? prs.filter((p) => p.state === "open").length;

  // Features for the branch-rename picker (scoped to the repo's project when known).
  const featuresQuery = trpc.feature.list.useQuery(
    repo.projectId ? { projectId: repo.projectId } : {},
  );
  const features = (featuresQuery.data ?? []).map((f) => ({ id: f.id, title: f.title }));

  const refreshPrs = () => utils.github.pullRequestsByRepo.invalidate({ repoFullName: repo.fullName });

  async function load(showToast = false) {
    if (!repo.installationId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const [ov, co, cn] = await Promise.all([
      getRepoOverview(repo.installationId, repo.fullName),
      listRepoCommits(repo.installationId, repo.fullName),
      listRepoContributors(repo.installationId, repo.fullName),
      syncRepoPullRequests(repo.installationId, repo.fullName),
    ]);
    setOverview(ov);
    setCommits(co);
    setContributors(cn);
    await utils.github.pullRequestsByRepo.invalidate({ repoFullName: repo.fullName });
    setLoading(false);
    if (showToast) toast.success("Repository synced");
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [repo.fullName, repo.installationId]);

  async function handleSync() {
    setSyncing(true);
    await load(true);
    setSyncing(false);
  }

  return (
    <div className="mt-6 max-w-5xl space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onBack}
            className="grid size-9 place-items-center rounded-lg border border-foreground/10 bg-foreground/5 text-muted-foreground transition hover:bg-foreground/10 hover:text-foreground"
          >
            <ArrowLeft className="size-4" />
          </button>
          <div>
            <h2 className="text-lg font-semibold text-foreground">{repo.fullName}</h2>
            <p className="text-xs text-muted-foreground">
              {overview?.private ? "Private" : "Public"} · default {overview?.defaultBranch ?? repo.defaultBranch ?? "main"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleSync}
            disabled={syncing}
            className="inline-flex items-center gap-1.5 rounded-lg border border-foreground/10 bg-foreground/5 px-3 py-1.5 text-xs text-foreground/80 transition hover:bg-foreground/10 disabled:opacity-50"
          >
            <RefreshCw className={cn("size-3.5", syncing && "animate-spin")} />
            Sync
          </button>
          {overview && (
            <a
              href={overview.htmlUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 rounded-lg border border-foreground/10 bg-foreground/5 px-3 py-1.5 text-xs text-foreground/80 transition hover:bg-foreground/10"
            >
              <ExternalLink className="size-3.5" />
              Open on GitHub
            </a>
          )}
        </div>
      </div>

      <Tabs defaultValue="overview" className="gap-5">
        <TabsList className="h-auto flex-wrap justify-start rounded-lg border border-foreground/10 bg-foreground/[0.045] p-1">
          <TabsTrigger value="overview" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">Overview</TabsTrigger>
          <TabsTrigger value="prs" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">Pull Requests ({prs.length})</TabsTrigger>
          <TabsTrigger value="commits" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">Commits</TabsTrigger>
          <TabsTrigger value="contributors" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">Contributors</TabsTrigger>
        </TabsList>

        {/* Overview */}
        <TabsContent value="overview">
          {loading ? (
            <Shimmer />
          ) : !overview ? (
            <p className="rounded-xl border border-foreground/10 bg-foreground/[0.03] p-8 text-center text-sm text-muted-foreground">
              Couldn&apos;t load repository details. Try syncing.
            </p>
          ) : (
            <div className="space-y-5">
              {repo.id && <AiSummaryCard repositoryId={repo.id} />}
              {overview.description && <p className="text-sm leading-6 text-foreground/80">{overview.description}</p>}
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                <StatPill icon={<Star className="size-5" />} label="Stars" value={overview.stars} href={`${overview.htmlUrl}/stargazers`} />
                <StatPill icon={<GitFork className="size-5" />} label="Forks" value={overview.forks} href={`${overview.htmlUrl}/forks`} />
                <StatPill icon={<CircleDot className="size-5" />} label="Open issues" value={openIssuesOnly} href={`${overview.htmlUrl}/issues`} />
                <StatPill icon={<GitPullRequest className="size-5" />} label="Open PRs" value={openPrCount} href={`${overview.htmlUrl}/pulls`} />
                <StatPill icon={<Eye className="size-5" />} label="Watchers" value={overview.watchers} href={`${overview.htmlUrl}/watchers`} />
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-xl border border-foreground/10 bg-foreground/[0.03] p-4">
                  <p className="text-xs text-muted-foreground">Language</p>
                  <p className="mt-1 text-sm font-medium text-foreground">{overview.language ?? "—"}</p>
                </div>
                <div className="rounded-xl border border-foreground/10 bg-foreground/[0.03] p-4">
                  <p className="text-xs text-muted-foreground">Default branch</p>
                  <p className="mt-1 font-mono text-sm font-medium text-foreground">{overview.defaultBranch}</p>
                </div>
                <div className="rounded-xl border border-foreground/10 bg-foreground/[0.03] p-4">
                  <p className="text-xs text-muted-foreground">Last push</p>
                  <p className="mt-1 text-sm font-medium text-foreground">{timeAgo(overview.pushedAt)}</p>
                </div>
              </div>
            </div>
          )}
        </TabsContent>

        {/* Pull Requests */}
        <TabsContent value="prs">
          {prsQuery.isLoading || loading ? (
            <Shimmer />
          ) : prs.length === 0 ? (
            <p className="rounded-xl border border-foreground/10 bg-foreground/[0.03] p-8 text-center text-sm text-muted-foreground">
              No pull requests yet. Open a PR (use a <span className="font-mono text-muted-foreground">feature/&#123;id&#125;</span> branch to trigger AI review).
            </p>
          ) : (
            <div className="divide-y divide-foreground/5 overflow-hidden rounded-xl border border-foreground/10">
              {prs.map((pr) => (
                <PrRow key={pr.id} pr={pr} features={features} onChanged={refreshPrs} />
              ))}
            </div>
          )}
        </TabsContent>

        {/* Commits */}
        <TabsContent value="commits">
          {loading ? (
            <Shimmer />
          ) : commits.length === 0 ? (
            <p className="rounded-xl border border-foreground/10 bg-foreground/[0.03] p-8 text-center text-sm text-muted-foreground">No commits found.</p>
          ) : (
            <div className="divide-y divide-foreground/5 overflow-hidden rounded-xl border border-foreground/10">
              {commits.map((c) => (
                <div key={c.sha} className="flex items-center gap-3 px-5 py-3.5">
                  <GitCommitHorizontal className="size-4 shrink-0 text-muted-foreground" />
                  {c.authorAvatar ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={c.authorAvatar} alt={c.authorLogin ?? ""} className="size-6 shrink-0 rounded-full" />
                  ) : (
                    <div className="grid size-6 shrink-0 place-items-center rounded-full bg-foreground/10 text-[10px] text-foreground/80">
                      {(c.authorName ?? "?")[0]}
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <a href={c.htmlUrl} target="_blank" rel="noreferrer" className="block truncate text-sm text-foreground hover:text-primary">
                      {c.message}
                    </a>
                    <p className="text-xs text-muted-foreground">
                      {c.authorLogin ?? c.authorName ?? "unknown"} · {timeAgo(c.date)}
                    </p>
                  </div>
                  <span className="shrink-0 font-mono text-[11px] text-muted-foreground">{c.sha.slice(0, 7)}</span>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Contributors */}
        <TabsContent value="contributors">
          {loading ? (
            <Shimmer />
          ) : contributors.length === 0 ? (
            <p className="rounded-xl border border-foreground/10 bg-foreground/[0.03] p-8 text-center text-sm text-muted-foreground">
              <Users className="mx-auto mb-2 size-5 text-muted-foreground" />
              No contributors found.
            </p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {contributors.map((c) => (
                <a
                  key={c.login}
                  href={c.htmlUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-3 rounded-xl border border-foreground/10 bg-foreground/[0.03] px-4 py-3 transition hover:border-primary/30 hover:bg-foreground/[0.06]"
                >
                  {c.avatar ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={c.avatar} alt={c.login} className="size-9 rounded-full" />
                  ) : (
                    <div className="grid size-9 place-items-center rounded-full bg-foreground/10 text-sm text-foreground/80">{c.login[0]}</div>
                  )}
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">{c.login}</p>
                    <p className="text-xs text-muted-foreground">{c.contributions} commits</p>
                  </div>
                </a>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

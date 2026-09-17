"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  CheckCircle2,
  ExternalLink,
  Link2,
  Loader2,
  MoreVertical,
  Unlink2,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";

import { useActiveProject } from "~/components/shipflow/project-context";
import { ListToolbar, type ToolbarOption } from "~/components/shipflow/list-toolbar";
import { FADE_UP, PageHeader, STAGGER } from "~/components/shipflow/ui-kit";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "~/components/ui/sheet";
import { cn } from "~/lib/utils";
import { trpc } from "~/trpc/client";

type StatusFilter = "all" | "running" | "passed" | "failed";
type ReviewSort = "newest" | "oldest" | "score_high" | "score_low";

const FILTERS: ToolbarOption<StatusFilter>[] = [
  { value: "all", label: "All" },
  { value: "running", label: "Running" },
  { value: "passed", label: "Passed" },
  { value: "failed", label: "Failed" },
];

const REVIEW_SORTS: ToolbarOption<ReviewSort>[] = [
  { value: "newest", label: "Newest first" },
  { value: "oldest", label: "Oldest first" },
  { value: "score_high", label: "Score high → low" },
  { value: "score_low", label: "Score low → high" },
];

function verdictBadge(status: string) {
  if (status === "passed") {
    return {
      className:
        "border-success/30 bg-success/10 text-success",
      icon: <CheckCircle2 className="size-3.5" />,
      label: "Passed",
    };
  }
  if (status === "failed") {
    return {
      className: "border-destructive/30 bg-destructive/10 text-destructive",
      icon: <XCircle className="size-3.5" />,
      label: "Changes needed",
    };
  }
  return {
    className: "border-primary/30 bg-primary/10 text-primary",
    icon: <Loader2 className="size-3.5 animate-spin" />,
    label: "Reviewing",
  };
}

function scoreTone(score: number) {
  if (score >= 80) return "text-success";
  if (score >= 60) return "text-amber-400";
  return "text-destructive";
}

function formatDate(value: string | Date | null) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default function ReviewsPage() {
  const { activeProjectId, ready, isLoading } = useActiveProject();
  const [filter, setFilter] = useState<StatusFilter>("all");
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search, 200);
  const [sort, setSort] = useState<ReviewSort>("newest");
  const [openCycleId, setOpenCycleId] = useState<string | null>(null);
  const utils = trpc.useUtils();

  const { data: cycles = [], isLoading: cyclesLoading } =
    trpc.review.listAllCycles.useQuery(
      {
        projectId: activeProjectId ?? undefined,
        status: filter === "all" ? undefined : filter,
      },
      { enabled: ready && !isLoading },
    );

  // Search (feature title / PR number / repo) and sort are applied client-side
  // over the status-filtered cycles the server returns.
  const visibleCycles = useMemo(() => {
    const query = debouncedSearch.trim().toLowerCase();
    const filtered = cycles.filter((cycle) => {
      if (!query) return true;
      const haystack = `${cycle.featureTitle ?? ""} #${cycle.prNumber} ${cycle.repoFullName}`.toLowerCase();
      return haystack.includes(query);
    });

    return [...filtered].sort((a, b) => {
      if (sort === "score_high" || sort === "score_low") {
        // Missing scores sort last regardless of direction.
        const sa = a.prdComplianceScore ?? -1;
        const sb = b.prdComplianceScore ?? -1;
        if (sa === -1 && sb === -1) return 0;
        if (sa === -1) return 1;
        if (sb === -1) return -1;
        return sort === "score_high" ? sb - sa : sa - sb;
      }
      const at = new Date(a.completedAt ?? a.createdAt).getTime();
      const bt = new Date(b.completedAt ?? b.createdAt).getTime();
      return sort === "oldest" ? at - bt : bt - at;
    });
  }, [cycles, debouncedSearch, sort]);

  // Features the user can attach a review to (current scope).
  const { data: features = [] } = trpc.feature.list.useQuery(
    { projectId: activeProjectId ?? undefined },
    { enabled: ready && !isLoading },
  );

  const linkCycle = trpc.review.linkCycleToFeature.useMutation({
    onSuccess: () => {
      utils.review.listAllCycles.invalidate();
      toast.success("Review linked to feature.");
    },
    onError: (error) => toast.error(error.message),
  });

  const unlinkCycle = trpc.review.unlinkCycle.useMutation({
    onSuccess: () => {
      utils.review.listAllCycles.invalidate();
      toast.success("Review unlinked.");
    },
    onError: (error) => toast.error(error.message),
  });

  const mutating = linkCycle.isPending || unlinkCycle.isPending;

  return (
    <motion.div initial="hidden" animate="show" variants={STAGGER} className="space-y-6">
      <motion.div variants={FADE_UP}>
        <PageHeader
          title="Review history"
          description="Every AI code review cycle across this project's features."
        />
      </motion.div>

      {/* Search + status filter + sort */}
      <ListToolbar
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search by feature, PR #, or repo…"
        filters={FILTERS}
        activeFilter={filter}
        onFilterChange={setFilter}
        sortOptions={REVIEW_SORTS}
        activeSort={sort}
        onSortChange={setSort}
      />

      {cyclesLoading ? (
        <motion.div variants={FADE_UP} className="border border-border bg-card p-12 text-center">
          <Loader2 className="mx-auto size-5 animate-spin text-muted-foreground" />
        </motion.div>
      ) : cycles.length === 0 ? (
        <motion.div variants={FADE_UP} className="border border-border bg-card p-12 text-center">
          <p className="text-sm text-muted-foreground">
            {filter === "all"
              ? "No reviews yet. Link a GitHub PR to trigger AI review."
              : `No ${filter} reviews.`}
          </p>
        </motion.div>
      ) : visibleCycles.length === 0 ? (
        <motion.div variants={FADE_UP} className="border border-border bg-card p-12 text-center">
          <p className="text-sm text-muted-foreground">No reviews match your search.</p>
        </motion.div>
      ) : (
        <motion.div variants={FADE_UP} className="overflow-hidden border border-border bg-card">
          {/* Header row */}
          <div className="hidden grid-cols-[2fr_1fr_1.2fr_0.8fr_1fr_auto] gap-3 border-b border-border px-5 py-3 font-mono text-[10px] uppercase tracking-wider text-muted-foreground sm:grid">
            <span>Feature</span>
            <span>PR</span>
            <span>Verdict</span>
            <span>Score</span>
            <span>Date</span>
            <span className="sr-only">Actions</span>
          </div>

          <div className="divide-y divide-border">
            {visibleCycles.map((cycle) => {
              const badge = verdictBadge(cycle.status);
              return (
                <div
                  key={cycle.id}
                  className="grid grid-cols-1 gap-2 px-5 py-4 transition-colors hover:bg-foreground/[0.03] sm:grid-cols-[2fr_1fr_1.2fr_0.8fr_1fr_auto] sm:items-center sm:gap-3"
                >
                  <button
                    type="button"
                    onClick={() => setOpenCycleId(cycle.id)}
                    className="contents text-left"
                  >
                    <span className="truncate text-sm font-medium text-foreground">
                      {cycle.featureTitle ?? (
                        <span className="italic text-muted-foreground">Unlinked</span>
                      )}
                    </span>
                    <span className="font-mono text-xs text-muted-foreground">
                      #{cycle.prNumber}
                    </span>
                    <span
                      className={cn(
                        "inline-flex w-fit items-center gap-1.5 border px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider",
                        badge.className,
                      )}
                    >
                      {badge.icon}
                      {badge.label}
                    </span>
                    <span className="font-mono text-xs">
                      {typeof cycle.prdComplianceScore === "number" ? (
                        <span className={scoreTone(cycle.prdComplianceScore)}>
                          {cycle.prdComplianceScore}%
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {formatDate(cycle.completedAt ?? cycle.createdAt)}
                    </span>
                  </button>

                  <RowActions
                    isLinked={Boolean(cycle.featureId)}
                    currentFeatureId={cycle.featureId}
                    features={features}
                    disabled={mutating}
                    onLink={(featureId) => linkCycle.mutate({ cycleId: cycle.id, featureId })}
                    onUnlink={() => unlinkCycle.mutate({ cycleId: cycle.id })}
                  />
                </div>
              );
            })}
          </div>
        </motion.div>
      )}

      <ReviewDrawer
        cycleId={openCycleId}
        onOpenChange={(open) => !open && setOpenCycleId(null)}
      />
    </motion.div>
  );
}

function RowActions({
  isLinked,
  currentFeatureId,
  features,
  disabled,
  onLink,
  onUnlink,
}: {
  isLinked: boolean;
  currentFeatureId: string | null;
  features: { id: string; title: string }[];
  disabled: boolean;
  onLink: (featureId: string) => void;
  onUnlink: () => void;
}) {
  return (
    <div className="flex justify-end" onClick={(e) => e.stopPropagation()}>
      <DropdownMenu>
        <DropdownMenuTrigger
          aria-label="Review actions"
          className="grid size-8 place-items-center border border-border bg-card text-muted-foreground transition-colors hover:border-foreground/20 hover:text-foreground focus:outline-none"
        >
          <MoreVertical className="size-4" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52">
          <DropdownMenuSub>
            <DropdownMenuSubTrigger className="gap-2">
              <Link2 className="size-4" />
              {isLinked ? "Move to feature" : "Link to feature"}
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent className="max-h-72 w-64 overflow-y-auto">
              {features.length === 0 ? (
                <DropdownMenuItem disabled>No features in scope</DropdownMenuItem>
              ) : (
                features.map((f) => (
                  <DropdownMenuItem
                    key={f.id}
                    disabled={disabled || f.id === currentFeatureId}
                    onSelect={() => onLink(f.id)}
                    className="cursor-pointer"
                  >
                    <span className="truncate">{f.title}</span>
                    {f.id === currentFeatureId ? (
                      <CheckCircle2 className="ml-auto size-3.5 text-success" />
                    ) : null}
                  </DropdownMenuItem>
                ))
              )}
            </DropdownMenuSubContent>
          </DropdownMenuSub>
          {isLinked ? (
            <DropdownMenuItem
              variant="destructive"
              disabled={disabled}
              onSelect={onUnlink}
              className="cursor-pointer gap-2"
            >
              <Unlink2 className="size-4" />
              Unlink from feature
            </DropdownMenuItem>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

function ReviewDrawer({
  cycleId,
  onOpenChange,
}: {
  cycleId: string | null;
  onOpenChange: (open: boolean) => void;
}) {
  const utils = trpc.useUtils();
  const { data: cycle, isLoading } = trpc.review.getCycle.useQuery(
    { cycleId: cycleId ?? "" },
    { enabled: Boolean(cycleId) },
  );

  const resolve = trpc.review.resolveIssue.useMutation({
    onSuccess: () => {
      if (cycleId) utils.review.getCycle.invalidate({ cycleId });
      utils.review.listAllCycles.invalidate();
      toast.success("Finding marked resolved.");
    },
    onError: (error) => toast.error(error.message),
  });

  const badge = cycle ? verdictBadge(cycle.status) : null;

  return (
    <Sheet open={Boolean(cycleId)} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
        {isLoading || !cycle ? (
          <div className="flex h-40 items-center justify-center">
            <Loader2 className="size-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            <SheetHeader>
              <SheetTitle className="pr-6">
                {cycle.featureTitle ?? "Unlinked review"}
              </SheetTitle>
              <SheetDescription asChild>
                <div className="flex flex-wrap items-center gap-3 text-xs">
                  {badge ? (
                    <span
                      className={cn(
                        "inline-flex items-center gap-1.5 border px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider",
                        badge.className,
                      )}
                    >
                      {badge.icon}
                      {badge.label}
                    </span>
                  ) : null}
                  {typeof cycle.prdComplianceScore === "number" ? (
                    <span className="font-mono">
                      PRD compliance:{" "}
                      <span className={scoreTone(cycle.prdComplianceScore)}>
                        {cycle.prdComplianceScore}%
                      </span>
                    </span>
                  ) : null}
                  <Link
                    href={cycle.prUrl}
                    target="_blank"
                    className="inline-flex items-center gap-1 text-primary hover:underline"
                  >
                    {cycle.repoFullName} #{cycle.prNumber}
                    <ExternalLink className="size-3" />
                  </Link>
                </div>
              </SheetDescription>
            </SheetHeader>

            <div className="space-y-6 px-4 pb-8">
              {/* AI summary */}
              <section>
                <h3 className="mb-2 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                  Summary
                </h3>
                <p className="whitespace-pre-line text-sm text-foreground/90">
                  {cycle.summary ?? "No summary recorded for this cycle."}
                </p>
              </section>

              {/* Findings */}
              <section>
                <h3 className="mb-2 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                  Findings ({cycle.issues.length})
                </h3>
                {cycle.issues.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No findings — the PR satisfied the linked PRD.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {cycle.issues.map((issue) => {
                      const blocking = issue.severity === "blocking";
                      return (
                        <div
                          key={issue.id}
                          className={cn(
                            "border p-3",
                            issue.resolved
                              ? "border-border bg-card opacity-60"
                              : blocking
                                ? "border-destructive/30 bg-destructive/[0.06]"
                                : "border-amber-400/30 bg-amber-400/[0.06]",
                          )}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <span
                                className={cn(
                                  "font-mono text-[10px] uppercase tracking-wider",
                                  blocking ? "text-destructive" : "text-amber-400",
                                )}
                              >
                                {issue.severity.replace("_", " ")}
                              </span>
                              <p className="mt-1 text-sm text-foreground/90">{issue.title}</p>
                              {issue.filePath ? (
                                <p className="mt-1 truncate font-mono text-[11px] text-muted-foreground">
                                  {issue.filePath}
                                  {issue.lineNumber ? `:${issue.lineNumber}` : ""}
                                </p>
                              ) : null}
                            </div>
                            {issue.resolved ? (
                              <span className="inline-flex shrink-0 items-center gap-1 font-mono text-[10px] uppercase tracking-wider text-success">
                                <CheckCircle2 className="size-3.5" /> Resolved
                              </span>
                            ) : (
                              <button
                                type="button"
                                onClick={() => resolve.mutate({ issueId: issue.id })}
                                disabled={resolve.isPending}
                                className="shrink-0 border border-border px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider text-muted-foreground transition-colors hover:border-success/40 hover:text-success disabled:opacity-50"
                              >
                                Resolve
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

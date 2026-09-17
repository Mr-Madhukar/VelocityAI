"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { CheckCircle2, Clock, FileText, Loader2, Plus, Sparkles } from "lucide-react";

import { ProjectTag, useActiveProject } from "~/components/shipflow/project-context";
import { LinkPending } from "~/components/shipflow/link-pending";
import { ListToolbar, type ToolbarOption } from "~/components/shipflow/list-toolbar";
import { FADE_UP, PageHeader, STAGGER } from "~/components/shipflow/ui-kit";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { trpc } from "~/trpc/client";

type PrdFilter = "all" | "generating" | "pending" | "active";
type PrdSort = "newest" | "oldest" | "title";

const PRD_FILTERS: ToolbarOption<PrdFilter>[] = [
  { value: "all", label: "All" },
  { value: "generating", label: "Generating" },
  { value: "pending", label: "Pending" },
  { value: "active", label: "Active" },
];

const PRD_SORTS: ToolbarOption<PrdSort>[] = [
  { value: "newest", label: "Newest first" },
  { value: "oldest", label: "Oldest first" },
  { value: "title", label: "Title A–Z" },
];

export default function PrdListPage() {
  const router = useRouter();
  const { activeProjectId, ready, isLoading } = useActiveProject();
  const { data: features = [] } = trpc.feature.list.useQuery(
    { projectId: activeProjectId ?? undefined },
    { enabled: ready && !isLoading },
  );

  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search, 200);
  const [filter, setFilter] = useState<PrdFilter>("all");
  const [sort, setSort] = useState<PrdSort>("newest");

  const withPrd = useMemo(
    () => features.filter((f) => !["intake", "clarifying"].includes(f.status)),
    [features],
  );
  const hasGenerating = withPrd.some((f) => f.status === "prd_generating");

  const visible = useMemo(() => {
    const query = debouncedSearch.trim().toLowerCase();
    const filtered = withPrd.filter((f) => {
      if (query && !`${f.title} ${f.description ?? ""}`.toLowerCase().includes(query)) {
        return false;
      }
      if (filter === "generating") return f.status === "prd_generating";
      if (filter === "pending") return f.status === "prd_ready";
      if (filter === "active") return !["prd_generating", "prd_ready"].includes(f.status);
      return true;
    });

    return [...filtered].sort((a, b) => {
      if (sort === "title") return a.title.localeCompare(b.title);
      const diff = new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      return sort === "oldest" ? -diff : diff;
    });
  }, [withPrd, debouncedSearch, filter, sort]);

  // Poll while any PRD is being generated
  useEffect(() => {
    if (!hasGenerating) return;
    const id = setInterval(() => router.refresh(), 3000);
    return () => clearInterval(id);
  }, [hasGenerating, router]);

  return (
    <motion.div initial="hidden" animate="show" variants={STAGGER} className="space-y-6">
      <motion.div variants={FADE_UP}>
        <PageHeader title="PRDs" description="Product Requirements Documents for all features." />
      </motion.div>

      {withPrd.length > 0 ? (
        <ListToolbar
          search={search}
          onSearchChange={setSearch}
          searchPlaceholder="Search PRDs…"
          filters={PRD_FILTERS}
          activeFilter={filter}
          onFilterChange={setFilter}
          sortOptions={PRD_SORTS}
          activeSort={sort}
          onSortChange={setSort}
        />
      ) : null}

      {withPrd.length === 0 ? (
        <motion.div variants={FADE_UP} className="border border-border bg-card p-12 text-center">
          <p className="text-sm text-muted-foreground">No PRDs yet. Create a feature request to generate your first PRD.</p>
          <Link
            href="/features/new"
            className="mt-6 inline-flex h-9 items-center gap-2 bg-primary px-4 text-sm font-medium text-primary-foreground transition-transform hover:opacity-95 active:scale-[0.97]"
          >
            <Plus className="size-4" />
            Create feature
            <LinkPending />
          </Link>
        </motion.div>
      ) : visible.length === 0 ? (
        <motion.div variants={FADE_UP} className="border border-border bg-card p-12 text-center">
          <p className="text-sm text-muted-foreground">No PRDs match your search or filter.</p>
        </motion.div>
      ) : (
        <div className="grid gap-3">
          {visible.map((feature) => {
            const isGenerating = feature.status === "prd_generating";
            return (
              <motion.div variants={FADE_UP} key={feature.id}>
                <Link
                  href={`/features/${feature.id}?tab=prd`}
                  className="group flex items-center justify-between gap-4 border border-border bg-card px-5 py-4 transition-colors hover:border-foreground/20 hover:bg-foreground/[0.03]"
                >
                  <div className="flex min-w-0 items-center gap-4">
                    <div
                      className={
                        isGenerating
                          ? "grid size-10 shrink-0 place-items-center border border-primary/30 bg-primary/10 text-primary"
                          : "grid size-10 shrink-0 place-items-center border border-border bg-foreground/[0.03] text-muted-foreground transition-colors group-hover:text-primary"
                      }
                    >
                      {isGenerating ? <Sparkles className="size-5" /> : <FileText className="size-5" />}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="truncate text-sm font-medium text-foreground">{feature.title}</p>
                        <ProjectTag projectId={feature.projectId} className="shrink-0" />
                      </div>
                      <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                        {isGenerating ? <Loader2 className="size-3 animate-spin text-primary" /> : null}
                        {isGenerating
                          ? "AI is writing the PRD…"
                          : feature.status === "prd_ready"
                            ? "Awaiting approval"
                            : "PRD workflow active"}
                      </p>
                    </div>
                  </div>

                  {isGenerating ? (
                    <span className="inline-flex shrink-0 items-center gap-1.5 border border-primary/30 bg-primary/10 px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider text-primary">
                      <Loader2 className="size-3 animate-spin" />
                      Generating
                    </span>
                  ) : feature.status === "prd_ready" ? (
                    <span className="inline-flex shrink-0 items-center gap-1.5 border border-primary/30 bg-primary/10 px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider text-primary">
                      <Clock className="size-3.5" /> Pending
                    </span>
                  ) : (
                    <span className="inline-flex shrink-0 items-center gap-1.5 border border-success/30 bg-success/10 px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider text-success">
                      <CheckCircle2 className="size-3.5" /> Active
                    </span>
                  )}
                </Link>
              </motion.div>
            );
          })}
        </div>
      )}
    </motion.div>
  );
}

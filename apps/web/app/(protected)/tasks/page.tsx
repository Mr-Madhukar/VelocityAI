"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";

import { ProjectTag, useActiveProject } from "~/components/shipflow/project-context";
import { TasksListSkeleton } from "~/components/shipflow/page-skeletons";
import { ListToolbar, type ToolbarOption } from "~/components/shipflow/list-toolbar";
import { FADE_UP, PageHeader, STAGGER, StatusBadge } from "~/components/shipflow/ui-kit";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { statusLabel } from "~/components/shipflow/status";
import { trpc } from "~/trpc/client";

type FeatureStatus = keyof typeof statusLabel;

type TaskFilter = "all" | "active" | "review" | "done" | "blocked";
type TaskSort = "newest" | "oldest" | "title" | "priority";

const TASK_FILTERS: ToolbarOption<TaskFilter>[] = [
  { value: "all", label: "All" },
  { value: "active", label: "Active" },
  { value: "review", label: "In review" },
  { value: "done", label: "Done" },
  { value: "blocked", label: "Blocked" },
];

const TASK_SORTS: ToolbarOption<TaskSort>[] = [
  { value: "newest", label: "Newest first" },
  { value: "oldest", label: "Oldest first" },
  { value: "title", label: "Title A–Z" },
  { value: "priority", label: "Priority" },
];

// High → low ordering for the "Priority" sort.
const PRIORITY_RANK: Record<string, number> = { urgent: 0, high: 1, medium: 2, low: 3 };

export default function TasksPage() {
  const { activeProjectId, activeProject, ready, isLoading: projectsLoading } = useActiveProject();
  const { data: features = [], isLoading } = trpc.feature.list.useQuery(
    { projectId: activeProjectId ?? undefined },
    { enabled: ready && !projectsLoading },
  );

  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search, 200);
  const [filter, setFilter] = useState<TaskFilter>("all");
  const [sort, setSort] = useState<TaskSort>("newest");

  const activeFeatures = useMemo(
    () =>
      features.filter(
        (feature) => !["intake", "clarifying", "prd_ready"].includes(feature.status),
      ),
    [features],
  );

  const visible = useMemo(() => {
    const query = debouncedSearch.trim().toLowerCase();
    const filtered = activeFeatures.filter((f) => {
      if (query && !`${f.title} ${f.description ?? ""}`.toLowerCase().includes(query)) {
        return false;
      }
      if (filter === "active") return ["tasks_ready", "in_progress"].includes(f.status);
      if (filter === "review") return f.status === "in_review";
      if (filter === "done") return ["approved", "shipped"].includes(f.status);
      if (filter === "blocked") return f.status === "blocked";
      return true;
    });

    return [...filtered].sort((a, b) => {
      if (sort === "title") return a.title.localeCompare(b.title);
      if (sort === "priority") {
        return (PRIORITY_RANK[a.priority] ?? 99) - (PRIORITY_RANK[b.priority] ?? 99);
      }
      const diff = new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      return sort === "oldest" ? -diff : diff;
    });
  }, [activeFeatures, debouncedSearch, filter, sort]);

  const showSkeleton = !ready || projectsLoading || isLoading;

  return (
    <motion.div initial="hidden" animate="show" variants={STAGGER} className="space-y-6">
      <motion.div variants={FADE_UP}>
        <PageHeader
          title="Task board"
          description={activeProject ? `Engineering tasks across ${activeProject.name}.` : "Engineering tasks across all active features."}
        />
      </motion.div>

      {!showSkeleton && activeFeatures.length > 0 ? (
        <ListToolbar
          search={search}
          onSearchChange={setSearch}
          searchPlaceholder="Search tasks…"
          filters={TASK_FILTERS}
          activeFilter={filter}
          onFilterChange={setFilter}
          sortOptions={TASK_SORTS}
          activeSort={sort}
          onSortChange={setSort}
        />
      ) : null}

      {showSkeleton ? (
        <TasksListSkeleton rows={3} />
      ) : activeFeatures.length === 0 ? (
        <motion.div variants={FADE_UP} className="border border-border bg-card p-12 text-center">
          <p className="text-sm text-muted-foreground">No tasks yet. Approve a PRD to generate engineering tasks.</p>
        </motion.div>
      ) : visible.length === 0 ? (
        <motion.div variants={FADE_UP} className="border border-border bg-card p-12 text-center">
          <p className="text-sm text-muted-foreground">No tasks match your search or filter.</p>
        </motion.div>
      ) : (
        <div className="space-y-3">
          {visible.map((feature) => {
            const status = feature.status as FeatureStatus;
            return (
              <motion.div variants={FADE_UP} key={feature.id}>
                <Link
                  href={`/features/${feature.id}?tab=tasks`}
                  className="group block border border-border bg-card p-5 transition-colors hover:border-foreground/20 hover:bg-foreground/[0.03]"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h2 className="truncate text-sm font-medium text-foreground">{feature.title}</h2>
                        <ProjectTag projectId={feature.projectId} className="shrink-0" />
                      </div>
                      <p className="mt-1 line-clamp-1 text-xs text-muted-foreground">{feature.description}</p>
                    </div>
                    <StatusBadge status={status} />
                  </div>
                  <p className="mt-4 inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                    Open feature to view and manage tasks
                    <ArrowRight aria-hidden className="size-3.5 text-foreground/20 transition-colors group-hover:text-primary" />
                  </p>
                </Link>
              </motion.div>
            );
          })}
        </div>
      )}
    </motion.div>
  );
}

"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { ArrowRight, Boxes, Clock3, FolderKanban, Plus, Rocket, Search } from "lucide-react";
import type { RouterOutputs } from "@repo/trpc/client";

import { useActiveProject } from "~/components/shipflow/project-context";
import { CreateProjectDialog } from "~/components/shipflow/create-project-dialog";
import { ProjectsGridSkeleton } from "~/components/shipflow/page-skeletons";
import { FADE_UP, PageHeader, STAGGER, StatTile } from "~/components/shipflow/ui-kit";
import { trpc } from "~/trpc/client";

const finishedStatuses = new Set(["approved", "shipped"]);

type ProjectItem = RouterOutputs["project"]["list"][number];
type ProjectStats = { total: number; shipped: number; finished: number; blocked: number };

function NewProjectButton() {
  return (
    <CreateProjectDialog
      trigger={
        <button className="inline-flex h-9 items-center gap-2 bg-primary px-4 text-sm font-medium text-primary-foreground transition-transform hover:opacity-95 active:scale-[0.97]">
          <Plus className="size-4" />
          New project
        </button>
      }
    />
  );
}

function ProjectCard({
  project,
  stats,
  onOpen,
}: Readonly<{
  project: ProjectItem;
  stats: ProjectStats;
  onOpen: () => void;
}>) {
  const featureLabel = stats.total === 1 ? "feature" : "features";

  return (
    <motion.button
      variants={FADE_UP}
      onClick={onOpen}
      className="group flex h-full flex-col border border-border bg-card p-5 text-left transition-colors hover:border-foreground/20 hover:bg-foreground/3"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="grid size-9 place-items-center border border-border bg-foreground/3 text-muted-foreground transition-colors group-hover:border-primary/40 group-hover:text-primary">
          <FolderKanban className="size-4" />
        </div>
        <ArrowRight aria-hidden className="size-4 text-foreground/20 transition-colors group-hover:text-primary" />
      </div>
      <p className="mt-4 font-medium text-foreground">{project.name}</p>
      <p className="font-mono text-[11px] text-muted-foreground">/{project.slug}</p>
      <p className="mt-2 line-clamp-2 flex-1 text-sm leading-6 text-muted-foreground">
        {project.description || "No description yet."}
      </p>
      <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-border pt-3 font-mono text-[11px] text-muted-foreground">
        <span>{stats.total} {featureLabel}</span>
        {stats.shipped > 0 ? <span className="text-success">{stats.shipped} shipped</span> : null}
        {stats.blocked > 0 ? <span className="text-destructive">{stats.blocked} blocked</span> : null}
      </div>
    </motion.button>
  );
}

function CreateProjectCard() {
  return (
    <CreateProjectDialog
      trigger={
        <motion.button
          variants={FADE_UP}
          className="group flex h-full min-h-46 flex-col items-center justify-center gap-3 border border-dashed border-border bg-card p-5 text-center transition-colors hover:border-primary/40 hover:bg-foreground/3"
        >
          <div className="grid size-10 place-items-center rounded-full border border-dashed border-border bg-foreground/3 text-muted-foreground transition-colors group-hover:border-primary/40 group-hover:text-primary">
            <Plus className="size-5" />
          </div>
          <div>
            <p className="font-medium text-foreground">New project</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Group features, PRDs, tasks &amp; repos
            </p>
          </div>
        </motion.button>
      }
    />
  );
}

function ProjectsListContent({
  isLoading,
  totalProjectsCount,
  filteredProjects,
  query,
  statsByProject,
  onOpenProject,
}: Readonly<{
  isLoading: boolean;
  totalProjectsCount: number;
  filteredProjects: ProjectItem[];
  query: string;
  statsByProject: Map<string, ProjectStats>;
  onOpenProject: (id: string) => void;
}>) {
  if (isLoading) {
    return <ProjectsGridSkeleton />;
  }

  if (totalProjectsCount === 0) {
    return (
      <motion.div variants={FADE_UP} className="border border-border bg-card p-12 text-center">
        <p className="text-sm text-muted-foreground">No projects yet. Create one to start submitting feature requests.</p>
        <div className="mt-4 flex justify-center">
          <NewProjectButton />
        </div>
      </motion.div>
    );
  }

  if (filteredProjects.length === 0) {
    return (
      <motion.div variants={FADE_UP} className="border border-border bg-card p-12 text-center">
        <p className="text-sm text-muted-foreground">No projects match “{query}”.</p>
      </motion.div>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {filteredProjects.map((p) => {
        const stats = statsByProject.get(p.id) ?? { total: 0, shipped: 0, finished: 0, blocked: 0 };
        return (
          <ProjectCard
            key={p.id}
            project={p}
            stats={stats}
            onOpen={() => onOpenProject(p.id)}
          />
        );
      })}
      <CreateProjectCard />
    </div>
  );
}

export default function ProjectsPage() {
  const router = useRouter();
  const { setActiveProjectId } = useActiveProject();
  const { data: projects = [], isLoading: projectsLoading } = trpc.project.list.useQuery();
  const { data: features = [] } = trpc.feature.list.useQuery({});
  const [query, setQuery] = useState("");

  // Per-project stats grouped from the org-wide feature list (no extra endpoint).
  const statsByProject = useMemo(() => {
    const map = new Map<string, ProjectStats>();
    for (const f of features) {
      const s = map.get(f.projectId) ?? { total: 0, shipped: 0, finished: 0, blocked: 0 };
      s.total += 1;
      if (f.status === "shipped") s.shipped += 1;
      if (finishedStatuses.has(f.status)) s.finished += 1;
      if (f.status === "blocked") s.blocked += 1;
      map.set(f.projectId, s);
    }
    return map;
  }, [features]);

  const orgShipped = features.filter((f) => f.status === "shipped").length;
  const orgActive = features.filter((f) => !finishedStatuses.has(f.status)).length;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return projects;
    return projects.filter(
      (p) => p.name.toLowerCase().includes(q) || (p.description ?? "").toLowerCase().includes(q),
    );
  }, [projects, query]);

  function openProject(id: string) {
    setActiveProjectId(id);
    router.push("/dashboard");
  }

  return (
    <motion.div initial="hidden" animate="show" variants={STAGGER} className="space-y-8">
      <motion.div variants={FADE_UP}>
        <PageHeader
          title="Projects"
          description="Each project groups its own features, PRDs, tasks, repositories, and reviews. Pick one to work inside it, or switch scope to “All projects” for the org-wide view."
          action={<NewProjectButton />}
        />
      </motion.div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatTile label="Projects" value={projects.length} detail="In this organization" icon={FolderKanban} />
        <StatTile label="Total features" value={features.length} detail="Across all projects" icon={Boxes} />
        <StatTile label="Active work" value={orgActive} detail="Still moving through VelocityAI" icon={Clock3} />
        <StatTile label="Shipped" value={orgShipped} detail="Features live in production" icon={Rocket} />
      </div>

      <motion.div variants={FADE_UP} className="flex items-center gap-2 border border-border bg-card px-3 py-2">
        <Search className="size-4 shrink-0 text-muted-foreground" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Filter projects…"
          className="w-full bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
        />
      </motion.div>

      <ProjectsListContent
        isLoading={projectsLoading}
        totalProjectsCount={projects.length}
        filteredProjects={filtered}
        query={query}
        statsByProject={statsByProject}
        onOpenProject={openProject}
      />
    </motion.div>
  );
}

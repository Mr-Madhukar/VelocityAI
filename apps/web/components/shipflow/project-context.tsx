"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { Check, ChevronsUpDown, FolderGit2, Layers, Plus } from "lucide-react";
import { useRouter } from "next/navigation";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import { cn } from "~/lib/utils";
import { trpc } from "~/trpc/client";
import { useOrgRealtime } from "@/hooks/use-org-realtime";

type Project = { id: string; name: string; slug: string; description: string | null };

type ProjectContextValue = {
  projects: Project[];
  /** `null` = "All projects" (org-wide scope). */
  activeProjectId: string | null;
  activeProject: Project | null;
  setActiveProjectId: (id: string | null) => void;
  /** Human label for the current scope ("All projects" or the project name). */
  scopeLabel: string;
  isLoading: boolean;
  ready: boolean;
};

const ProjectContext = createContext<ProjectContextValue | null>(null);

const STORAGE_PREFIX = "shipflow.activeProject";
// Sentinel persisted when the user explicitly chooses the org-wide ("All projects") scope.
const ALL_SCOPE = "__all__";

export function ProjectProvider({ children }: { children: React.ReactNode }) {
  const { data: org } = trpc.org.current.useQuery();
  const { data: projects = [], isLoading } = trpc.project.list.useQuery();

  // Subscribe to the active org's realtime channel — keeps the whole team in sync
  useOrgRealtime(org?.id);

  // Scope: `null` = "All projects" (org-wide). `ready` distinguishes "not yet
  // hydrated" (null + !ready) from an explicit org-wide scope (null + ready).
  const [activeProjectId, setActiveProjectIdState] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  const storageKey = org?.id ? `${STORAGE_PREFIX}.${org.id}` : null;

  // Hydrate the scope from localStorage once we know the org. Missing or the
  // ALL_SCOPE sentinel → org-wide (null); a stored id → that project.
  useEffect(() => {
    if (!storageKey) return;
    const stored = window.localStorage.getItem(storageKey);
    setActiveProjectIdState(stored && stored !== ALL_SCOPE ? stored : null);
    setReady(true);
  }, [storageKey]);

  // If the selected project no longer exists, fall back to the org-wide scope
  // (never auto-snap to the first project — picking happens on /projects).
  useEffect(() => {
    if (!ready || isLoading) return;
    if (activeProjectId && !projects.some((p) => p.id === activeProjectId)) {
      setActiveProjectIdState(null);
      if (storageKey) window.localStorage.setItem(storageKey, ALL_SCOPE);
    }
  }, [ready, isLoading, projects, activeProjectId, storageKey]);

  function setActiveProjectId(id: string | null) {
    setActiveProjectIdState(id);
    if (storageKey) {
      window.localStorage.setItem(storageKey, id ?? ALL_SCOPE);
    }
  }

  const value = useMemo<ProjectContextValue>(() => {
    const activeProject = projects.find((p) => p.id === activeProjectId) ?? null;
    const scopeLabel = activeProject?.name ?? "All projects";
    return { projects, activeProjectId, activeProject, setActiveProjectId, scopeLabel, isLoading, ready };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projects, activeProjectId, isLoading, ready]);

  return <ProjectContext.Provider value={value}>{children}</ProjectContext.Provider>;
}

export function useActiveProject() {
  const ctx = useContext(ProjectContext);
  if (!ctx) throw new Error("useActiveProject must be used within a ProjectProvider");
  return ctx;
}

/**
 * Small chip showing which project a record belongs to. Only renders while the
 * org-wide ("All projects") scope is active — when a single project is selected
 * every card already belongs to it, so the label would be redundant noise.
 */
export function ProjectTag({
  projectId,
  className,
}: {
  projectId: string | null;
  className?: string;
}) {
  const { projects, activeProjectId } = useActiveProject();
  if (activeProjectId !== null) return null;

  const project = projects.find((p) => p.id === projectId);
  if (!project) return null;

  return (
    <span
      className={cn(
        "inline-flex max-w-full items-center gap-1 border border-border bg-foreground/[0.04] px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider text-muted-foreground",
        className,
      )}
    >
      <FolderGit2 className="size-3 shrink-0" />
      <span className="truncate">{project.name}</span>
    </span>
  );
}

export function ProjectSwitcher() {
  const router = useRouter();
  const { projects, activeProject, activeProjectId, setActiveProjectId, scopeLabel, isLoading } =
    useActiveProject();
  const isAll = activeProjectId === null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="group flex items-center gap-2.5 border border-border bg-foreground/[0.03] px-3 py-1.5 text-left transition-colors hover:border-foreground/20 hover:bg-foreground/[0.06] focus:outline-none">
        <div className="grid size-7 shrink-0 place-items-center bg-primary/10 text-primary">
          {isAll ? <Layers className="size-4" /> : <FolderGit2 className="size-4" />}
        </div>
        <div className="min-w-0">
          <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Scope</p>
          <p className="truncate text-sm font-medium text-foreground">
            {isLoading ? "Loading…" : scopeLabel}
          </p>
        </div>
        <ChevronsUpDown className="size-4 shrink-0 text-muted-foreground" />
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-60 border-border bg-popover">
        <DropdownMenuItem
          onSelect={() => setActiveProjectId(null)}
          className={cn("cursor-pointer text-sm", isAll ? "text-primary" : "text-muted-foreground")}
        >
          <Layers className="mr-2 size-4 shrink-0" />
          <span className="truncate">All projects</span>
          {isAll && <Check className="ml-auto size-3.5 text-primary" />}
        </DropdownMenuItem>

        {projects.length > 0 && <DropdownMenuSeparator className="bg-border" />}

        {projects.map((project) => (
          <DropdownMenuItem
            key={project.id}
            onSelect={() => setActiveProjectId(project.id)}
            className={cn(
              "cursor-pointer text-sm",
              project.id === activeProject?.id ? "text-primary" : "text-muted-foreground",
            )}
          >
            <FolderGit2 className="mr-2 size-4 shrink-0" />
            <span className="truncate">{project.name}</span>
            {project.id === activeProject?.id && <Check className="ml-auto size-3.5 text-primary" />}
          </DropdownMenuItem>
        ))}

        <DropdownMenuSeparator className="bg-border" />
        <DropdownMenuItem
          onSelect={() => router.push("/projects")}
          className="cursor-pointer text-sm text-muted-foreground"
        >
          <Plus className="mr-2 size-4" />
          New project
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

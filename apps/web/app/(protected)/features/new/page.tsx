"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, FolderPlus, Loader2, Plus, SendHorizontal, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { Textarea } from "~/components/ui/textarea";
import { PageHeader, RequiredMark } from "~/components/shipflow/ui-kit";
import { useActiveProject } from "~/components/shipflow/project-context";
import { cn } from "~/lib/utils";
import { trpc } from "~/trpc/client";

type Priority = "low" | "medium" | "high" | "urgent";

// Sentinel value for the "Create new project" option at the bottom of the
// project dropdown — selecting it opens the inline create input instead of
// picking a project. Namespaced so it can never collide with a real project id.
const NEW_PROJECT_VALUE = "__new_project__";

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export default function NewFeaturePage() {
  const router = useRouter();
  const utils = trpc.useUtils();
  const {
    projects,
    activeProjectId,
    setActiveProjectId,
    isLoading: loadingProjects,
  } = useActiveProject();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [projectId, setProjectId] = useState("");
  const [priority, setPriority] = useState<Priority>("medium");

  // Inline "create project" state — lets the user add a project without leaving
  // the feature form. On success we select it and set it as the active scope.
  const [creatingProject, setCreatingProject] = useState(false);
  const [newProjectName, setNewProjectName] = useState("");

  const createProject = trpc.project.create.useMutation({
    onSuccess: (project) => {
      if (!project) return;
      void utils.project.list.invalidate();
      setProjectId(project.id);
      setActiveProjectId(project.id); // scope the whole app to the new project
      setCreatingProject(false);
      setNewProjectName("");
      toast.success(`Project “${project.name}” created`);
    },
    onError: (error) => toast.error(error.message),
  });

  function submitNewProject() {
    const name = newProjectName.trim();
    const slug = slugify(name);
    if (!name || !slug || createProject.isPending) return;
    createProject.mutate({ name, slug });
  }

  // Default the form to the currently-active project once it resolves
  useEffect(() => {
    if (!projectId && activeProjectId) setProjectId(activeProjectId);
  }, [activeProjectId, projectId]);

  const createFeature = trpc.feature.create.useMutation({
    onSuccess: (feature) => {
      if (!feature) {
        toast.error("Feature was not created");
        return;
      }

      toast.success("Feature request created");
      router.push(`/features/${feature.id}`);
      router.refresh();
    },
    onError: (error) => toast.error(error.message),
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="New feature request"
        description="Start with the messy real-world ask. VelocityAI will turn it into a structured delivery workflow."
      />
      <div className="max-w-3xl rounded-lg border border-foreground/10 bg-foreground/[0.045] p-5">
        <div className="grid gap-5">
          <div className="grid gap-2">
            <Label htmlFor="title" className="text-foreground/80">Feature title <RequiredMark /></Label>
            <Input
              id="title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="AI release approval gate"
              className="border-foreground/10 bg-foreground/5 text-foreground placeholder:text-muted-foreground"
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="description" className="text-foreground/80">Raw client request <RequiredMark /></Label>
            <Textarea
              id="description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Explain what the client or team wants, what problem it solves, and any known constraints."
              className="min-h-44 border-foreground/10 bg-foreground/5 text-foreground placeholder:text-muted-foreground"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label className="text-foreground/80">Project <RequiredMark /></Label>

              {creatingProject ? (
                <div className="flex items-center gap-2">
                  <Input
                    autoFocus
                    value={newProjectName}
                    onChange={(event) => setNewProjectName(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        submitNewProject();
                      }
                      if (event.key === "Escape") setCreatingProject(false);
                    }}
                    placeholder="New project name"
                    disabled={createProject.isPending}
                    className="border-foreground/10 bg-foreground/5 text-foreground placeholder:text-muted-foreground"
                  />
                  <button
                    type="button"
                    onClick={submitNewProject}
                    disabled={!newProjectName.trim() || createProject.isPending}
                    aria-label="Create project"
                    className="grid size-9 shrink-0 place-items-center bg-primary text-primary-foreground transition-transform hover:opacity-95 active:scale-[0.97] disabled:opacity-50"
                  >
                    {createProject.isPending ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
                  </button>
                  <button
                    type="button"
                    onClick={() => setCreatingProject(false)}
                    disabled={createProject.isPending}
                    aria-label="Cancel"
                    className="grid size-9 shrink-0 place-items-center border border-foreground/10 bg-foreground/5 text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50"
                  >
                    <X className="size-4" />
                  </button>
                </div>
              ) : (
                <Select
                  value={projectId}
                  onValueChange={(value) => {
                    if (value === NEW_PROJECT_VALUE) {
                      setCreatingProject(true);
                      setNewProjectName("");
                      return;
                    }
                    setProjectId(value);
                  }}
                  disabled={loadingProjects}
                >
                  <SelectTrigger className="w-full border-foreground/10 bg-foreground/5 text-foreground">
                    <SelectValue placeholder={loadingProjects ? "Loading…" : "Select project"} />
                  </SelectTrigger>
                  <SelectContent className="border-border bg-popover">
                    {projects.map((p) => (
                      <SelectItem key={p.id} value={p.id} className="focus:bg-foreground/10">
                        {p.name}
                      </SelectItem>
                    ))}
                    <SelectItem
                      value={NEW_PROJECT_VALUE}
                      className={cn(
                        "text-primary focus:bg-foreground/10 focus:text-primary",
                        projects.length > 0 && "mt-1 border-t border-foreground/10",
                      )}
                    >
                      <span className="inline-flex items-center gap-1.5">
                        <Plus className="size-3.5" />
                        Create new project
                      </span>
                    </SelectItem>
                  </SelectContent>
                </Select>
              )}

              {projects.length === 0 && !loadingProjects && !creatingProject && (
                <p className="inline-flex items-center gap-1 text-xs text-amber-500 dark:text-amber-400">
                  <FolderPlus className="size-3.5" />
                  No projects yet — create one to submit this request.
                </p>
              )}
            </div>

            <div className="grid gap-2">
              <Label className="text-foreground/80">Priority</Label>
              <Select value={priority} onValueChange={(value) => setPriority(value as Priority)}>
                <SelectTrigger className="w-full border-foreground/10 bg-foreground/5 text-foreground">
                  <SelectValue placeholder="Select priority" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="urgent">Urgent</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <Button
            type="button"
            disabled={!title.trim() || !description.trim() || !projectId.trim() || createFeature.isPending}
            onClick={() => createFeature.mutate({ title, description, projectId, priority })}
            className="w-fit bg-primary text-primary-foreground hover:bg-primary"
          >
            {createFeature.isPending ? <Loader2 className="size-4 animate-spin" /> : <SendHorizontal className="size-4" />}
            Create feature
          </Button>
        </div>
      </div>
    </div>
  );
}

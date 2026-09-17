"use client";

import { useState } from "react";
import { FolderPlus } from "lucide-react";
import { toast } from "sonner";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "~/components/ui/dialog";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Spinner } from "~/components/ui/spinner";
import { RequiredMark } from "./ui-kit";
import { useActiveProject } from "./project-context";
import { trpc } from "~/trpc/client";

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/**
 * Square, token-driven dialog that creates a project via `project.create`.
 * `trigger` is rendered as the dialog opener (e.g. the PageHeader CTA).
 */
export function CreateProjectDialog({ trigger }: { trigger: React.ReactNode }) {
  const utils = trpc.useUtils();
  const { setActiveProjectId } = useActiveProject();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  const create = trpc.project.create.useMutation({
    // Optimistically drop the new project into the list cache so it appears in
    // the switcher/lists instantly; reconcile with the server row on success.
    onMutate: async (vars) => {
      await utils.project.list.cancel();
      const previous = utils.project.list.getData();
      const optimisticId = `optimistic-${Date.now()}`;
      utils.project.list.setData(undefined, (old) => [
        ...(old ?? []),
        {
          id: optimisticId,
          organizationId: "",
          name: vars.name,
          slug: vars.slug,
          description: vars.description ?? null,
          techStack: null,
          createdBy: "",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ]);
      return { previous, optimisticId };
    },
    onError: (err, _vars, ctx) => {
      // Roll the list back to its pre-mutation state.
      if (ctx?.previous) utils.project.list.setData(undefined, ctx.previous);
      toast.error(err.message);
    },
    onSuccess: (project, _vars, ctx) => {
      toast.success(`Project “${project?.name}” created`);
      if (project) {
        // Swap the placeholder for the authoritative server row before switching
        // scope, so the "active project must exist" guard never resets to All.
        utils.project.list.setData(undefined, (old) =>
          (old ?? []).map((p) => (p.id === ctx?.optimisticId ? project : p)),
        );
        setActiveProjectId(project.id);
      }
      setName("");
      setDescription("");
      setOpen(false);
    },
    onSettled: () => {
      void utils.project.list.invalidate();
    },
  });

  const slug = slugify(name);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="border-border bg-popover sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New project</DialogTitle>
          <DialogDescription>
            Group features, PRDs, tasks, repos, and reviews under one project.
          </DialogDescription>
        </DialogHeader>

        <form
          id="create-project-form"
          onSubmit={(e) => {
            e.preventDefault();
            if (!name.trim() || !slug) return;
            create.mutate({ name: name.trim(), slug, description: description.trim() || undefined });
          }}
          className="grid gap-4 py-2"
        >
          <div className="grid gap-1.5">
            <Label htmlFor="project-name" className="text-xs text-muted-foreground">Name <RequiredMark /></Label>
            <Input
              id="project-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Mobile App"
              autoFocus
              required
            />
            {slug ? <p className="font-mono text-[11px] text-muted-foreground">/{slug}</p> : null}
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="project-desc" className="text-xs text-muted-foreground">
              Description <span className="text-muted-foreground/60">(optional)</span>
            </Label>
            <Input
              id="project-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What this project delivers"
            />
          </div>
        </form>

        <DialogFooter>
          <button
            type="submit"
            form="create-project-form"
            disabled={!name.trim() || !slug || create.isPending}
            className="inline-flex h-9 items-center justify-center gap-2 bg-primary px-4 text-sm font-medium text-primary-foreground transition-transform hover:opacity-95 active:scale-[0.97] disabled:opacity-50 disabled:active:scale-100"
          >
            {create.isPending ? <Spinner className="size-4" /> : <FolderPlus className="size-4" />}
            Create project
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

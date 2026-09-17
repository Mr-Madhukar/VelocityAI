"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus } from "lucide-react";
import { toast } from "sonner";

import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { trpc } from "~/trpc/client";

function toSlug(value: string) {
  return value.toLowerCase().trim().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
}

export function CreateOrgForm() {
  const router = useRouter();
  const utils = trpc.useUtils();
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [open, setOpen] = useState(false);

  const create = trpc.org.create.useMutation({
    // Optimistically add the org to the list (sidebar switcher, settings) so it
    // shows up the moment the user hits Create.
    onMutate: async (vars) => {
      await utils.org.list.cancel();
      const previous = utils.org.list.getData();
      const optimisticId = `optimistic-${Date.now()}`;
      utils.org.list.setData(undefined, (old) => [
        ...(old ?? []),
        { id: optimisticId, name: vars.name, slug: vars.slug, logo: null },
      ]);
      return { previous, optimisticId };
    },
    onError: (error, _vars, ctx) => {
      if (ctx?.previous) utils.org.list.setData(undefined, ctx.previous);
      toast.error(error.message);
    },
    onSuccess: (org, _vars, ctx) => {
      toast.success("Organization created");
      if (org) {
        utils.org.list.setData(undefined, (old) =>
          (old ?? []).map((o) =>
            o.id === ctx?.optimisticId
              ? { id: org.id, name: org.name, slug: org.slug, logo: org.logo }
              : o,
          ),
        );
      }
      // The server made the new org active — refresh current + server components.
      void utils.org.current.invalidate();
      router.refresh();
      setOpen(false);
      setName("");
      setSlug("");
    },
    onSettled: () => {
      void utils.org.list.invalidate();
    },
  });

  if (!open) {
    return (
      <Button type="button" variant="outline" onClick={() => setOpen(true)} className="border-foreground/10 bg-foreground/5 text-foreground hover:bg-foreground/10">
        <Plus className="size-4" />
        Create new organization
      </Button>
    );
  }

  return (
    <div className="space-y-3">
      <div className="grid gap-2">
        <Label htmlFor="org-name" className="text-foreground/80">Name</Label>
        <Input
          id="org-name"
          value={name}
          onChange={(event) => {
            setName(event.target.value);
            setSlug(toSlug(event.target.value));
          }}
          placeholder="My Team"
          className="border-foreground/10 bg-foreground/5 text-foreground placeholder:text-muted-foreground"
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="org-slug" className="text-foreground/80">Slug</Label>
        <Input
          id="org-slug"
          value={slug}
          onChange={(event) => setSlug(toSlug(event.target.value))}
          placeholder="my-team"
          className="border-foreground/10 bg-foreground/5 text-foreground placeholder:text-muted-foreground"
        />
      </div>
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          onClick={() => create.mutate({ name, slug })}
          disabled={!name.trim() || !slug.trim() || create.isPending}
          className="bg-primary text-primary-foreground hover:bg-primary"
        >
          {create.isPending ? <Loader2 className="size-4 animate-spin" /> : null}
          Create
        </Button>
        <Button type="button" variant="ghost" onClick={() => setOpen(false)} className="text-muted-foreground hover:bg-foreground/10 hover:text-foreground">
          Cancel
        </Button>
      </div>
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { trpc } from "~/trpc/client";

function toSlug(value: string) {
  return value.toLowerCase().trim().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
}

export function OrgSettingsForm() {
  const router = useRouter();
  const { data: org, isLoading } = trpc.org.current.useQuery();
  const utils = trpc.useUtils();

  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");

  useEffect(() => {
    if (org) {
      setName(org.name);
      setSlug(org.slug);
    }
  }, [org]);

  const update = trpc.org.update.useMutation({
    onSuccess: () => {
      toast.success("Organization updated");
      utils.org.current.invalidate();
      utils.org.list.invalidate();
      router.refresh();
    },
    onError: (err) => toast.error(err.message),
  });

  if (isLoading) {
    return <div className="h-24 animate-pulse rounded-lg bg-foreground/5" />;
  }

  if (!org) return null;

  const dirty = name !== org.name || slug !== org.slug;

  return (
    <div className="grid gap-4">
      <div className="grid gap-1.5">
        <Label htmlFor="org-name" className="text-xs text-muted-foreground">Organization name</Label>
        <Input
          id="org-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="border-foreground/10 bg-foreground/5 text-foreground placeholder:text-muted-foreground"
        />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="org-slug" className="text-xs text-muted-foreground">Slug</Label>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">VelocityAI.in/</span>
          <Input
            id="org-slug"
            value={slug}
            onChange={(e) => setSlug(toSlug(e.target.value))}
            className="border-foreground/10 bg-foreground/5 text-foreground placeholder:text-muted-foreground"
          />
        </div>
      </div>
      <div className="flex justify-end">
        <Button
          onClick={() => update.mutate({ name, slug })}
          disabled={!dirty || !name.trim() || !slug.trim() || update.isPending}
          className="bg-primary text-primary-foreground hover:bg-primary disabled:opacity-40"
        >
          {update.isPending ? <Loader2 className="size-4 animate-spin" /> : "Save changes"}
        </Button>
      </div>
    </div>
  );
}

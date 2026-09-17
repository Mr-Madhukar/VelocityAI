"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronsUpDown, Building2, Plus, Loader2 } from "lucide-react";

import { authClient } from "@/lib/auth-client";
import { trpc } from "@/trpc/client";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function OrgSwitcher() {
  const router = useRouter();
  const utils = trpc.useUtils();
  const { data: orgs = [] } = trpc.org.list.useQuery();
  const { data: current } = trpc.org.current.useQuery();
  const [switching, setSwitching] = useState<string | null>(null);

  async function switchOrg(organizationId: string) {
    if (organizationId === current?.id || switching) return;
    setSwitching(organizationId);
    try {
      // Persist the new active org onto the server session.
      await authClient.organization.setActive({ organizationId });
      // Every org-scoped tRPC query (org.current, projects, features, tasks,
      // reviews, billing, …) is now stale — router.refresh() alone only
      // re-renders server components and leaves the React Query cache untouched.
      // Invalidate everything so the whole app refetches against the new org.
      await utils.invalidate();
      router.refresh();
    } finally {
      setSwitching(null);
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex w-full items-center gap-2 border border-border bg-foreground/[0.02] px-3 py-2 text-left transition-colors hover:bg-foreground/[0.06] focus:outline-none">
        <div className="grid size-6 shrink-0 place-items-center bg-primary/15 text-primary">
          <Building2 className="size-3.5" />
        </div>
        <span className="flex-1 truncate text-xs font-medium text-foreground">
          {current?.name ?? "Select org"}
        </span>
        <ChevronsUpDown className="size-3.5 shrink-0 text-muted-foreground" />
      </DropdownMenuTrigger>

      <DropdownMenuContent align="start" className="w-52 border-border bg-popover">
        {orgs.map((org) => (
          <DropdownMenuItem
            key={org.id}
            // Keep the menu open while the switch is in flight so the spinner is visible.
            onSelect={(event) => {
              event.preventDefault();
              void switchOrg(org.id);
            }}
            disabled={!!switching}
            className={`text-sm ${org.id === current?.id ? "text-primary" : "text-muted-foreground"} cursor-pointer`}
          >
            <Building2 className="mr-2 size-4 shrink-0" />
            <span className="truncate">{org.name}</span>
            {switching === org.id ? (
              <Loader2 className="ml-auto size-3.5 shrink-0 animate-spin text-primary" />
            ) : org.id === current?.id ? (
              <span className="ml-auto font-mono text-[10px] uppercase tracking-wider text-primary">active</span>
            ) : null}
          </DropdownMenuItem>
        ))}

        {orgs.length > 0 && <DropdownMenuSeparator className="bg-border" />}

        <DropdownMenuItem
          onSelect={() => router.push("/settings")}
          className="cursor-pointer text-sm text-muted-foreground"
        >
          <Plus className="mr-2 size-4" />
          New organization
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

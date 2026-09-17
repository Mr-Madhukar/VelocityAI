"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, Bell, CheckCircle2, FileText, Github, OctagonAlert } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import { useActiveProject } from "./project-context";
import { cn } from "~/lib/utils";
import { trpc } from "~/trpc/client";

type Event = {
  id: string;
  featureId: string;
  title: string;
  message: string;
  icon: LucideIcon;
  tone: "success" | "primary" | "destructive";
  at: Date;
};

function relativeTime(date: Date): string {
  const diff = Date.now() - date.getTime();
  const mins = Math.round(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.round(hrs / 24)}d ago`;
}

const toneDot: Record<Event["tone"], string> = {
  success: "bg-success",
  primary: "bg-primary",
  destructive: "bg-destructive",
};
const toneText: Record<Event["tone"], string> = {
  success: "text-success",
  primary: "text-primary",
  destructive: "text-destructive",
};

const STORAGE_PREFIX = "shipflow.readNotifications";

/** Derives recent pipeline events client-side from existing feature data — no new backend. */
export function NotificationsMenu() {
  const { activeProjectId, ready, isLoading } = useActiveProject();
  const { data: org } = trpc.org.current.useQuery();
  const { data: features = [] } = trpc.feature.list.useQuery(
    { projectId: activeProjectId ?? undefined },
    { enabled: ready && !isLoading },
  );

  // A persistent nudge: if the active project (or the whole org, in "All"
  // scope) has no connected repository, surface a "connect a repo" card that
  // explains the payoff. Not part of the dismissable activity feed — it stays
  // until a repo is actually connected.
  const { data: repos = [], isLoading: reposLoading } = trpc.github.repositories.useQuery(
    { projectId: activeProjectId ?? undefined },
    { enabled: ready && !isLoading },
  );
  const showConnectRepo = ready && !isLoading && !reposLoading && repos.length === 0;

  // Read state is persisted per-org so a seen notification stays hidden across
  // reloads and doesn't leak between organizations on a shared browser.
  const storageKey = org?.id ? `${STORAGE_PREFIX}.${org.id}` : null;
  const [readIds, setReadIds] = useState<Set<string>>(new Set());
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    if (!storageKey) return;
    try {
      const raw = window.localStorage.getItem(storageKey);
      setReadIds(new Set(raw ? (JSON.parse(raw) as string[]) : []));
    } catch {
      setReadIds(new Set());
    }
    setHydrated(true);
  }, [storageKey]);

  const allEvents = useMemo<Event[]>(() => {
    const out: Event[] = [];
    for (const f of features) {
      // Time the event by the last status change, not feature creation, so
      // "PRD ready"/"passed"/"blocked" read as when they actually happened.
      const at = new Date(f.updatedAt);
      if (f.status === "prd_ready") {
        out.push({ id: `${f.id}-prd`, featureId: f.id, title: f.title, message: "PRD ready for review", icon: FileText, tone: "primary", at });
      } else if (f.status === "approved" || f.status === "shipped") {
        out.push({ id: `${f.id}-passed`, featureId: f.id, title: f.title, message: "AI review passed", icon: CheckCircle2, tone: "success", at });
      } else if (f.status === "blocked") {
        out.push({ id: `${f.id}-blocked`, featureId: f.id, title: f.title, message: "Blocker raised", icon: OctagonAlert, tone: "destructive", at });
      }
    }
    return out.sort((a, b) => b.at.getTime() - a.at.getTime()).slice(0, 8);
  }, [features]);

  // Only surface unread (new) events — anything already seen is hidden.
  const events = useMemo(
    () => allEvents.filter((e) => !readIds.has(e.id)),
    [allEvents, readIds],
  );

  // Mark everything currently shown as read when the menu closes, so the badge
  // clears and these items don't reappear next time — only genuinely new events
  // will show up again.
  function markAllRead() {
    if (!hydrated || !storageKey || events.length === 0) return;
    setReadIds((prev) => {
      const next = new Set(prev);
      for (const e of allEvents) next.add(e.id);
      try {
        window.localStorage.setItem(storageKey, JSON.stringify([...next]));
      } catch {
        // storage unavailable (private mode / quota) — read state is best-effort
      }
      return next;
    });
  }

  return (
    <DropdownMenu onOpenChange={(open) => { if (!open) markAllRead(); }}>
      <DropdownMenuTrigger
        aria-label="Notifications"
        className="relative grid size-9 shrink-0 place-items-center border border-border bg-foreground/[0.03] text-muted-foreground transition-colors hover:bg-foreground/[0.06] hover:text-foreground focus:outline-none"
      >
        <Bell className="size-4" />
        {events.length > 0 ? (
          <span className="absolute -right-1 -top-1 grid min-w-4 place-items-center bg-primary px-1 font-mono text-[9px] font-medium text-primary-foreground">
            {events.length}
          </span>
        ) : showConnectRepo ? (
          <span className="absolute -right-1 -top-1 size-2 rounded-full bg-primary" />
        ) : null}
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-80 border-border bg-popover p-0">
        <div className="flex items-center justify-between border-b border-border px-3 py-2.5">
          <p className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">Activity</p>
          <span className="text-[11px] text-muted-foreground">{events.length} new</span>
        </div>

        {/* Repo-connect nudge — pinned above the activity feed, links to the
            GitHub connect page. Persists until a repo is connected. */}
        {showConnectRepo ? (
          <Link
            href="/github"
            className="flex items-start gap-3 border-b border-border bg-primary/[0.04] px-3 py-3 transition-colors hover:bg-primary/[0.07]"
          >
            <span className="mt-0.5 grid size-7 shrink-0 place-items-center border border-primary/30 bg-background text-primary">
              <Github className="size-3.5" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-1.5">
                <span className="size-1.5 shrink-0 bg-primary" />
                <span className="truncate text-sm font-medium text-foreground">Connect a repository</span>
              </span>
              <span className="mt-0.5 block text-xs leading-5 text-muted-foreground">
                Get accurate tech-stack detection, better prompt generation, and full codebase context.
              </span>
            </span>
            <ArrowRight className="mt-1 size-3.5 shrink-0 text-primary" />
          </Link>
        ) : null}

        {events.length === 0 ? (
          showConnectRepo ? null : (
            <p className="px-3 py-8 text-center text-sm text-muted-foreground">You&apos;re all caught up.</p>
          )
        ) : (
          <ul className="max-h-80 overflow-y-auto">
            {events.map((e) => {
              const Icon = e.icon;
              return (
                <li key={e.id}>
                  <Link
                    href={`/features/${e.featureId}`}
                    className="flex items-start gap-3 border-b border-border px-3 py-3 transition-colors last:border-b-0 hover:bg-foreground/[0.04]"
                  >
                    <span className={cn("mt-0.5 grid size-7 shrink-0 place-items-center border border-border bg-foreground/[0.03]", toneText[e.tone])}>
                      <Icon className="size-3.5" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-1.5">
                        <span className={cn("size-1.5 shrink-0", toneDot[e.tone])} />
                        <span className="truncate text-sm text-foreground">{e.message}</span>
                      </span>
                      <span className="mt-0.5 block truncate text-xs text-muted-foreground">{e.title}</span>
                    </span>
                    <span className="shrink-0 font-mono text-[10px] text-muted-foreground">{relativeTime(e.at)}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

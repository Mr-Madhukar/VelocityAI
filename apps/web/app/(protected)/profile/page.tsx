"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Building2,
  CheckCircle2,
  Clock,
  ListTodo,
  Loader2,
  LogOut,
  ShieldCheck,
} from "lucide-react";

import { authClient } from "@/lib/auth-client";
import { trpc } from "@/trpc/client";
import { EmailVerifiedBadge, VerifyEmailDialog } from "~/components/shipflow/verify-email";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { getDisplayName, getInitials } from "@/features/auth/components/user-menu";
import { SIGN_IN_PATH } from "@/features/auth/utils";
import { cn } from "~/lib/utils";

const STATUS_FILTERS = [
  { value: "all", label: "All" },
  { value: "todo", label: "To do" },
  { value: "in_progress", label: "In progress" },
  { value: "done", label: "Done" },
] as const;

type StatusFilter = (typeof STATUS_FILTERS)[number]["value"];

export default function ProfilePage() {
  const router = useRouter();
  const utils = trpc.useUtils();
  const { data: session, isPending: sessionPending } = authClient.useSession();

  const memberships = trpc.profile.memberships.useQuery(undefined, {
    enabled: !!session?.user,
  });
  const myTasks = trpc.profile.myTasks.useQuery(undefined, {
    enabled: !!session?.user,
  });
  const { data: currentOrg } = trpc.org.current.useQuery(undefined, {
    enabled: !!session?.user,
  });

  const { data: emailStatus } = trpc.profile.emailStatus.useQuery(undefined, {
    enabled: !!session?.user,
  });

  const [signingOut, setSigningOut] = useState(false);
  const [switchingOrg, setSwitchingOrg] = useState<string | null>(null);
  const [verifyOpen, setVerifyOpen] = useState(false);

  // Task filters — org scope + status. Org filter only matters with 2+ orgs.
  const [orgFilter, setOrgFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  const tasks = myTasks.data;
  const hasMultipleOrgs = (memberships.data?.length ?? 0) > 1;

  const filteredTasks = useMemo(() => {
    return (tasks ?? []).filter((task) => {
      if (orgFilter !== "all" && task.organizationId !== orgFilter) return false;
      if (statusFilter === "all") return true;
      if (statusFilter === "done") return task.status === "done";
      if (statusFilter === "in_progress") return task.status === "in_progress";
      // "todo" bucket = anything not started or done (todo/backlog/etc).
      return task.status !== "done" && task.status !== "in_progress";
    });
  }, [tasks, orgFilter, statusFilter]);

  async function handleSignOut() {
    setSigningOut(true);
    await authClient.signOut({
      fetchOptions: { onSuccess: () => router.push(SIGN_IN_PATH) },
    });
  }

  // Switching org here mirrors the sidebar OrgSwitcher: persist the active org
  // on the server session, then invalidate the client cache so everything
  // refetches against the new org before landing on the dashboard.
  async function switchOrg(organizationId: string) {
    if (switchingOrg) return;
    if (organizationId === currentOrg?.id) {
      router.push("/dashboard");
      return;
    }
    setSwitchingOrg(organizationId);
    try {
      await authClient.organization.setActive({ organizationId });
      await utils.invalidate();
      router.push("/dashboard");
      router.refresh();
    } finally {
      setSwitchingOrg(null);
    }
  }

  if (sessionPending) {
    return <ProfileSkeleton />;
  }

  if (!session?.user) {
    router.push(SIGN_IN_PATH);
    return null;
  }

  const user = session.user;
  const displayName = getDisplayName(user);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center gap-5">
        <Avatar className="size-20 ring-2 ring-foreground/10">
          {user.image ? <AvatarImage src={user.image} alt={displayName} /> : null}
          <AvatarFallback className="text-2xl">{getInitials(user)}</AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <h1 className="truncate text-2xl font-bold text-foreground">{displayName}</h1>
          {user.email ? (
            <div className="mt-0.5 flex flex-wrap items-center gap-2">
              <p className="truncate text-sm text-muted-foreground">{user.email}</p>
              {emailStatus ? (
                <>
                  <EmailVerifiedBadge verified={emailStatus.emailVerified} />
                  {!emailStatus.emailVerified && (
                    <button
                      type="button"
                      onClick={() => setVerifyOpen(true)}
                      className="inline-flex items-center gap-1 text-xs font-medium text-primary underline-offset-2 hover:underline"
                    >
                      <ShieldCheck className="size-3.5" />
                      Verify email
                    </button>
                  )}
                </>
              ) : null}
            </div>
          ) : null}
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="shrink-0 text-muted-foreground hover:text-red-400"
          onClick={handleSignOut}
          disabled={signingOut}
        >
          <LogOut className="size-4" />
          Sign out
        </Button>
      </div>

      <VerifyEmailDialog open={verifyOpen} onOpenChange={setVerifyOpen} />

      {/* Organizations */}
      <Section icon={<Building2 className="size-4" />} title="Organizations">
        {memberships.isPending ? (
          <CardSkeleton />
        ) : memberships.data?.length === 0 ? (
          <EmptyState text="You're not a member of any organization yet." />
        ) : (
          <div className="grid gap-3">
            {memberships.data?.map((m) => {
              const isActive = m.orgId === currentOrg?.id;
              const isSwitching = switchingOrg === m.orgId;
              return (
                <button
                  key={m.orgId}
                  type="button"
                  onClick={() => switchOrg(m.orgId)}
                  disabled={!!switchingOrg}
                  className={cn(
                    "flex items-center gap-4 rounded-xl border px-4 py-3 text-left transition disabled:opacity-60",
                    isActive
                      ? "border-primary/40 bg-primary/[0.06]"
                      : "border-foreground/10 bg-foreground/[0.03] hover:bg-foreground/[0.06]",
                  )}
                >
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-lg font-bold text-primary">
                    {m.orgName?.[0]?.toUpperCase() ?? "?"}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate font-medium text-foreground">{m.orgName}</p>
                      {isActive ? (
                        <span className="shrink-0 font-mono text-[10px] uppercase tracking-wider text-primary">
                          active
                        </span>
                      ) : null}
                    </div>
                    <p className="text-xs capitalize text-muted-foreground">
                      {m.plan} plan · {m.memberCount} members
                    </p>
                  </div>
                  {isSwitching ? (
                    <Loader2 className="size-4 shrink-0 animate-spin text-primary" />
                  ) : (
                    <RoleBadge role={m.role} />
                  )}
                </button>
              );
            })}
          </div>
        )}
      </Section>

      {/* My Tasks */}
      <Section
        icon={<ListTodo className="size-4" />}
        title="My Tasks"
        action={
          myTasks.data && myTasks.data.length > 0 ? (
            <div className="flex flex-wrap items-center gap-2">
              {hasMultipleOrgs ? (
                <select
                  value={orgFilter}
                  onChange={(e) => setOrgFilter(e.target.value)}
                  className="h-8 rounded-lg border border-foreground/10 bg-foreground/[0.03] px-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary/40"
                >
                  <option value="all">All organizations</option>
                  {memberships.data?.map((m) => (
                    <option key={m.orgId} value={m.orgId}>
                      {m.orgName}
                    </option>
                  ))}
                </select>
              ) : null}
              <div className="flex items-center gap-1 rounded-lg border border-foreground/10 bg-foreground/[0.03] p-0.5">
                {STATUS_FILTERS.map((filter) => (
                  <button
                    key={filter.value}
                    type="button"
                    onClick={() => setStatusFilter(filter.value)}
                    className={cn(
                      "rounded-md px-2.5 py-1 text-xs font-medium transition",
                      statusFilter === filter.value
                        ? "bg-primary/15 text-primary"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {filter.label}
                  </button>
                ))}
              </div>
            </div>
          ) : null
        }
      >
        {myTasks.isPending ? (
          <CardSkeleton />
        ) : (tasks ?? []).length === 0 ? (
          <EmptyState text="No tasks assigned to you yet." />
        ) : filteredTasks.length === 0 ? (
          <EmptyState text="No tasks match the selected filters." />
        ) : (
          <div className="grid gap-2">
            {filteredTasks.map((task) => (
              <div
                key={task.id}
                className="flex items-start gap-3 rounded-xl border border-foreground/10 bg-foreground/[0.03] px-4 py-3"
              >
                <TaskStatusIcon status={task.status} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground">{task.title}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {task.orgName} · {task.featureTitle}
                  </p>
                </div>
                <span className="shrink-0 text-xs capitalize text-muted-foreground">
                  {task.status.replace("_", " ")}
                </span>
              </div>
            ))}
          </div>
        )}
      </Section>
    </div>
  );
}

function Section({
  icon,
  title,
  action,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-muted-foreground">
          {icon}
          <h2 className="text-sm font-semibold uppercase tracking-wider">{title}</h2>
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
      {children}
    </div>
  );
}

function RoleBadge({ role }: { role: string }) {
  const colors: Record<string, string> = {
    owner: "bg-amber-400/10 text-amber-700 dark:text-amber-300 border-amber-400/20",
    admin: "bg-purple-400/10 text-purple-300 border-purple-400/20",
    manager: "bg-blue-400/10 text-blue-300 border-blue-400/20",
    developer: "bg-success/10 text-success border-success/20",
  };
  return (
    <span
      className={`shrink-0 rounded-full border px-2.5 py-0.5 text-xs font-medium capitalize ${colors[role] ?? "bg-foreground/5 text-muted-foreground border-foreground/10"}`}
    >
      {role}
    </span>
  );
}

function TaskStatusIcon({ status }: { status: string }) {
  if (status === "done") return <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" />;
  if (status === "in_progress") return <Clock className="mt-0.5 size-4 shrink-0 text-primary" />;
  return <div className="mt-1 size-3 shrink-0 rounded-full border border-muted-foreground" />;
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="rounded-xl border border-foreground/10 bg-foreground/[0.03] px-4 py-8 text-center">
      <p className="text-sm text-muted-foreground">{text}</p>
    </div>
  );
}

function CardSkeleton() {
  return (
    <div className="space-y-2">
      {[1, 2].map((i) => (
        <Skeleton key={i} className="h-16 w-full rounded-xl" />
      ))}
    </div>
  );
}

function ProfileSkeleton() {
  return (
    <div className="space-y-8">
      <div className="flex items-center gap-5">
        <Skeleton className="size-20 rounded-full" />
        <div className="space-y-2">
          <Skeleton className="h-7 w-48" />
          <Skeleton className="h-4 w-36" />
        </div>
      </div>
    </div>
  );
}

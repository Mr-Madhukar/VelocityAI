"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import {
  ArrowRight,
  CheckCircle2,
  Circle,
  Clock3,
  ExternalLink,
  FolderKanban,
  GitPullRequestArrow,
  Plus,
  Rocket,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { SiGithub } from "react-icons/si";

import { useActiveProject } from "~/components/shipflow/project-context";
import { CreateProjectDialog } from "~/components/shipflow/create-project-dialog";
import {
  ComplianceBadge,
  EffortBadge,
  FADE_UP,
  PageHeader,
  SectionCard,
  STAGGER,
  StatTile,
  StatusBadge,
} from "~/components/shipflow/ui-kit";
import { statusLabel } from "~/components/shipflow/status";
import { trpc } from "~/trpc/client";

type FeatureStatus = keyof typeof statusLabel;

const finishedStatuses = new Set(["approved", "shipped"]);

const pipelineStages = [
  { label: "Intake", statuses: ["intake", "clarifying"] },
  { label: "PRD", statuses: ["prd_generating", "prd_ready"] },
  { label: "Tasks", statuses: ["tasks_ready", "in_progress"] },
  { label: "Review", statuses: ["in_review"] },
  { label: "Shipped", statuses: ["approved", "shipped"] },
] as const;

function timeAgo(value: Date | string) {
  const then = new Date(value).getTime();
  const seconds = Math.max(0, Math.round((Date.now() - then) / 1000));
  if (seconds < 60) return "just now";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(value).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

const ACTIVITY_META = {
  feature: { icon: Sparkles, tone: "text-primary", label: "Feature" },
  review: { icon: ShieldCheck, tone: "text-success", label: "Review" },
  pr: { icon: GitPullRequestArrow, tone: "text-muted-foreground", label: "Pull request" },
} as const;

type ActivityItem = {
  id: string;
  kind: keyof typeof ACTIVITY_META;
  title: string;
  subtitle: string | null;
  status: string | null;
  score: number | null;
  at: Date | string;
  href: string | null;
  externalUrl: string | null;
};

function ActivityRow({ item }: Readonly<{ item: ActivityItem }>) {
  const meta = ACTIVITY_META[item.kind];
  const Icon = meta.icon;

  const inner = (
    <>
      <span className={`grid size-8 shrink-0 place-items-center border border-border bg-foreground/3 ${meta.tone}`}>
        <Icon className="size-4" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate text-sm font-medium text-foreground">{item.title}</p>
          {item.kind === "review" && typeof item.score === "number" ? (
            <ComplianceBadge score={item.score} />
          ) : null}
        </div>
        <p className="mt-0.5 truncate font-mono text-[11px] text-muted-foreground">
          {meta.label}
          {item.subtitle ? ` · ${item.subtitle}` : ""}
          {item.status ? ` · ${item.status.replaceAll("_", " ")}` : ""}
        </p>
      </div>
      <span className="shrink-0 font-mono text-[11px] text-muted-foreground">{timeAgo(item.at)}</span>
    </>
  );

  const className =
    "group flex items-center gap-3 px-5 py-3 transition-colors hover:bg-foreground/3";

  if (item.href) {
    return (
      <Link href={item.href} className={className}>
        {inner}
      </Link>
    );
  }
  if (item.externalUrl) {
    return (
      <a href={item.externalUrl} target="_blank" rel="noreferrer" className={className}>
        {inner}
        <ExternalLink aria-hidden className="size-3.5 shrink-0 text-foreground/20 group-hover:text-primary" />
      </a>
    );
  }
  return <div className={className}>{inner}</div>;
}

function OnboardingChecklist({
  hasProjects,
  hasRepos,
}: Readonly<{
  hasProjects: boolean;
  hasRepos: boolean;
}>) {
  const steps = [
    {
      done: hasProjects,
      title: "Create a project",
      body: "Group your features, PRDs, tasks, and repositories.",
      action: hasProjects ? null : (
        <CreateProjectDialog
          trigger={
            <button className="inline-flex h-8 items-center gap-1.5 border border-border bg-foreground/3 px-3 text-xs font-medium text-foreground transition-colors hover:border-foreground/20">
              <FolderKanban className="size-3.5" /> New project
            </button>
          }
        />
      ),
    },
    {
      done: hasRepos,
      title: "Connect a repository",
      body: "Link a GitHub repo so VelocityAI can review pull requests.",
      action: hasRepos ? null : (
        <Link
          href="/github"
          className="inline-flex h-8 items-center gap-1.5 border border-border bg-foreground/3 px-3 text-xs font-medium text-foreground transition-colors hover:border-foreground/20"
        >
          <SiGithub className="size-3.5" /> Connect repo
        </Link>
      ),
    },
    {
      done: false,
      title: "Create your first feature",
      body: "Drop in a rough ask — VelocityAI clarifies it, writes a PRD, and plans the work.",
      action: (
        <Link
          href="/features/new"
          className="inline-flex h-8 items-center gap-1.5 bg-primary px-3 text-xs font-medium text-primary-foreground transition-transform hover:opacity-95 active:scale-[0.97]"
        >
          <Plus className="size-3.5" /> New feature
        </Link>
      ),
    },
  ];

  return (
    <SectionCard
      title="Get started with VelocityAI"
      subtitle="A few quick steps to light up your delivery pipeline."
    >
      <div className="divide-y divide-border">
        {steps.map((step) => (
          <div key={step.title} className="flex items-start gap-3 px-5 py-4">
            {step.done ? (
              <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-success" />
            ) : (
              <Circle className="mt-0.5 size-5 shrink-0 text-muted-foreground/40" />
            )}
            <div className="min-w-0 flex-1">
              <p className={step.done ? "text-sm font-medium text-muted-foreground line-through" : "text-sm font-medium text-foreground"}>
                {step.title}
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">{step.body}</p>
            </div>
            {step.action ? <div className="shrink-0">{step.action}</div> : null}
          </div>
        ))}
      </div>
    </SectionCard>
  );
}

export default function DashboardPage() {
  const { activeProjectId, activeProject, projects, ready, isLoading } = useActiveProject();
  const { data: features = [] } = trpc.feature.list.useQuery(
    { projectId: activeProjectId ?? undefined },
    { enabled: ready && !isLoading },
  );
  const { data: activity = [] } = trpc.feature.recentActivity.useQuery(
    { limit: 10 },
    { enabled: ready && !isLoading },
  );
  const { data: repos = [] } = trpc.github.repositories.useQuery(undefined, {
    enabled: ready && !isLoading,
  });

  const shipped = features.filter((f) => f.status === "shipped").length;
  const finished = features.filter((f) => finishedStatuses.has(f.status)).length;
  const blockers = features.filter((f) => f.status === "blocked").length;
  const shippedPercent = features.length ? Math.round((shipped / features.length) * 100) : 0;
  const latest = features.slice(0, 5);

  const stageCounts = pipelineStages.map((stage) => ({
    label: stage.label,
    count: features.filter((f) => (stage.statuses as readonly string[]).includes(f.status)).length,
  }));

  const showOnboarding = features.length === 0;

  return (
    <motion.div initial="hidden" animate="show" variants={STAGGER} className="space-y-8">
        <motion.div variants={FADE_UP}>
          <PageHeader
            title="Dashboard"
            description="One control room for product discovery, PRD generation, engineering tasks, AI review, and release approval."
          />
        </motion.div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <StatTile label="Features shipped" value={shippedPercent} suffix="%" detail={`${shipped} of ${features.length} features live`} icon={Rocket} />
          <StatTile label="Approved flow" value={finished} detail="Approved or already shipped" icon={ShieldCheck} />
          <StatTile label="Active work" value={Math.max(features.length - finished, 0)} detail="Requests still moving through VelocityAI" icon={Clock3} />
          <StatTile label="Open blockers" value={blockers} detail="Issues preventing release today" icon={GitPullRequestArrow} />
        </div>

        {/* Delivery pipeline — blueprint band */}
        <motion.div variants={FADE_UP}>
          <p className="mb-2 font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
            Delivery pipeline
          </p>
          <div className="grid grid-cols-2 overflow-hidden border border-border bg-card sm:grid-cols-3 lg:grid-cols-5">
            {stageCounts.map((stage, i) => (
              <div
                key={stage.label}
                className="relative flex items-center justify-between gap-2 border-b border-border p-4 last:border-b-0 sm:border-b-0 lg:border-r lg:last:border-r-0"
              >
                <div>
                  <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">{stage.label}</p>
                  <p className="mt-1 text-2xl font-medium tabular-nums text-foreground">{stage.count}</p>
                </div>
                {i < stageCounts.length - 1 ? (
                  <ArrowRight aria-hidden className="hidden size-4 shrink-0 text-foreground/20 lg:block" />
                ) : null}
              </div>
            ))}
          </div>
        </motion.div>

        {/* Guided onboarding — only while the org has no features yet */}
        {showOnboarding ? (
          <motion.div variants={FADE_UP}>
            <OnboardingChecklist hasProjects={projects.length > 0} hasRepos={repos.length > 0} />
          </motion.div>
        ) : null}

        {/* Active features */}
        <SectionCard
          title="Active features"
          subtitle={activeProject ? `Requests in ${activeProject.name}.` : "Real requests from your current organization."}
        >
          {latest.length === 0 ? (
            <div className="p-16 text-center">
              <p className="text-sm text-muted-foreground">
                No features yet. Create the first request and VelocityAI will start the workflow.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {latest.map((feature) => {
                const status = feature.status as FeatureStatus;
                return (
                  <Link
                    key={feature.id}
                    href={`/features/${feature.id}`}
                    className="group grid gap-4 px-5 py-4 transition-colors hover:bg-foreground/3 md:grid-cols-[1.5fr_0.7fr_0.7fr] md:items-center"
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2.5">
                        <p className="truncate font-medium text-foreground">{feature.title}</p>
                        <StatusBadge status={status} />
                        <EffortBadge hours={feature.estimatedHours} />
                        <ComplianceBadge score={feature.complianceScore} />
                      </div>
                      <p className="mt-1.5 line-clamp-1 text-sm text-muted-foreground">{feature.description}</p>
                    </div>
                    <p className="text-sm capitalize text-muted-foreground">{feature.priority}</p>
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm text-muted-foreground">
                        {new Date(feature.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                      </p>
                      <ArrowRight aria-hidden className="size-4 shrink-0 text-foreground/20 transition-colors group-hover:text-primary" />
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </SectionCard>

        {/* Recent activity — org-wide stream of features, reviews, and PRs */}
        {activity.length > 0 ? (
          <SectionCard
            title="Recent activity"
            subtitle="Latest feature updates, AI reviews, and pull requests across your organization."
          >
            <div className="divide-y divide-border">
              {activity.map((item) => (
                <ActivityRow key={item.id} item={item as ActivityItem} />
              ))}
            </div>
          </SectionCard>
        ) : null}
    </motion.div>
  );
}

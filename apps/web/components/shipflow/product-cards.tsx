import Link from "next/link";
import { Bot, CircleDot, GitPullRequestArrow, Star, TriangleAlert } from "lucide-react";

import type {
  DemoFeature,
  DemoRepository,
  DemoReview,
  DemoTask,
} from "@repo/services/shipflow/demo";
import { cn } from "~/lib/utils";
import { reviewTone, statusLabel, statusTone } from "./status";

export function MetricCard({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="rounded-lg border border-foreground/10 bg-foreground/[0.055] p-4 shadow-2xl shadow-black/20">
      <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">{label}</p>
      <p className="mt-4 text-3xl font-semibold text-foreground">{value}</p>
      <p className="mt-2 text-sm text-muted-foreground">{detail}</p>
    </div>
  );
}

export function FeatureCard({ feature }: { feature: DemoFeature }) {
  return (
    <Link
      href={`/features/${feature.id}`}
      className="block rounded-lg border border-foreground/10 bg-foreground/[0.045] p-4 transition hover:-translate-y-0.5 hover:border-primary/40 hover:bg-foreground/[0.07]"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-medium text-foreground">{feature.title}</p>
          <p className="mt-1 text-xs text-muted-foreground">Owner: {feature.owner}</p>
        </div>
        <span className={cn("rounded-full border px-2 py-0.5 text-[11px]", statusTone[feature.status])}>
          {statusLabel[feature.status]}
        </span>
      </div>
      <div className="mt-4 h-2 overflow-hidden rounded-full bg-foreground/10">
        <div className="h-full rounded-full bg-primary" style={{ width: `${feature.progress}%` }} />
      </div>
      <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
        <span>{feature.progress}% complete</span>
        <span>{feature.linkedPr ?? "No PR"}</span>
      </div>
    </Link>
  );
}

export function RepositoryRow({ repo }: { repo: DemoRepository }) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-foreground/10 bg-muted p-4">
      <div>
        <p className="font-medium text-foreground">{repo.fullName}</p>
        <p className="text-xs text-muted-foreground">Default branch: {repo.defaultBranch}</p>
      </div>
      <span
        className={cn(
          "rounded-full px-2 py-1 text-xs",
          repo.reviewHealth === "passing" && "bg-success/10 text-success",
          repo.reviewHealth === "attention" && "bg-amber-400/10 text-amber-800 dark:text-amber-100",
          repo.reviewHealth === "blocked" && "bg-destructive/10 text-destructive",
        )}
      >
        {repo.connected ? repo.reviewHealth : "not connected"}
      </span>
    </div>
  );
}

export function TaskBoard({ tasks }: { tasks: DemoTask[] }) {
  const columns: Array<{ key: DemoTask["status"]; title: string }> = [
    { key: "todo", title: "Todo" },
    { key: "in_progress", title: "In progress" },
    { key: "blocked", title: "Blocked" },
    { key: "done", title: "Done" },
  ];

  return (
    <div className="grid gap-4 xl:grid-cols-4">
      {columns.map((column) => (
        <div key={column.key} className="rounded-lg border border-foreground/10 bg-foreground/[0.035]">
          <div className="border-b border-foreground/10 px-4 py-3">
            <p className="font-medium text-foreground">{column.title}</p>
          </div>
          <div className="space-y-3 p-3">
            {tasks
              .filter((task) => task.status === column.key)
              .map((task) => (
                <div key={task.id} className="rounded-md border border-foreground/10 bg-muted p-3">
                  <div className="flex items-center gap-2 text-xs text-primary">
                    <CircleDot className="size-3" />
                    {task.type} · {task.priority}
                  </div>
                  <p className="mt-2 text-sm font-medium text-foreground">{task.title}</p>
                  <p className="mt-1 text-xs text-muted-foreground">Assigned to {task.assignee}</p>
                </div>
              ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export function ReviewCard({ review }: { review: DemoReview }) {
  return (
    <div className="rounded-lg border border-foreground/10 bg-foreground/[0.045] p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <GitPullRequestArrow className="size-4 text-primary" />
          <p className="font-medium text-foreground">{review.pullRequest}</p>
        </div>
        <span className={cn("rounded-full border px-2 py-1 text-xs", reviewTone[review.status])}>
          {review.status.replace("_", " ")}
        </span>
      </div>
      <p className="mt-3 text-sm leading-6 text-foreground/80">{review.summary}</p>
      <div className="mt-4 space-y-2">
        {review.findings.map((finding) => (
          <div key={`${finding.file}-${finding.message}`} className="rounded-md border border-foreground/10 bg-muted p-3">
            <div className="flex items-center gap-2 text-xs">
              {finding.severity === "blocking" ? (
                <TriangleAlert className="size-3 text-destructive" />
              ) : finding.severity === "positive" ? (
                <Star className="size-3 text-success" />
              ) : (
                <Bot className="size-3 text-amber-600 dark:text-amber-300" />
              )}
              <span className="text-muted-foreground">{finding.file}</span>
            </div>
            <p className="mt-1 text-sm text-foreground">{finding.message}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

import { generatePrdMarkdown } from "@repo/services/shipflow/agents";
import { reviewPullRequestAgainstPrd } from "@repo/services/shipflow/code-review";
import { getDemoWorkspace } from "@repo/services/shipflow/demo";

import { z, zodUndefinedModel } from "../../schema";
import { publicProcedure, router } from "../../trpc";

const featureStatusSchema = z.enum([
  "intake",
  "clarifying",
  "prd_generating",
  "prd_ready",
  "tasks_ready",
  "in_progress",
  "in_review",
  "approved",
  "shipped",
  "blocked",
]);

const workspaceSchema = z.object({
  organization: z.object({
    name: z.string(),
    plan: z.enum(["Launch", "Scale", "Enterprise"]),
  }),
  metrics: z.object({
    features: z.object({
      total: z.number(),
      shipped: z.number(),
      inReview: z.number(),
      blocked: z.number(),
      activeCount: z.number(),
      shippedPercent: z.number(),
      health: z.enum(["healthy", "attention", "empty"]),
    }),
    reviewPassRate: z.number(),
    aiHoursSaved: z.number(),
    openBlockers: z.number(),
  }),
  repositories: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      fullName: z.string(),
      defaultBranch: z.string(),
      reviewHealth: z.enum(["passing", "attention", "blocked"]),
      connected: z.boolean(),
    }),
  ),
  features: z.array(
    z.object({
      id: z.string(),
      title: z.string(),
      owner: z.string(),
      status: featureStatusSchema,
      priority: z.enum(["low", "medium", "high", "urgent"]),
      progress: z.number(),
      prdVersion: z.number(),
      linkedPr: z.string().nullable(),
      acceptanceCriteria: z.array(z.string()),
    }),
  ),
  prds: z.array(
    z.object({
      featureId: z.string(),
      problem: z.string(),
      goals: z.array(z.string()),
      nonGoals: z.array(z.string()),
      userStories: z.array(z.string()),
      edgeCases: z.array(z.string()),
      successMetrics: z.array(z.string()),
    }),
  ),
  tasks: z.array(
    z.object({
      id: z.string(),
      featureId: z.string(),
      title: z.string(),
      type: z.enum(["frontend", "backend", "database", "infra", "testing", "docs"]),
      status: z.enum(["todo", "in_progress", "done", "blocked"]),
      priority: z.enum(["p0", "p1", "p2", "p3"]),
      assignee: z.string(),
    }),
  ),
  reviews: z.array(
    z.object({
      id: z.string(),
      featureId: z.string(),
      pullRequest: z.string(),
      status: z.enum(["processing", "passed", "changes_requested", "blocked"]),
      summary: z.string(),
      findings: z.array(
        z.object({
          severity: z.enum(["blocking", "non_blocking", "positive"]),
          message: z.string(),
          file: z.string(),
        }),
      ),
    }),
  ),
  activity: z.array(
    z.object({
      id: z.string(),
      kind: z.enum(["feature", "prd", "task", "ai_review", "approval"]),
      title: z.string(),
      detail: z.string(),
      time: z.string(),
    }),
  ),
  billing: z.object({
    plan: z.enum(["Free", "Pro", "Scale"]),
    usedCredits: z.number(),
    includedCredits: z.number(),
    repositoryLimit: z.number(),
    renewalDate: z.string(),
  }),
  onboarding: z.array(
    z.object({
      label: z.string(),
      complete: z.boolean(),
    }),
  ),
});

export const shipflowRouter = router({
  getWorkspace: publicProcedure
    .input(zodUndefinedModel)
    .output(workspaceSchema)
    .query(() => getDemoWorkspace()),
  generatePrd: publicProcedure
    .input(
      z.object({
        title: z.string().min(1),
        problem: z.string().min(1),
        goals: z.array(z.string()).min(1),
        nonGoals: z.array(z.string()).default([]),
        userStories: z.array(z.string()).min(1),
        acceptanceCriteria: z.array(z.string()).min(1),
        edgeCases: z.array(z.string()).default([]),
        successMetrics: z.array(z.string()).min(1),
      }),
    )
    .output(
      z.object({
        markdown: z.string(),
      }),
    )
    .mutation((opts) => ({
      markdown: generatePrdMarkdown(opts.input),
    })),
  reviewPullRequest: publicProcedure
    .input(
      z.object({
        repoFullName: z.string().min(1),
        pullRequestTitle: z.string().min(1),
        prdTitle: z.string().min(1),
        acceptanceCriteria: z.array(z.string()).min(1),
        files: z.array(
          z.object({
            filePath: z.string().min(1),
            patch: z.string().min(1),
          }),
        ),
      }),
    )
    .output(
      z.object({
        status: z.enum(["passed", "changes_requested"]),
        summary: z.string(),
        reviewMarkdown: z.string(),
        findings: z.array(
          z.object({
            severity: z.enum(["blocking", "non_blocking", "positive"]),
            message: z.string(),
            file: z.string(),
          }),
        ),
      }),
    )
    .mutation((opts) => reviewPullRequestAgainstPrd(opts.input)),
});

"use server";

import { and, db, desc, eq } from "@repo/database";
import {
  featureRequests,
  prds,
  repositories,
  reviewCycles,
  reviewIssues,
} from "@repo/database/schema";

import { requireAuth } from "@/features/auth/session";
import { commitFilesAndOpenPr } from "@/features/github/server/create-pr";

import { generateImplementation, type CopilotMode, type CopilotPlan } from "./agent";
import { buildRepoContext, getRepoContext } from "./repo-context";

type ActionError = { ok: false; error: string };

type Repo = typeof repositories.$inferSelect;
type AuthorizeResult =
  | { ok: false; error: string }
  | { ok: true; organizationId: string; repo: Repo };

// Resolve the active org and confirm the repo belongs to it. Every Copilot
// action goes through this so one org can't touch another's repo.
async function authorizeRepo(repositoryId: string): Promise<AuthorizeResult> {
  const session = await requireAuth();
  const organizationId = session.session.activeOrganizationId;
  if (!organizationId) {
    return { ok: false, error: "Select an organization first." };
  }

  const [repo] = await db
    .select()
    .from(repositories)
    .where(
      and(eq(repositories.id, repositoryId), eq(repositories.organizationId, organizationId)),
    );
  if (!repo) return { ok: false, error: "Repository not found in this organization." };

  return { ok: true, organizationId, repo };
}

export async function refreshRepoContextAction(repositoryId: string) {
  const auth = await authorizeRepo(repositoryId);
  if (!auth.ok) return { ok: false as const, error: auth.error };

  try {
    const context = await buildRepoContext(repositoryId);
    return {
      ok: true as const,
      fileCount: context.fileCount,
      updatedAt: context.updatedAt.toISOString(),
    };
  } catch (error) {
    return {
      ok: false as const,
      error: error instanceof Error ? error.message : "Failed to index repository.",
    };
  }
}

export async function generateImplementationAction(input: {
  repositoryId: string;
  prompt: string;
  mode: CopilotMode;
  featureId?: string | null;
}): Promise<({ ok: true; plan: CopilotPlan }) | ActionError> {
  const auth = await authorizeRepo(input.repositoryId);
  if (!auth.ok) return { ok: false, error: auth.error };

  if (!input.prompt.trim()) {
    return { ok: false, error: "Describe what you want to build or fix." };
  }

  // Pull PRD + outstanding review findings when the request is tied to a feature
  // — this is what lets it "build from the PRD" or "fix the review issues".
  let prd: { problem: string; acceptanceCriteria: string[] } | null = null;
  let reviewFindings: string[] | null = null;

  if (input.featureId) {
    const [feature] = await db
      .select({ id: featureRequests.id })
      .from(featureRequests)
      .where(
        and(
          eq(featureRequests.id, input.featureId),
          eq(featureRequests.organizationId, auth.organizationId),
        ),
      );
    if (feature) {
      const [prdRow] = await db
        .select()
        .from(prds)
        .where(eq(prds.featureId, input.featureId));
      if (prdRow) {
        prd = {
          problem: prdRow.problem,
          acceptanceCriteria: JSON.parse(prdRow.acceptanceCriteria) as string[],
        };
      }

      if (input.mode === "fix") {
        const [latestCycle] = await db
          .select({ id: reviewCycles.id })
          .from(reviewCycles)
          .where(eq(reviewCycles.featureId, input.featureId))
          .orderBy(desc(reviewCycles.createdAt))
          .limit(1);
        if (latestCycle) {
          const issues = await db
            .select({ title: reviewIssues.title, suggestion: reviewIssues.suggestion })
            .from(reviewIssues)
            .where(
              and(
                eq(reviewIssues.reviewCycleId, latestCycle.id),
                eq(reviewIssues.resolved, false),
              ),
            );
          reviewFindings = issues.map((i) =>
            i.suggestion ? `${i.title} — ${i.suggestion}` : i.title,
          );
        }
      }
    }
  }

  try {
    const plan = await generateImplementation({
      repositoryId: input.repositoryId,
      prompt: input.prompt,
      mode: input.mode,
      prd,
      reviewFindings,
    });
    return { ok: true, plan };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Generation failed.",
    };
  }
}

export async function openDraftPrAction(input: {
  repositoryId: string;
  title: string;
  body: string;
  files: Array<{ path: string; content: string }>;
}) {
  const auth = await authorizeRepo(input.repositoryId);
  if (!auth.ok) return { ok: false as const, error: auth.error };

  const { repo } = auth;
  if (!repo.installationId) {
    return { ok: false as const, error: "Repository has no GitHub installation." };
  }
  if (input.files.length === 0) {
    return { ok: false as const, error: "No files to commit." };
  }

  try {
    const pr = await commitFilesAndOpenPr({
      installationId: repo.installationId,
      fullName: repo.fullName,
      defaultBranch: repo.defaultBranch,
      branchPrefix: "VelocityAI",
      title: input.title,
      body: `${input.body}\n\n— Drafted by VelocityAI Copilot 🚢`,
      commitMessage: `${input.title}\n\nGenerated by VelocityAI Copilot.`,
      files: input.files,
      draft: true,
    });

    return { ok: true as const, prUrl: pr.prUrl, prNumber: pr.prNumber };
  } catch (error) {
    return {
      ok: false as const,
      error: error instanceof Error ? error.message : "Failed to open draft PR.",
    };
  }
}

/**
 * The AI summary of a repo shown on the GitHub repo dashboard — the stored
 * repo_context snapshot (overview, stack, key files) in a display-ready shape.
 */
export async function getRepoAiSummaryAction(repositoryId: string) {
  const auth = await authorizeRepo(repositoryId);
  if (!auth.ok) return null;
  const context = await getRepoContext(repositoryId);
  if (!context) return { indexed: false as const };
  return {
    indexed: true as const,
    overview: context.overview,
    stack: context.stack,
    fileCount: context.fileCount,
    keyFiles: Object.entries(context.summaries)
      .slice(0, 8)
      .map(([path, summary]) => ({ path, summary })),
    updatedAt: context.updatedAt.toISOString(),
  };
}

export async function getRepoContextStatusAction(repositoryId: string) {
  const auth = await authorizeRepo(repositoryId);
  if (!auth.ok) return null;
  const context = await getRepoContext(repositoryId);
  if (!context) return { indexed: false as const };
  return {
    indexed: true as const,
    fileCount: context.fileCount,
    stack: context.stack,
    updatedAt: context.updatedAt.toISOString(),
  };
}

import { and, db, desc, eq } from "@repo/database";
import {
  featureRequests,
  githubInstallations,
  prds,
  pullRequests,
  reviewCycles,
  reviewIssues,
} from "@repo/database/schema";

import { reviewPullRequestAgainstPrd } from "@/features/ai/qa-reviewer";
import { consumeReviewCredit, resolveOrgIdForPullRequest, ReviewCreditError } from "@/features/billing/server/credits";
import { getGithubApp } from "@/lib/github/app";
import { publishOrgEvent } from "@/lib/realtime/server";

export { ReviewCreditError };

function safeParseStringArray(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as string[]) : [];
  } catch {
    return [];
  }
}

/**
 * Runs the full AI review for a cached pull request and posts the result back
 * to GitHub. This is the single source of truth for review execution — it is
 * called both by the Inngest webhook function and directly (inline) from server
 * actions, so reviews work even when Inngest isn't reachable.
 */
import type { Octokit } from "octokit";

type InstallationOctokit = Octokit;
type ReviewResult = Awaited<ReturnType<typeof reviewPullRequestAgainstPrd>>;

interface PrFileDiff {
  filePath: string;
  patch: string;
}

interface PrCommitSummary {
  sha: string;
  message: string;
}

async function fetchPrFilesAndCommits(
  octokit: InstallationOctokit,
  owner: string,
  repo: string,
  pullNumber: number,
): Promise<{ files: PrFileDiff[]; commits: PrCommitSummary[] }> {
  const { data: prFiles } = await octokit.rest.pulls.listFiles({
    owner,
    repo,
    pull_number: pullNumber,
    per_page: 100,
  });
  let files: PrFileDiff[] = prFiles
    .filter((f: { patch?: string }) => Boolean(f.patch))
    .map((f: { filename: string; patch?: string }) => ({ filePath: f.filename, patch: f.patch as string }));

  if (files.length === 0) {
    const { data: diffData } = await octokit.rest.pulls.get({
      owner,
      repo,
      pull_number: pullNumber,
      mediaType: { format: "diff" },
    });
    files = [{ filePath: "diff", patch: String(diffData) }];
  }

  const { data: prCommits } = await octokit.rest.pulls.listCommits({
    owner,
    repo,
    pull_number: pullNumber,
    per_page: 100,
  });
  const commits = prCommits.map((c: { sha: string; commit: { message: string } }) => ({ sha: c.sha, message: c.commit.message }));

  return { files, commits };
}

async function handleReviewFailure(
  reviewCycleId: string | undefined,
  featureId: string | null,
  error: unknown,
) {
  const message = error instanceof Error ? error.message : String(error);
  if (reviewCycleId) {
    await db
      .update(reviewCycles)
      .set({
        status: "failed",
        summary: `Review failed to complete: ${message}`,
        completedAt: new Date(),
      })
      .where(eq(reviewCycles.id, reviewCycleId));
  }
  if (featureId) {
    await db
      .update(featureRequests)
      .set({ status: "blocked", updatedAt: new Date() })
      .where(eq(featureRequests.id, featureId));
  }
}

async function persistReviewCycleOutcome(
  reviewCycleId: string,
  pullRequest: typeof pullRequests.$inferSelect,
  review: ReviewResult,
  featureId: string | null,
) {
  let prAuthorUserId: string | null = null;
  if (pullRequest.authorLogin) {
    const [installation] = await db
      .select({ userId: githubInstallations.userId })
      .from(githubInstallations)
      .where(eq(githubInstallations.accountLogin, pullRequest.authorLogin));
    prAuthorUserId = installation?.userId ?? null;
  }

  await db
    .update(reviewCycles)
    .set({
      status: review.status === "passed" ? "passed" : "failed",
      overallVerdict: review.status === "passed" ? "approve" : "request_changes",
      summary: review.summary,
      prdComplianceScore: review.complianceScore,
      completedAt: new Date(),
    })
    .where(eq(reviewCycles.id, reviewCycleId));

  if (review.findings.length > 0) {
    await db.insert(reviewIssues).values(
      review.findings.map((finding) => ({
        id: crypto.randomUUID(),
        reviewCycleId,
        category: "prd_compliance",
        severity: finding.severity,
        title: finding.message,
        description: finding.message,
        suggestion:
          finding.severity === "positive"
            ? finding.suggestion?.trim() ?? ""
            : finding.suggestion?.trim() ||
              "Update the pull request to satisfy the linked PRD.",
        filePath: finding.file,
        assignedTo: finding.severity === "blocking" ? prAuthorUserId : null,
      })),
    );
  }

  if (featureId) {
    await db
      .update(featureRequests)
      .set({
        status: review.status === "passed" ? "approved" : "blocked",
        updatedAt: new Date(),
      })
      .where(eq(featureRequests.id, featureId));

    const [feat] = await db
      .select({ organizationId: featureRequests.organizationId })
      .from(featureRequests)
      .where(eq(featureRequests.id, featureId));

    if (feat) {
      await publishOrgEvent(feat.organizationId, {
        type: "review.completed",
        featureId,
        verdict: review.status === "passed" ? "approved" : "changes requested",
        complianceScore: review.complianceScore,
      });
    }
  }
}

function buildReviewMarkdown(review: ReviewResult): string {
  let markdownBody = `### VelocityAI Review 🚢\n\n`;
  markdownBody += `**Verdict:** ${review.status === "passed" ? "✅ Approved" : "❌ Changes Requested"} · **PRD compliance: ${review.complianceScore}/100**\n\n`;
  markdownBody += `${review.summary}\n\n`;
  if (review.findings.length > 0) {
    markdownBody += `#### Findings\n`;
    for (const f of review.findings) {
      markdownBody += `- **${f.severity.toUpperCase()}**: ${f.message}\n`;
      if (f.suggestion?.trim()) {
        markdownBody += `  - 💡 ${f.suggestion.trim()}\n`;
      }
    }
  }
  return markdownBody;
}

async function postGitHubReviewAndCommitStatus(
  octokit: InstallationOctokit,
  owner: string,
  repo: string,
  pullRequest: typeof pullRequests.$inferSelect,
  review: ReviewResult,
  featureId: string | null,
) {
  const markdownBody = buildReviewMarkdown(review);

  try {
    const inlineComments = review.findings
      .filter((f) => f.file && f.file !== "pull request diff")
      .slice(0, 5)
      .map((f) => ({
        path: f.file,
        position: 1,
        body: `**[VelocityAI ${f.severity.toUpperCase()}]**: ${f.message}${
          f.suggestion ? `\n\n💡 **Suggestion**: ${f.suggestion}` : ""
        }`,
      }));

    await octokit.rest.pulls.createReview({
      owner,
      repo,
      pull_number: pullRequest.number,
      commit_id: pullRequest.headSha,
      event: review.status === "passed" ? "APPROVE" : "REQUEST_CHANGES",
      body: markdownBody,
      comments: inlineComments.length > 0 ? inlineComments : undefined,
    });
  } catch {
    try {
      await octokit.rest.issues.createComment({
        owner,
        repo,
        issue_number: pullRequest.number,
        body: markdownBody,
      });
    } catch {
      /* best effort */
    }
  }

  try {
    const targetUrl = featureId
      ? `${process.env.NEXT_PUBLIC_APP_URL || "https://my-ai-code-reviewer.onrender.com"}/features/${featureId}`
      : undefined;

    await octokit.rest.repos.createCommitStatus({
      owner,
      repo,
      sha: pullRequest.headSha,
      state: review.status === "passed" ? "success" : "failure",
      context: "VelocityAI / PRD Compliance",
      description: `PRD Compliance: ${review.complianceScore}/100 (${
        review.status === "passed" ? "Passed" : "Changes requested"
      })`,
      target_url: targetUrl,
    });
  } catch (err) {
    console.error("Failed to post commit status check:", err);
  }
}

/**
 * Runs the full AI review for a cached pull request and posts the result back
 * to GitHub. This is the single source of truth for review execution — it is
 * called both by the Inngest webhook function and directly (inline) from server
 * actions, so reviews work even when Inngest isn't reachable.
 */
export async function runReviewForPullRequest(pullRequestId: string) {
  const [pullRequest] = await db
    .select()
    .from(pullRequests)
    .where(eq(pullRequests.id, pullRequestId));

  if (!pullRequest) {
    throw new Error(`Pull request ${pullRequestId} not found`);
  }

  const featureId = pullRequest.featureId;

  const organizationId = await resolveOrgIdForPullRequest({
    featureId,
    repositoryId: pullRequest.repositoryId,
  });
  if (organizationId) {
    const allowed = await consumeReviewCredit(organizationId);
    if (!allowed) throw new ReviewCreditError();
  }

  const [prd] = featureId
    ? await db.select().from(prds).where(eq(prds.featureId, featureId))
    : [null];

  const app = getGithubApp();
  const [owner, repo] = pullRequest.repoFullName.split("/") as [string, string];

  let installationId = pullRequest.installationId;
  if (!installationId) {
    const { data: inst } = await app.octokit.rest.apps.getRepoInstallation({ owner, repo });
    installationId = inst.id;
  }

  const octokit = await app.getInstallationOctokit(installationId);
  const { files, commits } = await fetchPrFilesAndCommits(octokit, owner, repo, pullRequest.number);

  const [reviewCycle] = await db
    .insert(reviewCycles)
    .values({
      id: crypto.randomUUID(),
      pullRequestId: pullRequest.id,
      featureId,
      headSha: pullRequest.headSha,
      status: "running",
    })
    .returning();

  if (featureId) {
    const [feat] = await db
      .update(featureRequests)
      .set({ status: "in_review", updatedAt: new Date() })
      .where(eq(featureRequests.id, featureId))
      .returning({ organizationId: featureRequests.organizationId });

    if (feat) {
      await publishOrgEvent(feat.organizationId, {
        type: "review.started",
        featureId,
        prNumber: pullRequest.number,
      });
    }
  }

  let review: ReviewResult;
  try {
    review = await reviewPullRequestAgainstPrd({
      repoFullName: pullRequest.repoFullName,
      pullRequestTitle: pullRequest.title,
      prdTitle: prd?.problem ?? null,
      acceptanceCriteria: prd ? safeParseStringArray(prd.acceptanceCriteria) : null,
      files,
      commits,
    });
  } catch (error) {
    await handleReviewFailure(reviewCycle?.id, featureId, error);
    throw error;
  }

  if (reviewCycle) {
    await persistReviewCycleOutcome(reviewCycle.id, pullRequest, review, featureId);
  }

  await postGitHubReviewAndCommitStatus(octokit, owner, repo, pullRequest, review, featureId);

  return review;
}

/** Whether a review cycle already exists for a PR (used to avoid duplicate auto-reviews). */
export async function hasExistingReview(pullRequestId: string): Promise<boolean> {
  const [cycle] = await db
    .select({ id: reviewCycles.id })
    .from(reviewCycles)
    .where(eq(reviewCycles.pullRequestId, pullRequestId))
    .limit(1);
  return Boolean(cycle);
}

/**
 * A completed review cycle covering the PR's current head commit, if one exists.
 * Lets a manual "re-run" reuse the existing review instead of spending a fresh
 * AI call when nothing has changed since the last review.
 */
export async function reviewForCurrentCommit(
  pullRequestId: string,
): Promise<{ id: string; status: string } | null> {
  const [pr] = await db
    .select({ headSha: pullRequests.headSha })
    .from(pullRequests)
    .where(eq(pullRequests.id, pullRequestId));
  if (!pr) return null;

  const [cycle] = await db
    .select({ id: reviewCycles.id, status: reviewCycles.status })
    .from(reviewCycles)
    .where(
      and(
        eq(reviewCycles.pullRequestId, pullRequestId),
        eq(reviewCycles.headSha, pr.headSha),
      ),
    )
    .orderBy(desc(reviewCycles.createdAt))
    .limit(1);

  if (!cycle || (cycle.status !== "passed" && cycle.status !== "failed")) {
    return null;
  }
  return cycle;
}

/**
 * Whether an *auto-triggered* review should be skipped for a PR: a review is
 * already running, or this exact head SHA was already reviewed (webhook
 * re-deliveries, no-op pushes). Manual re-runs bypass this by calling
 * `runReviewForPullRequest` directly.
 */
export async function shouldSkipAutoReview(
  pullRequestId: string,
  headSha: string,
): Promise<boolean> {
  const cycles = await db
    .select({
      status: reviewCycles.status,
      headSha: reviewCycles.headSha,
      createdAt: reviewCycles.createdAt,
    })
    .from(reviewCycles)
    .where(eq(reviewCycles.pullRequestId, pullRequestId));

  // A "running" cycle older than this is presumed crashed and won't block.
  const STUCK_AFTER_MS = 15 * 60 * 1000;
  const now = Date.now();

  return cycles.some((c) => {
    if (c.headSha != null && c.headSha === headSha) return true;
    if (c.status === "running") {
      const age = now - new Date(c.createdAt).getTime();
      return age < STUCK_AFTER_MS;
    }
    return false;
  });
}

import { reviewPullRequestAgainstPrd } from "@/features/ai/qa-reviewer";
import { runReviewForPullRequest, ReviewCreditError } from "@/features/github/review";

import { inngest } from "../client";

export const reviewPullRequestFunction = inngest.createFunction(
  { id: "review-pull-request", triggers: [{ event: "github/pull_request.review_requested" }] },
  async ({ event, step }) => {
    const { pullRequestId } = event.data as {
      pullRequestId?: string;
      repoFullName?: string;
      pullRequestTitle?: string;
      prdTitle?: string;
      acceptanceCriteria?: string[];
      files?: Array<{ filePath: string; patch: string }>;
    };

    // Legacy / direct-invocation path (no DB record) — review the inline payload.
    if (!pullRequestId) {
      return step.run("review-webhook-payload", async () =>
        reviewPullRequestAgainstPrd({
          repoFullName: event.data.repoFullName,
          pullRequestTitle: event.data.pullRequestTitle,
          prdTitle: event.data.prdTitle,
          acceptanceCriteria: event.data.acceptanceCriteria,
          files: event.data.files ?? [],
        }),
      );
    }

    // Standard path: run the shared review pipeline for the cached PR.
    return step.run("run-review", async () => {
      try {
        return await runReviewForPullRequest(pullRequestId);
      } catch (error) {
        // Out of credits is terminal — don't let Inngest retry (and re-charge).
        if (error instanceof ReviewCreditError) {
          return { skipped: true, reason: "no_credits" as const };
        }
        throw error;
      }
    });
  },
);

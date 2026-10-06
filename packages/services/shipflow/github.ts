export type GitHubPullRequestWebhookPayload = {
  repository: {
    full_name: string;
  };
  pull_request: {
    number: number;
    title: string;
    head: {
      sha: string;
    };
    base: {
      ref: string;
    };
    user: {
      login: string;
    } | null;
  };
};

export type PullRequestReviewRequestedEvent = {
  repoFullName: string;
  pullRequestNumber: number;
  pullRequestTitle: string;
  authorLogin: string;
  headSha: string;
  baseBranch: string;
};

const reviewableActions = new Set([
  "opened",
  "reopened",
  "synchronize",
  "ready_for_review",
]);

export function shouldReviewPullRequestAction(action: string) {
  return reviewableActions.has(action);
}

export function toReviewRequestedEvent(
  payload: GitHubPullRequestWebhookPayload,
): PullRequestReviewRequestedEvent {
  return {
    repoFullName: payload.repository.full_name,
    pullRequestNumber: payload.pull_request.number,
    pullRequestTitle: payload.pull_request.title,
    authorLogin: payload.pull_request.user?.login ?? "unknown",
    headSha: payload.pull_request.head.sha,
    baseBranch: payload.pull_request.base.ref,
  };
}

function trimHyphens(value: string): string {
  let start = 0;
  let end = value.length;
  while (start < end && value.codePointAt(start) === 45) {
    start++;
  }
  while (end > start && value.codePointAt(end - 1) === 45) {
    end--;
  }
  return value.slice(start, end);
}

/**
 * Turns an arbitrary string (a feature title or an AI suggestion) into a short,
 * readable, git-safe branch slug — lowercase, hyphen-separated, first few words
 * only, length-capped. Never returns an empty string.
 */
export function slugifyBranchName(input: string): string {
  const base = trimHyphens(
    input
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[^a-z0-9]+/g, "-"),
  );

  const words = base.split("-").filter(Boolean).slice(0, 6);
  let slug = words.join("-");
  if (slug.length > 40) slug = trimHyphens(slug.slice(0, 40));
  return slug || "feature";
}

const FEATURE_BRANCH_RE = /^feature\/(.+)$/;

/**
 * Extracts the slug-or-id portion of a `feature/<ref>` branch, or null when the
 * branch isn't a feature branch. The caller resolves <ref> against stored
 * branch slugs first, then raw feature ids (back-compat).
 */
export function featureBranchRef(branch: string): string | null {
  const match = FEATURE_BRANCH_RE.exec(branch);
  return match?.[1]?.trim() || null;
}

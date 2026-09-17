import test from "node:test";
import assert from "node:assert/strict";

import {
  featureBranchRef,
  shouldReviewPullRequestAction,
  slugifyBranchName,
  toReviewRequestedEvent,
} from "./github";

test("shouldReviewPullRequestAction accepts only review-worthy PR actions", () => {
  assert.equal(shouldReviewPullRequestAction("opened"), true);
  assert.equal(shouldReviewPullRequestAction("synchronize"), true);
  assert.equal(shouldReviewPullRequestAction("closed"), false);
});

test("toReviewRequestedEvent normalizes a GitHub pull request webhook", () => {
  assert.deepEqual(
    toReviewRequestedEvent({
      repository: { full_name: "kaiser/shipflow" },
      pull_request: {
        number: 42,
        title: "Add PRD approval gate",
        head: { sha: "abc123" },
        base: { ref: "main" },
        user: { login: "kaiser" },
      },
    }),
    {
      repoFullName: "kaiser/shipflow",
      pullRequestNumber: 42,
      pullRequestTitle: "Add PRD approval gate",
      authorLogin: "kaiser",
      headSha: "abc123",
      baseBranch: "main",
    },
  );
});

test("shouldReviewPullRequestAction covers reopened and ready_for_review, rejects noise", () => {
  assert.equal(shouldReviewPullRequestAction("reopened"), true);
  assert.equal(shouldReviewPullRequestAction("ready_for_review"), true);
  assert.equal(shouldReviewPullRequestAction("labeled"), false);
  assert.equal(shouldReviewPullRequestAction("assigned"), false);
  assert.equal(shouldReviewPullRequestAction(""), false);
});

test("toReviewRequestedEvent falls back to 'unknown' when the PR has no author", () => {
  const event = toReviewRequestedEvent({
    repository: { full_name: "kaiser/shipflow" },
    pull_request: {
      number: 7,
      title: "Bot PR",
      head: { sha: "deadbeef" },
      base: { ref: "develop" },
      user: null,
    },
  });
  assert.equal(event.authorLogin, "unknown");
  assert.equal(event.baseBranch, "develop");
});

test("slugifyBranchName produces short, git-safe slugs", () => {
  assert.equal(slugifyBranchName("Add a dark mode toggle"), "add-a-dark-mode-toggle");
  assert.equal(slugifyBranchName("  Spaces & Symbols!! "), "spaces-symbols");
  assert.equal(
    slugifyBranchName("This is a very long feature title that should be truncated for branch use").length <= 40,
    true,
  );
  // First six words only.
  assert.equal(slugifyBranchName("one two three four five six seven"), "one-two-three-four-five-six");
});

test("slugifyBranchName never returns an empty string", () => {
  assert.equal(slugifyBranchName("!!!"), "feature");
  assert.equal(slugifyBranchName(""), "feature");
});

test("featureBranchRef extracts the ref after feature/, else null", () => {
  assert.equal(featureBranchRef("feature/add-dark-mode"), "add-dark-mode");
  assert.equal(featureBranchRef("feature/9f3a1b2c-7d4e"), "9f3a1b2c-7d4e");
  assert.equal(featureBranchRef("main"), null);
  assert.equal(featureBranchRef("feat/x"), null);
  assert.equal(featureBranchRef("feature/"), null);
});

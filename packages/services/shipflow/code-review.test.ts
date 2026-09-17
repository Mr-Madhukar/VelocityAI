import assert from "node:assert/strict";
import test from "node:test";

import {
  formatPullRequestFilesForReview,
  reviewPullRequestAgainstPrd,
} from "./code-review";

test("formatPullRequestFilesForReview renders GitHub file patches as markdown diff blocks", () => {
  const markdown = formatPullRequestFilesForReview([
    {
      filePath: "app/page.tsx",
      patch: "+<main>ShipFlow</main>",
    },
  ]);

  assert.match(markdown, /### app\/page\.tsx/);
  assert.match(markdown, /```diff/);
  assert.match(markdown, /\+<main>ShipFlow<\/main>/);
});

test("reviewPullRequestAgainstPrd blocks when an acceptance criterion is missing", () => {
  const review = reviewPullRequestAgainstPrd({
    repoFullName: "acme/web",
    pullRequestTitle: "Add QA gate",
    prdTitle: "AI QA gate",
    acceptanceCriteria: [
      "Blocking findings prevent approval",
      "Post review comment to GitHub",
    ],
    files: [
      {
        filePath: "features/reviews/post-comment.ts",
        patch: "+export async function postComment() { return 'GitHub comment posted' }",
      },
    ],
  });

  assert.equal(review.status, "changes_requested");
  assert.equal(review.findings.some((finding) => finding.severity === "blocking"), true);
});

test("reviewPullRequestAgainstPrd passes when criteria are represented in the diff", () => {
  const review = reviewPullRequestAgainstPrd({
    repoFullName: "acme/web",
    pullRequestTitle: "Add approval blocker",
    prdTitle: "AI QA gate",
    acceptanceCriteria: [
      "Blocking findings prevent approval",
      "Post review comment to GitHub",
    ],
    files: [
      {
        filePath: "features/reviews/review.ts",
        patch:
          "+block approval when blocking findings exist\n+post review comment to GitHub",
      },
    ],
  });

  assert.equal(review.status, "passed");
  assert.equal(review.findings.every((finding) => finding.severity !== "blocking"), true);
});

test("reviewPullRequestAgainstPrd scores 100 when all criteria are represented", () => {
  const review = reviewPullRequestAgainstPrd({
    repoFullName: "acme/web",
    pullRequestTitle: "Add approval blocker",
    prdTitle: "AI QA gate",
    acceptanceCriteria: [
      "Blocking findings prevent approval",
      "Post review comment to GitHub",
    ],
    files: [
      {
        filePath: "features/reviews/review.ts",
        patch:
          "+block approval when blocking findings exist\n+post review comment to GitHub",
      },
    ],
  });

  assert.equal(review.complianceScore, 100);
});

test("reviewPullRequestAgainstPrd compliance score reflects the missing share", () => {
  const review = reviewPullRequestAgainstPrd({
    repoFullName: "acme/web",
    pullRequestTitle: "Add QA gate",
    prdTitle: "AI QA gate",
    acceptanceCriteria: [
      "Blocking findings prevent approval",
      "Post review comment to GitHub",
    ],
    files: [
      {
        filePath: "features/reviews/post-comment.ts",
        patch: "+export async function postComment() { return 'GitHub comment posted' }",
      },
    ],
  });

  // One of two criteria is missing → 50/100, and never the old constant 60.
  assert.equal(review.complianceScore, 50);
  assert.notEqual(review.complianceScore, 60);
});

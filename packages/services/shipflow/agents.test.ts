import assert from "node:assert/strict";
import test from "node:test";

import {
  generateClarificationQuestions,
  generatePrdMarkdown,
  reviewImplementationAgainstCriteria,
} from "./agents";

test("generateClarificationQuestions asks for missing scope and success metrics", () => {
  const questions = generateClarificationQuestions(
    "Customers want better notifications",
  );

  assert.ok(questions.some((question) => question.includes("success")));
  assert.ok(questions.some((question) => question.includes("users")));
});

test("generatePrdMarkdown includes required PRD sections", () => {
  const markdown = generatePrdMarkdown({
    title: "AI QA gate",
    problem: "PRs can ship without matching the PRD.",
    goals: ["Block incorrect releases"],
    nonGoals: ["Auto-merge PRs"],
    userStories: ["As a reviewer, I can see blockers."],
    acceptanceCriteria: ["Blocking findings prevent approval."],
    edgeCases: ["Documentation-only PRs"],
    successMetrics: ["Zero shipped blocking issues"],
  });

  assert.match(markdown, /Problem Statement/);
  assert.match(markdown, /Acceptance Criteria/);
  assert.match(markdown, /Success Metrics/);
});

test("reviewImplementationAgainstCriteria separates blocking and non-blocking findings", () => {
  const review = reviewImplementationAgainstCriteria({
    acceptanceCriteria: [
      "Blocking findings prevent approval",
      "Post review comment to GitHub",
    ],
    implementationNotes:
      "The code posts review comment to GitHub but approval is not blocked yet.",
  });

  assert.equal(review.status, "changes_requested");
  assert.equal(review.blockingFindings.length, 1);
  assert.equal(review.nonBlockingFindings.length, 0);
});

import assert from "node:assert/strict";
import test from "node:test";

import {
  generateClarificationQuestions,
  generatePrdMarkdown,
  reviewImplementationAgainstCriteria,
} from "./agents";
import {
  reviewPullRequestAgainstPrd,
  scoreFromCriteria,
  clampScore,
} from "./code-review";
import {
  createFeatureRequest,
  getNextFeatureStatus,
  summarizeFeatureProgress,
} from "./workflow";

/**
 * AI Agent Model Evaluation & Quality Benchmark Suite
 * Tests and verifies evaluation metrics across all core agent pipelines:
 * 1. Clarification Question Agent
 * 2. PRD Markdown Generation & Section Completeness
 * 3. PRD Criteria Compliance Scoring & QA Review
 * 4. Deterministic Review Logic & Severity Assignment
 * 5. Workflow State Machine Precision
 */

test("EVAL 1: Clarification Agent detects missing context and scope bounds", () => {
  const genericRequest = "Add notifications to our application";
  const questions = generateClarificationQuestions(genericRequest);

  // Eval metric 1: Question count coverage
  assert.ok(questions.length >= 3, `Expected at least 3 clarification questions, got ${questions.length}`);

  // Eval metric 2: Target user context check
  assert.ok(
    questions.some((q) => q.toLowerCase().includes("users")),
    "Clarification agent must probe for affected users",
  );

  // Eval metric 3: Success metric context check
  assert.ok(
    questions.some((q) => q.toLowerCase().includes("metric") || q.toLowerCase().includes("success")),
    "Clarification agent must probe for measurable success metrics",
  );

  // Eval metric 4: Scope boundary check
  assert.ok(
    questions.some((q) => q.toLowerCase().includes("scope")),
    "Clarification agent must probe for out-of-scope bounds",
  );

  // Eval metric 5: Context-dependent trigger (GitHub repo check)
  const ghRequest = "Add webhook integration for GitHub pull requests";
  const ghQuestions = generateClarificationQuestions(ghRequest);
  assert.equal(
    ghQuestions.some((q) => q.includes("Does this feature need to connect with a GitHub")),
    false,
    "Agent should not redundantly ask about GitHub when the request already explicitly mentions it",
  );
});

test("EVAL 2: PRD Generator Agent compiles all required engineering sections into valid markdown", () => {
  const prdDraft = {
    title: "Real-time Notification Service",
    problem: "Users miss critical PR review status updates when away from the tab.",
    goals: ["Deliver notifications in under 200ms", "Support in-app and browser push"],
    nonGoals: ["Email digest delivery in v1", "SMS notifications"],
    userStories: ["As a dev, I get notified when AI review completes"],
    acceptanceCriteria: ["Pusher event emitted on review completion", "Toast notification shown in UI"],
    edgeCases: ["User has multiple active browser tabs open"],
    successMetrics: ["95% of review notifications read within 5 minutes"],
  };

  const markdown = generatePrdMarkdown(prdDraft);

  // Eval metrics: Verify all 7 core PRD sections are rendered
  assert.match(markdown, /## Problem Statement/);
  assert.match(markdown, /## Goals/);
  assert.match(markdown, /## Non-goals/);
  assert.match(markdown, /## User Stories/);
  assert.match(markdown, /## Acceptance Criteria/);
  assert.match(markdown, /## Edge Cases/);
  assert.match(markdown, /## Success Metrics/);
  assert.match(markdown, /Real-time Notification Service/);
});

test("EVAL 3: Criteria Compliance Engine derives exact scores from per-criterion verdicts", () => {
  // Scenario A: 100% compliance
  const allMet = [
    { status: "met" as const },
    { status: "met" as const },
    { status: "met" as const },
  ];
  assert.equal(scoreFromCriteria(allMet), 100);

  // Scenario B: Partial compliance (1 met = 1, 1 partial = 0.5, 1 not_met = 0 -> (1 + 0.5 + 0) / 3 = 50%)
  const mixed = [
    { status: "met" as const },
    { status: "partial" as const },
    { status: "not_met" as const },
  ];
  assert.equal(scoreFromCriteria(mixed), 50);

  // Scenario C: Boundary clamping
  assert.equal(clampScore(-15), 0);
  assert.equal(clampScore(125), 100);
  assert.equal(clampScore(84.7), 85);
});

test("EVAL 4: QA Review Agent identifies missing criteria and assigns blocking severity", () => {
  const reviewResult = reviewPullRequestAgainstPrd({
    repoFullName: "Mr-Madhukar/My-ai-code-reviewer",
    pullRequestTitle: "Add OAuth Google Provider",
    prdTitle: "Google Authentication Flow",
    acceptanceCriteria: [
      "Configure Google OAuth client credentials",
      "Persist auth session cookie securely",
      "Unit test the callback handler",
    ],
    files: [
      {
        filePath: "apps/web/lib/auth.ts",
        patch: "+export const googleAuth = { clientId: process.env.GOOGLE_CLIENT_ID };",
      },
    ],
  });

  const blockingIssues = reviewResult.findings.filter((f) => f.severity === "blocking");
  assert.ok(blockingIssues.length >= 1, "Reviewer must flag at least one missing criterion as blocking");
  assert.equal(reviewResult.status, "changes_requested");
  assert.ok(reviewResult.complianceScore < 100, `Compliance score must be < 100, got ${reviewResult.complianceScore}`);
});

test("EVAL 5: Implementation Review against criteria validates blocking vs non-blocking separation", () => {
  const passReview = reviewImplementationAgainstCriteria({
    acceptanceCriteria: [
      "Blocking findings prevent approval",
      "Display toast on completion",
    ],
    implementationNotes: "We block approval whenever blocking findings are found and display toast",
  });
  assert.equal(passReview.status, "passed");
  assert.equal(passReview.blockingFindings.length, 0);

  const failReview = reviewImplementationAgainstCriteria({
    acceptanceCriteria: [
      "Blocking findings prevent approval",
      "Export PDF report",
    ],
    implementationNotes: "Only added button styling",
  });
  assert.equal(failReview.status, "changes_requested");
  assert.ok(failReview.blockingFindings.length > 0);
});

test("EVAL 6: Workflow Lifecycle State Machine prevents invalid state transitions", () => {
  const feature = createFeatureRequest({
    title: "Export PRD to PDF",
    description: "Download PRD as PDF document",
    createdById: "u_1",
    organizationId: "org_1",
    projectId: "proj_1",
  });

  assert.equal(feature.status, "intake");
  assert.equal(getNextFeatureStatus("intake"), "clarifying");
  assert.equal(getNextFeatureStatus("clarifying"), "prd_generating");
  assert.equal(getNextFeatureStatus("prd_generating"), "prd_ready");
  assert.equal(getNextFeatureStatus("prd_ready"), "tasks_ready");
  assert.equal(getNextFeatureStatus("tasks_ready"), "in_progress");
  assert.equal(getNextFeatureStatus("in_progress"), "in_review");
  assert.equal(getNextFeatureStatus("in_review"), "approved");
  assert.equal(getNextFeatureStatus("approved"), "shipped");
  assert.equal(getNextFeatureStatus("shipped"), "shipped");
  assert.equal(getNextFeatureStatus("blocked"), "clarifying");
});

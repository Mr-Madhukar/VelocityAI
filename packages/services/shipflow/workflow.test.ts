import assert from "node:assert/strict";
import test from "node:test";

import {
  createFeatureRequest,
  getNextFeatureStatus,
  summarizeFeatureProgress,
  type FeatureStatus,
} from "./workflow";

test("createFeatureRequest trims input and starts in intake", () => {
  const feature = createFeatureRequest({
    title: "  AI QA gate  ",
    description: " Review every PR against the approved PRD. ",
    createdById: "user_1",
    organizationId: "org_1",
    projectId: "project_1",
  });

  assert.equal(feature.title, "AI QA gate");
  assert.equal(feature.description, "Review every PR against the approved PRD.");
  assert.equal(feature.status, "intake");
  assert.equal(feature.priority, "medium");
});

test("createFeatureRequest rejects empty titles", () => {
  assert.throws(
    () =>
      createFeatureRequest({
        title: "   ",
        description: "Useful idea",
        createdById: "user_1",
        organizationId: "org_1",
        projectId: "project_1",
      }),
    /title/i,
  );
});

test("getNextFeatureStatus follows the ShipFlow lifecycle", () => {
  const path: FeatureStatus[] = [
    "intake",
    "clarifying",
    "prd_generating",
    "prd_ready",
    "tasks_ready",
    "in_progress",
    "in_review",
    "approved",
    "shipped",
  ];

  const visited: FeatureStatus[] = ["intake"];
  let current: FeatureStatus = "intake";

  while (current !== "shipped") {
    current = getNextFeatureStatus(current);
    visited.push(current);
  }

  assert.deepEqual(visited, path);
});

test("summarizeFeatureProgress returns a user-facing dashboard summary", () => {
  const summary = summarizeFeatureProgress({
    total: 8,
    shipped: 2,
    inReview: 1,
    blocked: 1,
  });

  assert.equal(summary.shippedPercent, 25);
  assert.equal(summary.activeCount, 5);
  assert.equal(summary.health, "attention");
});

test("createFeatureRequest keeps an explicit priority and rejects each missing field", () => {
  const feature = createFeatureRequest({
    title: "Urgent fix",
    description: "Patch the leak",
    createdById: "user_1",
    organizationId: "org_1",
    projectId: "project_1",
    priority: "urgent",
  });
  assert.equal(feature.priority, "urgent");

  const base = {
    title: "t",
    description: "d",
    createdById: "u",
    organizationId: "o",
    projectId: "p",
  };
  assert.throws(() => createFeatureRequest({ ...base, description: "  " }), /description/i);
  assert.throws(() => createFeatureRequest({ ...base, createdById: "" }), /createdById/i);
  assert.throws(() => createFeatureRequest({ ...base, organizationId: "" }), /organizationId/i);
  assert.throws(() => createFeatureRequest({ ...base, projectId: "" }), /projectId/i);
});

test("getNextFeatureStatus is terminal at shipped and recovers from blocked", () => {
  assert.equal(getNextFeatureStatus("shipped"), "shipped");
  assert.equal(getNextFeatureStatus("blocked"), "clarifying");
  // approved is the last step before shipped
  assert.equal(getNextFeatureStatus("approved"), "shipped");
});

test("summarizeFeatureProgress reports empty and healthy states", () => {
  const empty = summarizeFeatureProgress({ total: 0, shipped: 0, inReview: 0, blocked: 0 });
  assert.equal(empty.health, "empty");
  assert.equal(empty.shippedPercent, 0);
  assert.equal(empty.activeCount, 0);

  const healthy = summarizeFeatureProgress({ total: 4, shipped: 3, inReview: 0, blocked: 0 });
  assert.equal(healthy.health, "healthy");
  assert.equal(healthy.shippedPercent, 75);
  assert.equal(healthy.activeCount, 1);
});

test("summarizeFeatureProgress never reports a negative active count", () => {
  const summary = summarizeFeatureProgress({ total: 2, shipped: 2, inReview: 0, blocked: 3 });
  assert.equal(summary.activeCount, 0);
});

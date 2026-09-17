import assert from "node:assert/strict";
import test from "node:test";

import { getDemoWorkspace } from "./demo";

test("getDemoWorkspace returns a complete SaaS dashboard model", () => {
  const workspace = getDemoWorkspace();

  assert.equal(workspace.organization.name, "Acme Cloud");
  assert.ok(workspace.metrics.features.total > 0);
  assert.ok(workspace.features.length >= 4);
  assert.ok(workspace.activity.some((event) => event.kind === "ai_review"));
  assert.ok(workspace.repositories.every((repo) => repo.fullName.includes("/")));
});

test("getDemoWorkspace keeps review counts aligned with feature list", () => {
  const workspace = getDemoWorkspace();
  const inReview = workspace.features.filter(
    (feature) => feature.status === "in_review",
  ).length;

  assert.equal(workspace.metrics.features.inReview, inReview);
});

test("getDemoWorkspace links PRDs, tasks, and reviews to real features", () => {
  const workspace = getDemoWorkspace();
  const featureIds = new Set(workspace.features.map((feature) => feature.id));

  assert.ok(workspace.prds.every((prd) => featureIds.has(prd.featureId)));
  assert.ok(workspace.tasks.every((task) => featureIds.has(task.featureId)));
  assert.ok(workspace.reviews.every((review) => featureIds.has(review.featureId)));
});

test("getDemoWorkspace exposes a coherent billing and onboarding state", () => {
  const workspace = getDemoWorkspace();

  assert.ok(workspace.billing.usedCredits <= workspace.billing.includedCredits);
  assert.ok(workspace.billing.repositoryLimit >= workspace.repositories.length);
  assert.equal(workspace.onboarding.at(-1)?.complete, false);
});

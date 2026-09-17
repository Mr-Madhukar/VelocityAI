import test from "node:test";
import assert from "node:assert/strict";

import {
  bestPlan,
  calculateCreditUsage,
  getPlanDetails,
  normalizeRazorpaySubscriptionEvent,
  resolveCreditPeriod,
} from "./billing";

test("getPlanDetails returns the product limits for each plan", () => {
  assert.deepEqual(getPlanDetails("pro"), {
    plan: "pro",
    label: "Pro",
    monthlyPriceInr: 999,
    includedCredits: 1000,
    repositoryLimit: 10,
    seatsIncluded: 10,
    projectLimit: 10,
    featureLimit: 200,
    organizationLimit: 5,
    promptGenerationLimit: 200,
    chatConversationLimit: 50,
  });
});

test("calculateCreditUsage protects percentage math when credits are empty", () => {
  assert.deepEqual(calculateCreditUsage({ usedCredits: 25, includedCredits: 0 }), {
    usedCredits: 25,
    includedCredits: 0,
    remainingCredits: 0,
    usedPercent: 100,
    status: "over_limit",
  });
});

test("calculateCreditUsage reports healthy / attention / over_limit thresholds", () => {
  const healthy = calculateCreditUsage({ usedCredits: 10, includedCredits: 100 });
  assert.equal(healthy.status, "healthy");
  assert.equal(healthy.usedPercent, 10);
  assert.equal(healthy.remainingCredits, 90);

  const attention = calculateCreditUsage({ usedCredits: 80, includedCredits: 100 });
  assert.equal(attention.status, "attention");
  assert.equal(attention.usedPercent, 80);

  const over = calculateCreditUsage({ usedCredits: 120, includedCredits: 100 });
  assert.equal(over.status, "over_limit");
  assert.equal(over.usedPercent, 100); // capped
  assert.equal(over.remainingCredits, 0); // floored
});

test("getPlanDetails exposes the free and scale tiers", () => {
  assert.equal(getPlanDetails("free").monthlyPriceInr, 0);
  assert.equal(getPlanDetails("free").repositoryLimit, 3);
  assert.equal(getPlanDetails("free").seatsIncluded, 3);
  assert.equal(getPlanDetails("free").projectLimit, 3);
  assert.equal(getPlanDetails("scale").monthlyPriceInr, 1999);
  assert.equal(getPlanDetails("scale").includedCredits, 5000);
  // Scale has no team-size cap.
  assert.equal(getPlanDetails("scale").seatsIncluded, -1);
  assert.equal(getPlanDetails("scale").projectLimit, 50);
});

test("getPlanDetails caps feature requests and organizations per tier", () => {
  assert.equal(getPlanDetails("free").featureLimit, 5);
  assert.equal(getPlanDetails("free").organizationLimit, 2);
  assert.equal(getPlanDetails("pro").featureLimit, 200);
  assert.equal(getPlanDetails("pro").organizationLimit, 5);
  assert.equal(getPlanDetails("scale").featureLimit, 2000);
  assert.equal(getPlanDetails("scale").organizationLimit, 20);
});

test("bestPlan resolves the highest tier a user belongs to", () => {
  assert.equal(bestPlan([]), "free");
  assert.equal(bestPlan(["free", "free"]), "free");
  assert.equal(bestPlan(["free", "pro"]), "pro");
  assert.equal(bestPlan(["pro", "scale", "free"]), "scale");
});

test("normalizeRazorpaySubscriptionEvent ignores unknown events", () => {
  const update = normalizeRazorpaySubscriptionEvent({
    event: "subscription.pending",
    subscriptionId: "sub_x",
  });
  assert.equal(update.handled, false);
  assert.equal(update.plan, "free");
});

test("normalizeRazorpaySubscriptionEvent returns a stable subscription update", () => {
  assert.deepEqual(
    normalizeRazorpaySubscriptionEvent({
      event: "subscription.activated",
      subscriptionId: "sub_123",
      currentEnd: 1_767_225_600,
      organizationId: "org_123",
      userId: "user_123",
    }),
    {
      handled: true,
      subscriptionId: "sub_123",
      organizationId: "org_123",
      userId: "user_123",
      plan: "pro",
      status: "active",
      renewsAt: new Date("2026-01-01T00:00:00.000Z"),
    },
  );
});

test("normalizeRazorpaySubscriptionEvent keeps the targeted plan from notes", () => {
  const update = normalizeRazorpaySubscriptionEvent({
    event: "subscription.charged",
    subscriptionId: "sub_456",
    plan: "scale",
  });
  assert.equal(update.plan, "scale");
  assert.equal(update.status, "charged");
});

test("normalizeRazorpaySubscriptionEvent downgrades to free on cancellation", () => {
  const update = normalizeRazorpaySubscriptionEvent({
    event: "subscription.cancelled",
    subscriptionId: "sub_789",
    plan: "scale",
  });
  assert.equal(update.plan, "free");
  assert.equal(update.status, "canceled");
});

test("resolveCreditPeriod treats a missing reset boundary as expired", () => {
  const now = new Date("2026-06-30T00:00:00.000Z");
  const result = resolveCreditPeriod(now, null, null);
  assert.equal(result.expired, true);
  // No billing cycle → next window is 30 days out.
  assert.equal(
    result.nextResetAt.getTime(),
    new Date("2026-07-30T00:00:00.000Z").getTime(),
  );
});

test("resolveCreditPeriod expires once the reset boundary has passed", () => {
  const now = new Date("2026-06-30T00:00:00.000Z");
  const result = resolveCreditPeriod(now, new Date("2026-06-29T00:00:00.000Z"), null);
  assert.equal(result.expired, true);
});

test("resolveCreditPeriod stays in-period while the reset is still in the future", () => {
  const now = new Date("2026-06-30T00:00:00.000Z");
  const periodEnd = new Date("2026-07-15T00:00:00.000Z");
  const result = resolveCreditPeriod(now, periodEnd, periodEnd);
  assert.equal(result.expired, false);
});

test("resolveCreditPeriod rolls a paid plan to its billing-cycle end", () => {
  const now = new Date("2026-06-30T00:00:00.000Z");
  const periodEnd = new Date("2026-07-31T00:00:00.000Z");
  // Reset already lapsed, but the next cycle end is still ahead → snap to it.
  const result = resolveCreditPeriod(now, new Date("2026-06-01T00:00:00.000Z"), periodEnd);
  assert.equal(result.expired, true);
  assert.equal(result.nextResetAt.getTime(), periodEnd.getTime());
});

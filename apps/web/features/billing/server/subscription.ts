"use server";

import { db, eq } from "@repo/database";
import { subscriptions } from "@repo/database/schema";
import type { BillingPlan } from "@repo/services/shipflow/billing";

import { requireAuth } from "@/features/auth/session";

import { getRazorpayInstance } from "../lib/razorpay";

type PaidPlan = Exclude<BillingPlan, "free">;

// Razorpay subscriptions require a finite number of billing cycles — there is no
// true "infinite". 120 monthly cycles (10 years) acts as effectively
// indefinite auto-renewal; the customer keeps getting charged each month until
// they cancel, well before this horizon is reached.
const BILLING_CYCLE_COUNT = 120;

// Each paid plan maps to a Razorpay plan id configured in the environment.
function planEnvId(plan: PaidPlan): string | undefined {
  switch (plan) {
    case "pro":
      return process.env.RAZORPAY_PRO_PLAN_ID;
    case "scale":
      return process.env.RAZORPAY_SCALE_PLAN_ID;
  }
}

export async function createCheckoutSubscription(plan: PaidPlan) {
  const session = await requireAuth();
  const organizationId = session.session.activeOrganizationId;

  if (!organizationId) {
    return { ok: false as const, error: "Select an organization before upgrading." };
  }

  const keyId = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID;
  const planId = planEnvId(plan);

  if (!keyId || !planId) {
    return {
      ok: false as const,
      error: `Billing isn't configured for the ${plan} plan yet. Set NEXT_PUBLIC_RAZORPAY_KEY_ID and the plan id.`,
    };
  }

  const razorpay = getRazorpayInstance();
  const subscription = await razorpay.subscriptions.create({
    plan_id: planId,
    total_count: BILLING_CYCLE_COUNT,
    customer_notify: 1,
    // The webhook reconciles by these notes — keep plan + org in sync with the row.
    notes: {
      userId: session.user.id,
      organizationId,
      plan,
    },
  });

  // Stash the pending Razorpay subscription id so the webhook can match this org
  // even if its notes are dropped. Ensure a row exists first.
  const [existing] = await db
    .select({ id: subscriptions.id })
    .from(subscriptions)
    .where(eq(subscriptions.organizationId, organizationId));

  if (existing) {
    await db
      .update(subscriptions)
      .set({ razorpaySubscriptionId: subscription.id, updatedAt: new Date() })
      .where(eq(subscriptions.organizationId, organizationId));
  } else {
    await db.insert(subscriptions).values({
      id: crypto.randomUUID(),
      organizationId,
      plan: "free",
      status: "active",
      razorpaySubscriptionId: subscription.id,
    });
  }

  return {
    ok: true as const,
    subscriptionId: subscription.id,
    keyId,
    plan,
  };
}

export async function cancelCheckoutSubscription() {
  const session = await requireAuth();
  const organizationId = session.session.activeOrganizationId;

  if (!organizationId) {
    return { ok: false as const, error: "Select an organization first." };
  }

  const [row] = await db
    .select({ razorpaySubscriptionId: subscriptions.razorpaySubscriptionId })
    .from(subscriptions)
    .where(eq(subscriptions.organizationId, organizationId));

  if (!row?.razorpaySubscriptionId) {
    return { ok: false as const, error: "No active subscription to cancel." };
  }

  const razorpay = getRazorpayInstance();
  // Cancel at cycle end so the org keeps access until the period they paid for.
  await razorpay.subscriptions.cancel(row.razorpaySubscriptionId, true);

  return { ok: true as const };
}

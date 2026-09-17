export const billingPlans = ["free", "pro", "scale"] as const;
export type BillingPlan = (typeof billingPlans)[number];

export type PlanDetails = {
  plan: BillingPlan;
  label: string;
  monthlyPriceInr: number;
  includedCredits: number;
  /** Connected-repository cap. `-1` means unlimited. */
  repositoryLimit: number;
  /** Team-member (seat) cap. `-1` means unlimited. */
  seatsIncluded: number;
  /** Project cap. `-1` means unlimited. */
  projectLimit: number;
  /** Feature-request cap per organization. `-1` means unlimited. */
  featureLimit: number;
  /** How many organizations a user may create/own. `-1` means unlimited. */
  organizationLimit: number;
  /** AI implementation-prompt generations per org per billing period. `-1` = unlimited. */
  promptGenerationLimit: number;
  /** AI-assistant chat conversations per org per billing period. `-1` = unlimited. */
  chatConversationLimit: number;
};

/** A single feature may have at most this many prompt generations, ever. */
export const PROMPTS_PER_FEATURE = 2;

/**
 * Plan tiers, low → high. Used to resolve a user's *best* entitlement when they
 * belong to several organizations on different plans (e.g. the org-creation cap
 * follows their highest-tier org).
 */
export const planRank: Record<BillingPlan, number> = {
  free: 0,
  pro: 1,
  scale: 2,
};

/** Highest-tier plan among the given plans (defaults to free when empty). */
export function bestPlan(plans: BillingPlan[]): BillingPlan {
  return plans.reduce<BillingPlan>(
    (best, plan) => (planRank[plan] > planRank[best] ? plan : best),
    "free",
  );
}

export type CreditUsageInput = {
  usedCredits: number;
  includedCredits: number;
};

export type CreditUsageSummary = CreditUsageInput & {
  remainingCredits: number;
  usedPercent: number;
  status: "healthy" | "attention" | "over_limit";
};

export type RazorpaySubscriptionEventInput = {
  event: string;
  subscriptionId: string;
  currentEnd?: number;
  organizationId?: string;
  userId?: string;
  /** Plan the checkout targeted, carried in the Razorpay subscription notes. */
  plan?: BillingPlan;
};

export type SubscriptionUpdate = {
  handled: boolean;
  subscriptionId: string;
  organizationId?: string;
  userId?: string;
  plan: BillingPlan;
  status: "active" | "charged" | "canceled" | "halted" | "completed";
  renewsAt: Date | null;
};

const planDetails: Record<BillingPlan, PlanDetails> = {
  free: {
    plan: "free",
    label: "Free",
    monthlyPriceInr: 0,
    includedCredits: 100,
    repositoryLimit: 3,
    seatsIncluded: 3,
    projectLimit: 3,
    featureLimit: 5,
    organizationLimit: 2,
    promptGenerationLimit: 10,
    chatConversationLimit: 10,
  },
  pro: {
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
  },
  scale: {
    plan: "scale",
    label: "Scale",
    monthlyPriceInr: 1999,
    includedCredits: 5000,
    repositoryLimit: 50,
    seatsIncluded: -1,
    projectLimit: 50,
    // Top tier — scaled up an order of magnitude from Pro.
    featureLimit: 2000,
    organizationLimit: 20,
    promptGenerationLimit: 500,
    chatConversationLimit: -1,
  },
};

// Per-event status, and whether the event is a downgrade back to the free plan.
// Activation/charge keeps whatever plan the checkout targeted (from notes).
const eventStatusMap: Record<
  string,
  { status: SubscriptionUpdate["status"]; downgrade: boolean }
> = {
  "subscription.activated": { status: "active", downgrade: false },
  "subscription.charged": { status: "charged", downgrade: false },
  "subscription.cancelled": { status: "canceled", downgrade: true },
  "subscription.halted": { status: "halted", downgrade: true },
  "subscription.completed": { status: "completed", downgrade: true },
};

export function getPlanDetails(plan: BillingPlan): PlanDetails {
  return planDetails[plan];
}

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * Decide whether the AI-review credit window has rolled over and, if so, the
 * next reset boundary. Paid plans reset on their billing-cycle end; free (and
 * any plan with no cycle) rolls every 30 days. Pure so both the tRPC usage
 * query and the credit-consuming path share one rule.
 */
export function resolveCreditPeriod(
  now: Date,
  resetAt: Date | null,
  currentPeriodEnd: Date | null,
): { expired: boolean; nextResetAt: Date } {
  const expired = !resetAt || resetAt.getTime() <= now.getTime();
  const nextResetAt =
    currentPeriodEnd && currentPeriodEnd.getTime() > now.getTime()
      ? currentPeriodEnd
      : new Date(now.getTime() + THIRTY_DAYS_MS);
  return { expired, nextResetAt };
}

/**
 * Start of the current usage period for metered AI actions (prompt generation,
 * chat conversations). Paid plans with an active billing cycle count from the
 * current cycle's start (stepping 30-day windows back from `currentPeriodEnd`
 * until the window contains `now`); everyone else uses a rolling 30-day window.
 * Pure so quota checks and any usage UI share one rule.
 */
export function resolveUsagePeriodStart(now: Date, currentPeriodEnd: Date | null): Date {
  const nowMs = now.getTime();
  if (currentPeriodEnd && currentPeriodEnd.getTime() > nowMs) {
    let start = currentPeriodEnd.getTime();
    while (start > nowMs) start -= THIRTY_DAYS_MS;
    return new Date(start);
  }
  return new Date(nowMs - THIRTY_DAYS_MS);
}

export function calculateCreditUsage(
  input: CreditUsageInput,
): CreditUsageSummary {
  const remainingCredits = Math.max(input.includedCredits - input.usedCredits, 0);
  const usedPercent =
    input.includedCredits === 0
      ? 100
      : Math.min(Math.round((input.usedCredits / input.includedCredits) * 100), 100);

  let status: CreditUsageSummary["status"] = "healthy";

  if (input.includedCredits === 0 || input.usedCredits > input.includedCredits) {
    status = "over_limit";
  } else if (usedPercent >= 80) {
    status = "attention";
  }

  return {
    ...input,
    remainingCredits,
    usedPercent,
    status,
  };
}

export function normalizeRazorpaySubscriptionEvent(
  input: RazorpaySubscriptionEventInput,
): SubscriptionUpdate {
  const eventStatus = eventStatusMap[input.event];

  if (!eventStatus) {
    return {
      handled: false,
      subscriptionId: input.subscriptionId,
      organizationId: input.organizationId,
      userId: input.userId,
      plan: "free",
      status: "completed",
      renewsAt: null,
    };
  }

  return {
    handled: true,
    subscriptionId: input.subscriptionId,
    organizationId: input.organizationId,
    userId: input.userId,
    plan: eventStatus.downgrade ? "free" : input.plan ?? "pro",
    status: eventStatus.status,
    renewsAt: input.currentEnd ? new Date(input.currentEnd * 1000) : null,
  };
}

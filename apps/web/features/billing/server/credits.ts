import { db, eq } from "@repo/database";
import { featureRequests, repositories, subscriptions } from "@repo/database/schema";
import { getPlanDetails, resolveCreditPeriod } from "@repo/services/shipflow/billing";

/** Thrown when an AI review can't run because the org is out of credits. */
export class ReviewCreditError extends Error {
  constructor(
    message = "AI review credits exhausted for this billing period. Upgrade your plan to run more reviews.",
  ) {
    super(message);
    this.name = "ReviewCreditError";
  }
}

const FREE = getPlanDetails("free");

async function getOrCreateSubscription(organizationId: string) {
  const [existing] = await db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.organizationId, organizationId));
  if (existing) return existing;

  const [created] = await db
    .insert(subscriptions)
    .values({
      id: crypto.randomUUID(),
      organizationId,
      plan: "free",
      status: "active",
      aiReviewCredits: FREE.includedCredits,
      repositoryLimit: FREE.repositoryLimit,
      creditsResetAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    })
    .returning();
  return created!;
}

/** Resolve the owning org for a cached PR (feature first, then repository). */
export async function resolveOrgIdForPullRequest(pr: {
  featureId: string | null;
  repositoryId: string | null;
}): Promise<string | null> {
  if (pr.featureId) {
    const [feature] = await db
      .select({ organizationId: featureRequests.organizationId })
      .from(featureRequests)
      .where(eq(featureRequests.id, pr.featureId));
    if (feature) return feature.organizationId;
  }
  if (pr.repositoryId) {
    const [repo] = await db
      .select({ organizationId: repositories.organizationId })
      .from(repositories)
      .where(eq(repositories.id, pr.repositoryId));
    if (repo) return repo.organizationId;
  }
  return null;
}

/**
 * Reserve one AI-review credit for the org. Rolls the period over lazily, then
 * either increments usage (returns true) or reports the budget is spent
 * (returns false) — the caller blocks the review on false.
 */
export async function consumeReviewCredit(organizationId: string): Promise<boolean> {
  const sub = await getOrCreateSubscription(organizationId);
  const now = new Date();
  const { expired, nextResetAt } = resolveCreditPeriod(now, sub.creditsResetAt, sub.currentPeriodEnd);
  // A rolled-over period starts at 0 used; otherwise carry the running count.
  const used = expired ? 0 : sub.aiReviewCreditsUsed;
  const included = sub.aiReviewCredits;

  // -1 = unlimited; otherwise block once the allowance is spent.
  if (included !== -1 && used >= included) {
    return false;
  }

  await db
    .update(subscriptions)
    .set({
      aiReviewCreditsUsed: used + 1,
      creditsResetAt: expired ? nextResetAt : sub.creditsResetAt,
      updatedAt: now,
    })
    .where(eq(subscriptions.organizationId, organizationId));
  return true;
}

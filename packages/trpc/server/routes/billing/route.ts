import { count, eq } from "@repo/database";
import {
  featureRequests,
  members,
  projects,
  repositories,
  subscriptions,
} from "@repo/database/schema";
import { getPlanDetails, type BillingPlan } from "@repo/services/shipflow/billing";

import { orgProcedure, router } from "../../trpc";

export const billingRouter = router({
  getSubscription: orgProcedure.query(async ({ ctx }) => {
    const [subscription] = await ctx.db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.organizationId, ctx.org.id));

    if (subscription) {
      return subscription;
    }

    const free = getPlanDetails("free");
    const [created] = await ctx.db
      .insert(subscriptions)
      .values({
        id: crypto.randomUUID(),
        organizationId: ctx.org.id,
        plan: "free",
        status: "active",
        aiReviewCredits: free.includedCredits,
        repositoryLimit: free.repositoryLimit,
      })
      .returning();

    return created;
  }),

  summary: orgProcedure.query(async ({ ctx }) => {
    const [subscription] = await ctx.db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.organizationId, ctx.org.id));

    return subscription ?? null;
  }),

  // Real consumption for the active org — what the org has actually used so the
  // billing page can render usage against each plan's included limits.
  usage: orgProcedure.query(async ({ ctx }) => {
    const [subscription] = await ctx.db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.organizationId, ctx.org.id));

    const [seats] = await ctx.db
      .select({ value: count() })
      .from(members)
      .where(eq(members.organizationId, ctx.org.id));

    const [repos] = await ctx.db
      .select({ value: count() })
      .from(repositories)
      .where(eq(repositories.organizationId, ctx.org.id));

    const [projectsCount] = await ctx.db
      .select({ value: count() })
      .from(projects)
      .where(eq(projects.organizationId, ctx.org.id));

    const [features] = await ctx.db
      .select({ value: count() })
      .from(featureRequests)
      .where(eq(featureRequests.organizationId, ctx.org.id));

    // AI-review credits are metered on the subscription. Show 0 used once the
    // period has rolled over (the consuming path persists the actual reset).
    const periodExpired =
      !subscription?.creditsResetAt || subscription.creditsResetAt.getTime() <= Date.now();
    const creditsUsed = !subscription || periodExpired ? 0 : subscription.aiReviewCreditsUsed;

    // Limits come from the plan (single source of truth), not the stored row, so
    // limit changes apply to existing orgs immediately. `-1` = unlimited.
    const plan = (subscription?.plan ?? "free") as BillingPlan;
    const planDetails = getPlanDetails(plan);

    return {
      plan,
      status: subscription?.status ?? "active",
      currentPeriodEnd: subscription?.currentPeriodEnd ?? null,
      usage: {
        seatsUsed: seats?.value ?? 0,
        seatLimit: planDetails.seatsIncluded,
        repositoriesUsed: repos?.value ?? 0,
        repositoryLimit: planDetails.repositoryLimit,
        projectsUsed: projectsCount?.value ?? 0,
        projectLimit: planDetails.projectLimit,
        featuresCreated: features?.value ?? 0,
        featureLimit: planDetails.featureLimit,
        creditsUsed,
        creditsIncluded: subscription?.aiReviewCredits ?? planDetails.includedCredits,
      },
    };
  }),
});

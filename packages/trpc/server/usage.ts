import { and, count, eq, gte } from "@repo/database";
import { aiConversations, aiUsageEvents, subscriptions } from "@repo/database/schema";
import {
  getPlanDetails,
  PROMPTS_PER_FEATURE,
  resolveUsagePeriodStart,
  type BillingPlan,
} from "@repo/services/shipflow/billing";

import type { Context } from "./context";

const PROMPT_KIND = "prompt_generation";

async function orgPlan(
  ctx: Context,
  orgId: string,
): Promise<{ plan: BillingPlan; currentPeriodEnd: Date | null }> {
  const [sub] = await ctx.db
    .select({ plan: subscriptions.plan, currentPeriodEnd: subscriptions.currentPeriodEnd })
    .from(subscriptions)
    .where(eq(subscriptions.organizationId, orgId));
  return {
    plan: (sub?.plan ?? "free") as BillingPlan,
    currentPeriodEnd: sub?.currentPeriodEnd ?? null,
  };
}

// ── Implementation-prompt generation quota ───────────────────────────────
export type PromptQuota = {
  plan: BillingPlan;
  planLabel: string;
  // Monthly, per org.
  periodUsed: number;
  periodLimit: number;
  // Lifetime, per feature.
  featureUsed: number;
  featureLimit: number;
  canGenerate: boolean;
  reason: string | null;
};

export async function computePromptQuota(
  ctx: Context,
  orgId: string,
  featureId: string,
): Promise<PromptQuota> {
  const { plan, currentPeriodEnd } = await orgPlan(ctx, orgId);
  const details = getPlanDetails(plan);
  const periodStart = resolveUsagePeriodStart(new Date(), currentPeriodEnd);

  const [feat] = await ctx.db
    .select({ value: count() })
    .from(aiUsageEvents)
    .where(and(eq(aiUsageEvents.kind, PROMPT_KIND), eq(aiUsageEvents.featureId, featureId)));

  const [period] = await ctx.db
    .select({ value: count() })
    .from(aiUsageEvents)
    .where(
      and(
        eq(aiUsageEvents.kind, PROMPT_KIND),
        eq(aiUsageEvents.organizationId, orgId),
        gte(aiUsageEvents.createdAt, periodStart),
      ),
    );

  const featureUsed = feat?.value ?? 0;
  const periodUsed = period?.value ?? 0;
  const featureLimit = PROMPTS_PER_FEATURE;
  const periodLimit = details.promptGenerationLimit;

  let reason: string | null = null;
  if (featureUsed >= featureLimit) {
    reason = `You've used all ${featureLimit} prompt generations for this feature.`;
  } else if (periodLimit !== -1 && periodUsed >= periodLimit) {
    reason = `Your ${details.label} plan includes ${periodLimit} prompt generations per month. Upgrade for more.`;
  }

  return {
    plan,
    planLabel: details.label,
    periodUsed,
    periodLimit,
    featureUsed,
    featureLimit,
    canGenerate: reason === null,
    reason,
  };
}

export async function logPromptGeneration(
  ctx: Context,
  orgId: string,
  userId: string,
  featureId: string,
): Promise<void> {
  await ctx.db.insert(aiUsageEvents).values({
    organizationId: orgId,
    userId,
    kind: PROMPT_KIND,
    featureId,
  });
}

// ── Assistant chat quota (metered per conversation) ──────────────────────
export type ChatQuota = {
  plan: BillingPlan;
  planLabel: string;
  used: number;
  limit: number; // -1 = unlimited
  canChat: boolean;
  reason: string | null;
};

export async function computeChatQuota(ctx: Context, orgId: string): Promise<ChatQuota> {
  const { plan, currentPeriodEnd } = await orgPlan(ctx, orgId);
  const details = getPlanDetails(plan);
  const limit = details.chatConversationLimit;

  if (limit === -1) {
    return { plan, planLabel: details.label, used: 0, limit, canChat: true, reason: null };
  }

  const periodStart = resolveUsagePeriodStart(new Date(), currentPeriodEnd);
  const [row] = await ctx.db
    .select({ value: count() })
    .from(aiConversations)
    .where(
      and(
        eq(aiConversations.organizationId, orgId),
        gte(aiConversations.createdAt, periodStart),
      ),
    );

  const used = row?.value ?? 0;
  const reason =
    used >= limit
      ? `Your ${details.label} plan includes ${limit} AI chats per month. Upgrade for more.`
      : null;

  return { plan, planLabel: details.label, used, limit, canChat: reason === null, reason };
}

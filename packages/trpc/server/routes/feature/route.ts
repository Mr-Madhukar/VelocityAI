import { TRPCError } from "@trpc/server";
import { and, asc, count, desc, eq, getTableColumns, sql } from "@repo/database";
import {
  clarificationMessages,
  featureRequests,
  organizations,
  prds,
  pullRequests,
  repositories,
  reviewCycles,
  reviewIssues,
  subscriptions,
  tasks,
  usersTable,
} from "@repo/database/schema";
import { getPlanDetails, type BillingPlan } from "@repo/services/shipflow/billing";

import { ensureFeatureBranchName } from "@repo/database/branch";

import { orgProcedure, router } from "../../trpc";
import { z } from "../../schema";
import { enforceRateLimit } from "../../rate-limit";

const featureStatusSchema = z.enum([
  "intake",
  "clarifying",
  "prd_generating",
  "prd_ready",
  "tasks_ready",
  "in_progress",
  "in_review",
  "approved",
  "shipped",
  "blocked",
]);

export const featureRouter = router({
  create: orgProcedure
    .input(
      z.object({
        projectId: z.string(),
        title: z.string().min(1),
        description: z.string().min(1),
        priority: z.enum(["low", "medium", "high", "urgent"]).default("medium"),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Enforce the plan's feature-request cap (-1 = unlimited).
      const [subscription] = await ctx.db
        .select({ plan: subscriptions.plan })
        .from(subscriptions)
        .where(eq(subscriptions.organizationId, ctx.org.id));

      const plan = (subscription?.plan ?? "free") as BillingPlan;
      const featureLimit = getPlanDetails(plan).featureLimit;

      if (featureLimit !== -1) {
        const [used] = await ctx.db
          .select({ value: count() })
          .from(featureRequests)
          .where(eq(featureRequests.organizationId, ctx.org.id));

        if ((used?.value ?? 0) >= featureLimit) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: `Your ${plan} plan allows up to ${featureLimit} feature requests. Upgrade to create more.`,
          });
        }
      }

      const [feature] = await ctx.db
        .insert(featureRequests)
        .values({
          id: crypto.randomUUID(),
          organizationId: ctx.org.id,
          createdBy: ctx.session.user.id,
          status: "clarifying",
          projectId: input.projectId,
          title: input.title,
          description: input.description,
          priority: input.priority,
        })
        .returning();

      if (!feature) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      // Auto-start: have the AI ask its first clarifying question immediately
      try {
        const { reply } = await ctx.ai.clarify({
          title: input.title,
          description: input.description,
          messages: [],
        });
        await ctx.db.insert(clarificationMessages).values({
          featureId: feature.id,
          role: "assistant",
          content: reply,
        });
      } catch {
        // Non-fatal — clarification can be started manually from the feature page
      }

      await ctx.publish(ctx.org.id, {
        type: "feature.created",
        featureId: feature.id,
        title: feature.title,
        actorName: ctx.session.user.name ?? ctx.session.user.email ?? "Someone",
      });

      return feature;
    }),

  list: orgProcedure
    .input(
      z
        .object({
          projectId: z.string().optional(),
          status: featureStatusSchema.optional(),
        })
        .optional(),
    )
    .query(async ({ ctx, input }) => {
      const conditions = [eq(featureRequests.organizationId, ctx.org.id)];

      if (input?.projectId) {
        conditions.push(eq(featureRequests.projectId, input.projectId));
      }

      if (input?.status) {
        conditions.push(eq(featureRequests.status, input.status));
      }

      // Enrich each feature with its PRD effort estimate and the PRD-compliance
      // score of its most recent review cycle so list/dashboard cards can show
      // those badges without an extra round-trip. The score subquery is
      // correlated (latest cycle per feature); the PRD join is 1:1.
      return ctx.db
        .select({
          ...getTableColumns(featureRequests),
          estimatedHours: prds.estimatedTotalHours,
          complianceScore: sql<number | null>`(
            select rc.prd_compliance_score
            from review_cycle rc
            where rc.feature_id = ${featureRequests.id}
            order by rc.created_at desc
            limit 1
          )`.as("compliance_score"),
        })
        .from(featureRequests)
        .leftJoin(prds, eq(prds.featureId, featureRequests.id))
        .where(and(...conditions))
        .orderBy(desc(featureRequests.createdAt));
    }),

  // Unified, org-wide activity stream for the dashboard: the most recent feature
  // status changes, AI review cycles, and pull requests, merged and sorted by
  // time. Reviews/PRs are scoped to the org via their connected repository.
  recentActivity: orgProcedure
    .input(z.object({ limit: z.number().min(1).max(30).optional() }).optional())
    .query(async ({ ctx, input }) => {
      const limit = input?.limit ?? 12;

      const recentFeatures = await ctx.db
        .select({
          id: featureRequests.id,
          title: featureRequests.title,
          status: featureRequests.status,
          at: featureRequests.updatedAt,
        })
        .from(featureRequests)
        .where(eq(featureRequests.organizationId, ctx.org.id))
        .orderBy(desc(featureRequests.updatedAt))
        .limit(limit);

      const recentReviews = await ctx.db
        .selectDistinct({
          id: reviewCycles.id,
          status: reviewCycles.status,
          score: reviewCycles.prdComplianceScore,
          at: reviewCycles.createdAt,
          featureId: reviewCycles.featureId,
          featureTitle: featureRequests.title,
          prNumber: pullRequests.number,
          prUrl: pullRequests.githubPrUrl,
          repoFullName: pullRequests.repoFullName,
        })
        .from(reviewCycles)
        .innerJoin(pullRequests, eq(reviewCycles.pullRequestId, pullRequests.id))
        .innerJoin(repositories, eq(repositories.fullName, pullRequests.repoFullName))
        .leftJoin(featureRequests, eq(reviewCycles.featureId, featureRequests.id))
        .where(eq(repositories.organizationId, ctx.org.id))
        .orderBy(desc(reviewCycles.createdAt))
        .limit(limit);

      const recentPrs = await ctx.db
        .selectDistinct({
          id: pullRequests.id,
          title: pullRequests.title,
          number: pullRequests.number,
          state: pullRequests.state,
          prUrl: pullRequests.githubPrUrl,
          repoFullName: pullRequests.repoFullName,
          at: pullRequests.updatedAt,
        })
        .from(pullRequests)
        .innerJoin(repositories, eq(repositories.fullName, pullRequests.repoFullName))
        .where(eq(repositories.organizationId, ctx.org.id))
        .orderBy(desc(pullRequests.updatedAt))
        .limit(limit);

      const items = [
        ...recentFeatures.map((f) => ({
          id: `feature-${f.id}`,
          kind: "feature" as const,
          title: f.title,
          subtitle: null as string | null,
          status: f.status,
          score: null as number | null,
          at: f.at,
          href: `/features/${f.id}`,
          externalUrl: null as string | null,
        })),
        ...recentReviews.map((r) => ({
          id: `review-${r.id}`,
          kind: "review" as const,
          title: r.featureTitle ?? "Unlinked review",
          subtitle: `${r.repoFullName} #${r.prNumber}`,
          status: r.status,
          score: r.score,
          at: r.at,
          href: r.featureId ? `/features/${r.featureId}?tab=review-history` : null,
          externalUrl: r.prUrl,
        })),
        ...recentPrs.map((p) => ({
          id: `pr-${p.id}`,
          kind: "pr" as const,
          title: p.title,
          subtitle: `${p.repoFullName} #${p.number}`,
          status: p.state,
          score: null as number | null,
          at: p.at,
          href: null as string | null,
          externalUrl: p.prUrl,
        })),
      ];

      return items
        .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
        .slice(0, limit);
    }),

  getById: orgProcedure
    .input(z.object({ featureId: z.string() }))
    .query(async ({ ctx, input }) => {
      const [feature] = await ctx.db
        .select()
        .from(featureRequests)
        .where(
          and(
            eq(featureRequests.id, input.featureId),
            eq(featureRequests.organizationId, ctx.org.id),
          ),
        );

      if (!feature) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      // Backfill a readable, org-unique branch slug for older features so the
      // review tab can suggest `feature/<slug>`. Idempotent, and never fatal —
      // a backfill failure must not stop the feature from loading.
      let branchName = feature.branchName ?? feature.id;
      try {
        branchName = await ensureFeatureBranchName(ctx.db, feature);
      } catch (err) {
        console.error("Failed to backfill feature branch name:", err);
      }

      // Creator + org name power the "document" PRD view and share/export flows.
      const [creator] = await ctx.db
        .select({ name: usersTable.name, email: usersTable.email })
        .from(usersTable)
        .where(eq(usersTable.id, feature.createdBy));
      const [org] = await ctx.db
        .select({ name: organizations.name })
        .from(organizations)
        .where(eq(organizations.id, feature.organizationId));

      const messages = await ctx.db
        .select()
        .from(clarificationMessages)
        .where(eq(clarificationMessages.featureId, input.featureId));
      const [prd] = await ctx.db
        .select()
        .from(prds)
        .where(eq(prds.featureId, input.featureId));
      const featureTasks = await ctx.db
        .select({
          id: tasks.id,
          featureId: tasks.featureId,
          prdId: tasks.prdId,
          title: tasks.title,
          description: tasks.description,
          type: tasks.type,
          priority: tasks.priority,
          status: tasks.status,
          estimatedHours: tasks.estimatedHours,
          blockedReason: tasks.blockedReason,
          assignedTo: tasks.assignedTo,
          order: tasks.order,
          createdAt: tasks.createdAt,
          updatedAt: tasks.updatedAt,
          assigneeName: usersTable.name,
          assigneeImage: usersTable.image,
          noteCount: sql<number>`(
            select count(*)::int from task_note tn where tn.task_id = ${tasks.id}
          )`.as("note_count"),
        })
        .from(tasks)
        .leftJoin(usersTable, eq(tasks.assignedTo, usersTable.id))
        .where(eq(tasks.featureId, input.featureId));
      const prs = await ctx.db
        .select()
        .from(pullRequests)
        .where(eq(pullRequests.featureId, input.featureId));
      const cyclesRaw = await ctx.db
        .select()
        .from(reviewCycles)
        .where(eq(reviewCycles.featureId, input.featureId))
        .orderBy(desc(reviewCycles.createdAt));
      const cycles = await Promise.all(
        cyclesRaw.map(async (cycle) => ({
          ...cycle,
          issues: await ctx.db
            .select()
            .from(reviewIssues)
            .where(eq(reviewIssues.reviewCycleId, cycle.id)),
        })),
      );

      return {
        ...feature,
        branchName,
        createdByName: creator?.name ?? null,
        createdByEmail: creator?.email ?? null,
        orgName: org?.name ?? null,
        messages,
        prd: prd ?? null,
        tasks: featureTasks,
        pullRequests: prs,
        reviewCycles: cycles,
      };
    }),

  updateStatus: orgProcedure
    .input(z.object({ featureId: z.string(), status: featureStatusSchema }))
    .mutation(async ({ ctx, input }) => {
      const [updated] = await ctx.db
        .update(featureRequests)
        .set({ status: input.status, updatedAt: new Date() })
        .where(
          and(
            eq(featureRequests.id, input.featureId),
            eq(featureRequests.organizationId, ctx.org.id),
          ),
        )
        .returning();

      if (updated) {
        await ctx.publish(ctx.org.id, {
          type: "feature.updated",
          featureId: updated.id,
          title: updated.title,
          status: updated.status,
        });
      }

      return updated;
    }),

  cancelTaskGeneration: orgProcedure
    .input(z.object({ featureId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db
        .update(featureRequests)
        .set({ status: "prd_ready", updatedAt: new Date() })
        .where(
          and(
            eq(featureRequests.id, input.featureId),
            eq(featureRequests.organizationId, ctx.org.id),
            eq(featureRequests.status, "in_progress"),
          ),
        );
      return { cancelled: true };
    }),

  cancelPrdGeneration: orgProcedure
    .input(z.object({ featureId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      // Revert status to clarifying so the Inngest save-prd step will abort on its status check
      await ctx.db
        .update(featureRequests)
        .set({ status: "clarifying", updatedAt: new Date() })
        .where(
          and(
            eq(featureRequests.id, input.featureId),
            eq(featureRequests.organizationId, ctx.org.id),
            eq(featureRequests.status, "prd_generating"),
          ),
        );
      return { cancelled: true };
    }),

  // Manually trigger PRD (re)generation — fires the same Inngest event the AI uses when done clarifying
  triggerPrdGeneration: orgProcedure
    .input(z.object({ featureId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      // Bill/abuse guard: cap how often a single user can kick off PRD generation.
      enforceRateLimit({
        key: `prd-generate:${ctx.session.user.id}`,
        limit: 5,
        windowMs: 60_000,
        message: "You're generating PRDs too quickly — please wait a moment.",
      });

      const [feature] = await ctx.db
        .select({ status: featureRequests.status })
        .from(featureRequests)
        .where(
          and(
            eq(featureRequests.id, input.featureId),
            eq(featureRequests.organizationId, ctx.org.id),
          ),
        );

      if (!feature) throw new TRPCError({ code: "NOT_FOUND" });

      // Don't let a second generation start while one is already running.
      if (feature.status === "prd_generating") {
        throw new TRPCError({
          code: "CONFLICT",
          message: "A PRD is already being generated for this feature.",
        });
      }

      // A PRD already exists → this is an explicit regeneration (new version).
      // Approved PRDs are locked, exactly like manual editing.
      const [existingPrd] = await ctx.db
        .select({ id: prds.id, approvedAt: prds.approvedAt })
        .from(prds)
        .where(eq(prds.featureId, input.featureId));

      if (existingPrd?.approvedAt) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "This PRD is approved and can no longer be regenerated.",
        });
      }

      await ctx.db
        .update(featureRequests)
        .set({ status: "prd_generating", updatedAt: new Date() })
        .where(
          and(
            eq(featureRequests.id, input.featureId),
            eq(featureRequests.organizationId, ctx.org.id),
          ),
        );

      await ctx.emit({
        name: "feature/clarification-complete",
        data: { featureId: input.featureId, regenerate: Boolean(existingPrd) },
      });

      return { triggered: true, regenerated: Boolean(existingPrd) };
    }),

  // Manually trigger task generation — fires the same Inngest event as PRD approval
  triggerTaskGeneration: orgProcedure
    .input(z.object({
      featureId: z.string(),
      specialtyOverrides: z.record(z.string(), z.string()).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      enforceRateLimit({
        key: `task-generate:${ctx.session.user.id}`,
        limit: 5,
        windowMs: 60_000,
        message: "You're generating tasks too quickly — please wait a moment.",
      });

      const [feature] = await ctx.db
        .select({ status: featureRequests.status })
        .from(featureRequests)
        .where(
          and(
            eq(featureRequests.id, input.featureId),
            eq(featureRequests.organizationId, ctx.org.id),
          ),
        );

      if (!feature) throw new TRPCError({ code: "NOT_FOUND" });

      // Block re-triggering while task generation is already running.
      if (feature.status === "in_progress") {
        throw new TRPCError({
          code: "CONFLICT",
          message: "Engineering tasks are already being generated for this feature.",
        });
      }

      await ctx.db
        .update(featureRequests)
        .set({ status: "in_progress", updatedAt: new Date() })
        .where(
          and(
            eq(featureRequests.id, input.featureId),
            eq(featureRequests.organizationId, ctx.org.id),
          ),
        );

      await ctx.emit({
        name: "prd/approved",
        data: { featureId: input.featureId, specialtyOverrides: input.specialtyOverrides ?? {} },
      });

      return { triggered: true };
    }),

  sendClarificationMessage: orgProcedure
    .input(z.object({ featureId: z.string(), message: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      // Each clarification turn is an AI call — throttle to keep costs sane.
      enforceRateLimit({
        key: `clarify:${ctx.session.user.id}`,
        limit: 20,
        windowMs: 60_000,
        message: "You're sending messages too quickly — please slow down.",
      });

      // Save the user's message first
      await ctx.db.insert(clarificationMessages).values({
        id: crypto.randomUUID(),
        featureId: input.featureId,
        role: "user",
        content: input.message,
      });

      // Fetch the feature for title/description context
      const [feature] = await ctx.db
        .select()
        .from(featureRequests)
        .where(
          and(
            eq(featureRequests.id, input.featureId),
            eq(featureRequests.organizationId, ctx.org.id),
          ),
        );

      if (!feature) throw new TRPCError({ code: "NOT_FOUND" });

      // Move from intake → clarifying on the first message
      if (feature.status === "intake") {
        await ctx.db
          .update(featureRequests)
          .set({ status: "clarifying", updatedAt: new Date() })
          .where(eq(featureRequests.id, input.featureId));
      }

      // Fetch the full conversation (including the message we just saved)
      const allMessages = await ctx.db
        .select()
        .from(clarificationMessages)
        .where(eq(clarificationMessages.featureId, input.featureId))
        .orderBy(asc(clarificationMessages.createdAt));

      // Call GPT-4o to get the next question or a completion confirmation
      const { reply, isDone } = await ctx.ai.clarify({
        title: feature.title,
        description: feature.description,
        messages: allMessages.map((m) => ({
          role: m.role as "user" | "assistant",
          content: m.content,
        })),
      });

      // Save the AI response
      await ctx.db.insert(clarificationMessages).values({
        id: crypto.randomUUID(),
        featureId: input.featureId,
        role: "assistant",
        content: reply,
      });

      // When the AI has enough info, trigger the PRD generation pipeline
      if (isDone) {
        await ctx.emit({
          name: "feature/clarification-complete",
          data: { featureId: input.featureId },
        });
      }

      return { reply, isDone };
    }),
});

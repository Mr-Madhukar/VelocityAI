import { and, eq, inArray } from "@repo/database";
import { featureRequests, members, organizations, prds, usersTable } from "@repo/database/schema";
import type { PrdDocumentData } from "@repo/services/shipflow/prd-document";

import { TRPCError } from "@trpc/server";

import { managerProcedure, orgProcedure, router } from "../../trpc";
import { z } from "../../schema";
import { enforceRateLimit } from "../../rate-limit";

function safeParseArray(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as string[]) : [];
  } catch {
    return [];
  }
}

function parsePrd(record: typeof prds.$inferSelect) {
  return {
    ...record,
    goals: safeParseArray(record.goals),
    nonGoals: safeParseArray(record.nonGoals),
    userStories: safeParseArray(record.userStories),
    acceptanceCriteria: safeParseArray(record.acceptanceCriteria),
    edgeCases: safeParseArray(record.edgeCases),
    successMetrics: safeParseArray(record.successMetrics),
    technicalRequirements: safeParseArray(record.technicalRequirements),
    dependencies: safeParseArray(record.dependencies),
    risks: safeParseArray(record.risks),
    requiredDisciplines: safeParseArray(record.requiredDisciplines),
  };
}

const getByFeatureProcedure = orgProcedure
  .input(z.object({ featureId: z.string() }))
  .query(async ({ ctx, input }) => {
    const [prd] = await ctx.db
      .select()
      .from(prds)
      .where(eq(prds.featureId, input.featureId));
    return prd ? parsePrd(prd) : null;
  });

export const prdRouter = router({
  byFeature: getByFeatureProcedure,
  getByFeature: getByFeatureProcedure,

  // Edit PRD content using an AI prompt — locked after approval
  editWithAI: managerProcedure
    .input(z.object({ prdId: z.string(), featureId: z.string(), prompt: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      enforceRateLimit({
        key: `prd-edit:${ctx.session.user.id}`,
        limit: 10,
        windowMs: 60_000,
        message: "You're editing the PRD too quickly — please wait a moment.",
      });

      const [existing] = await ctx.db
        .select()
        .from(prds)
        .where(and(eq(prds.id, input.prdId), eq(prds.featureId, input.featureId)));

      if (!existing) throw new Error("PRD not found");
      if (existing.approvedAt) throw new Error("Cannot edit an approved PRD");

      const currentPrd = {
        problemStatement: existing.problem,
        goals: safeParseArray(existing.goals),
        nonGoals: safeParseArray(existing.nonGoals),
        userStories: safeParseArray(existing.userStories),
        acceptanceCriteria: safeParseArray(existing.acceptanceCriteria),
        edgeCases: safeParseArray(existing.edgeCases),
        successMetrics: safeParseArray(existing.successMetrics),
        technicalRequirements: safeParseArray(existing.technicalRequirements),
        dependencies: safeParseArray(existing.dependencies),
        risks: safeParseArray(existing.risks),
        estimatedTotalHours: existing.estimatedTotalHours,
      };

      const updated = await ctx.ai.editPrd({ currentPrd, editPrompt: input.prompt });

      const [saved] = await ctx.db
        .update(prds)
        .set({
          problem: updated.problemStatement,
          goals: JSON.stringify(updated.goals),
          nonGoals: JSON.stringify(updated.nonGoals),
          userStories: JSON.stringify(updated.userStories),
          acceptanceCriteria: JSON.stringify(updated.acceptanceCriteria),
          edgeCases: JSON.stringify(updated.edgeCases),
          successMetrics: JSON.stringify(updated.successMetrics),
          technicalRequirements: JSON.stringify(updated.technicalRequirements),
          dependencies: JSON.stringify(updated.dependencies),
          risks: JSON.stringify(updated.risks),
          estimatedTotalHours: updated.estimatedTotalHours,
          rawMarkdown: updated.rawMarkdown,
          version: existing.version + 1,
          updatedAt: new Date(),
        })
        .where(eq(prds.id, input.prdId))
        .returning();

      return saved ? parsePrd(saved) : null;
    }),

  // Manager manually edits the estimated total hours — locked after approval
  updateEstimate: managerProcedure
    .input(z.object({ prdId: z.string(), estimatedTotalHours: z.number().int().min(0).nullable() }))
    .mutation(async ({ ctx, input }) => {
      const [existing] = await ctx.db
        .select({ approvedAt: prds.approvedAt })
        .from(prds)
        .where(eq(prds.id, input.prdId));

      if (!existing) throw new Error("PRD not found");
      if (existing.approvedAt) throw new Error("Cannot edit an approved PRD");

      await ctx.db
        .update(prds)
        .set({ estimatedTotalHours: input.estimatedTotalHours, updatedAt: new Date() })
        .where(eq(prds.id, input.prdId));
      return { success: true };
    }),

  // Manager sets the target deadline manually
  setDeadline: managerProcedure
    .input(z.object({ prdId: z.string(), targetDeadline: z.string().nullable() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db
        .update(prds)
        .set({
          targetDeadline: input.targetDeadline ? new Date(input.targetDeadline) : null,
          updatedAt: new Date(),
        })
        .where(eq(prds.id, input.prdId));
      return { success: true };
    }),

  approve: managerProcedure
    .input(z.object({
      prdId: z.string(),
      featureId: z.string(),
      // specialty → userId for slots where no member has that specialty
      specialtyOverrides: z.record(z.string(), z.string()).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      enforceRateLimit({
        key: `prd-approve:${ctx.session.user.id}`,
        limit: 5,
        windowMs: 60_000,
        message: "You're approving too quickly — please wait a moment.",
      });

      // Idempotency / double-click guard: approving already kicks off task
      // generation, so don't let a second approval fire a duplicate run.
      const [existing] = await ctx.db
        .select({ approvedAt: prds.approvedAt })
        .from(prds)
        .where(eq(prds.id, input.prdId));

      if (!existing) throw new TRPCError({ code: "NOT_FOUND", message: "PRD not found" });
      if (existing.approvedAt) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "This PRD has already been approved.",
        });
      }

      await ctx.db
        .update(prds)
        .set({ approvedBy: ctx.session.user.id, approvedAt: new Date() })
        .where(eq(prds.id, input.prdId));

      await ctx.emit({
        name: "prd/approved",
        data: { featureId: input.featureId, specialtyOverrides: input.specialtyOverrides ?? {} },
      });

      return { success: true };
    }),

  // Share a PRD by email — to teammates in the same org (verified emails only;
  // GitHub sign-ins can carry unverified/noreply addresses we can't deliver to)
  // and/or to external addresses typed in directly. The PRD document is
  // rendered and attached as a PDF. Any org member may share (read-oriented).
  share: orgProcedure
    .input(
      z
        .object({
          prdId: z.string(),
          featureId: z.string(),
          recipientUserIds: z.array(z.string()).max(25).default([]),
          externalEmails: z.array(z.string().trim().toLowerCase().email()).max(10).default([]),
          message: z.string().max(1000).optional(),
        })
        .refine((v) => v.recipientUserIds.length + v.externalEmails.length > 0, {
          message: "Select at least one teammate or add an email address.",
        }),
    )
    .mutation(async ({ ctx, input }) => {
      enforceRateLimit({
        key: `prd-share:${ctx.session.user.id}`,
        limit: 10,
        windowMs: 60_000,
        message: "You're sharing too quickly — please wait a moment.",
      });

      // Load the PRD scoped to the feature.
      const [prd] = await ctx.db
        .select()
        .from(prds)
        .where(and(eq(prds.id, input.prdId), eq(prds.featureId, input.featureId)));
      if (!prd) throw new TRPCError({ code: "NOT_FOUND", message: "PRD not found" });

      // Load the feature scoped to the active org (also authorizes access).
      const [feature] = await ctx.db
        .select()
        .from(featureRequests)
        .where(
          and(
            eq(featureRequests.id, input.featureId),
            eq(featureRequests.organizationId, ctx.org.id),
          ),
        );
      if (!feature) throw new TRPCError({ code: "NOT_FOUND", message: "Feature not found" });

      const [creator] = await ctx.db
        .select({ name: usersTable.name })
        .from(usersTable)
        .where(eq(usersTable.id, feature.createdBy));

      const [org] = await ctx.db
        .select({ name: organizations.name })
        .from(organizations)
        .where(eq(organizations.id, ctx.org.id));

      // Resolve teammate recipients — restricted to members of this org whose
      // email is verified (we refuse to send to unverified/noreply addresses).
      const memberRecipients =
        input.recipientUserIds.length > 0
          ? await ctx.db
              .select({ userId: usersTable.id, name: usersTable.name, email: usersTable.email })
              .from(members)
              .innerJoin(usersTable, eq(members.userId, usersTable.id))
              .where(
                and(
                  eq(members.organizationId, ctx.org.id),
                  inArray(members.userId, input.recipientUserIds),
                  eq(usersTable.emailVerified, true),
                ),
              )
          : [];

      const memberEmails = new Set(memberRecipients.map((r) => r.email.toLowerCase()));
      const externalRecipients = [...new Set(input.externalEmails)]
        .filter((email) => !memberEmails.has(email))
        .map((email) => ({ userId: null, name: null, email }));

      const recipients = [...memberRecipients, ...externalRecipients];

      if (recipients.length === 0) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message:
            input.recipientUserIds.length > 0
              ? "None of the selected teammates have a verified email address."
              : "Add at least one recipient.",
        });
      }

      const document: PrdDocumentData = {
        featureTitle: feature.title,
        priority: feature.priority,
        status: feature.status,
        version: prd.version,
        problem: prd.problem,
        goals: safeParseArray(prd.goals),
        nonGoals: safeParseArray(prd.nonGoals),
        userStories: safeParseArray(prd.userStories),
        acceptanceCriteria: safeParseArray(prd.acceptanceCriteria),
        edgeCases: safeParseArray(prd.edgeCases),
        successMetrics: safeParseArray(prd.successMetrics),
        technicalRequirements: safeParseArray(prd.technicalRequirements),
        dependencies: safeParseArray(prd.dependencies),
        risks: safeParseArray(prd.risks),
        estimatedTotalHours: prd.estimatedTotalHours,
        targetDeadline: prd.targetDeadline,
        approvedAt: prd.approvedAt,
        createdByName: creator?.name ?? null,
        createdAt: feature.createdAt,
        orgName: org?.name ?? null,
      };

      const sharedByName = ctx.session.user.name ?? ctx.session.user.email ?? "A teammate";

      // Send to each recipient (skip those without a real email address).
      const results = await Promise.allSettled(
        recipients
          .filter((r) => r.email && r.email.includes("@"))
          .map((r) =>
            ctx.sendPrdShare({
              to: r.email,
              recipientName: r.name,
              sharedByName,
              featureId: feature.id,
              message: input.message?.trim() || undefined,
              document,
            }),
          ),
      );

      // Selected teammates that were dropped by the verified-email filter.
      const skipped = input.recipientUserIds.length - memberRecipients.length;

      const sent = results.filter((r) => r.status === "fulfilled").length;
      const failed = results.length - sent;

      if (sent === 0) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Could not send the PRD to any recipient. Please try again.",
        });
      }

      return { sent, failed, skipped: Math.max(0, skipped) };
    }),
});

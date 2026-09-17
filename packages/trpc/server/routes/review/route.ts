import { TRPCError } from "@trpc/server";
import { and, desc, eq, isNotNull, isNull, ne } from "@repo/database";
import {
  featureRequests,
  pullRequests,
  repositories,
  reviewCycles,
  reviewIssues,
} from "@repo/database/schema";

import type { Context } from "../../context";
import { orgProcedure, router } from "../../trpc";
import { z } from "../../schema";

async function attachIssues(
  ctx: Context,
  cycle: typeof reviewCycles.$inferSelect,
) {
  const issues = await ctx.db
    .select()
    .from(reviewIssues)
    .where(eq(reviewIssues.reviewCycleId, cycle.id));

  return { ...cycle, issues };
}

export const reviewRouter = router({
  // Every review cycle for the org's connected repos (optionally scoped to a
  // project / status / link-state), with feature + PR context joined in. The org
  // is resolved via the PR's connected repo so reviews whose branch never matched
  // a feature (featureId = null) still appear and can be linked later.
  listAllCycles: orgProcedure
    .input(
      z
        .object({
          projectId: z.string().optional(),
          status: z.enum(["running", "passed", "failed"]).optional(),
          linked: z.enum(["all", "linked", "unlinked"]).optional(),
        })
        .optional(),
    )
    .query(async ({ ctx, input }) => {
      const conditions = [eq(repositories.organizationId, ctx.org.id)];
      if (input?.projectId) {
        // A project filter only matches feature-linked cycles (unlinked have no project).
        conditions.push(eq(featureRequests.projectId, input.projectId));
      }
      if (input?.status) {
        conditions.push(eq(reviewCycles.status, input.status));
      }
      if (input?.linked === "linked") {
        conditions.push(isNotNull(reviewCycles.featureId));
      } else if (input?.linked === "unlinked") {
        conditions.push(isNull(reviewCycles.featureId));
      }

      return ctx.db
        .selectDistinct({
          id: reviewCycles.id,
          status: reviewCycles.status,
          overallVerdict: reviewCycles.overallVerdict,
          prdComplianceScore: reviewCycles.prdComplianceScore,
          createdAt: reviewCycles.createdAt,
          completedAt: reviewCycles.completedAt,
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
        .where(and(...conditions))
        .orderBy(desc(reviewCycles.createdAt));
    }),

  // One cycle with its full finding list + feature/PR context for the detail
  // drawer. Org-scoped so a cycle id from another org can't be read.
  getCycle: orgProcedure
    .input(z.object({ cycleId: z.string() }))
    .query(async ({ ctx, input }) => {
      const [row] = await ctx.db
        .selectDistinct({
          cycle: reviewCycles,
          featureTitle: featureRequests.title,
          prNumber: pullRequests.number,
          prUrl: pullRequests.githubPrUrl,
          repoFullName: pullRequests.repoFullName,
        })
        .from(reviewCycles)
        .innerJoin(pullRequests, eq(reviewCycles.pullRequestId, pullRequests.id))
        .innerJoin(repositories, eq(repositories.fullName, pullRequests.repoFullName))
        .leftJoin(featureRequests, eq(reviewCycles.featureId, featureRequests.id))
        .where(
          and(
            eq(reviewCycles.id, input.cycleId),
            eq(repositories.organizationId, ctx.org.id),
          ),
        );

      if (!row) return null;

      const issues = await ctx.db
        .select()
        .from(reviewIssues)
        .where(eq(reviewIssues.reviewCycleId, input.cycleId));

      return {
        ...row.cycle,
        featureTitle: row.featureTitle,
        prNumber: row.prNumber,
        prUrl: row.prUrl,
        repoFullName: row.repoFullName,
        issues,
      };
    }),

  listCyclesByFeature: orgProcedure
    .input(z.object({ featureId: z.string() }))
    .query(async ({ ctx, input }) => {
      const cycles = await ctx.db
        .select()
        .from(reviewCycles)
        .where(eq(reviewCycles.featureId, input.featureId))
        .orderBy(desc(reviewCycles.createdAt));

      return Promise.all(cycles.map((cycle) => attachIssues(ctx, cycle)));
    }),

  getLatestCycle: orgProcedure
    .input(z.object({ featureId: z.string() }))
    .query(async ({ ctx, input }) => {
      const [cycle] = await ctx.db
        .select()
        .from(reviewCycles)
        .where(eq(reviewCycles.featureId, input.featureId))
        .orderBy(desc(reviewCycles.createdAt))
        .limit(1);

      return cycle ? attachIssues(ctx, cycle) : null;
    }),

  // Attach a review cycle (often one whose branch never matched a feature) to a
  // feature, enforcing one active PR per feature: the feature's previous PR and
  // its cycles are detached first. Re-points the cycle's PR too so future
  // commits auto-link, and rolls the verdict up to the feature when the cycle
  // has completed (the user picked this cycle deliberately).
  linkCycleToFeature: orgProcedure
    .input(z.object({ cycleId: z.string(), featureId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      // The cycle must belong to one of this org's connected repos.
      const [row] = await ctx.db
        .selectDistinct({
          pullRequestId: reviewCycles.pullRequestId,
          status: reviewCycles.status,
          prHeadSha: pullRequests.headSha,
        })
        .from(reviewCycles)
        .innerJoin(pullRequests, eq(reviewCycles.pullRequestId, pullRequests.id))
        .innerJoin(repositories, eq(repositories.fullName, pullRequests.repoFullName))
        .where(
          and(
            eq(reviewCycles.id, input.cycleId),
            eq(repositories.organizationId, ctx.org.id),
          ),
        );

      if (!row) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Review not found" });
      }

      // The target feature must belong to this org.
      const [feature] = await ctx.db
        .select({ id: featureRequests.id })
        .from(featureRequests)
        .where(
          and(
            eq(featureRequests.id, input.featureId),
            eq(featureRequests.organizationId, ctx.org.id),
          ),
        );

      if (!feature) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Feature not found" });
      }

      const now = new Date();
      await ctx.db.transaction(async (tx) => {
        // Detach the feature's previous PR(s) and their cycles — one active PR.
        await tx
          .update(pullRequests)
          .set({ featureId: null, linkedHeadSha: null, linkedAt: null, updatedAt: now })
          .where(
            and(
              eq(pullRequests.featureId, input.featureId),
              ne(pullRequests.id, row.pullRequestId),
            ),
          );
        await tx
          .update(reviewCycles)
          .set({ featureId: null })
          .where(
            and(
              eq(reviewCycles.featureId, input.featureId),
              ne(reviewCycles.pullRequestId, row.pullRequestId),
            ),
          );

        // Attach the chosen cycle and re-point its PR so subsequent commits
        // link automatically.
        await tx
          .update(reviewCycles)
          .set({ featureId: input.featureId })
          .where(eq(reviewCycles.id, input.cycleId));
        await tx
          .update(pullRequests)
          .set({
            featureId: input.featureId,
            linkedHeadSha: row.prHeadSha,
            linkedAt: now,
            updatedAt: now,
          })
          .where(eq(pullRequests.id, row.pullRequestId));

        // Reflect a completed verdict on the feature.
        if (row.status === "passed" || row.status === "failed") {
          await tx
            .update(featureRequests)
            .set({
              status: row.status === "passed" ? "approved" : "blocked",
              updatedAt: now,
            })
            .where(eq(featureRequests.id, input.featureId));
        }
      });

      return { linked: true };
    }),

  unlinkCycle: orgProcedure
    .input(z.object({ cycleId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const [row] = await ctx.db
        .selectDistinct({
          pullRequestId: reviewCycles.pullRequestId,
          featureId: reviewCycles.featureId,
        })
        .from(reviewCycles)
        .innerJoin(pullRequests, eq(reviewCycles.pullRequestId, pullRequests.id))
        .innerJoin(repositories, eq(repositories.fullName, pullRequests.repoFullName))
        .where(
          and(
            eq(reviewCycles.id, input.cycleId),
            eq(repositories.organizationId, ctx.org.id),
          ),
        );

      if (!row) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Review not found" });
      }

      const now = new Date();
      await ctx.db.transaction(async (tx) => {
        // Detach every sibling cycle of this PR on that feature — the feature's
        // review history is all-or-nothing per linked PR.
        if (row.featureId) {
          await tx
            .update(reviewCycles)
            .set({ featureId: null })
            .where(
              and(
                eq(reviewCycles.pullRequestId, row.pullRequestId),
                eq(reviewCycles.featureId, row.featureId),
              ),
            );
        } else {
          await tx
            .update(reviewCycles)
            .set({ featureId: null })
            .where(eq(reviewCycles.id, input.cycleId));
        }

        // Detach the PR too so new commits don't re-link to the old feature.
        await tx
          .update(pullRequests)
          .set({ featureId: null, linkedHeadSha: null, linkedAt: null, updatedAt: now })
          .where(eq(pullRequests.id, row.pullRequestId));
      });

      return { unlinked: true };
    }),

  resolveIssue: orgProcedure
    .input(z.object({ issueId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      // Confirm the issue belongs to this org (via its cycle → PR → connected
      // repo) before mutating — otherwise any member could resolve another
      // org's finding by id. Scoped through the repo, not the feature, so
      // issues on detached (feature-less) cycles stay resolvable.
      const [owned] = await ctx.db
        .selectDistinct({ id: reviewIssues.id })
        .from(reviewIssues)
        .innerJoin(reviewCycles, eq(reviewIssues.reviewCycleId, reviewCycles.id))
        .innerJoin(pullRequests, eq(reviewCycles.pullRequestId, pullRequests.id))
        .innerJoin(repositories, eq(repositories.fullName, pullRequests.repoFullName))
        .where(
          and(
            eq(reviewIssues.id, input.issueId),
            eq(repositories.organizationId, ctx.org.id),
          ),
        );

      if (!owned) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Review issue not found" });
      }

      const [updated] = await ctx.db
        .update(reviewIssues)
        .set({ resolved: true })
        .where(eq(reviewIssues.id, input.issueId))
        .returning();

      // Check if all blocking issues for this review cycle are now resolved
      if (updated?.reviewCycleId) {
        const remainingBlocking = await ctx.db
          .select({ id: reviewIssues.id })
          .from(reviewIssues)
          .where(
            and(
              eq(reviewIssues.reviewCycleId, updated.reviewCycleId),
              eq(reviewIssues.severity, "blocking"),
              eq(reviewIssues.resolved, false),
            ),
          );

        if (remainingBlocking.length === 0) {
          await ctx.db
            .update(reviewCycles)
            .set({ status: "passed", overallVerdict: "approve" })
            .where(eq(reviewCycles.id, updated.reviewCycleId));

          const [cycle] = await ctx.db
            .select({ featureId: reviewCycles.featureId })
            .from(reviewCycles)
            .where(eq(reviewCycles.id, updated.reviewCycleId));

          if (cycle?.featureId) {
            await ctx.db
              .update(featureRequests)
              .set({ status: "in_review", updatedAt: new Date() })
              .where(
                and(
                  eq(featureRequests.id, cycle.featureId),
                  eq(featureRequests.status, "blocked"),
                ),
              );
          }
        }
      }

      return updated;
    }),
});

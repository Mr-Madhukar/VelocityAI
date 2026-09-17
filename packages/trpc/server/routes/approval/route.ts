import { TRPCError } from "@trpc/server";
import { and, desc, eq, ne } from "@repo/database";
import { featureRequests, reviewCycles, reviewIssues, tasks } from "@repo/database/schema";

import { managerProcedure, router } from "../../trpc";
import { z } from "../../schema";

export const approvalRouter = router({
  approve: managerProcedure
    .input(
      z.object({
        featureId: z.string(),
        notes: z.string().optional(),
        overrideReason: z.string().min(5).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const [feature] = await ctx.db
        .select()
        .from(featureRequests)
        .where(eq(featureRequests.id, input.featureId));

      if (!feature) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Feature not found" });
      }

      if (feature.status !== "in_review" && feature.status !== "approved") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Feature is not ready for approval (must be in_review)",
        });
      }

      // Check review gating if no manager override was supplied
      if (!input.overrideReason) {
        const [latestCycle] = await ctx.db
          .select()
          .from(reviewCycles)
          .where(eq(reviewCycles.featureId, input.featureId))
          .orderBy(desc(reviewCycles.createdAt))
          .limit(1);

        if (!latestCycle) {
          throw new TRPCError({
            code: "PRECONDITION_FAILED",
            message: "Cannot approve release: No AI code review cycle has been run for this feature.",
          });
        }

        const isPassed =
          latestCycle.status === "passed" || latestCycle.overallVerdict === "approve";

        if (!isPassed) {
          throw new TRPCError({
            code: "PRECONDITION_FAILED",
            message:
              "Cannot approve release: The latest AI code review has not passed. Resolve findings and re-review first.",
          });
        }

        // Verify there are no open blocking issues on this cycle
        const unresolvedBlocking = await ctx.db
          .select({ id: reviewIssues.id })
          .from(reviewIssues)
          .where(
            and(
              eq(reviewIssues.reviewCycleId, latestCycle.id),
              eq(reviewIssues.severity, "blocking"),
              eq(reviewIssues.resolved, false),
            ),
          )
          .limit(1);

        if (unresolvedBlocking.length > 0) {
          throw new TRPCError({
            code: "PRECONDITION_FAILED",
            message: "Cannot approve release: Feature has unresolved blocking review issues.",
          });
        }
      }

      const [updated] = await ctx.db
        .update(featureRequests)
        .set({ status: "approved", updatedAt: new Date() })
        .where(eq(featureRequests.id, input.featureId))
        .returning();

      return updated;
    }),

  reject: managerProcedure
    .input(z.object({ featureId: z.string(), reason: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const [updated] = await ctx.db
        .update(featureRequests)
        .set({ status: "blocked", updatedAt: new Date() })
        .where(eq(featureRequests.id, input.featureId))
        .returning();

      return updated;
    }),

  ship: managerProcedure
    .input(z.object({ featureId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const [feature] = await ctx.db
        .select()
        .from(featureRequests)
        .where(eq(featureRequests.id, input.featureId));

      if (feature?.status !== "approved") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Feature must be approved before shipping",
        });
      }

      // Hard gate: Ensure all engineering tasks associated with this feature are completed
      const pendingTasks = await ctx.db
        .select({ id: tasks.id, title: tasks.title, status: tasks.status })
        .from(tasks)
        .where(
          and(
            eq(tasks.featureId, input.featureId),
            ne(tasks.status, "done"),
          ),
        )
        .limit(1);

      if (pendingTasks.length > 0) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: `Cannot ship feature: Task "${pendingTasks[0]?.title}" is still ${pendingTasks[0]?.status}. All engineering tasks must be completed before shipping.`,
        });
      }

      const [updated] = await ctx.db
        .update(featureRequests)
        .set({ status: "shipped", updatedAt: new Date() })
        .where(eq(featureRequests.id, input.featureId))
        .returning();

      return updated;
    }),
});

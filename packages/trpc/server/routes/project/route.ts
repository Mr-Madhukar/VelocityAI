import { TRPCError } from "@trpc/server";
import { and, count, eq } from "@repo/database";
import { projects, subscriptions } from "@repo/database/schema";
import { getPlanDetails, type BillingPlan } from "@repo/services/shipflow/billing";

import { orgProcedure, router } from "../../trpc";
import { z } from "../../schema";

export const projectRouter = router({
  create: orgProcedure
    .input(
      z.object({
        name: z.string().min(1),
        slug: z.string().min(1),
        description: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Enforce the plan's project cap (-1 = unlimited).
      const [subscription] = await ctx.db
        .select({ plan: subscriptions.plan })
        .from(subscriptions)
        .where(eq(subscriptions.organizationId, ctx.org.id));

      const plan = (subscription?.plan ?? "free") as BillingPlan;
      const projectLimit = getPlanDetails(plan).projectLimit;

      if (projectLimit !== -1) {
        const [used] = await ctx.db
          .select({ value: count() })
          .from(projects)
          .where(eq(projects.organizationId, ctx.org.id));

        if ((used?.value ?? 0) >= projectLimit) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: `Your ${plan} plan allows up to ${projectLimit} projects. Upgrade to create more.`,
          });
        }
      }

      const [project] = await ctx.db
        .insert(projects)
        .values({
          id: crypto.randomUUID(),
          organizationId: ctx.org.id,
          createdBy: ctx.session.user.id,
          name: input.name,
          slug: input.slug,
          description: input.description,
        })
        .returning();

      return project;
    }),

  list: orgProcedure.query(async ({ ctx }) =>
    ctx.db
      .select()
      .from(projects)
      .where(eq(projects.organizationId, ctx.org.id)),
  ),

  getById: orgProcedure
    .input(z.object({ projectId: z.string() }))
    .query(async ({ ctx, input }) => {
      const [project] = await ctx.db
        .select()
        .from(projects)
        .where(
          and(
            eq(projects.id, input.projectId),
            eq(projects.organizationId, ctx.org.id),
          ),
        );

      if (!project) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      return project;
    }),
});

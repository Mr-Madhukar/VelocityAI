import { TRPCError } from "@trpc/server";
import { and, eq } from "@repo/database";
import { members, organizations, sessionsTable, subscriptions } from "@repo/database/schema";
import { bestPlan, getPlanDetails, type BillingPlan } from "@repo/services/shipflow/billing";

import { orgProcedure, protectedProcedure, router } from "../../trpc";
import { z } from "../../schema";

export const orgRouter = router({
  create: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1),
        slug: z.string().min(1).regex(/^[a-z0-9-]+$/),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Cap how many organizations a user may own. The cap follows their
      // highest-tier owned org (a user on a paid org gets the higher allowance).
      const ownedOrgs = await ctx.db
        .select({ plan: subscriptions.plan })
        .from(members)
        .leftJoin(subscriptions, eq(subscriptions.organizationId, members.organizationId))
        .where(and(eq(members.userId, ctx.session.user.id), eq(members.role, "owner")));

      const plan = bestPlan(ownedOrgs.map((o) => (o.plan ?? "free") as BillingPlan));
      const orgLimit = getPlanDetails(plan).organizationLimit;

      if (orgLimit !== -1 && ownedOrgs.length >= orgLimit) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: `Your ${plan} plan allows up to ${orgLimit} organizations. Upgrade to create more.`,
        });
      }

      const id = crypto.randomUUID();
      const [org] = await ctx.db
        .insert(organizations)
        .values({ id, name: input.name, slug: input.slug })
        .returning();

      await ctx.db.insert(members).values({
        id: crypto.randomUUID(),
        organizationId: id,
        userId: ctx.session.user.id,
        role: "owner",
      });

      // Make the new org active in the current session
      await ctx.db
        .update(sessionsTable)
        .set({ activeOrganizationId: id })
        .where(eq(sessionsTable.id, ctx.session.session.id));

      return org;
    }),

  list: protectedProcedure.query(async ({ ctx }) =>
    ctx.db
      .select({
        id: organizations.id,
        name: organizations.name,
        slug: organizations.slug,
        logo: organizations.logo,
      })
      .from(organizations)
      .innerJoin(
        members,
        and(
          eq(members.organizationId, organizations.id),
          eq(members.userId, ctx.session.user.id),
        ),
      ),
  ),

  current: protectedProcedure.query(async ({ ctx }) => {
    const organizationId = ctx.session.session.activeOrganizationId;

    if (!organizationId) {
      return null;
    }

    const [org] = await ctx.db
      .select()
      .from(organizations)
      .where(eq(organizations.id, organizationId));

    return org ?? null;
  }),

  getBySlug: protectedProcedure
    .input(z.object({ slug: z.string() }))
    .query(async ({ ctx, input }) => {
      const [org] = await ctx.db
        .select()
        .from(organizations)
        .innerJoin(
          members,
          and(
            eq(members.organizationId, organizations.id),
            eq(members.userId, ctx.session.user.id),
          ),
        )
        .where(eq(organizations.slug, input.slug));

      if (!org) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      return org.organization;
    }),

  // Update the active org's name/slug — owner only
  update: orgProcedure
    .input(
      z.object({
        name: z.string().min(1).optional(),
        slug: z.string().min(1).regex(/^[a-z0-9-]+$/).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      if (ctx.memberRole !== "owner") {
        throw new TRPCError({ code: "FORBIDDEN", message: "Only the org owner can edit organization settings." });
      }

      const [updated] = await ctx.db
        .update(organizations)
        .set({
          ...(input.name ? { name: input.name } : {}),
          ...(input.slug ? { slug: input.slug } : {}),
        })
        .where(eq(organizations.id, ctx.org.id))
        .returning();

      return updated;
    }),
});

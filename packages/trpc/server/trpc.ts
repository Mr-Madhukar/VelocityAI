import { initTRPC, TRPCError } from "@trpc/server";
import { and, eq } from "@repo/database";
import { members } from "@repo/database/schema";
import { type MemberRole } from "@repo/database/schema";
import { OpenApiMeta } from "trpc-to-openapi";

import { createContext } from "./context";

export const tRPCContext = initTRPC
  .meta<OpenApiMeta>()
  .context<typeof createContext>()
  .create({});

export const router = tRPCContext.router;

export const publicProcedure = tRPCContext.procedure;

export const protectedProcedure = tRPCContext.procedure.use(({ ctx, next }) => {
  if (!ctx.session) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "You must be signed in to access this resource.",
    });
  }

  return next({
    ctx: {
      ...ctx,
      session: ctx.session,
    },
  });
});

// Verifies the user is an actual DB member of their active org and attaches their real role.
export const orgProcedure = protectedProcedure.use(async ({ ctx, next }) => {
  const organizationId = ctx.session.session.activeOrganizationId;

  if (!organizationId) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Select an organization before accessing this resource.",
    });
  }

  const [membership] = await ctx.db
    .select({ role: members.role })
    .from(members)
    .where(
      and(
        eq(members.organizationId, organizationId),
        eq(members.userId, ctx.session.user.id),
      ),
    );

  if (!membership) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "You are not a member of this organization.",
    });
  }

  return next({
    ctx: {
      ...ctx,
      org: { id: organizationId },
      memberRole: membership.role as MemberRole,
    },
  });
});

// manager, admin, owner — can approve PRDs, assign tasks, ship features
export const managerProcedure = orgProcedure.use(({ ctx, next }) => {
  const allowed: MemberRole[] = ["owner", "admin", "manager"];
  if (!allowed.includes(ctx.memberRole)) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "This action requires a manager role or above.",
    });
  }
  return next({ ctx });
});

// admin, owner — manage members, change roles, delete projects
export const adminProcedure = orgProcedure.use(({ ctx, next }) => {
  const allowed: MemberRole[] = ["owner", "admin"];
  if (!allowed.includes(ctx.memberRole)) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "This action requires an admin role or above.",
    });
  }
  return next({ ctx });
});

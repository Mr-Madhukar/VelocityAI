import { randomInt, randomUUID } from "node:crypto";

import { and, count, eq, inArray, ne } from "@repo/database";
import {
  featureRequests,
  members,
  organizations,
  projects,
  subscriptions,
  tasks,
  usersTable,
  verificationsTable,
} from "@repo/database/schema";
import { TRPCError } from "@trpc/server";

import { protectedProcedure, router } from "../../trpc";
import { z } from "../../schema";
import { enforceRateLimit } from "../../rate-limit";

const VERIFY_CODE_TTL_MINUTES = 10;

function verificationIdentifier(userId: string) {
  return `email-verify:${userId}`;
}

export const profileRouter = router({
  // Current user's email + verification state, read fresh from the DB so the
  // UI updates immediately after a successful verification.
  emailStatus: protectedProcedure.query(async ({ ctx }) => {
    const [user] = await ctx.db
      .select({ email: usersTable.email, emailVerified: usersTable.emailVerified })
      .from(usersTable)
      .where(eq(usersTable.id, ctx.session.user.id));

    if (!user) throw new TRPCError({ code: "NOT_FOUND", message: "User not found" });
    return user;
  }),

  // Email a 6-digit code the user can enter to prove they own their address.
  // GitHub sign-ins often land with an unverified (or noreply) email, and we
  // refuse to send PRDs to unverified addresses — this is the way out.
  sendEmailVerificationCode: protectedProcedure.mutation(async ({ ctx }) => {
    enforceRateLimit({
      key: `email-verify-send:${ctx.session.user.id}`,
      limit: 5,
      windowMs: 10 * 60_000,
      message: "Too many verification emails — please wait a few minutes and try again.",
    });

    const [user] = await ctx.db
      .select({ name: usersTable.name, email: usersTable.email, emailVerified: usersTable.emailVerified })
      .from(usersTable)
      .where(eq(usersTable.id, ctx.session.user.id));

    if (!user) throw new TRPCError({ code: "NOT_FOUND", message: "User not found" });
    if (user.emailVerified) return { alreadyVerified: true, email: user.email };
    if (!user.email.includes("@") || user.email.endsWith("@users.noreply.github.com")) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message:
          "Your account has no reachable email address. Make your email public on GitHub or sign in with another method, then try again.",
      });
    }

    const code = randomInt(0, 1_000_000).toString().padStart(6, "0");
    const identifier = verificationIdentifier(ctx.session.user.id);

    // One live code per user — a resend invalidates the previous code.
    await ctx.db.delete(verificationsTable).where(eq(verificationsTable.identifier, identifier));
    await ctx.db.insert(verificationsTable).values({
      id: randomUUID(),
      identifier,
      value: JSON.stringify({ code, email: user.email }),
      expiresAt: new Date(Date.now() + VERIFY_CODE_TTL_MINUTES * 60_000),
    });

    await ctx.sendVerificationCode({
      to: user.email,
      name: user.name,
      code,
      expiresInMinutes: VERIFY_CODE_TTL_MINUTES,
    });

    return { alreadyVerified: false, email: user.email };
  }),

  // Check the 6-digit code and mark the account's email as verified.
  verifyEmailCode: protectedProcedure
    .input(z.object({ code: z.string().regex(/^\d{6}$/, "Enter the 6-digit code") }))
    .mutation(async ({ ctx, input }) => {
      enforceRateLimit({
        key: `email-verify-check:${ctx.session.user.id}`,
        limit: 10,
        windowMs: 10 * 60_000,
        message: "Too many attempts — please wait a few minutes and try again.",
      });

      const identifier = verificationIdentifier(ctx.session.user.id);
      const [record] = await ctx.db
        .select()
        .from(verificationsTable)
        .where(eq(verificationsTable.identifier, identifier));

      if (!record || record.expiresAt.getTime() < Date.now()) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "This code has expired. Request a new one and try again.",
        });
      }

      let stored: { code?: string; email?: string } = {};
      try {
        stored = JSON.parse(record.value) as { code?: string; email?: string };
      } catch {
        // Corrupt record — treat as expired below.
      }

      const [user] = await ctx.db
        .select({ email: usersTable.email })
        .from(usersTable)
        .where(eq(usersTable.id, ctx.session.user.id));

      if (!stored.code || !user || stored.email !== user.email) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "This code is no longer valid. Request a new one and try again.",
        });
      }

      if (stored.code !== input.code) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "That code doesn't match. Double-check the email and try again.",
        });
      }

      await ctx.db
        .update(usersTable)
        .set({ emailVerified: true, updatedAt: new Date() })
        .where(eq(usersTable.id, ctx.session.user.id));
      await ctx.db.delete(verificationsTable).where(eq(verificationsTable.identifier, identifier));

      return { verified: true };
    }),

  // All organizations the current user belongs to, with their role + plan
  memberships: protectedProcedure.query(async ({ ctx }) => {
    const rows = await ctx.db
      .select({
        orgId: organizations.id,
        orgName: organizations.name,
        role: members.role,
        plan: subscriptions.plan,
      })
      .from(members)
      .innerJoin(organizations, eq(organizations.id, members.organizationId))
      .leftJoin(subscriptions, eq(subscriptions.organizationId, organizations.id))
      .where(eq(members.userId, ctx.session.user.id));

    // Attach member count for each org
    const withCounts = await Promise.all(
      rows.map(async (row) => {
        const countResult = await ctx.db
          .select({ memberCount: count() })
          .from(members)
          .where(eq(members.organizationId, row.orgId));
        const memberCount = countResult[0]?.memberCount ?? 0;
        return { ...row, plan: row.plan ?? "free", memberCount };
      }),
    );

    return withCounts;
  }),

  // All tasks assigned to the current user across all orgs
  myTasks: protectedProcedure.query(async ({ ctx }) => {
    const rows = await ctx.db
      .select({
        id: tasks.id,
        title: tasks.title,
        status: tasks.status,
        type: tasks.type,
        featureTitle: featureRequests.title,
        orgName: organizations.name,
        featureId: tasks.featureId,
        organizationId: featureRequests.organizationId,
      })
      .from(tasks)
      .innerJoin(featureRequests, eq(featureRequests.id, tasks.featureId))
      .innerJoin(organizations, eq(organizations.id, featureRequests.organizationId))
      .where(eq(tasks.assignedTo, ctx.session.user.id))
      .limit(20);

    return rows;
  }),

  // Permanently delete the current user's account. Organizations where the
  // user is the only member are deleted outright (cascades wipe their
  // projects, features, PRDs, tasks, reviews, keys, …). In shared orgs the
  // content belongs to the org, so the user's authored projects/features are
  // reassigned to another member — their created_by FKs are ON DELETE
  // RESTRICT and would otherwise block the user delete. The only hard stop:
  // the user is the sole OWNER of an org that still has other members —
  // ownership must be transferred (or the org deleted) first.
  deleteAccount: protectedProcedure
    .input(z.object({ confirmation: z.string() }))
    .mutation(async ({ ctx, input }) => {
      enforceRateLimit({
        key: `delete-account:${ctx.session.user.id}`,
        limit: 5,
        windowMs: 10 * 60_000,
        message: "Too many attempts — please wait a few minutes and try again.",
      });

      const userId = ctx.session.user.id;
      const [user] = await ctx.db
        .select({ email: usersTable.email })
        .from(usersTable)
        .where(eq(usersTable.id, userId));
      if (!user) throw new TRPCError({ code: "NOT_FOUND", message: "User not found" });

      if (input.confirmation.trim().toLowerCase() !== user.email.toLowerCase()) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Type your account email exactly to confirm deletion.",
        });
      }

      const myMemberships = await ctx.db
        .select({
          orgId: members.organizationId,
          orgName: organizations.name,
          role: members.role,
        })
        .from(members)
        .innerJoin(organizations, eq(organizations.id, members.organizationId))
        .where(eq(members.userId, userId));

      const ROLE_PRIORITY: Record<string, number> = {
        owner: 0,
        admin: 1,
        manager: 2,
        developer: 3,
      };

      const soloOrgIds: string[] = [];
      const reassignTargets = new Map<string, string>(); // orgId -> new createdBy
      const blockedOrgs: string[] = [];

      for (const m of myMemberships) {
        const others = await ctx.db
          .select({ userId: members.userId, role: members.role })
          .from(members)
          .where(and(eq(members.organizationId, m.orgId), ne(members.userId, userId)));

        if (others.length === 0) {
          soloOrgIds.push(m.orgId);
          continue;
        }
        if (m.role === "owner" && !others.some((o) => o.role === "owner")) {
          blockedOrgs.push(m.orgName);
          continue;
        }
        others.sort((a, b) => (ROLE_PRIORITY[a.role] ?? 9) - (ROLE_PRIORITY[b.role] ?? 9));
        reassignTargets.set(m.orgId, others[0]!.userId);
      }

      if (blockedOrgs.length > 0) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: `You are the only owner of ${blockedOrgs.join(
            ", ",
          )}. Transfer ownership to another member (or remove the other members so the organization is deleted with your account) and try again.`,
        });
      }

      // Content authored in orgs the user is no longer a member of would still
      // block the delete via the RESTRICT FKs — sweep those orgs the same way.
      const authoredOrgIds = new Set<string>();
      const authoredProjects = await ctx.db
        .select({ orgId: projects.organizationId })
        .from(projects)
        .where(eq(projects.createdBy, userId));
      const authoredFeatures = await ctx.db
        .select({ orgId: featureRequests.organizationId })
        .from(featureRequests)
        .where(eq(featureRequests.createdBy, userId));
      for (const row of [...authoredProjects, ...authoredFeatures]) authoredOrgIds.add(row.orgId);

      for (const orgId of authoredOrgIds) {
        if (soloOrgIds.includes(orgId) || reassignTargets.has(orgId)) continue;
        const [anyMember] = await ctx.db
          .select({ userId: members.userId })
          .from(members)
          .where(and(eq(members.organizationId, orgId), ne(members.userId, userId)))
          .limit(1);
        // An org with no remaining members has nobody left to own the content.
        if (anyMember) reassignTargets.set(orgId, anyMember.userId);
        else soloOrgIds.push(orgId);
      }

      await ctx.db.transaction(async (tx) => {
        if (soloOrgIds.length > 0) {
          await tx.delete(organizations).where(inArray(organizations.id, soloOrgIds));
        }
        for (const [orgId, targetId] of reassignTargets) {
          await tx
            .update(projects)
            .set({ createdBy: targetId })
            .where(and(eq(projects.organizationId, orgId), eq(projects.createdBy, userId)));
          await tx
            .update(featureRequests)
            .set({ createdBy: targetId })
            .where(and(eq(featureRequests.organizationId, orgId), eq(featureRequests.createdBy, userId)));
        }
        // The user row cascades to sessions, accounts, memberships, device
        // codes, GitHub installations, comments, and AI conversations.
        await tx.delete(usersTable).where(eq(usersTable.id, userId));
        await tx
          .delete(verificationsTable)
          .where(eq(verificationsTable.identifier, verificationIdentifier(userId)));
      });

      return { deleted: true };
    }),
});

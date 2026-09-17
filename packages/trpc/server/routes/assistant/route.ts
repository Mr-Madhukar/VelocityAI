import { TRPCError } from "@trpc/server";
import { and, asc, count, desc, eq } from "@repo/database";
import {
  aiConversations,
  aiMessages,
  featureRequests,
  organizations,
  projects,
  repositories,
  subscriptions,
  tasks,
} from "@repo/database/schema";

import type { Context } from "../../context";
import { orgProcedure, router } from "../../trpc";
import { z } from "../../schema";
import { enforceRateLimit } from "../../rate-limit";
import { computeChatQuota } from "../../usage";

// Assemble a compact, bounded snapshot of the org's workspace for the model to
// ground its answers in. Deliberately name-based (no raw IDs) and length-capped.
async function buildAssistantContext(ctx: Context, orgId: string): Promise<string> {
  const [org] = await ctx.db
    .select({ name: organizations.name })
    .from(organizations)
    .where(eq(organizations.id, orgId));

  const [sub] = await ctx.db
    .select({ plan: subscriptions.plan })
    .from(subscriptions)
    .where(eq(subscriptions.organizationId, orgId));

  const projectRows = await ctx.db
    .select({ id: projects.id, name: projects.name, techStack: projects.techStack })
    .from(projects)
    .where(eq(projects.organizationId, orgId));

  const repoRows = await ctx.db
    .select({ fullName: repositories.fullName })
    .from(repositories)
    .where(eq(repositories.organizationId, orgId));

  const featureRows = await ctx.db
    .select({
      title: featureRequests.title,
      status: featureRequests.status,
      priority: featureRequests.priority,
      projectId: featureRequests.projectId,
    })
    .from(featureRequests)
    .where(eq(featureRequests.organizationId, orgId))
    .orderBy(desc(featureRequests.updatedAt))
    .limit(50);

  const taskCounts = await ctx.db
    .select({ status: tasks.status, value: count() })
    .from(tasks)
    .innerJoin(featureRequests, eq(featureRequests.id, tasks.featureId))
    .where(eq(featureRequests.organizationId, orgId))
    .groupBy(tasks.status);

  const projectName = new Map(projectRows.map((p) => [p.id, p.name]));

  const lines: string[] = [];
  lines.push(`Organization: ${org?.name ?? "Unknown"} (plan: ${sub?.plan ?? "free"})`);

  lines.push(
    `Projects (${projectRows.length}): ${
      projectRows.length > 0
        ? projectRows
            .map((p) => (p.techStack ? `${p.name} [${p.techStack}]` : p.name))
            .join(", ")
        : "none yet"
    }`,
  );

  lines.push(
    `Repositories connected: ${
      repoRows.length > 0 ? repoRows.map((r) => r.fullName).join(", ") : "none connected"
    }`,
  );

  if (taskCounts.length > 0) {
    lines.push(
      `Tasks by status: ${taskCounts.map((t) => `${t.status}=${t.value}`).join(", ")}`,
    );
  }

  if (featureRows.length > 0) {
    lines.push(`\nFeatures (most recent ${featureRows.length}):`);
    for (const f of featureRows) {
      const proj = projectName.get(f.projectId);
      lines.push(
        `- ${f.title} — status: ${f.status}, priority: ${f.priority}${
          proj ? ` [${proj}]` : ""
        }`,
      );
    }
  } else {
    lines.push("\nNo features created yet.");
  }

  return lines.join("\n");
}

// Load a conversation scoped to the caller (their own, in the active org).
async function loadOwnConversation(ctx: Context, id: string, orgId: string, userId: string) {
  const [conv] = await ctx.db
    .select()
    .from(aiConversations)
    .where(
      and(
        eq(aiConversations.id, id),
        eq(aiConversations.organizationId, orgId),
        eq(aiConversations.userId, userId),
      ),
    );
  return conv ?? null;
}

function deriveTitle(content: string): string {
  const trimmed = content.trim().replace(/\s+/g, " ");
  return trimmed.length > 60 ? `${trimmed.slice(0, 57)}…` : trimmed || "New chat";
}

export const assistantRouter = router({
  quota: orgProcedure.query(({ ctx }) => computeChatQuota(ctx, ctx.org.id)),

  listConversations: orgProcedure.query(async ({ ctx }) => {
    return ctx.db
      .select({
        id: aiConversations.id,
        title: aiConversations.title,
        createdAt: aiConversations.createdAt,
        updatedAt: aiConversations.updatedAt,
      })
      .from(aiConversations)
      .where(
        and(
          eq(aiConversations.organizationId, ctx.org.id),
          eq(aiConversations.userId, ctx.session.user.id),
        ),
      )
      .orderBy(desc(aiConversations.updatedAt))
      .limit(50);
  }),

  getConversation: orgProcedure
    .input(z.object({ conversationId: z.string() }))
    .query(async ({ ctx, input }) => {
      const conv = await loadOwnConversation(
        ctx,
        input.conversationId,
        ctx.org.id,
        ctx.session.user.id,
      );
      if (!conv) throw new TRPCError({ code: "NOT_FOUND", message: "Conversation not found." });

      const messages = await ctx.db
        .select({
          id: aiMessages.id,
          role: aiMessages.role,
          content: aiMessages.content,
          createdAt: aiMessages.createdAt,
        })
        .from(aiMessages)
        .where(eq(aiMessages.conversationId, conv.id))
        .orderBy(asc(aiMessages.createdAt));

      return { conversation: conv, messages };
    }),

  deleteConversation: orgProcedure
    .input(z.object({ conversationId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const conv = await loadOwnConversation(
        ctx,
        input.conversationId,
        ctx.org.id,
        ctx.session.user.id,
      );
      if (!conv) throw new TRPCError({ code: "NOT_FOUND", message: "Conversation not found." });
      await ctx.db.delete(aiConversations).where(eq(aiConversations.id, conv.id));
      return { success: true };
    }),

  sendMessage: orgProcedure
    .input(
      z.object({
        conversationId: z.string().optional(),
        content: z.string().trim().min(1).max(2000),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      enforceRateLimit({
        key: `assistant-chat:${ctx.session.user.id}`,
        limit: 20,
        windowMs: 60_000,
        message: "You're sending messages too quickly — please wait a moment.",
      });

      let conversationId = input.conversationId ?? null;

      if (conversationId) {
        const conv = await loadOwnConversation(
          ctx,
          conversationId,
          ctx.org.id,
          ctx.session.user.id,
        );
        if (!conv) throw new TRPCError({ code: "NOT_FOUND", message: "Conversation not found." });
      } else {
        // A new conversation consumes one chat from the monthly plan quota.
        const quota = await computeChatQuota(ctx, ctx.org.id);
        if (!quota.canChat) {
          throw new TRPCError({ code: "FORBIDDEN", message: quota.reason ?? "Chat limit reached." });
        }
        const [conv] = await ctx.db
          .insert(aiConversations)
          .values({
            organizationId: ctx.org.id,
            userId: ctx.session.user.id,
            title: deriveTitle(input.content),
          })
          .returning({ id: aiConversations.id });
        if (!conv) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        conversationId = conv.id;
      }

      // Prior turns (before this message) for model context.
      const history = await ctx.db
        .select({ role: aiMessages.role, content: aiMessages.content })
        .from(aiMessages)
        .where(eq(aiMessages.conversationId, conversationId))
        .orderBy(asc(aiMessages.createdAt));

      // Persist the user's message.
      await ctx.db.insert(aiMessages).values({
        conversationId,
        role: "user",
        content: input.content,
      });

      const context = await buildAssistantContext(ctx, ctx.org.id);

      const priorMessages = history.map((m) => ({
        role: m.role === "assistant" ? ("assistant" as const) : ("user" as const),
        content: m.content,
      }));

      const { reply } = await ctx.ai.assistantChat({
        context,
        messages: [...priorMessages, { role: "user", content: input.content }],
      });

      const [assistantMessage] = await ctx.db
        .insert(aiMessages)
        .values({ conversationId, role: "assistant", content: reply })
        .returning();

      await ctx.db
        .update(aiConversations)
        .set({ updatedAt: new Date() })
        .where(eq(aiConversations.id, conversationId));

      return {
        conversationId,
        reply,
        message: assistantMessage ?? null,
      };
    }),
});

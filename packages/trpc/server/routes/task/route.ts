import { TRPCError } from "@trpc/server";
import { and, asc, eq } from "@repo/database";
import { featureRequests, taskNotes, tasks, usersTable } from "@repo/database/schema";

import type { Context } from "../../context";
import { orgProcedure, router } from "../../trpc";
import { z } from "../../schema";

// Guard: the task exists AND belongs to the caller's active org (tasks are
// org-scoped through their feature). Throws NOT_FOUND otherwise.
async function assertTaskInOrg(ctx: Context, taskId: string, orgId: string) {
  const [row] = await ctx.db
    .select({ id: tasks.id })
    .from(tasks)
    .innerJoin(featureRequests, eq(featureRequests.id, tasks.featureId))
    .where(and(eq(tasks.id, taskId), eq(featureRequests.organizationId, orgId)));
  if (!row) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Task not found." });
  }
}

async function listGroupedTasks(ctx: Context, featureId: string) {
  const all = await ctx.db
    .select()
    .from(tasks)
    .where(eq(tasks.featureId, featureId))
    .orderBy(asc(tasks.order));

  return {
    todo: all.filter((task) => task.status === "todo"),
    in_progress: all.filter((task) => task.status === "in_progress"),
    done: all.filter((task) => task.status === "done"),
    blocked: all.filter((task) => task.status === "blocked"),
  };
}

export const taskRouter = router({
  byFeature: orgProcedure
    .input(z.object({ featureId: z.string() }))
    .query(({ ctx, input }) => listGroupedTasks(ctx, input.featureId)),

  listByFeature: orgProcedure
    .input(z.object({ featureId: z.string() }))
    .query(({ ctx, input }) => listGroupedTasks(ctx, input.featureId)),

  updateStatus: orgProcedure
    .input(
      z.object({
        taskId: z.string(),
        status: z.enum(["todo", "in_progress", "done", "blocked"]),
        blockedReason: z.string().nullish(),
        order: z.number().int().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const [updated] = await ctx.db
        .update(tasks)
        .set({
          status: input.status,
          // Clear the blocked reason whenever a task leaves the blocked column
          blockedReason: input.status === "blocked" ? input.blockedReason ?? null : null,
          ...(input.order !== undefined ? { order: input.order } : {}),
          updatedAt: new Date(),
        })
        .where(eq(tasks.id, input.taskId))
        .returning();

      if (updated) {
        await ctx.publish(ctx.org.id, {
          type: "task.updated",
          taskId: updated.id,
          title: updated.title,
          status: updated.status,
        });
      }

      return updated;
    }),

  // Persist the full board (status + order + blocked reason) after drag-and-drop
  reorder: orgProcedure
    .input(
      z.object({
        items: z.array(
          z.object({
            taskId: z.string(),
            status: z.enum(["todo", "in_progress", "done", "blocked"]),
            order: z.number().int(),
            blockedReason: z.string().nullish(),
          }),
        ),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await Promise.all(
        input.items.map((item) =>
          ctx.db
            .update(tasks)
            .set({
              status: item.status,
              order: item.order,
              // Reason only persists while a task is in the blocked column
              blockedReason: item.status === "blocked" ? item.blockedReason ?? null : null,
              updatedAt: new Date(),
            })
            .where(eq(tasks.id, item.taskId)),
        ),
      );
      return { success: true };
    }),

  assignTo: orgProcedure
    .input(z.object({ taskId: z.string(), userId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const [updated] = await ctx.db
        .update(tasks)
        .set({ assignedTo: input.userId, updatedAt: new Date() })
        .where(eq(tasks.id, input.taskId))
        .returning();

      if (updated) {
        await ctx.publish(ctx.org.id, {
          type: "task.updated",
          taskId: updated.id,
          title: updated.title,
          status: updated.status,
        });
      }

      return updated;
    }),

  // ── Task notes (threaded discussion) ──────────────────────────────────
  listNotes: orgProcedure
    .input(z.object({ taskId: z.string() }))
    .query(async ({ ctx, input }) => {
      await assertTaskInOrg(ctx, input.taskId, ctx.org.id);
      return ctx.db
        .select({
          id: taskNotes.id,
          taskId: taskNotes.taskId,
          userId: taskNotes.userId,
          parentId: taskNotes.parentId,
          content: taskNotes.content,
          createdAt: taskNotes.createdAt,
          authorName: usersTable.name,
          authorImage: usersTable.image,
        })
        .from(taskNotes)
        .innerJoin(usersTable, eq(usersTable.id, taskNotes.userId))
        .where(eq(taskNotes.taskId, input.taskId))
        .orderBy(asc(taskNotes.createdAt));
    }),

  addNote: orgProcedure
    .input(
      z.object({
        taskId: z.string(),
        content: z.string().trim().min(1).max(4000),
        // Present when this note is a reply to an existing note.
        parentId: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await assertTaskInOrg(ctx, input.taskId, ctx.org.id);

      if (input.parentId) {
        // The reply target must belong to the same task.
        const [parent] = await ctx.db
          .select({ id: taskNotes.id })
          .from(taskNotes)
          .where(
            and(eq(taskNotes.id, input.parentId), eq(taskNotes.taskId, input.taskId)),
          );
        if (!parent) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Reply target not found." });
        }
      }

      const [note] = await ctx.db
        .insert(taskNotes)
        .values({
          taskId: input.taskId,
          userId: ctx.session.user.id,
          parentId: input.parentId ?? null,
          content: input.content,
        })
        .returning();

      if (!note) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      return {
        ...note,
        authorName: ctx.session.user.name ?? null,
        authorImage: ctx.session.user.image ?? null,
      };
    }),
});

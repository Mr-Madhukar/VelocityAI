import { db, eq } from "@repo/database";
import { featureRequests, members, prds, tasks, usersTable, SPECIALTY_TASK_TYPES } from "@repo/database/schema";

import { generateTasks, type Developer } from "@/features/ai/task-generator";
import { publishOrgEvent } from "@/lib/realtime/server";

import { inngest } from "../client";

export const generateTasksFailureHandler = inngest.createFunction(
  { id: "generate-tasks-on-failure", triggers: [{ event: "inngest/function.failed" }] },
  async ({ event }) => {
    if ((event.data as { function_id?: string }).function_id !== "generate-tasks") return;
    const featureId = (event.data as { event?: { data?: { featureId?: string } } }).event?.data?.featureId;
    if (!featureId) return;
    await db
      .update(featureRequests)
      .set({ status: "prd_ready", updatedAt: new Date() })
      .where(eq(featureRequests.id, featureId));
  },
);

export const generateTasksFunction = inngest.createFunction(
  { id: "generate-tasks", triggers: [{ event: "prd/approved" }] },
  async ({ event, step }) => {
    const { featureId, specialtyOverrides = {} } = event.data as {
      featureId: string;
      specialtyOverrides?: Record<string, string>;
    };

    const { prd, feature } = await step.run("fetch-prd", async () => {
      const [record] = await db
        .select()
        .from(prds)
        .where(eq(prds.featureId, featureId));

      const [feat] = await db
        .select()
        .from(featureRequests)
        .where(eq(featureRequests.id, featureId));

      if (!record || !feat) throw new Error(`PRD or feature not found for ${featureId}`);
      return { prd: record, feature: feat };
    });

    await step.run("set-planning", async () => {
      await db
        .update(featureRequests)
        .set({ status: "in_progress", updatedAt: new Date() })
        .where(eq(featureRequests.id, featureId));
    });

    // Fetch all org members so the AI can assign tasks to real people
    const developers = await step.run("fetch-developers", async (): Promise<Developer[]> => {
      const rows = await db
        .select({ userId: usersTable.id, name: usersTable.name, specialty: members.specialty })
        .from(members)
        .innerJoin(usersTable, eq(members.userId, usersTable.id))
        .where(eq(members.organizationId, feature.organizationId));

      return rows.map((r) => ({ userId: r.userId, name: r.name, specialty: r.specialty ?? undefined, skills: [] }));
    });

    const generatedTasks = await step.run("ai-generate-tasks", async () =>
      generateTasks({
        problemStatement: prd.problem,
        goals: JSON.parse(prd.goals) as string[],
        nonGoals: JSON.parse(prd.nonGoals) as string[],
        acceptanceCriteria: JSON.parse(prd.acceptanceCriteria) as string[],
        edgeCases: JSON.parse(prd.edgeCases) as string[],
        developers,
      }),
    );

    await step.run("save-tasks", async () => {
      // Build taskType → userId fallback from member specialties + client overrides
      const taskTypeToUserId: Record<string, string> = {};
      for (const dev of developers) {
        if (dev.specialty) {
          for (const taskType of SPECIALTY_TASK_TYPES[dev.specialty as keyof typeof SPECIALTY_TASK_TYPES] ?? []) {
            taskTypeToUserId[taskType] = dev.userId;
          }
        }
      }
      for (const [specialty, userId] of Object.entries(specialtyOverrides)) {
        for (const taskType of SPECIALTY_TASK_TYPES[specialty as keyof typeof SPECIALTY_TASK_TYPES] ?? []) {
          taskTypeToUserId[taskType] = userId;
        }
      }

      // Replace any prior task set (e.g. from a regenerated PRD version or a
      // re-trigger) so we never accumulate duplicates.
      await db.delete(tasks).where(eq(tasks.featureId, featureId));

      await db.insert(tasks).values(
        generatedTasks.map((task, index) => ({
          id: crypto.randomUUID(),
          prdId: prd.id,
          featureId,
          title: task.title,
          description: task.description,
          type: task.type,
          priority: task.priority,
          status: task.status,
          estimatedHours: task.estimatedHours,
          assignedTo: task.assignedTo ?? taskTypeToUserId[task.type] ?? null,
          order: index,
        })),
      );

      // Keep the PRD estimate honest: total effort = sum of the actual task
      // estimates (each of which already carries its own complexity buffer).
      const totalHours = generatedTasks.reduce((sum, t) => sum + t.estimatedHours, 0);
      await db
        .update(featureRequests)
        .set({ status: "tasks_ready", updatedAt: new Date() })
        .where(eq(featureRequests.id, featureId));
      await db
        .update(prds)
        .set({ estimatedTotalHours: totalHours, updatedAt: new Date() })
        .where(eq(prds.id, prd.id));
    });

    await step.run("broadcast-tasks-ready", async () => {
      await publishOrgEvent(feature.organizationId, {
        type: "tasks.generated",
        featureId,
        featureTitle: feature.title,
        count: generatedTasks.length,
      });
    });

    return { featureId, taskCount: generatedTasks.length, developerCount: developers.length };
  },
);

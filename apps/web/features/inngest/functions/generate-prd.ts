import { db, eq } from "@repo/database";
import {
  clarificationMessages,
  featureRequests,
  prds,
  tasks,
} from "@repo/database/schema";
import { ensureFeatureBranchName } from "@repo/database/branch";

import { generatePrd } from "@/features/ai/prd-generator";
import { publishOrgEvent } from "@/lib/realtime/server";

import { inngest } from "../client";

export const generatePrdFunction = inngest.createFunction(
  { id: "generate-prd", triggers: [{ event: "feature/clarification-complete" }] },
  async ({ event, step }) => {
    const { featureId, regenerate = false } = event.data as {
      featureId: string;
      regenerate?: boolean;
    };

    const context = await step.run("fetch-context", async () => {
      const [existingPrd] = await db
        .select({ id: prds.id, version: prds.version, approvedAt: prds.approvedAt })
        .from(prds)
        .where(eq(prds.featureId, featureId));

      // Idempotency guard: a PRD already exists and this isn't an explicit
      // regeneration (e.g. a duplicate/replayed event) — nothing to do.
      if (existingPrd && !regenerate) return null;
      // Approved PRDs are locked — never overwrite them, even on regenerate.
      if (existingPrd?.approvedAt) return null;

      const [feature] = await db
        .select()
        .from(featureRequests)
        .where(eq(featureRequests.id, featureId));
      const messages = await db
        .select()
        .from(clarificationMessages)
        .where(eq(clarificationMessages.featureId, featureId));

      if (!feature) throw new Error(`Feature ${featureId} not found`);

      return { feature, messages, existingPrd: existingPrd ?? null };
    });

    // Nothing to do (PRD already exists / is approved)
    if (context === null) return { featureId, status: "skipped" };

    await step.run("set-generating", async () => {
      await db
        .update(featureRequests)
        .set({ status: "prd_generating", updatedAt: new Date() })
        .where(eq(featureRequests.id, featureId));
    });

    const prdContent = await step.run("ai-generate-prd", async () =>
      generatePrd({
        title: context.feature.title,
        description: context.feature.description,
        messages: context.messages.map((message) => ({
          role: message.role as "user" | "assistant",
          content: message.content,
        })),
      }),
    );

    await step.run("save-prd", async () => {
      // Guard: abort if the user cancelled generation (status reverted to clarifying)
      const [current] = await db
        .select({ status: featureRequests.status })
        .from(featureRequests)
        .where(eq(featureRequests.id, featureId));

      if (!current || current.status !== "prd_generating") {
        return { skipped: true };
      }

      const content = {
        problem: prdContent.problemStatement,
        goals: JSON.stringify(prdContent.goals),
        nonGoals: JSON.stringify(prdContent.nonGoals),
        userStories: JSON.stringify(prdContent.userStories),
        acceptanceCriteria: JSON.stringify(prdContent.acceptanceCriteria),
        edgeCases: JSON.stringify(prdContent.edgeCases),
        successMetrics: JSON.stringify(prdContent.successMetrics),
        technicalRequirements: JSON.stringify(prdContent.technicalRequirements),
        dependencies: JSON.stringify(prdContent.dependencies),
        risks: JSON.stringify(prdContent.risks),
        requiredDisciplines: JSON.stringify(prdContent.requiredDisciplines),
        estimatedTotalHours: prdContent.estimatedTotalHours,
        rawMarkdown: prdContent.rawMarkdown,
      };

      if (context.existingPrd) {
        // Regeneration: bump to the next version in place (featureId is unique,
        // so we reuse the same row), reset any prior approval, and drop the
        // now-stale tasks so re-approval produces a fresh v<n> task set.
        await db
          .update(prds)
          .set({
            ...content,
            version: context.existingPrd.version + 1,
            approvedAt: null,
            approvedBy: null,
            updatedAt: new Date(),
          })
          .where(eq(prds.id, context.existingPrd.id));
        await db.delete(tasks).where(eq(tasks.featureId, featureId));
      } else {
        await db.insert(prds).values({
          id: crypto.randomUUID(),
          featureId,
          ...content,
        });
      }

      await db
        .update(featureRequests)
        .set({ status: "prd_ready", updatedAt: new Date() })
        .where(eq(featureRequests.id, featureId));
    });

    // Assign a readable, org-unique branch slug (e.g. "add-dark-mode") so the
    // review tab can suggest `feature/<slug>` instead of the raw feature id.
    await step.run("ensure-branch-name", async () => {
      await ensureFeatureBranchName(db, context.feature);
    });

    await step.run("broadcast-prd-ready", async () => {
      await publishOrgEvent(context.feature.organizationId, {
        type: "prd.generated",
        featureId,
        featureTitle: context.feature.title,
      });
    });

    return { featureId, status: "prd_ready" };
  },
);

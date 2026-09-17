import { TRPCError } from "@trpc/server";
import { and, desc, eq } from "@repo/database";
import {
  featureRequests,
  implementationPrompts,
  prds,
  projects,
  repoContexts,
  repositories,
  tasks,
} from "@repo/database/schema";

import type { Context } from "../../context";
import { orgProcedure, router } from "../../trpc";
import { z } from "../../schema";
import { enforceRateLimit } from "../../rate-limit";
import { computePromptQuota, logPromptGeneration } from "../../usage";

// Normalize a tech-stack string into the cache key: trim, collapse internal
// whitespace, lowercase. Applied identically on read and write so "Next.js" and
// "next.js" resolve to the same cached row instead of silently duplicating.
function normalizeStack(raw: string): string {
  return raw.trim().replace(/\s+/g, " ").toLowerCase();
}

function safeParse<T>(raw: string | null | undefined, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

// Sorted list of a feature's current task ids — the staleness fingerprint. Drag/
// status changes never touch the set, so board activity never marks prompts
// stale; adding or removing a task does.
async function taskIdFingerprint(ctx: Context, featureId: string): Promise<string[]> {
  const rows = await ctx.db
    .select({ id: tasks.id })
    .from(tasks)
    .where(eq(tasks.featureId, featureId));
  return rows.map((r) => r.id).sort();
}

// Load the feature scoped to the caller's active org (also authorizes access).
async function loadFeatureInOrg(ctx: Context, featureId: string, orgId: string) {
  const [feature] = await ctx.db
    .select()
    .from(featureRequests)
    .where(and(eq(featureRequests.id, featureId), eq(featureRequests.organizationId, orgId)));
  if (!feature) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Feature not found." });
  }
  return feature;
}

function parseRecord(row: typeof implementationPrompts.$inferSelect) {
  return {
    techStack: row.techStack,
    combinedPrompt: row.combinedPrompt,
    prdVersion: row.prdVersion,
    updatedAt: row.updatedAt,
  };
}

type PromptRecord = ReturnType<typeof parseRecord>;

type GetByFeatureResult = {
  record: PromptRecord | null;
  stale: boolean;
  availableStacks: string[];
  defaults: { projectTechStack: string | null; repoStack: string | null };
  // The feature's required engineering disciplines (from the PRD), used to show
  // only the tech-stack presets that match what the feature actually needs.
  disciplines: string[];
  // Whether the feature's project has any connected repository. When true the
  // tech stack is locked to the repo's detected stack (no manual override); when
  // false the UI nudges the user to connect a repo for sharper prompts.
  repoConnected: boolean;
};

// Resolve default stack candidates + the cached-stack list + staleness for the
// (optional) selected stack. Shared by getByFeature and generate so both return
// the exact same shape.
async function buildResult(
  ctx: Context,
  feature: typeof featureRequests.$inferSelect,
  selectedStack: string | undefined,
): Promise<GetByFeatureResult> {
  const [prd] = await ctx.db
    .select({ version: prds.version, requiredDisciplines: prds.requiredDisciplines })
    .from(prds)
    .where(eq(prds.featureId, feature.id));

  const cached = await ctx.db
    .select()
    .from(implementationPrompts)
    .where(eq(implementationPrompts.featureId, feature.id))
    .orderBy(desc(implementationPrompts.updatedAt));

  const availableStacks = cached.map((r) => r.techStack);

  const normalized = selectedStack ? normalizeStack(selectedStack) : null;
  const row = normalized
    ? cached.find((r) => r.techStack === normalized) ?? null
    : cached[0] ?? null;

  // Staleness: PRD version bumped, or the task id set changed since generation.
  let stale = false;
  if (row) {
    const fingerprint = await taskIdFingerprint(ctx, feature.id);
    const storedFingerprint = safeParse<string[]>(row.taskFingerprint, []);
    stale =
      (prd ? row.prdVersion !== prd.version : false) ||
      JSON.stringify(fingerprint) !== JSON.stringify([...storedFingerprint].sort());
  }

  // Default stack candidates: the project's stored stack, and the connected
  // repo's detected stack (first indexed repo in the project, if any).
  const [project] = await ctx.db
    .select({ techStack: projects.techStack })
    .from(projects)
    .where(eq(projects.id, feature.projectId));

  const [repoStackRow] = await ctx.db
    .select({ stack: repoContexts.stack })
    .from(repoContexts)
    .innerJoin(repositories, eq(repositories.id, repoContexts.repositoryId))
    .where(eq(repositories.projectId, feature.projectId))
    .orderBy(desc(repoContexts.updatedAt))
    .limit(1);

  // A connected repo may exist even before it's been indexed (no repoStack yet),
  // so check the repositories table directly rather than inferring from context.
  const [connectedRepo] = await ctx.db
    .select({ id: repositories.id })
    .from(repositories)
    .where(eq(repositories.projectId, feature.projectId))
    .limit(1);

  return {
    record: row ? parseRecord(row) : null,
    stale,
    availableStacks,
    defaults: {
      projectTechStack: project?.techStack ?? null,
      repoStack: repoStackRow?.stack ? repoStackRow.stack : null,
    },
    disciplines: safeParse<string[]>(prd?.requiredDisciplines, []),
    repoConnected: Boolean(connectedRepo),
  };
}

export const promptsRouter = router({
  getByFeature: orgProcedure
    .input(z.object({ featureId: z.string(), techStack: z.string().optional() }))
    .query(async ({ ctx, input }) => {
      const feature = await loadFeatureInOrg(ctx, input.featureId, ctx.org.id);
      return buildResult(ctx, feature, input.techStack);
    }),

  quota: orgProcedure
    .input(z.object({ featureId: z.string() }))
    .query(async ({ ctx, input }) => {
      await loadFeatureInOrg(ctx, input.featureId, ctx.org.id);
      return computePromptQuota(ctx, ctx.org.id, input.featureId);
    }),

  // One-shot prompt from a plain message — no feature/PRD required. Powers the
  // CLI's `VelocityAI prompt quick`. Rate-limited but not persisted.
  generateFromMessage: orgProcedure
    .input(
      z.object({
        message: z.string().trim().min(8).max(4000),
        techStack: z.string().trim().min(1).max(120).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      enforceRateLimit({
        key: `quick-prompt:${ctx.session.user.id}`,
        limit: 5,
        windowMs: 300_000,
        message: "You're generating prompts too quickly — please wait a moment.",
      });

      const result = await ctx.ai.generateQuickPrompt({
        message: input.message,
        techStack: input.techStack ?? null,
      });

      if (!result.prompt.trim()) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Prompt generation is not available right now.",
        });
      }

      return { prompt: result.prompt };
    }),

  generate: orgProcedure
    .input(
      z.object({
        featureId: z.string(),
        techStack: z.string().trim().min(1).max(120),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      enforceRateLimit({
        key: `impl-prompts:${ctx.session.user.id}`,
        limit: 5,
        windowMs: 300_000,
        message: "You're generating prompts too quickly — please wait a moment.",
      });

      const feature = await loadFeatureInOrg(ctx, input.featureId, ctx.org.id);

      const [prd] = await ctx.db.select().from(prds).where(eq(prds.featureId, feature.id));
      if (!prd) {
        throw new TRPCError({ code: "NOT_FOUND", message: "This feature has no PRD yet." });
      }
      if (!prd.approvedAt) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Approve the PRD before generating implementation prompts.",
        });
      }

      const featureTasks = await ctx.db
        .select({
          id: tasks.id,
          title: tasks.title,
          description: tasks.description,
          type: tasks.type,
          priority: tasks.priority,
          estimatedHours: tasks.estimatedHours,
        })
        .from(tasks)
        .where(eq(tasks.featureId, feature.id));

      if (featureTasks.length === 0) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Generate engineering tasks before generating implementation prompts.",
        });
      }

      // Plan-based quota: per-feature lifetime cap (2) + monthly org cap.
      const quota = await computePromptQuota(ctx, ctx.org.id, feature.id);
      if (!quota.canGenerate) {
        throw new TRPCError({ code: "FORBIDDEN", message: quota.reason ?? "Prompt generation limit reached." });
      }

      const displayStack = input.techStack.trim();
      const normalized = normalizeStack(input.techStack);

      const result = await ctx.ai.generateImplPrompts({
        feature: { title: feature.title, description: feature.description },
        prd: {
          problemStatement: prd.problem,
          goals: safeParse<string[]>(prd.goals, []),
          nonGoals: safeParse<string[]>(prd.nonGoals, []),
          userStories: safeParse<string[]>(prd.userStories, []),
          acceptanceCriteria: safeParse<string[]>(prd.acceptanceCriteria, []),
          edgeCases: safeParse<string[]>(prd.edgeCases, []),
          technicalRequirements: safeParse<string[]>(prd.technicalRequirements, []),
          dependencies: safeParse<string[]>(prd.dependencies, []),
          risks: safeParse<string[]>(prd.risks, []),
        },
        tasks: featureTasks,
        techStack: displayStack,
      });

      const fingerprint = featureTasks.map((t) => t.id).sort();
      const now = new Date();

      // Upsert on the (featureId, techStack) unique index: switching back to a
      // previously-generated stack is a cache hit; Regenerate replaces the row.
      await ctx.db
        .insert(implementationPrompts)
        .values({
          featureId: feature.id,
          prdId: prd.id,
          techStack: normalized,
          combinedPrompt: result.combinedPrompt,
          taskPrompts: "{}",
          prdVersion: prd.version,
          taskFingerprint: JSON.stringify(fingerprint),
          createdBy: ctx.session.user.id,
          updatedAt: now,
        })
        .onConflictDoUpdate({
          target: [implementationPrompts.featureId, implementationPrompts.techStack],
          set: {
            prdId: prd.id,
            combinedPrompt: result.combinedPrompt,
            taskPrompts: "{}",
            prdVersion: prd.version,
            taskFingerprint: JSON.stringify(fingerprint),
            createdBy: ctx.session.user.id,
            updatedAt: now,
          },
        });

      // Persist the (nicely-cased) stack onto the project so every feature in it
      // defaults to the same stack next time.
      await ctx.db
        .update(projects)
        .set({ techStack: displayStack, updatedAt: now })
        .where(eq(projects.id, feature.projectId));

      // Record the generation event (drives per-feature + monthly quotas).
      await logPromptGeneration(ctx, ctx.org.id, ctx.session.user.id, feature.id);

      return buildResult(ctx, feature, input.techStack);
    }),
});

import "server-only";

import { and, db, eq } from "@repo/database";
import {
  AGENT_PROVIDERS,
  agentProviderKeys,
  featureRequests,
  prds,
  repositories,
  tasks,
  type AgentProvider,
} from "@repo/database/schema";

import { requireAuth } from "@/features/auth/session";
import {
  buildRepoContext,
  getRepoContext,
  type RepoContext,
} from "@/features/copilot/server/repo-context";
import { getFeatureBranchFiles } from "@/features/github/server/branch-files";
import { getLinkedOpenPr, type LinkedOpenPr } from "@/features/github/server/linked-pr";

import { decryptSecret } from "./crypto";
import type { AgentRunInput, AgentTaskContext } from "./engine";

export type ActionError = { ok: false; error: string };

// Resolve the caller's active org. Every Agent action is org-scoped.
export async function requireOrg(): Promise<
  { ok: true; organizationId: string; userId: string } | ActionError
> {
  const session = await requireAuth();
  const organizationId = session.session.activeOrganizationId;
  if (!organizationId) return { ok: false, error: "Select an organization first." };
  return { ok: true, organizationId, userId: session.user.id };
}

export function isProvider(value: string): value is AgentProvider {
  return (AGENT_PROVIDERS as readonly string[]).includes(value);
}

export type AgentRunRequest = {
  repositoryId: string;
  provider: string;
  model: string;
  prompt: string;
  featureId?: string | null;
  taskIds?: string[] | null;
  history?: Array<{ role: "user" | "assistant"; content: string }>;
};

export type AgentRunDeps = {
  keyId: string;
  engineInput: AgentRunInput;
};

// Remember the last-used model so the picker defaults to it next time. Fire and
// forget — a failed write must never fail the run.
export function rememberModel(keyId: string, model: string) {
  void db
    .update(agentProviderKeys)
    .set({ defaultModel: model, updatedAt: new Date() })
    .where(eq(agentProviderKeys.id, keyId))
    .catch(() => {});
}

/**
 * Shared setup for a run: authorize, load the encrypted key, load the repo's AI
 * context ONCE (from the `repo_context` DB snapshot — built at connect time, so
 * this is a single row read, not a GitHub round-trip), and gather PRD + tasks.
 * The loaded context is handed to the engine so generation is one DB read plus
 * one model call — nothing is re-fetched while coding.
 *
 * NOT a server action (this module has no "use server") — the returned deps
 * carry the decrypted API key and must never be reachable from the client.
 */
async function loadRepoAndKey(
  repositoryId: string,
  provider: AgentProvider,
  organizationId: string,
): Promise<
  | { ok: true; repo: typeof repositories.$inferSelect; keyRow: typeof agentProviderKeys.$inferSelect }
  | ActionError
> {
  const [repo] = await db
    .select()
    .from(repositories)
    .where(
      and(
        eq(repositories.id, repositoryId),
        eq(repositories.organizationId, organizationId),
      ),
    );
  if (!repo) return { ok: false, error: "Repository not found in this organization." };

  const [keyRow] = await db
    .select()
    .from(agentProviderKeys)
    .where(
      and(
        eq(agentProviderKeys.organizationId, organizationId),
        eq(agentProviderKeys.provider, provider),
      ),
    );
  if (!keyRow) {
    return { ok: false, error: "No API key saved for this provider yet. Add one in Agent settings." };
  }

  return { ok: true, repo, keyRow };
}

async function loadFeaturePrdAndTasks(
  featureId: string,
  organizationId: string,
  taskIds?: string[] | null,
): Promise<
  | {
      ok: true;
      feature: { id: string; branchName: string | null };
      prd: { problem: string; acceptanceCriteria: string[] };
      tasks: AgentTaskContext[];
    }
  | ActionError
> {
  const [feature] = await db
    .select({ id: featureRequests.id, branchName: featureRequests.branchName })
    .from(featureRequests)
    .where(
      and(
        eq(featureRequests.id, featureId),
        eq(featureRequests.organizationId, organizationId),
      ),
    );
  if (!feature) return { ok: false, error: "Feature not found in this organization." };

  const [prdRow] = await db.select().from(prds).where(eq(prds.featureId, featureId));
  if (!prdRow) {
    return {
      ok: false,
      error:
        "This feature has no PRD yet. Open the feature and let the AI generate one from the Clarify tab — the agent codes strictly from the PRD, so that's step one.",
    };
  }
  if (!prdRow.approvedAt) {
    return {
      ok: false,
      error:
        "This feature's PRD isn't approved yet. Review and approve it on the feature's PRD tab first — the agent only implements approved PRDs.",
    };
  }

  let prd: { problem: string; acceptanceCriteria: string[] };
  try {
    prd = {
      problem: prdRow.problem,
      acceptanceCriteria: JSON.parse(prdRow.acceptanceCriteria) as string[],
    };
  } catch {
    prd = { problem: prdRow.problem, acceptanceCriteria: [] };
  }

  const allTasks = await db.select().from(tasks).where(eq(tasks.featureId, featureId));
  const selected = taskIds?.length
    ? allTasks.filter((t) => taskIds.includes(t.id))
    : allTasks;
  const taskContext: AgentTaskContext[] = selected.map((t) => ({
    title: t.title,
    description: t.description,
    type: t.type,
    status: t.status,
  }));

  return { ok: true, feature, prd, tasks: taskContext };
}

async function loadPriorBranchChanges(
  feature: { id: string; branchName: string | null },
  repo: typeof repositories.$inferSelect,
): Promise<{
  priorChanges: Array<{ path: string; content: string }> | null;
  linkedPr: LinkedOpenPr | null;
}> {
  if (!repo.installationId) return { priorChanges: null, linkedPr: null };
  const linkedPr = await getLinkedOpenPr(feature.id, repo.fullName);
  const branchName =
    linkedPr?.headBranch ?? (feature.branchName ? `feature/${feature.branchName}` : null);
  if (!branchName) return { priorChanges: null, linkedPr };

  const priorChanges = await getFeatureBranchFiles({
    installationId: repo.installationId,
    fullName: repo.fullName,
    defaultBranch: linkedPr?.baseBranch ?? repo.defaultBranch,
    branchName,
  });
  return { priorChanges, linkedPr };
}

export async function prepareAgentRun(
  input: AgentRunRequest,
): Promise<{ ok: true; deps: AgentRunDeps } | ActionError> {
  const auth = await requireOrg();
  if (!auth.ok) return { ok: false, error: auth.error };
  if (!isProvider(input.provider)) return { ok: false, error: "Unknown provider." };
  if (!input.prompt.trim()) return { ok: false, error: "Describe what you want the agent to build." };

  if (!input.featureId) {
    return {
      ok: false,
      error:
        "The agent codes from an approved PRD, so please pick a feature first. If the feature doesn't have a PRD yet, open it and let the AI write one from the Clarify tab — then come back here.",
    };
  }

  const repoRes = await loadRepoAndKey(input.repositoryId, input.provider, auth.organizationId);
  if (!repoRes.ok) return repoRes;
  const { repo, keyRow } = repoRes;

  let context: RepoContext | null = await getRepoContext(input.repositoryId);
  if (!context) {
    try {
      context = await buildRepoContext(input.repositoryId);
    } catch {
      return {
        ok: false,
        error:
          "Couldn't analyze the repository. Open its GitHub dashboard and generate the AI summary, then retry.",
      };
    }
  }

  const featureRes = await loadFeaturePrdAndTasks(input.featureId, auth.organizationId, input.taskIds);
  if (!featureRes.ok) return featureRes;
  const { feature, prd, tasks: taskContext } = featureRes;

  const { priorChanges, linkedPr } = await loadPriorBranchChanges(feature, repo);

  return {
    ok: true,
    deps: {
      keyId: keyRow.id,
      engineInput: {
        provider: input.provider,
        modelId: input.model,
        apiKey: decryptSecret(keyRow.encryptedKey),
        prompt: input.prompt,
        context,
        prd,
        tasks: taskContext,
        priorChanges,
        linkedPr: linkedPr
          ? {
              number: linkedPr.number,
              title: linkedPr.title,
              body: linkedPr.body,
              url: linkedPr.url,
            }
          : null,
        history: input.history,
      },
    },
  };
}

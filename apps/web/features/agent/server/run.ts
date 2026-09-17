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
export async function prepareAgentRun(
  input: AgentRunRequest,
): Promise<{ ok: true; deps: AgentRunDeps } | ActionError> {
  const auth = await requireOrg();
  if (!auth.ok) return { ok: false, error: auth.error };
  if (!isProvider(input.provider)) return { ok: false, error: "Unknown provider." };
  if (!input.prompt.trim()) return { ok: false, error: "Describe what you want the agent to build." };

  // The agent always codes from an approved PRD — a feature is required.
  if (!input.featureId) {
    return {
      ok: false,
      error:
        "The agent codes from an approved PRD, so please pick a feature first. If the feature doesn't have a PRD yet, open it and let the AI write one from the Clarify tab — then come back here.",
    };
  }

  // The repo must belong to the caller's org.
  const [repo] = await db
    .select()
    .from(repositories)
    .where(
      and(
        eq(repositories.id, input.repositoryId),
        eq(repositories.organizationId, auth.organizationId),
      ),
    );
  if (!repo) return { ok: false, error: "Repository not found in this organization." };

  const [keyRow] = await db
    .select()
    .from(agentProviderKeys)
    .where(
      and(
        eq(agentProviderKeys.organizationId, auth.organizationId),
        eq(agentProviderKeys.provider, input.provider),
      ),
    );
  if (!keyRow) {
    return { ok: false, error: "No API key saved for this provider yet. Add one in Agent settings." };
  }

  // Load the stored repo context once. Build it only if this repo was never
  // indexed (older connections); normally it already exists from connect time.
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

  // PRD + tasks give the agent the "code from the PRD, task-wise" grounding.
  // The PRD must exist AND be approved — the agent never codes from guesswork.
  const [feature] = await db
    .select({ id: featureRequests.id, branchName: featureRequests.branchName })
    .from(featureRequests)
    .where(
      and(
        eq(featureRequests.id, input.featureId),
        eq(featureRequests.organizationId, auth.organizationId),
      ),
    );
  if (!feature) return { ok: false, error: "Feature not found in this organization." };

  const [prdRow] = await db.select().from(prds).where(eq(prds.featureId, input.featureId));
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

  const allTasks = await db.select().from(tasks).where(eq(tasks.featureId, input.featureId));
  const selected = input.taskIds?.length
    ? allTasks.filter((t) => input.taskIds!.includes(t.id))
    : allTasks;
  const taskContext: AgentTaskContext[] = selected.map((t) => ({
    title: t.title,
    description: t.description,
    type: t.type,
    status: t.status,
  }));

  // If this feature already has a LINKED open PR (auto-linked by branch or
  // linked manually — possibly on a non-canonical branch), read THAT PR's
  // branch: the agent must see the work already on the PR and build on top of
  // it, and the later commit lands on the same PR. Only when no PR is linked
  // do we fall back to the feature's canonical feature/<slug> branch.
  // Best-effort: no branch yet (first run) or a read failure → no prior context.
  let priorChanges: Array<{ path: string; content: string }> | null = null;
  let linkedPr: LinkedOpenPr | null = null;
  if (repo.installationId) {
    linkedPr = await getLinkedOpenPr(feature.id, repo.fullName);
    const branchName =
      linkedPr?.headBranch ?? (feature.branchName ? `feature/${feature.branchName}` : null);
    if (branchName) {
      priorChanges = await getFeatureBranchFiles({
        installationId: repo.installationId,
        fullName: repo.fullName,
        defaultBranch: linkedPr?.baseBranch ?? repo.defaultBranch,
        branchName,
      });
    }
  }

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

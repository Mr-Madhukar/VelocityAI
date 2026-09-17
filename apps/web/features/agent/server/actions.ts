"use server";

import { and, db, eq } from "@repo/database";
import { ensureFeatureBranchName } from "@repo/database/branch";
import { agentProviderKeys, featureRequests, repositories } from "@repo/database/schema";

import { commitFilesAndOpenPr } from "@/features/github/server/create-pr";
import { getLinkedOpenPr, recordRaisedPr } from "@/features/github/server/linked-pr";

import { encryptSecret } from "./crypto";
import type { AgentPlan } from "../plan-schema";
import { generateAgentPlan } from "./engine";
import {
  isProvider,
  prepareAgentRun,
  rememberModel,
  requireOrg,
  type ActionError,
  type AgentRunRequest,
} from "./run";

// Streaming runs live in app/api/agent/stream — a plain HTTP stream survives
// arbitrarily long generations, unlike RSC streamable values whose chained
// updates overflow the call stack.

/**
 * The org's saved provider keys — hint only. The plaintext key is never
 * returned by any action; it exists in memory only for the duration of a run.
 */
export async function listAgentKeysAction() {
  const auth = await requireOrg();
  if (!auth.ok) return [];
  const rows = await db
    .select({
      provider: agentProviderKeys.provider,
      keyHint: agentProviderKeys.keyHint,
      defaultModel: agentProviderKeys.defaultModel,
      updatedAt: agentProviderKeys.updatedAt,
    })
    .from(agentProviderKeys)
    .where(eq(agentProviderKeys.organizationId, auth.organizationId));
  return rows.map((r) => ({ ...r, updatedAt: r.updatedAt.toISOString() }));
}

export async function saveAgentKeyAction(input: {
  provider: string;
  apiKey: string;
  defaultModel?: string | null;
}) {
  const auth = await requireOrg();
  if (!auth.ok) return { ok: false as const, error: auth.error };
  if (!isProvider(input.provider)) return { ok: false as const, error: "Unknown provider." };

  const apiKey = input.apiKey.trim();
  if (apiKey.length < 8) return { ok: false as const, error: "That doesn't look like a valid API key." };

  const now = new Date();
  const values = {
    encryptedKey: encryptSecret(apiKey),
    keyHint: apiKey.slice(-4),
    defaultModel: input.defaultModel ?? null,
    createdBy: auth.userId,
    updatedAt: now,
  };

  await db
    .insert(agentProviderKeys)
    .values({
      id: crypto.randomUUID(),
      organizationId: auth.organizationId,
      provider: input.provider,
      ...values,
    })
    .onConflictDoUpdate({
      target: [agentProviderKeys.organizationId, agentProviderKeys.provider],
      set: values,
    });

  return { ok: true as const, keyHint: values.keyHint };
}

export async function deleteAgentKeyAction(input: { provider: string }) {
  const auth = await requireOrg();
  if (!auth.ok) return { ok: false as const, error: auth.error };
  await db
    .delete(agentProviderKeys)
    .where(
      and(
        eq(agentProviderKeys.organizationId, auth.organizationId),
        eq(agentProviderKeys.provider, input.provider),
      ),
    );
  return { ok: true as const };
}

/**
 * Run the BYOK coding agent (batch) — returns the full plan at once. Kept for
 * non-streaming callers; the Agent page streams via /api/agent/stream.
 */
export async function runAgentAction(
  input: AgentRunRequest,
): Promise<{ ok: true; plan: AgentPlan } | ActionError> {
  const prep = await prepareAgentRun(input);
  if (!prep.ok) return prep;

  try {
    const plan = await generateAgentPlan(prep.deps.engineInput);
    rememberModel(prep.deps.keyId, input.model);
    return { ok: true, plan };
  } catch (error) {
    // Provider errors (bad key, model access, quota) surface as-is so the user
    // can fix their key/model — the message never includes the key itself.
    return {
      ok: false,
      error: error instanceof Error ? error.message : "The agent run failed.",
    };
  }
}

/** Open the PR for an agent-generated change set. */
export async function raiseAgentPrAction(input: {
  repositoryId: string;
  title: string;
  body: string;
  files: Array<{ path: string; content: string }>;
  draft?: boolean;
  /** The feature this change implements — its canonical branch is used. */
  featureId?: string | null;
}) {
  const auth = await requireOrg();
  if (!auth.ok) return { ok: false as const, error: auth.error };

  const [repo] = await db
    .select()
    .from(repositories)
    .where(
      and(
        eq(repositories.id, input.repositoryId),
        eq(repositories.organizationId, auth.organizationId),
      ),
    );
  if (!repo) return { ok: false as const, error: "Repository not found in this organization." };
  if (!repo.installationId) {
    return { ok: false as const, error: "Repository has no GitHub installation." };
  }
  if (!input.title.trim()) return { ok: false as const, error: "Give the PR a title." };
  if (input.files.length === 0) return { ok: false as const, error: "No files to commit." };

  // Use the feature's canonical branch (feature/<slug> — the same one shown on
  // the feature's preview tab) so the PR auto-links to the feature.
  let featureBranch: string | undefined;
  let linkFeatureId: string | undefined;
  if (input.featureId) {
    const [feature] = await db
      .select({
        id: featureRequests.id,
        organizationId: featureRequests.organizationId,
        title: featureRequests.title,
        branchName: featureRequests.branchName,
      })
      .from(featureRequests)
      .where(
        and(
          eq(featureRequests.id, input.featureId),
          eq(featureRequests.organizationId, auth.organizationId),
        ),
      );
    if (feature) {
      // A feature with a LINKED open PR gets the commit on THAT PR's branch —
      // even a non-canonical one (manually linked PR, back-compat id branch) —
      // so the existing PR accumulates the change instead of a new PR opening.
      const linked = await getLinkedOpenPr(feature.id, repo.fullName);
      featureBranch = linked?.headBranch ?? `feature/${await ensureFeatureBranchName(db, feature)}`;
      linkFeatureId = feature.id;
    }
  }

  try {
    const pr = await commitFilesAndOpenPr({
      installationId: repo.installationId,
      fullName: repo.fullName,
      defaultBranch: repo.defaultBranch,
      branchPrefix: "VelocityAI-agent",
      branchName: featureBranch,
      title: input.title.trim(),
      body: `${input.body}\n\n— Generated by VelocityAI Agent 🤖`,
      commitMessage: `${input.title.trim()}\n\nGenerated by VelocityAI Agent.`,
      files: input.files,
      draft: input.draft ?? false,
    });

    // Cache + link the PR row immediately so linked-PR detection (the
    // "Building on PR #N" chip, commit-instead-of-raise) works without waiting
    // for webhook delivery. Best-effort: a failed cache write never fails the
    // raise — the webhook remains the fallback source.
    if (linkFeatureId) {
      try {
        await recordRaisedPr({
          featureId: linkFeatureId,
          repositoryId: repo.id,
          installationId: repo.installationId,
          repoFullName: repo.fullName,
          githubPrId: pr.githubPrId,
          prNumber: pr.prNumber,
          prUrl: pr.prUrl,
          title: pr.prTitle,
          body: pr.prBody,
          headBranch: pr.branchName,
          baseBranch: pr.baseBranch,
          headSha: pr.headSha,
        });
      } catch (cacheError) {
        console.error("Failed to cache raised PR:", cacheError);
      }
    }

    return {
      ok: true as const,
      prUrl: pr.prUrl,
      prNumber: pr.prNumber,
      branch: pr.branchName,
      updatedExisting: pr.updatedExisting,
    };
  } catch (error) {
    return {
      ok: false as const,
      error: error instanceof Error ? error.message : "Failed to open the pull request.",
    };
  }
}

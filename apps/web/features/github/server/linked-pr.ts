import "server-only";

import { and, db, desc, eq } from "@repo/database";
import { pullRequests } from "@repo/database/schema";

export type LinkedOpenPr = {
  number: number;
  url: string;
  title: string;
  body: string | null;
  headBranch: string;
  baseBranch: string;
};

/**
 * The feature's linked OPEN pull request in the given repo, if any. This is the
 * source of truth for "where agent work on this feature lives": a PR gets
 * linked by the webhook's branch auto-linker OR manually via
 * linkPullRequestToFeature — the manual path does no branch rename, so the
 * linked PR's head branch may differ from the feature's canonical
 * feature/<slug> branch. Agent runs must read from and commit to THIS branch,
 * not the canonical one, or follow-up work opens a second PR.
 */
export async function getLinkedOpenPr(
  featureId: string,
  repoFullName: string,
): Promise<LinkedOpenPr | null> {
  const [pr] = await db
    .select({
      number: pullRequests.number,
      url: pullRequests.githubPrUrl,
      title: pullRequests.title,
      body: pullRequests.body,
      headBranch: pullRequests.headBranch,
      baseBranch: pullRequests.baseBranch,
    })
    .from(pullRequests)
    .where(
      and(
        eq(pullRequests.featureId, featureId),
        eq(pullRequests.repoFullName, repoFullName),
        eq(pullRequests.state, "open"),
      ),
    )
    .orderBy(desc(pullRequests.number))
    .limit(1);
  return pr ?? null;
}

/**
 * Cache + feature-link the PR an agent raise just touched, WITHOUT waiting for
 * the GitHub webhook. Webhook delivery is what normally populates the
 * pull_request table, but it can lag or be absent entirely (local dev with no
 * tunnel) — and until the row exists, getLinkedOpenPr sees nothing, the Agent UI
 * shows no linked PR, and a follow-up raise looks like it needs a brand-new PR.
 * Recording the row at raise time makes linked-PR detection self-contained.
 *
 * Mirrors the webhook's guard semantics: an existing row's feature link is only
 * written when it isn't already linked (never steals a manual link to another
 * feature); the link stamps fire only on the actual link transition. Best-effort
 * — the caller must not fail the raise if this write fails.
 */
export async function recordRaisedPr(input: {
  featureId: string;
  repositoryId: string;
  installationId: number;
  repoFullName: string;
  githubPrId: number;
  prNumber: number;
  prUrl: string;
  title: string;
  body: string | null;
  headBranch: string;
  baseBranch: string;
  headSha: string;
}): Promise<void> {
  const id = `pr_${input.githubPrId}`;
  const now = new Date();

  const [existing] = await db
    .select({ id: pullRequests.id, featureId: pullRequests.featureId })
    .from(pullRequests)
    .where(eq(pullRequests.id, id));

  if (!existing) {
    await db.insert(pullRequests).values({
      id,
      featureId: input.featureId,
      linkedHeadSha: input.headSha,
      linkedAt: now,
      repositoryId: input.repositoryId,
      installationId: input.installationId,
      githubPrId: input.githubPrId,
      githubPrUrl: input.prUrl,
      number: input.prNumber,
      title: input.title,
      body: input.body,
      headBranch: input.headBranch,
      baseBranch: input.baseBranch,
      headSha: input.headSha,
      repoFullName: input.repoFullName,
      state: "open",
    });
    return;
  }

  await db
    .update(pullRequests)
    .set({
      headSha: input.headSha,
      state: "open",
      title: input.title,
      body: input.body,
      updatedAt: now,
      ...(existing.featureId
        ? {}
        : { featureId: input.featureId, linkedHeadSha: input.headSha, linkedAt: now }),
    })
    .where(eq(pullRequests.id, id));
}

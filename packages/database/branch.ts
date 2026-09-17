import { and, eq } from "drizzle-orm";
import { featureBranchRef, slugifyBranchName } from "@repo/services/shipflow/github";

import { featureRequests, pullRequests, repositories } from "./schema";
import type { Database } from "./index";

type FeatureForBranch = {
  id: string;
  organizationId: string;
  title: string;
  branchName: string | null;
};

/**
 * Generate an org-unique branch slug from a base string (the feature title or an
 * AI suggestion). Appends `-2`, `-3`, … only when the root slug is already taken
 * within the organization.
 */
export async function generateUniqueBranchName(
  db: Database,
  organizationId: string,
  base: string,
  excludeFeatureId?: string,
): Promise<string> {
  const root = slugifyBranchName(base);

  const existing = await db
    .select({ id: featureRequests.id, branchName: featureRequests.branchName })
    .from(featureRequests)
    .where(eq(featureRequests.organizationId, organizationId));

  const taken = new Set(
    existing
      .filter((f) => f.branchName && f.id !== excludeFeatureId)
      .map((f) => f.branchName as string),
  );

  if (!taken.has(root)) return root;
  for (let i = 2; i < 1000; i++) {
    const candidate = `${root}-${i}`;
    if (!taken.has(candidate)) return candidate;
  }
  // Pathological fallback — guaranteed unique enough.
  return `${root}-${Date.now().toString(36)}`;
}

/**
 * Ensure a feature has a stored branch slug, generating and persisting one from
 * its title when missing. Idempotent and safe to call on every feature read.
 */
export async function ensureFeatureBranchName(
  db: Database,
  feature: FeatureForBranch,
): Promise<string> {
  if (feature.branchName) return feature.branchName;

  const name = await generateUniqueBranchName(
    db,
    feature.organizationId,
    feature.title,
    feature.id,
  );

  try {
    await db
      .update(featureRequests)
      .set({ branchName: name, updatedAt: new Date() })
      .where(eq(featureRequests.id, feature.id));
    return name;
  } catch {
    // Lost a race on the org-unique index — re-read whatever landed.
    const [fresh] = await db
      .select({ branchName: featureRequests.branchName })
      .from(featureRequests)
      .where(eq(featureRequests.id, feature.id));
    return fresh?.branchName ?? name;
  }
}

/**
 * Resolve a PR head branch (`feature/<ref>`) to a feature id. Matches the stored
 * branch slug within the org first, then falls back to a raw feature id embedded
 * in the branch (back-compat with `feature/{featureId}`). Returns null when the
 * branch isn't a feature branch or nothing matches.
 */
export async function resolveFeatureIdForBranch(
  db: Database,
  branch: string,
  organizationId?: string | null,
): Promise<string | null> {
  const ref = featureBranchRef(branch);
  if (!ref) return null;

  if (organizationId) {
    const [bySlug] = await db
      .select({ id: featureRequests.id })
      .from(featureRequests)
      .where(
        and(
          eq(featureRequests.organizationId, organizationId),
          eq(featureRequests.branchName, ref),
        ),
      );
    if (bySlug) return bySlug.id;
  }

  // Feature ids are globally unique UUIDs, so an id match is safe unscoped.
  const [byId] = await db
    .select({ id: featureRequests.id })
    .from(featureRequests)
    .where(eq(featureRequests.id, ref));
  return byId?.id ?? null;
}

/**
 * Branch-match auto-linking for the webhook / PR sync, guarded by the
 * one-active-PR-per-feature invariant. Returns a feature id ONLY when this PR
 * should genuinely become the feature's linked PR right now:
 *
 * - null when the branch doesn't resolve to a feature;
 * - null when another PR already claims the feature (a detached/replaced PR
 *   must never steal the link back on its next push or sync);
 * - null when this PR is already linked to the feature (idempotent — avoids
 *   re-stamping link metadata on every subsequent push).
 */
export async function resolveAutoLinkFeatureId(
  db: Database,
  opts: { branch: string; organizationId?: string | null; prId: string },
): Promise<string | null> {
  const resolved = await resolveFeatureIdForBranch(db, opts.branch, opts.organizationId);
  if (!resolved) return null;

  const claims = await db
    .select({ id: pullRequests.id })
    .from(pullRequests)
    .where(eq(pullRequests.featureId, resolved));

  if (claims.some((c) => c.id !== opts.prId)) return null;
  if (claims.some((c) => c.id === opts.prId)) return null;
  return resolved;
}

/**
 * The organization that owns a connected repo, resolved by full name (and
 * installation id when available to disambiguate the same repo across orgs).
 */
export async function resolveOrgIdForRepo(
  db: Database,
  repoFullName: string,
  installationId?: number | null,
): Promise<string | null> {
  const rows = await db
    .select({
      organizationId: repositories.organizationId,
      installationId: repositories.installationId,
    })
    .from(repositories)
    .where(eq(repositories.fullName, repoFullName));

  if (rows.length === 0) return null;
  if (installationId != null) {
    const exact = rows.find((r) => r.installationId === installationId);
    if (exact) return exact.organizationId;
  }
  return rows[0]!.organizationId;
}

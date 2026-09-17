import "server-only";

import { Octokit } from "octokit";

import { and, db, eq, inArray } from "@repo/database";
import {
  accountsTable,
  githubInstallations,
  organizationMembersTable,
} from "@repo/database/schema";

import { getGithubApp } from "@/lib/github/app";

export type InstallationOwnership =
  | { ok: true; accountLogin: string | null; accountType: string | null }
  | { ok: false; error: string };

/**
 * Server-side proof that `installationId` belongs to the calling user before
 * it may be saved or used. Installation ids are small guessable integers, so
 * a client-supplied id must never be trusted on its own — otherwise any
 * signed-in user could claim another tenant's installation and read their
 * private repo metadata.
 *
 * Verification ladder:
 *  1. The id must be a real installation of OUR GitHub App.
 *  2. If the caller has a GitHub-linked login, ownership is checked strictly:
 *     the installation must be accessible to their OAuth token (covers org
 *     installations) or target their own GitHub account. A mismatch is
 *     rejected outright.
 *  3. Callers without a GitHub login (Google/email sign-ins) can't be tied to
 *     a GitHub identity, so the happy-path popup flow is preserved for them —
 *     but only while the installation is unclaimed, or claimed by a teammate
 *     in one of their orgs. Claiming another tenant's installation requires
 *     signing in with GitHub to prove ownership.
 */
type InstallationAccount = { id?: number; login?: string; type?: string };

async function fetchInstallationAccount(
  installationId: number,
): Promise<{ ok: true; account: InstallationAccount | null } | { ok: false; error: string }> {
  try {
    const app = getGithubApp();
    const { data } = await app.octokit.rest.apps.getInstallation({
      installation_id: installationId,
    });
    return { ok: true, account: (data.account as InstallationAccount) ?? null };
  } catch (err) {
    console.error(`verifyInstallationOwnership failed for installation ${installationId}:`, err);
    return { ok: false, error: "That GitHub App installation doesn't exist." };
  }
}

async function verifyLinkedGitHubAccount(
  ghAccount: { accessToken: string | null; accountId: string },
  installationId: number,
  account: InstallationAccount | null,
): Promise<boolean> {
  if (ghAccount.accessToken) {
    try {
      const userOctokit = new Octokit({ auth: ghAccount.accessToken });
      const { data } = await userOctokit.rest.apps.listInstallationsForAuthenticatedUser({
        per_page: 100,
      });
      if (data.installations.some((i) => i.id === installationId)) return true;
    } catch {
      // Stale/revoked token — fall through to the account-id match.
    }
  }
  return account?.id != null && String(account.id) === ghAccount.accountId;
}

async function verifyUnlinkedUserAccess(userId: string, installationId: number): Promise<boolean> {
  const claims = await db
    .select({ userId: githubInstallations.userId })
    .from(githubInstallations)
    .where(eq(githubInstallations.installationId, installationId));
  const otherOwners = claims.map((c) => c.userId).filter((id) => id !== userId);
  if (otherOwners.length === 0) return true;

  const myOrgs = await db
    .select({ organizationId: organizationMembersTable.organizationId })
    .from(organizationMembersTable)
    .where(eq(organizationMembersTable.userId, userId));
  if (myOrgs.length === 0) return false;

  const orgMates = await db
    .select({ id: organizationMembersTable.id })
    .from(organizationMembersTable)
    .where(
      and(
        inArray(organizationMembersTable.userId, otherOwners),
        inArray(
          organizationMembersTable.organizationId,
          myOrgs.map((o) => o.organizationId),
        ),
      ),
    );
  return orgMates.length > 0;
}

export async function verifyInstallationOwnership(
  userId: string,
  installationId: number,
): Promise<InstallationOwnership> {
  // 1. The id must exist for our app — also gives us the target account.
  const fetchResult = await fetchInstallationAccount(installationId);
  if (!fetchResult.ok) {
    return fetchResult;
  }
  const { account } = fetchResult;

  const ownership: InstallationOwnership = {
    ok: true,
    accountLogin: account?.login ?? null,
    accountType: account?.type ?? null,
  };

  // 2. Strong path: the caller's linked GitHub identity.
  const [ghAccount] = await db
    .select()
    .from(accountsTable)
    .where(and(eq(accountsTable.userId, userId), eq(accountsTable.providerId, "github")));

  if (ghAccount) {
    const isOwner = await verifyLinkedGitHubAccount(ghAccount, installationId, account);
    if (isOwner) return ownership;
    return {
      ok: false,
      error:
        "This installation belongs to a different GitHub account than the one linked to your profile.",
    };
  }

  // 3. Weak path (no GitHub login): allow unclaimed or teammate-claimed ids.
  const isAllowed = await verifyUnlinkedUserAccess(userId, installationId);
  if (isAllowed) return ownership;

  return {
    ok: false,
    error:
      "This installation is already connected by another user. Sign in with GitHub to verify it's yours.",
  };
}

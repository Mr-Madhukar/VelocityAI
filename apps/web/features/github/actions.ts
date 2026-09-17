"use server";

import { headers } from "next/headers";
import { Octokit } from "octokit";

import { and, db, eq } from "@repo/database";
import {
  accountsTable,
  githubInstallations,
  pullRequestsTable,
  repositories,
} from "@repo/database/schema";
import { resolveAutoLinkFeatureId, resolveOrgIdForRepo } from "@repo/database/branch";

import { auth } from "@/lib/auth";
import { getGithubApp } from "@/lib/github/app";
import { inngest } from "@/features/inngest/client";
import {
  reviewForCurrentCommit,
  runReviewForPullRequest,
  shouldSkipAutoReview,
} from "@/features/github/review";
import { verifyInstallationOwnership } from "@/features/github/server/verify-installation";

export type GithubRepo = {
  id: string;
  fullName: string;
  name: string;
  owner: string;
  private: boolean;
  defaultBranch: string;
};

export type RepoOverview = {
  fullName: string;
  description: string | null;
  private: boolean;
  defaultBranch: string;
  stars: number;
  forks: number;
  /** True issue count (GitHub's open_issues_count minus open PRs). */
  openIssues: number;
  /** Open PR count fetched live from GitHub, independent of our PR sync. */
  openPrs: number;
  watchers: number;
  language: string | null;
  pushedAt: string | null;
  htmlUrl: string;
};

export type RepoCommit = {
  sha: string;
  message: string;
  authorName: string | null;
  authorLogin: string | null;
  authorAvatar: string | null;
  date: string | null;
  htmlUrl: string;
};

export type RepoContributor = {
  login: string;
  avatar: string | null;
  htmlUrl: string;
  contributions: number;
};

function splitFullName(fullName: string): [string, string] {
  const [owner = "", repo = ""] = fullName.split("/");
  return [owner, repo];
}

// Caller identity + active org, for authorizing server actions. Every action
// that receives an installationId / repo name / PR id from the client must go
// through one of the guards below — those values are attacker-controlled.
async function getSessionContext() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return null;
  return {
    userId: session.user.id,
    organizationId: session.session.activeOrganizationId ?? null,
  };
}

/**
 * A repo-scoped action may only touch repositories connected to the caller's
 * active org, under the installation that connected them. Blocks reading
 * another tenant's repo data by guessing installation ids / repo names.
 */
async function authorizeConnectedRepo(
  installationId: number,
  fullName: string,
): Promise<boolean> {
  const ctx = await getSessionContext();
  if (!ctx?.organizationId) return false;
  const rows = await db
    .select({ installationId: repositories.installationId })
    .from(repositories)
    .where(
      and(
        eq(repositories.fullName, fullName),
        eq(repositories.organizationId, ctx.organizationId),
      ),
    );
  // Older rows may predate installation tracking (null) — org scoping still holds.
  return rows.some((r) => r.installationId === installationId || r.installationId === null);
}

export type AppInstallation = {
  installationId: number;
  accountLogin: string | null;
  accountType: string | null;
  avatarUrl: string | null;
};

function mapInstallation(i: {
  id: number;
  account: { login?: string; type?: string; avatar_url?: string } | null;
}): AppInstallation {
  return {
    installationId: i.id,
    accountLogin: i.account?.login ?? null,
    accountType: i.account?.type ?? null,
    avatarUrl: i.account?.avatar_url ?? null,
  };
}

/**
 * Lists ONLY the GitHub App installations the currently signed-in user can access.
 *
 * This is scoped per-user — never list every installation of the app globally,
 * or a brand-new user would auto-detect and bind another tenant's installation
 * (cross-tenant data leak). We scope by:
 *   1. The user's GitHub OAuth token (`GET /user/installations`) when available, or
 *   2. Matching the global installation list against the user's GitHub account id.
 */
export async function listAppInstallations(): Promise<AppInstallation[]> {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) return [];

    // Look up the user's linked GitHub account (OAuth token + GitHub user id).
    const [ghAccount] = await db
      .select()
      .from(accountsTable)
      .where(
        and(
          eq(accountsTable.userId, session.user.id),
          eq(accountsTable.providerId, "github"),
        ),
      );

    // Preferred: list installations the *user* can access, via their OAuth token.
    if (ghAccount?.accessToken) {
      try {
        const userOctokit = new Octokit({ auth: ghAccount.accessToken });
        const { data } = await userOctokit.rest.apps.listInstallationsForAuthenticatedUser({
          per_page: 100,
        });
        return data.installations.map((i) =>
          mapInstallation(i as never),
        );
      } catch (err) {
        console.error("User-scoped installation lookup failed, falling back:", err);
      }
    }

    // Fallback: filter the global list down to the user's own GitHub account id.
    if (!ghAccount?.accountId) return [];
    const app = getGithubApp();
    const installations = await app.octokit.paginate(
      app.octokit.rest.apps.listInstallations,
      { per_page: 100 },
    );
    return installations
      .filter((i) => {
        const account = i.account as { id?: number } | null;
        return account?.id != null && String(account.id) === ghAccount.accountId;
      })
      .map((i) => mapInstallation(i as never));
  } catch (error) {
    console.error("Failed to list app installations:", error);
    return [];
  }
}

/**
 * Save a GitHub App installation for the calling user — but only after
 * server-side ownership verification. Replaces the old trpc mutation, which
 * trusted any client-supplied id (a cross-tenant hole: ids are guessable
 * integers). Account login/type are taken from GitHub, never from the client.
 */
export async function saveInstallationAction(input: {
  installationId: number;
}): Promise<
  { ok: true; accountLogin: string | null } | { ok: false; error: string }
> {
  const ctx = await getSessionContext();
  if (!ctx) return { ok: false, error: "Sign in first." };

  const verdict = await verifyInstallationOwnership(ctx.userId, input.installationId);
  if (!verdict.ok) return verdict;

  await db
    .insert(githubInstallations)
    .values({
      id: crypto.randomUUID(),
      userId: ctx.userId,
      installationId: input.installationId,
      accountLogin: verdict.accountLogin,
      accountType: verdict.accountType,
    })
    .onConflictDoUpdate({
      target: githubInstallations.userId,
      set: {
        installationId: input.installationId,
        accountLogin: verdict.accountLogin,
        accountType: verdict.accountType,
        updatedAt: new Date(),
      },
    });

  return { ok: true, accountLogin: verdict.accountLogin };
}

export async function listInstallationRepos(installationId: number): Promise<GithubRepo[]> {
  try {
    // Only the installation the caller has saved (and therefore verified) may
    // be enumerated — otherwise any user could list private repos of any
    // tenant by iterating installation ids.
    const ctx = await getSessionContext();
    if (!ctx) return [];
    const [saved] = await db
      .select({ installationId: githubInstallations.installationId })
      .from(githubInstallations)
      .where(eq(githubInstallations.userId, ctx.userId));
    if (saved?.installationId !== installationId) return [];

    const app = getGithubApp();
    const octokit = await app.getInstallationOctokit(installationId);
    const { data } = await octokit.rest.apps.listReposAccessibleToInstallation({ per_page: 100 });
    return data.repositories.map((r) => ({
      id: String(r.id),
      fullName: r.full_name,
      name: r.name,
      owner: r.owner.login,
      private: r.private,
      defaultBranch: r.default_branch,
    }));
  } catch {
    return [];
  }
}

export async function getRepoOverview(
  installationId: number,
  fullName: string,
): Promise<RepoOverview | null> {
  try {
    if (!(await authorizeConnectedRepo(installationId, fullName))) return null;
    const app = getGithubApp();
    const octokit = await app.getInstallationOctokit(installationId);
    const [owner, repo] = splitFullName(fullName);
    // GitHub's open_issues_count lumps PRs in with issues, so fetch the real
    // open-PR count too. Counting from the GitHub API (not our synced DB rows)
    // keeps the stats right even before/without a successful PR sync.
    const [{ data }, { data: openPrList }] = await Promise.all([
      octokit.rest.repos.get({ owner, repo }),
      octokit.rest.pulls.list({ owner, repo, state: "open", per_page: 100 }),
    ]);
    const openPrs = openPrList.length;
    return {
      fullName: data.full_name,
      description: data.description,
      private: data.private,
      defaultBranch: data.default_branch,
      stars: data.stargazers_count,
      forks: data.forks_count,
      openIssues: Math.max(0, data.open_issues_count - openPrs),
      openPrs,
      watchers: data.subscribers_count ?? data.watchers_count,
      language: data.language,
      pushedAt: data.pushed_at,
      htmlUrl: data.html_url,
    };
  } catch {
    return null;
  }
}

export async function listRepoCommits(
  installationId: number,
  fullName: string,
): Promise<RepoCommit[]> {
  try {
    if (!(await authorizeConnectedRepo(installationId, fullName))) return [];
    const app = getGithubApp();
    const octokit = await app.getInstallationOctokit(installationId);
    const [owner, repo] = splitFullName(fullName);
    const { data } = await octokit.rest.repos.listCommits({ owner, repo, per_page: 20 });
    return data.map((c) => ({
      sha: c.sha,
      message: c.commit.message.split("\n")[0] ?? c.commit.message,
      authorName: c.commit.author?.name ?? null,
      authorLogin: c.author?.login ?? null,
      authorAvatar: c.author?.avatar_url ?? null,
      date: c.commit.author?.date ?? null,
      htmlUrl: c.html_url,
    }));
  } catch {
    return [];
  }
}

export async function listRepoContributors(
  installationId: number,
  fullName: string,
): Promise<RepoContributor[]> {
  try {
    if (!(await authorizeConnectedRepo(installationId, fullName))) return [];
    const app = getGithubApp();
    const octokit = await app.getInstallationOctokit(installationId);
    const [owner, repo] = splitFullName(fullName);
    const { data } = await octokit.rest.repos.listContributors({ owner, repo, per_page: 30 });
    return data
      .filter((c) => c.login)
      .map((c) => ({
        login: c.login as string,
        avatar: c.avatar_url ?? null,
        htmlUrl: c.html_url ?? `https://github.com/${c.login}`,
        contributions: c.contributions,
      }));
  } catch {
    return [];
  }
}

interface RepoRowMeta {
  id: string;
  installationId: number | null;
  webhookId: string | null;
}

async function ensureRepoWebhook(
  octokit: Octokit,
  owner: string,
  repo: string,
  repositoryId: string | null,
  activeRepoRow?: RepoRowMeta,
): Promise<void> {
  if (!activeRepoRow || activeRepoRow.webhookId || !repositoryId) return;

  try {
    const webhookUrl = `${process.env.NEXT_PUBLIC_APP_URL || "https://my-ai-code-reviewer.onrender.com"}/api/github/webhook`;
    const webhookSecret = process.env.GITHUB_WEBHOOK_SECRET || "velocityai-webhook-secret";
    const { data: createdHook } = await octokit.rest.repos.createWebhook({
      owner,
      repo,
      name: "web",
      active: true,
      events: ["pull_request", "pull_request_review", "push"],
      config: {
        url: webhookUrl,
        content_type: "json",
        secret: webhookSecret,
        insecure_ssl: "0",
      },
    });
    if (createdHook?.id) {
      await db
        .update(repositories)
        .set({ webhookId: String(createdHook.id) })
        .where(eq(repositories.id, repositoryId));
    }
  } catch {
    /* proceed gracefully if app already receives organization-level events */
  }
}

interface SyncPrContext {
  fullName: string;
  organizationId: string | null;
  repositoryId: string | null;
  installationId: number;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function syncSinglePullRequest(pr: any, ctx: SyncPrContext): Promise<void> {
  const branch = pr.head.ref;
  const prId = `pr_${pr.id}`;
  const featureId = await resolveAutoLinkFeatureId(db, {
    branch,
    organizationId: ctx.organizationId,
    prId,
  });

  const saved = await db
    .insert(pullRequestsTable)
    .values({
      id: prId,
      featureId,
      ...(featureId ? { linkedHeadSha: pr.head.sha, linkedAt: new Date() } : {}),
      repositoryId: ctx.repositoryId,
      installationId: ctx.installationId,
      githubPrId: pr.id,
      githubPrUrl: pr.html_url,
      number: pr.number,
      title: pr.title,
      body: pr.body ?? null,
      authorLogin: pr.user?.login ?? null,
      headBranch: branch,
      baseBranch: pr.base.ref,
      headSha: pr.head.sha,
      repoFullName: ctx.fullName,
      state: pr.merged_at ? "merged" : pr.state,
    })
    .onConflictDoUpdate({
      target: pullRequestsTable.id,
      set: {
        ...(featureId
          ? { featureId, linkedHeadSha: pr.head.sha, linkedAt: new Date() }
          : {}),
        repositoryId: ctx.repositoryId,
        headSha: pr.head.sha,
        state: pr.merged_at ? "merged" : pr.state,
        title: pr.title,
        body: pr.body ?? null,
        updatedAt: new Date(),
      },
    })
    .returning({ featureId: pullRequestsTable.featureId });

  const linkedFeatureId = saved[0]?.featureId ?? featureId;
  const isOpen = !pr.merged_at && pr.state === "open";
  if (linkedFeatureId && isOpen && !(await shouldSkipAutoReview(prId, pr.head.sha))) {
    await inngest
      .send({
        name: "github/pull_request.review_requested",
        data: { pullRequestId: prId, repoFullName: ctx.fullName },
      })
      .catch((err) => console.error("Failed to enqueue review during sync:", err));
  }
}

/**
 * Pull the latest PRs from GitHub and upsert them into our DB so the dashboard
 * renders instantly and review status can be joined in. Feature-branch PRs are
 * linked to their feature when it exists.
 */
export async function syncRepoPullRequests(
  installationId: number,
  fullName: string,
): Promise<{ synced: number }> {
  try {
    if (!(await authorizeConnectedRepo(installationId, fullName))) return { synced: 0 };
    const app = getGithubApp();
    const octokit = await app.getInstallationOctokit(installationId);
    const [owner, repo] = splitFullName(fullName);
    const { data } = await octokit.rest.pulls.list({
      owner,
      repo,
      state: "all",
      per_page: 50,
      sort: "updated",
      direction: "desc",
    });

    const organizationId = await resolveOrgIdForRepo(db, fullName, installationId);

    const repoRows = await db
      .select({
        id: repositories.id,
        installationId: repositories.installationId,
        webhookId: repositories.webhookId,
      })
      .from(repositories)
      .where(eq(repositories.fullName, fullName));
    const repositoryId =
      repoRows.find((r) => r.installationId === installationId)?.id ?? repoRows[0]?.id ?? null;

    const activeRepoRow = repoRows.find((r) => r.id === repositoryId);
    await ensureRepoWebhook(octokit, owner, repo, repositoryId, activeRepoRow);

    const prCtx: SyncPrContext = {
      fullName,
      organizationId,
      repositoryId,
      installationId,
    };

    for (const pr of data) {
      await syncSinglePullRequest(pr, prCtx);
    }

    return { synced: data.length };
  } catch (error) {
    console.error("Failed to sync pull requests:", error);
    return { synced: 0 };
  }
}

/**
 * Runs the AI review for a single PR immediately (inline), independent of the
 * GitHub webhook or Inngest. Used by the "Run review" button so a review is
 * guaranteed to run on demand. If the PR's current commit was already reviewed,
 * it returns that result instead of spending a fresh AI call.
 */
export async function triggerPrReview(
  pullRequestId: string,
  opts?: { force?: boolean },
): Promise<{ ok: boolean; status?: string; reused?: boolean; error?: string }> {
  try {
    // PR ids are derived from GitHub's numeric ids (enumerable) — reviews
    // spend the owning org's AI credits, so only members of the org the PR's
    // repo is connected to may trigger one.
    const ctx = await getSessionContext();
    if (!ctx?.organizationId) {
      return { ok: false, error: "Sign in and select an organization first." };
    }
    const [pr] = await db
      .select({ repoFullName: pullRequestsTable.repoFullName })
      .from(pullRequestsTable)
      .where(eq(pullRequestsTable.id, pullRequestId));
    if (!pr) return { ok: false, error: "Pull request not found." };
    const [orgRepo] = await db
      .select({ id: repositories.id })
      .from(repositories)
      .where(
        and(
          eq(repositories.fullName, pr.repoFullName),
          eq(repositories.organizationId, ctx.organizationId),
        ),
      );
    if (!orgRepo) return { ok: false, error: "Pull request not found in this organization." };

    // `force` skips commit-reuse — used right after linking a PR to a feature,
    // where the old review predates the PRD context and must be redone.
    if (!opts?.force) {
      const existing = await reviewForCurrentCommit(pullRequestId);
      if (existing) {
        return { ok: true, status: existing.status, reused: true };
      }
    }
    const review = await runReviewForPullRequest(pullRequestId);
    return { ok: true, status: review.status };
  } catch (error) {
    console.error("Failed to run PR review:", error);
    return { ok: false, error: error instanceof Error ? error.message : "Review failed" };
  }
}

/**
 * Explicitly provisions an automated repository webhook via Octokit
 * and saves the generated webhookId to the repositories table.
 */
export async function setupRepoWebhookAction(
  fullName: string,
  installationId: number,
): Promise<{ ok: boolean; webhookId?: string; error?: string }> {
  try {
    if (!(await authorizeConnectedRepo(installationId, fullName))) {
      return { ok: false, error: "Unauthorized repository access." };
    }
    const app = getGithubApp();
    const octokit = await app.getInstallationOctokit(installationId);
    const [owner, repo] = splitFullName(fullName);
    const webhookUrl = `${process.env.NEXT_PUBLIC_APP_URL || "https://my-ai-code-reviewer.onrender.com"}/api/github/webhook`;
    const webhookSecret = process.env.GITHUB_WEBHOOK_SECRET || "velocityai-webhook-secret";

    const { data: createdHook } = await octokit.rest.repos.createWebhook({
      owner,
      repo,
      name: "web",
      active: true,
      events: ["pull_request", "pull_request_review", "push"],
      config: {
        url: webhookUrl,
        content_type: "json",
        secret: webhookSecret,
        insecure_ssl: "0",
      },
    });

    if (createdHook?.id) {
      await db
        .update(repositories)
        .set({ webhookId: String(createdHook.id) })
        .where(eq(repositories.fullName, fullName));
      return { ok: true, webhookId: String(createdHook.id) };
    }
    return { ok: false, error: "Failed to create webhook" };
  } catch (error) {
    console.error("Failed to setup repository webhook:", error);
    return { ok: false, error: error instanceof Error ? error.message : "Webhook setup failed" };
  }
}

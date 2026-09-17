import { getGithubApp } from "@/lib/github/app";
import { db, eq } from "@repo/database";
import { pullRequestsTable, repositories } from "@repo/database/schema";
import { resolveAutoLinkFeatureId, resolveOrgIdForRepo } from "@repo/database/branch";
import { inngest } from "@/features/inngest/client";
import { refreshRepoContextIfStale } from "@/features/copilot/server/repo-context";
import { runReviewForPullRequest, shouldSkipAutoReview } from "@/features/github/review";

const REVIEWABLE_ACTIONS = new Set(["opened", "synchronize", "reopened"]);

async function verifyWebhookSignature(
  payload: string,
  signature: string | null,
): Promise<{ ok: boolean; status: number; error?: string }> {
  if (!signature) {
    console.warn("[github-webhook] rejected: missing x-hub-signature-256 header");
    return { ok: false, status: 401, error: "Missing signature" };
  }

  try {
    const app = getGithubApp();
    const isValid = await app.webhooks.verify(payload, signature);
    if (!isValid) {
      console.warn(
        "[github-webhook] rejected: invalid signature — GITHUB_WEBHOOK_SECRET does not match the secret set on the GitHub App",
      );
      return { ok: false, status: 401, error: "Invalid signature" };
    }
    return { ok: true, status: 200 };
  } catch (error) {
    console.error("[github-webhook] verification failed:", error);
    return { ok: false, status: 401, error: "Verification failed" };
  }
}

interface WebhookPullRequestPayload {
  id: number;
  number: number;
  title: string;
  body: string | null;
  state: string;
  merged_at: string | null;
  html_url: string;
  head: {
    ref: string;
    sha: string;
  };
  base: {
    ref: string;
  };
  user?: {
    login: string;
  };
}

interface WebhookEventPayload {
  action: string;
  pull_request?: WebhookPullRequestPayload;
  repository: {
    full_name: string;
  };
  installation?: {
    id: number;
  };
}

async function persistPullRequest(
  pr: WebhookPullRequestPayload,
  event: WebhookEventPayload,
  featureId: string | null,
  repositoryId: string | null,
) {
  const [record] = await db
    .insert(pullRequestsTable)
    .values({
      id: `pr_${pr.id}`,
      featureId,
      // Record which commit the PR was at when it got linked to the feature.
      ...(featureId ? { linkedHeadSha: pr.head.sha, linkedAt: new Date() } : {}),
      repositoryId,
      installationId: event.installation?.id || 0,
      githubPrId: pr.id,
      githubPrUrl: pr.html_url,
      number: pr.number,
      title: pr.title,
      body: pr.body,
      authorLogin: pr.user?.login,
      headBranch: pr.head.ref,
      baseBranch: pr.base.ref,
      headSha: pr.head.sha,
      repoFullName: event.repository.full_name,
      state: pr.merged_at ? "merged" : pr.state || "open",
    })
    .onConflictDoUpdate({
      target: pullRequestsTable.id,
      set: {
        // Only overwrite the feature link when the guarded resolver says this
        // is a genuine new link — a null here would wipe a manual link on
        // every subsequent push. The guard also means the link-time stamps
        // only ever fire on the actual link transition.
        ...(featureId
          ? { featureId, linkedHeadSha: pr.head.sha, linkedAt: new Date() }
          : {}),
        repositoryId,
        headSha: pr.head.sha,
        state: pr.merged_at ? "merged" : pr.state || "open",
        title: pr.title,
        body: pr.body,
        updatedAt: new Date(),
      },
    })
    .returning();
  return record;
}

async function triggerReviewIfEligible(
  savedId: string,
  pr: WebhookPullRequestPayload,
  repoFullName: string,
  action: string,
) {
  if (!REVIEWABLE_ACTIONS.has(action)) return;

  if (await shouldSkipAutoReview(savedId, pr.head.sha)) {
    console.log(
      `[github-webhook] skipping review for ${savedId} — SHA ${pr.head.sha} already reviewed or in flight`,
    );
    return;
  }

  try {
    await inngest.send({
      name: "github/pull_request.review_requested",
      data: { pullRequestId: savedId, repoFullName },
    });
    console.log(`[github-webhook] enqueued review for ${savedId}`);
  } catch (error) {
    // Inngest unreachable (e.g. dev server offline). Fall back to running the
    // review inline, fire-and-forget, so it still happens. We don't await it —
    // GitHub expects a fast webhook response.
    console.error("[github-webhook] inngest enqueue failed, running review inline:", error);
    void runReviewForPullRequest(savedId).catch((err) =>
      console.error("[github-webhook] inline review failed:", err),
    );
  }
}

async function handleMergedPrRepoContext(
  repoFullName: string,
  action: string,
  mergedAt: string | null,
) {
  if (action !== "closed" || !mergedAt) return;

  try {
    const connectedRepos = await db
      .select({ id: repositories.id })
      .from(repositories)
      .where(eq(repositories.fullName, repoFullName));
    for (const repo of connectedRepos) {
      void refreshRepoContextIfStale(repo.id);
    }
  } catch (error) {
    console.error("[github-webhook] repo-context refresh failed to enqueue:", error);
  }
}

export async function POST(request: Request) {
  const payload = await request.text();
  const signature = request.headers.get("x-hub-signature-256");
  const eventName = request.headers.get("x-github-event");

  console.log(`[github-webhook] received event="${eventName}" hasSignature=${Boolean(signature)}`);

  const verification = await verifyWebhookSignature(payload, signature);
  if (!verification.ok) {
    return Response.json({ error: verification.error }, { status: verification.status });
  }

  if (eventName !== "pull_request") {
    console.log(`[github-webhook] ignoring non-pull_request event="${eventName}"`);
    return Response.json({ received: true });
  }

  const event = JSON.parse(payload) as WebhookEventPayload;
  const pr = event.pull_request;
  if (!pr) {
    return Response.json({ received: true });
  }

  console.log(
    `[github-webhook] pull_request action="${event.action}" repo="${event.repository.full_name}" #${pr.number} branch="${pr.head.ref}"`,
  );

  // Resolve a feature branch to a real feature: stored branch slug within the
  // repo's org first (feature/add-dark-mode), then a raw feature id (back-compat).
  // Guarded so a PR never steals a feature already linked to another PR, and so
  // an already-linked PR doesn't re-stamp its link metadata on every push.
  const branchName: string = pr.head.ref;
  const organizationId = await resolveOrgIdForRepo(
    db,
    event.repository.full_name,
    event.installation?.id ?? null,
  );
  const featureId = await resolveAutoLinkFeatureId(db, {
    branch: branchName,
    organizationId,
    prId: `pr_${pr.id}`,
  });

  // The connected repo row (billing org resolution + project scoping) — prefer
  // the row matching this installation when the same repo is connected twice.
  const repoRows = await db
    .select({ id: repositories.id, installationId: repositories.installationId })
    .from(repositories)
    .where(eq(repositories.fullName, event.repository.full_name));
  const repositoryId =
    repoRows.find((r) => r.installationId === event.installation?.id)?.id ??
    repoRows[0]?.id ??
    null;

  // Cache every PR for connected repos — even ones not tied to a feature.
  let saved;
  try {
    saved = await persistPullRequest(pr, event, featureId, repositoryId);
  } catch (error) {
    console.error("Failed to persist pull request:", error);
    return Response.json({ error: "Failed to persist pull request" }, { status: 500 });
  }

  // Trigger AI review for every PR in a repo where the app is installed — but
  // skip if this exact commit was already reviewed or a review is in flight.
  if (saved) {
    await triggerReviewIfEligible(saved.id, pr, event.repository.full_name, event.action);
  }

  // A merged PR changes the default branch — refresh the cached repo context so
  // Copilot reasons over the latest code. Fire-and-forget; never block the webhook.
  await handleMergedPrRepoContext(event.repository.full_name, event.action, pr.merged_at);

  return Response.json({ received: true });
}

import { TRPCError } from "@trpc/server";
import { and, count, desc, eq, inArray, isNull, ne } from "@repo/database";
import {
  featureRequests,
  githubInstallations,
  pullRequests,
  repositories,
  reviewCycles,
  subscriptions,
} from "@repo/database/schema";

import { getPlanDetails, type BillingPlan } from "@repo/services/shipflow/billing";

import { orgProcedure, protectedProcedure, router } from "../../trpc";
import { z } from "../../schema";

const repoInput = z.object({
  projectId: z.string(),
  fullName: z.string(),
  githubRepoId: z.string(),
  installationId: z.number(),
});

export const githubRouter = router({
  getInstallationStatus: protectedProcedure.query(async ({ ctx }) => {
    const [installation] = await ctx.db
      .select()
      .from(githubInstallations)
      .where(eq(githubInstallations.userId, ctx.session.user.id));

    return { installed: Boolean(installation), installation: installation ?? null };
  }),

  // NOTE: installations are saved via the `saveInstallationAction` server
  // action (apps/web/features/github/actions.ts), which verifies ownership of
  // the installation id against GitHub before writing. A trpc mutation can't
  // do that check (this package must stay free of Octokit), so no unverified
  // save endpoint is exposed here.

  repositories: orgProcedure
    .input(z.object({ projectId: z.string().optional() }).optional())
    .query(async ({ ctx, input }) => {
      const conditions = [eq(repositories.organizationId, ctx.org.id)];

      if (input?.projectId) {
        conditions.push(eq(repositories.projectId, input.projectId));
      }

      return ctx.db
        .select()
        .from(repositories)
        .where(and(...conditions));
    }),

  listRepos: orgProcedure
    .input(z.object({ projectId: z.string() }))
    .query(async ({ ctx, input }) =>
      ctx.db
        .select()
        .from(repositories)
        .where(
          and(
            eq(repositories.projectId, input.projectId),
            eq(repositories.organizationId, ctx.org.id),
          ),
        ),
    ),

  // Cached PRs for a connected repo, each with its latest AI review verdict.
  pullRequestsByRepo: orgProcedure
    .input(z.object({ repoFullName: z.string() }))
    .query(async ({ ctx, input }) => {
      // Ensure the repo belongs to this org before exposing its PRs.
      const [repo] = await ctx.db
        .select({ id: repositories.id })
        .from(repositories)
        .where(
          and(
            eq(repositories.fullName, input.repoFullName),
            eq(repositories.organizationId, ctx.org.id),
          ),
        );
      if (!repo) return [];

      const prs = await ctx.db
        .select()
        .from(pullRequests)
        .where(eq(pullRequests.repoFullName, input.repoFullName))
        .orderBy(desc(pullRequests.number));

      return Promise.all(
        prs.map(async (pr) => {
          const [cycle] = await ctx.db
            .select({
              status: reviewCycles.status,
              overallVerdict: reviewCycles.overallVerdict,
              prdComplianceScore: reviewCycles.prdComplianceScore,
              headSha: reviewCycles.headSha,
            })
            .from(reviewCycles)
            .where(eq(reviewCycles.pullRequestId, pr.id))
            .orderBy(desc(reviewCycles.createdAt))
            .limit(1);

          return {
            id: pr.id,
            number: pr.number,
            title: pr.title,
            url: pr.githubPrUrl,
            authorLogin: pr.authorLogin,
            headBranch: pr.headBranch,
            baseBranch: pr.baseBranch,
            state: pr.state,
            featureId: pr.featureId,
            headSha: pr.headSha,
            createdAt: pr.createdAt,
            updatedAt: pr.updatedAt,
            // Whether the latest review covers the PR's current commit — lets the
            // UI offer "view existing review" instead of spending a fresh one.
            reviewedCurrentCommit: cycle?.headSha != null && cycle.headSha === pr.headSha,
            review: cycle
              ? {
                  status: cycle.status,
                  overallVerdict: cycle.overallVerdict,
                  prdComplianceScore: cycle.prdComplianceScore,
                }
              : null,
          };
        }),
      );
    }),

  // Unlinked PRs (no feature) from the org's connected repos — the candidates a
  // user can attach to a feature. Scoped to a project's repos when given.
  listLinkablePullRequests: orgProcedure
    .input(z.object({ projectId: z.string().optional() }).optional())
    .query(async ({ ctx, input }) => {
      const conditions = [
        eq(repositories.organizationId, ctx.org.id),
        isNull(pullRequests.featureId),
      ];
      if (input?.projectId) {
        conditions.push(eq(repositories.projectId, input.projectId));
      }

      return ctx.db
        .selectDistinct({
          id: pullRequests.id,
          number: pullRequests.number,
          title: pullRequests.title,
          repoFullName: pullRequests.repoFullName,
          headBranch: pullRequests.headBranch,
          state: pullRequests.state,
          url: pullRequests.githubPrUrl,
        })
        .from(pullRequests)
        .innerJoin(repositories, eq(repositories.fullName, pullRequests.repoFullName))
        .where(and(...conditions))
        .orderBy(desc(pullRequests.number));
    }),

  // The open PR currently linked to a feature (if any) — surfaced in the Agent
  // so the user sees which PR the agent is building on: it reads that PR's code
  // and commits the requested change on top of the same PR.
  prForFeature: orgProcedure
    .input(z.object({ featureId: z.string() }))
    .query(async ({ ctx, input }) => {
      const [pr] = await ctx.db
        .select({
          number: pullRequests.number,
          url: pullRequests.githubPrUrl,
          title: pullRequests.title,
          headBranch: pullRequests.headBranch,
          baseBranch: pullRequests.baseBranch,
        })
        .from(pullRequests)
        .innerJoin(featureRequests, eq(featureRequests.id, pullRequests.featureId))
        .where(
          and(
            eq(pullRequests.featureId, input.featureId),
            eq(featureRequests.organizationId, ctx.org.id),
            eq(pullRequests.state, "open"),
          ),
        )
        .orderBy(desc(pullRequests.number))
        .limit(1);
      return pr ?? null;
    }),

  // Link a cached PR to a feature directly (no branch rename), enforcing one
  // active PR per feature: any previously linked PR — and its review history —
  // is detached so the feature's Review tab starts fresh with this PR.
  // - Open PR: no cycles are carried; the client immediately forces a fresh AI
  //   review, which becomes Review #1 and drives the feature's status.
  // - Closed/merged PR: no new review will come, so only the PR's newest
  //   completed cycle is carried and its verdict rolls up to the feature.
  linkPullRequestToFeature: orgProcedure
    .input(z.object({ pullRequestId: z.string(), featureId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      // The PR must belong to one of this org's connected repos.
      const [row] = await ctx.db
        .select({
          id: pullRequests.id,
          repoFullName: pullRequests.repoFullName,
          headSha: pullRequests.headSha,
          state: pullRequests.state,
        })
        .from(pullRequests)
        .innerJoin(repositories, eq(repositories.fullName, pullRequests.repoFullName))
        .where(
          and(
            eq(pullRequests.id, input.pullRequestId),
            eq(repositories.organizationId, ctx.org.id),
          ),
        );
      if (!row) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Pull request not found" });
      }

      const [feature] = await ctx.db
        .select({ id: featureRequests.id })
        .from(featureRequests)
        .where(
          and(
            eq(featureRequests.id, input.featureId),
            eq(featureRequests.organizationId, ctx.org.id),
          ),
        );
      if (!feature) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Feature not found" });
      }

      const now = new Date();
      await ctx.db.transaction(async (tx) => {
        // Detach the feature's previous PR(s) so this one becomes the only
        // linked PR. Clearing the link stamps also keeps the auto-link guard
        // from re-linking them on their next push/sync.
        await tx
          .update(pullRequests)
          .set({ featureId: null, linkedHeadSha: null, linkedAt: null, updatedAt: now })
          .where(
            and(
              eq(pullRequests.featureId, input.featureId),
              ne(pullRequests.id, input.pullRequestId),
            ),
          );

        // Their review history leaves the feature (still visible on the global
        // Reviews page as unlinked cycles).
        await tx
          .update(reviewCycles)
          .set({ featureId: null })
          .where(
            and(
              eq(reviewCycles.featureId, input.featureId),
              ne(reviewCycles.pullRequestId, input.pullRequestId),
            ),
          );

        // This PR's pre-link cycles are not carried either — detach them from
        // whatever feature they pointed at (e.g. a feature it was linked to
        // before) so history starts fresh.
        await tx
          .update(reviewCycles)
          .set({ featureId: null })
          .where(eq(reviewCycles.pullRequestId, input.pullRequestId));

        await tx
          .update(pullRequests)
          .set({
            featureId: input.featureId,
            linkedHeadSha: row.headSha,
            linkedAt: now,
            updatedAt: now,
          })
          .where(eq(pullRequests.id, input.pullRequestId));

        // A closed/merged PR never gets the forced link-time review, so carry
        // its newest completed cycle and reflect that verdict on the feature.
        if (row.state !== "open") {
          const [latest] = await tx
            .select({ id: reviewCycles.id, status: reviewCycles.status })
            .from(reviewCycles)
            .where(
              and(
                eq(reviewCycles.pullRequestId, input.pullRequestId),
                inArray(reviewCycles.status, ["passed", "failed"]),
              ),
            )
            .orderBy(desc(reviewCycles.createdAt))
            .limit(1);

          if (latest) {
            await tx
              .update(reviewCycles)
              .set({ featureId: input.featureId })
              .where(eq(reviewCycles.id, latest.id));
            await tx
              .update(featureRequests)
              .set({
                status: latest.status === "passed" ? "approved" : "blocked",
                updatedAt: now,
              })
              .where(eq(featureRequests.id, input.featureId));
          }
        }
      });

      return { linked: true };
    }),

  connectRepo: orgProcedure
    .input(
      z.object({
        projectId: z.string(),
        fullName: z.string(),
        githubRepoId: z.string(),
        installationId: z.number(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // The installation id must be the one this user saved (which went
      // through server-side ownership verification) — a raw client-supplied
      // id could otherwise bind another tenant's installation to this org.
      const [saved] = await ctx.db
        .select({ installationId: githubInstallations.installationId })
        .from(githubInstallations)
        .where(eq(githubInstallations.userId, ctx.session.user.id));
      if (!saved || saved.installationId !== input.installationId) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Connect your GitHub installation first.",
        });
      }

      // One repo → one project: reject if it's already connected anywhere in
      // this org (the user must disconnect it first to move it).
      const [existing] = await ctx.db
        .select({ id: repositories.id })
        .from(repositories)
        .where(
          and(
            eq(repositories.organizationId, ctx.org.id),
            eq(repositories.fullName, input.fullName),
          ),
        );
      if (existing) {
        throw new TRPCError({
          code: "CONFLICT",
          message:
            "This repository is already connected to a project. Disconnect it there first to move it.",
        });
      }

      // Enforce the plan's repository limit (-1 = unlimited). Derived live from
      // the plan (single source of truth in billing) so limit changes apply to
      // existing orgs immediately.
      const [sub] = await ctx.db
        .select({ plan: subscriptions.plan })
        .from(subscriptions)
        .where(eq(subscriptions.organizationId, ctx.org.id));
      const repoLimit = getPlanDetails((sub?.plan ?? "free") as BillingPlan).repositoryLimit;

      if (repoLimit !== -1) {
        const [used] = await ctx.db
          .select({ value: count() })
          .from(repositories)
          .where(eq(repositories.organizationId, ctx.org.id));
        if ((used?.value ?? 0) >= repoLimit) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: `Your plan allows ${repoLimit} ${repoLimit === 1 ? "repository" : "repositories"}. Upgrade to connect more.`,
          });
        }
      }

      const [owner = "", name = input.fullName] = input.fullName.split("/");
      const [repo] = await ctx.db
        .insert(repositories)
        .values({
          id: crypto.randomUUID(),
          projectId: input.projectId,
          organizationId: ctx.org.id,
          githubRepoId: input.githubRepoId,
          fullName: input.fullName,
          name,
          owner,
          installationId: input.installationId,
        })
        .returning();

      return repo;
    }),

  disconnectRepo: orgProcedure
    .input(z.object({ repoId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db
        .delete(repositories)
        .where(
          and(
            eq(repositories.id, input.repoId),
            eq(repositories.organizationId, ctx.org.id),
          ),
        );
    }),
});

import { and, desc, eq, ilike, or } from "@repo/database";
import {
  featureRequests,
  prds,
  projects,
  repositories,
  reviewCycles,
  tasks,
} from "@repo/database/schema";

import { orgProcedure, router } from "../../trpc";
import { z } from "../../schema";

export type SearchResultType =
  | "project"
  | "feature"
  | "task"
  | "prd"
  | "repository"
  | "review";

export type SearchResult = {
  type: SearchResultType;
  id: string;
  title: string;
  subtitle: string;
  href: string;
  /** Present on `project` results so the UI can set scope before navigating. */
  projectId?: string;
};

export const searchRouter = router({
  // Org-scoped search across every entity type. Pass `projectId` to narrow to a
  // single project; omit it for the org-wide ("All projects") search.
  global: orgProcedure
    .input(
      z.object({
        q: z.string().min(1),
        projectId: z.string().optional(),
        limit: z.number().min(1).max(25).optional(),
      }),
    )
    .query(async ({ ctx, input }): Promise<{ results: SearchResult[] }> => {
      const term = `%${input.q.trim()}%`;
      const perGroup = input.limit ?? 5;
      const orgId = ctx.org.id;
      const pid = input.projectId;
      const projectScope = pid ? eq(featureRequests.projectId, pid) : undefined;

      const [
        projectRows,
        featureRows,
        taskRows,
        prdRows,
        repoRows,
        reviewRows,
      ] = await Promise.all([
        ctx.db
          .select({ id: projects.id, name: projects.name, slug: projects.slug })
          .from(projects)
          .where(
            and(
              eq(projects.organizationId, orgId),
              or(ilike(projects.name, term), ilike(projects.description, term)),
              pid ? eq(projects.id, pid) : undefined,
            ),
          )
          .limit(perGroup),

        ctx.db
          .select({
            id: featureRequests.id,
            title: featureRequests.title,
            status: featureRequests.status,
          })
          .from(featureRequests)
          .where(
            and(
              eq(featureRequests.organizationId, orgId),
              or(ilike(featureRequests.title, term), ilike(featureRequests.description, term)),
              pid ? eq(featureRequests.projectId, pid) : undefined,
            ),
          )
          .orderBy(desc(featureRequests.createdAt))
          .limit(perGroup),

        ctx.db
          .select({
            id: tasks.id,
            title: tasks.title,
            featureId: tasks.featureId,
            featureTitle: featureRequests.title,
          })
          .from(tasks)
          .innerJoin(featureRequests, eq(tasks.featureId, featureRequests.id))
          .where(
            and(
              eq(featureRequests.organizationId, orgId),
              or(ilike(tasks.title, term), ilike(tasks.description, term)),
              projectScope,
            ),
          )
          .limit(perGroup),

        ctx.db
          .select({
            id: prds.id,
            featureId: prds.featureId,
            featureTitle: featureRequests.title,
          })
          .from(prds)
          .innerJoin(featureRequests, eq(prds.featureId, featureRequests.id))
          .where(
            and(
              eq(featureRequests.organizationId, orgId),
              or(
                ilike(prds.problem, term),
                ilike(prds.goals, term),
                ilike(prds.rawMarkdown, term),
              ),
              projectScope,
            ),
          )
          .limit(perGroup),

        ctx.db
          .select({
            id: repositories.id,
            fullName: repositories.fullName,
            name: repositories.name,
          })
          .from(repositories)
          .where(
            and(
              eq(repositories.organizationId, orgId),
              or(ilike(repositories.fullName, term), ilike(repositories.name, term)),
              pid ? eq(repositories.projectId, pid) : undefined,
            ),
          )
          .limit(perGroup),

        ctx.db
          .select({
            id: reviewCycles.id,
            featureId: reviewCycles.featureId,
            summary: reviewCycles.summary,
            verdict: reviewCycles.overallVerdict,
            featureTitle: featureRequests.title,
          })
          .from(reviewCycles)
          .innerJoin(featureRequests, eq(reviewCycles.featureId, featureRequests.id))
          .where(
            and(
              eq(featureRequests.organizationId, orgId),
              or(ilike(reviewCycles.summary, term), ilike(reviewCycles.overallVerdict, term)),
              projectScope,
            ),
          )
          .orderBy(desc(reviewCycles.createdAt))
          .limit(perGroup),
      ]);

      const results: SearchResult[] = [
        ...projectRows.map((p): SearchResult => ({
          type: "project",
          id: p.id,
          title: p.name,
          subtitle: `/${p.slug}`,
          href: "/dashboard",
          projectId: p.id,
        })),
        ...featureRows.map((f): SearchResult => ({
          type: "feature",
          id: f.id,
          title: f.title,
          subtitle: `Feature · ${f.status.replace(/_/g, " ")}`,
          href: `/features/${f.id}`,
        })),
        ...taskRows.map((t): SearchResult => ({
          type: "task",
          id: t.id,
          title: t.title,
          subtitle: `Task · ${t.featureTitle}`,
          href: `/features/${t.featureId}?tab=tasks`,
        })),
        ...prdRows.map((p): SearchResult => ({
          type: "prd",
          id: p.id,
          title: p.featureTitle,
          subtitle: "PRD",
          href: `/features/${p.featureId}?tab=prd`,
        })),
        ...repoRows.map((r): SearchResult => ({
          type: "repository",
          id: r.id,
          title: r.fullName,
          subtitle: "Repository",
          href: "/github",
        })),
        ...reviewRows.map((r): SearchResult => ({
          type: "review",
          id: r.id,
          title: r.featureTitle,
          subtitle: r.verdict ? `Review · ${r.verdict.replace(/_/g, " ")}` : "Review",
          href: `/features/${r.featureId}?tab=review-history`,
        })),
      ];

      return { results };
    }),
});

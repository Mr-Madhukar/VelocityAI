import type { Command } from "commander";

import { colorStatus, dim, info, printJson, shortId, success, table } from "../output";
import { ensureOrg, requireToken, type Runtime } from "../runtime";

async function prep(getRuntime: () => Runtime): Promise<Runtime> {
  const rt = getRuntime();
  requireToken(rt);
  await ensureOrg(rt);
  return rt;
}

export function registerReviewCommands(program: Command, getRuntime: () => Runtime): void {
  const review = program
    .command("review")
    .alias("reviews")
    .description("Browse AI code-review cycles and findings.");

  review
    .command("list")
    .description("List review cycles across the org's connected repos.")
    .option("--status <status>", "Filter by status: running, passed, or failed.")
    .action(async (opts: { status?: string }) => {
      const rt = await prep(getRuntime);
      const cycles = await rt.client.review.listAllCycles.query(
        opts.status ? { status: opts.status as never } : undefined,
      );

      if (rt.json) return printJson(cycles);
      if (cycles.length === 0) return info("No review cycles yet.");

      info(
        table(
          ["ID", "STATUS", "SCORE", "PR", "FEATURE"],
          cycles.map((c) => [
            shortId(c.id),
            colorStatus(c.status),
            c.prdComplianceScore != null ? `${c.prdComplianceScore}` : "—",
            c.repoFullName && c.prNumber != null ? `${c.repoFullName}#${c.prNumber}` : "—",
            c.featureTitle ?? "Unlinked",
          ]),
        ),
      );
      dim(`\n${cycles.length} cycle(s). Full ids/details: VelocityAI review show <id>`);
    });

  review
    .command("show <cycleId>")
    .description("Show a review cycle's summary and findings.")
    .action(async (cycleId: string) => {
      const rt = await prep(getRuntime);
      const cycle = await rt.client.review.getCycle.query({ cycleId });
      if (!cycle) return info("Review cycle not found in this organization.");

      if (rt.json) return printJson(cycle);

      info(`${cycle.featureTitle ?? "Unlinked review"}  ${colorStatus(cycle.status)}`);
      info(`  id:     ${cycle.id}`);
      info(`  verdict: ${cycle.overallVerdict ?? "—"}`);
      info(`  score:   ${cycle.prdComplianceScore != null ? cycle.prdComplianceScore : "—"}`);
      if (cycle.prUrl) info(`  PR:      ${cycle.prUrl}`);
      if (cycle.summary) info(`\n${cycle.summary}`);

      if (cycle.issues.length > 0) {
        info(`\nFindings (${cycle.issues.length}):`);
        info(
          table(
            ["ID", "SEVERITY", "RESOLVED", "TITLE"],
            cycle.issues.map((i) => [
              shortId(i.id),
              i.severity ?? "—",
              i.resolved ? "yes" : "no",
              i.title ?? i.category ?? "—",
            ]),
          ),
        );
        dim("\nResolve a finding: VelocityAI review resolve <issueId>");
      }
    });

  review
    .command("resolve <issueId>")
    .description("Mark a review finding as resolved.")
    .action(async (issueId: string) => {
      const rt = await prep(getRuntime);
      const result = await rt.client.review.resolveIssue.mutate({ issueId });
      if (rt.json) return printJson(result);
      success("Finding marked as resolved.");
    });
}

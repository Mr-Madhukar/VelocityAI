import type { Command } from "commander";
import pc from "picocolors";

import { colorStatus, dim, info, printJson, shortId, table } from "../output";
import { ensureOrg, requireToken, type Runtime } from "../runtime";

async function prep(getRuntime: () => Runtime): Promise<Runtime> {
  const rt = getRuntime();
  requireToken(rt);
  await ensureOrg(rt);
  return rt;
}

export function registerWorkspaceCommands(program: Command, getRuntime: () => Runtime): void {
  const project = program.command("project").alias("projects").description("Browse projects.");

  project
    .command("list")
    .description("List projects in the active organization.")
    .action(async () => {
      const rt = await prep(getRuntime);
      const projects = await rt.client.project.list.query();

      if (rt.json) return printJson(projects);
      if (projects.length === 0) return info("No projects yet. Create one in the web app.");

      info(
        table(
          ["ID", "SLUG", "NAME"],
          projects.map((p) => [shortId(p.id), p.slug, p.name]),
        ),
      );
    });

  const member = program.command("member").alias("members").description("Browse teammates.");

  member
    .command("list")
    .description("List members of the active organization.")
    .action(async () => {
      const rt = await prep(getRuntime);
      const members = await rt.client.member.list.query();

      if (rt.json) return printJson(members);

      info(
        table(
          ["NAME", "EMAIL", "ROLE", "SPECIALTY", "VERIFIED"],
          members.map((m) => [
            m.name || "—",
            m.email,
            m.role,
            m.specialty ?? "—",
            m.emailVerified ? pc.green("yes") : pc.yellow("no"),
          ]),
        ),
      );
      dim("\nOnly members with a verified email can receive shared PRDs.");
    });

  program
    .command("search <query...>")
    .description("Search projects, features, tasks, PRDs, repos, and reviews in the active org.")
    .option("--limit <n>", "Max results per entity type (1–25).", "5")
    .action(async (query: string[], opts: { limit: string }) => {
      const rt = await prep(getRuntime);
      const limit = Math.min(25, Math.max(1, Number.parseInt(opts.limit, 10) || 5));
      const { results } = await rt.client.search.global.query({ q: query.join(" "), limit });

      if (rt.json) return printJson(results);
      if (results.length === 0) return info("No matches.");

      info(
        table(
          ["TYPE", "TITLE", "DETAIL", "ID"],
          results.map((r) => [r.type, r.title, r.subtitle, shortId(r.id)]),
        ),
      );
      dim(`\n${results.length} result(s). Open one: ${rt.apiUrl}<href from --json output>`);
    });

  program
    .command("status")
    .description("One-screen snapshot of the active organization's pipeline.")
    .action(async () => {
      const rt = await prep(getRuntime);
      const [org, features, cycles] = await Promise.all([
        rt.client.org.current.query().catch(() => null),
        rt.client.feature.list.query({}),
        rt.client.review.listAllCycles.query(undefined).catch(() => []),
      ]);

      const featuresByStatus = new Map<string, number>();
      for (const f of features) {
        featuresByStatus.set(f.status, (featuresByStatus.get(f.status) ?? 0) + 1);
      }
      const running = cycles.filter((c) => c.status === "running").length;
      const failed = cycles.filter((c) => c.status === "failed").length;

      if (rt.json) {
        return printJson({
          org: org ? { id: org.id, name: org.name, slug: org.slug } : null,
          features: Object.fromEntries(featuresByStatus),
          totalFeatures: features.length,
          reviews: { total: cycles.length, running, failed },
        });
      }

      info(pc.bold(org ? `${org.name} (${org.slug})` : "Active organization"));
      info("");
      info(`Features (${features.length}):`);
      if (features.length === 0) {
        dim("  none yet — VelocityAI feature create --title … --description …");
      } else {
        for (const [status, count] of [...featuresByStatus.entries()].sort((a, b) => b[1] - a[1])) {
          info(`  ${String(count).padStart(3)}  ${colorStatus(status)}`);
        }
      }
      info("");
      info(`Reviews: ${cycles.length} cycle(s) · ${running} running · ${failed} failed`);
    });

  program
    .command("ping")
    .description("Check that the configured VelocityAI deployment is reachable.")
    .action(async () => {
      const rt = getRuntime();
      const started = Date.now();
      await rt.client.health.getHealth.query();
      const ms = Date.now() - started;

      if (rt.json) return printJson({ ok: true, apiUrl: rt.apiUrl, latencyMs: ms });
      info(`${pc.green("✔")} ${rt.apiUrl} is up (${ms}ms)`);
    });
}

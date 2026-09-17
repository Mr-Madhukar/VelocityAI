import type { Command } from "commander";

import { openBrowser } from "../auth-flow";
import { CliError, colorStatus, dim, info, printJson, shortId, success, table } from "../output";
import { ensureOrg, requireToken, type Runtime } from "../runtime";

const PRIORITIES = ["low", "medium", "high", "urgent"] as const;

async function prep(getRuntime: () => Runtime): Promise<Runtime> {
  const rt = getRuntime();
  requireToken(rt);
  await ensureOrg(rt);
  return rt;
}

export function registerFeatureCommands(program: Command, getRuntime: () => Runtime): void {
  const feature = program.command("feature").description("Work with feature requests.");

  feature
    .command("list")
    .description("List feature requests in the active organization.")
    .option("--status <status>", "Filter by feature status (e.g. prd_ready, in_review).")
    .option("--project <projectId>", "Filter by project id.")
    .action(async (opts: { status?: string; project?: string }) => {
      const rt = await prep(getRuntime);
      const features = await rt.client.feature.list.query({
        ...(opts.status ? { status: opts.status as never } : {}),
        ...(opts.project ? { projectId: opts.project } : {}),
      });

      if (rt.json) return printJson(features);
      if (features.length === 0) return info("No features yet. Create one with `VelocityAI feature create`.");

      info(
        table(
          ["ID", "STATUS", "PRIORITY", "TITLE"],
          features.map((f) => [shortId(f.id), colorStatus(f.status), f.priority, f.title]),
        ),
      );
      dim(`\n${features.length} feature(s). Full ids: VelocityAI feature list --json`);
    });

  feature
    .command("create")
    .description("Create a feature request (kicks off AI clarification).")
    .requiredOption("--title <title>", "Feature title.")
    .requiredOption("--description <description>", "What the feature should do.")
    .option("--project <project>", "Project slug or id (defaults to the only project if unambiguous).")
    .option("--priority <priority>", `One of: ${PRIORITIES.join(", ")}.`, "medium")
    .action(
      async (opts: { title: string; description: string; project?: string; priority: string }) => {
        const rt = await prep(getRuntime);

        if (!PRIORITIES.includes(opts.priority as (typeof PRIORITIES)[number])) {
          throw new CliError(`--priority must be one of: ${PRIORITIES.join(", ")}.`);
        }

        const projects = await rt.client.project.list.query();
        if (projects.length === 0) {
          throw new CliError("This organization has no projects yet. Create one in the web app first.");
        }
        const project = opts.project
          ? projects.find((p) => p.slug === opts.project || p.id === opts.project)
          : projects.length === 1
            ? projects[0]
            : undefined;
        if (!project) {
          throw new CliError(
            opts.project
              ? `No project matching "${opts.project}".`
              : "Multiple projects exist — pass --project <slug>.",
          );
        }

        const created = await rt.client.feature.create.mutate({
          projectId: project.id,
          title: opts.title,
          description: opts.description,
          priority: opts.priority as (typeof PRIORITIES)[number],
        });

        if (rt.json) return printJson(created);
        success(`Created feature ${shortId(created.id)} — ${created.title}`);
        info(`  Full id: ${created.id}`);
        dim("  The AI is drafting its first clarifying question. See `VelocityAI feature show <id>`.");
      },
    );

  feature
    .command("show <featureId>")
    .description("Show a feature's status, PRD summary, tasks, and reviews.")
    .action(async (featureId: string) => {
      const rt = await prep(getRuntime);
      const f = await rt.client.feature.getById.query({ featureId });

      if (rt.json) return printJson(f);

      info(`${f.title}  ${colorStatus(f.status)}`);
      info(`  id:       ${f.id}`);
      info(`  priority: ${f.priority}`);
      info(`  branch:   ${f.branchName}`);
      info(`  PRD:      ${f.prd ? `v${f.prd.version}${f.prd.approvedAt ? " (approved)" : ""}` : "— not generated"}`);
      info(`  tasks:    ${f.tasks.length}`);
      info(`  reviews:  ${f.reviewCycles.length}`);
      if (f.messages.length > 0) {
        const last = f.messages[f.messages.length - 1]!;
        dim(`\n  last clarification (${last.role}): ${last.content}`);
      }
    });

  feature
    .command("clarify <featureId> <message...>")
    .description("Send a clarification reply to the AI product manager.")
    .action(async (featureId: string, message: string[]) => {
      const rt = await prep(getRuntime);
      const result = await rt.client.feature.sendClarificationMessage.mutate({
        featureId,
        message: message.join(" "),
      });

      if (rt.json) return printJson(result);
      info(`AI: ${result.reply}`);
      if (result.isDone) success("Clarification complete — PRD generation was triggered.");
    });

  feature
    .command("open <featureId>")
    .description("Open a feature in the web app.")
    .action(async (featureId: string) => {
      const rt = await prep(getRuntime);
      const url = `${rt.apiUrl}/features/${featureId}`;
      openBrowser(url);
      if (rt.json) return printJson({ url });
      info(url);
    });

  feature
    .command("approve <featureId>")
    .description("Approve a feature that is in review (manager+).")
    .option("--notes <notes>", "Optional approval notes.")
    .action(async (featureId: string, opts: { notes?: string }) => {
      const rt = await prep(getRuntime);
      const updated = await rt.client.approval.approve.mutate({ featureId, notes: opts.notes });
      if (rt.json) return printJson(updated);
      success(`Approved — ${updated?.title ?? featureId} is now ${colorStatus(updated?.status)}.`);
    });

  feature
    .command("reject <featureId> <reason...>")
    .description("Reject a feature with a reason (manager+). Marks it blocked.")
    .action(async (featureId: string, reason: string[]) => {
      const rt = await prep(getRuntime);
      const updated = await rt.client.approval.reject.mutate({
        featureId,
        reason: reason.join(" "),
      });
      if (rt.json) return printJson(updated);
      success(`Rejected — ${updated?.title ?? featureId} is now ${colorStatus(updated?.status)}.`);
    });

  feature
    .command("ship <featureId>")
    .description("Mark an approved feature as shipped (manager+).")
    .action(async (featureId: string) => {
      const rt = await prep(getRuntime);
      const updated = await rt.client.approval.ship.mutate({ featureId });
      if (rt.json) return printJson(updated);
      success(`🚀 ${updated?.title ?? featureId} shipped.`);
    });

  feature
    .command("tasks <featureId>")
    .description("List the engineering tasks generated for a feature.")
    .action(async (featureId: string) => {
      const rt = await prep(getRuntime);
      const f = await rt.client.feature.getById.query({ featureId });

      if (rt.json) return printJson(f.tasks);
      if (f.tasks.length === 0) return info("No tasks yet. Approve the PRD to generate them.");

      info(
        table(
          ["STATUS", "PRIORITY", "TYPE", "~H", "TITLE", "ASSIGNEE"],
          f.tasks.map((t) => [
            colorStatus(t.status),
            t.priority,
            t.type,
            t.estimatedHours != null ? String(t.estimatedHours) : "—",
            t.title,
            t.assigneeName ?? "—",
          ]),
        ),
      );
    });
}

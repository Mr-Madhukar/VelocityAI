import type { Command } from "commander";

import { fetchSession } from "../auth-flow";
import { CliError, colorStatus, dim, info, printJson, shortId, success, table } from "../output";
import { ensureOrg, requireToken, type Runtime } from "../runtime";

const TASK_STATUSES = ["todo", "in_progress", "done", "blocked"] as const;
type TaskStatus = (typeof TASK_STATUSES)[number];

async function prep(getRuntime: () => Runtime): Promise<Runtime> {
  const rt = getRuntime();
  requireToken(rt);
  await ensureOrg(rt);
  return rt;
}

async function moveTask(rt: Runtime, taskId: string, status: TaskStatus, reason?: string) {
  const updated = await rt.client.task.updateStatus.mutate({
    taskId,
    status,
    ...(status === "blocked" && reason ? { blockedReason: reason } : {}),
  });
  if (!updated) throw new CliError("Task not found.");

  if (rt.json) return printJson(updated);
  success(`${updated.title} → ${status.replace("_", " ")}`);
}

/** Resolve "me", an email, or a (partial) name to an org member's user id. */
async function resolveMember(rt: Runtime, who: string): Promise<{ userId: string; label: string }> {
  if (who === "me") {
    const session = await fetchSession(rt.apiUrl, requireToken(rt));
    const id = session?.user?.id;
    if (!id) throw new CliError("Couldn't resolve your user id. Run `VelocityAI login` again.");
    return { userId: id, label: session.user?.email ?? "you" };
  }

  const members = await rt.client.member.list.query();
  const needle = who.toLowerCase();
  const matches = members.filter(
    (m) =>
      m.email.toLowerCase() === needle ||
      m.name.toLowerCase() === needle ||
      m.name.toLowerCase().includes(needle),
  );
  if (matches.length === 0) {
    throw new CliError(`No teammate matching "${who}". See \`VelocityAI member list\`.`);
  }
  if (matches.length > 1) {
    throw new CliError(
      `"${who}" matches several teammates: ${matches.map((m) => m.email).join(", ")}. Use the full email.`,
    );
  }
  return { userId: matches[0]!.userId, label: matches[0]!.name || matches[0]!.email };
}

export function registerTaskCommands(program: Command, getRuntime: () => Runtime): void {
  const task = program.command("task").alias("tasks").description("Work with engineering tasks.");

  task
    .command("list <featureId>")
    .description("Show a feature's task board grouped by status.")
    .action(async (featureId: string) => {
      const rt = await prep(getRuntime);
      const [board, members] = await Promise.all([
        rt.client.task.byFeature.query({ featureId }),
        rt.client.member.list.query().catch(() => []),
      ]);
      const nameOf = new Map(members.map((m) => [m.userId, m.name || m.email]));

      if (rt.json) return printJson(board);

      const all = TASK_STATUSES.flatMap((status) => board[status]);
      if (all.length === 0) return info("No tasks yet. Approve the PRD to generate them.");

      info(
        table(
          ["ID", "STATUS", "PRIORITY", "TYPE", "~H", "TITLE", "ASSIGNEE"],
          all.map((t) => [
            shortId(t.id),
            colorStatus(t.status),
            t.priority,
            t.type,
            t.estimatedHours != null ? String(t.estimatedHours) : "—",
            t.title,
            (t.assignedTo && nameOf.get(t.assignedTo)) ?? "—",
          ]),
        ),
      );
      const counts = TASK_STATUSES.map((s) => `${board[s].length} ${s.replace("_", " ")}`).join(" · ");
      dim(`\n${counts}. Full ids: VelocityAI --json task list <featureId>`);
    });

  task
    .command("mine")
    .description("List tasks assigned to you across all organizations.")
    .action(async () => {
      const rt = getRuntime();
      requireToken(rt);
      const mine = await rt.client.profile.myTasks.query();

      if (rt.json) return printJson(mine);
      if (mine.length === 0) return info("No tasks assigned to you yet.");

      info(
        table(
          ["ID", "STATUS", "TYPE", "TITLE", "FEATURE", "ORG"],
          mine.map((t) => [
            shortId(t.id),
            colorStatus(t.status),
            t.type,
            t.title,
            t.featureTitle,
            t.orgName,
          ]),
        ),
      );
    });

  task
    .command("move <taskId> <status>")
    .description(`Move a task to one of: ${TASK_STATUSES.join(", ")}.`)
    .option("--reason <reason>", "Why the task is blocked (with status `blocked`).")
    .action(async (taskId: string, status: string, opts: { reason?: string }) => {
      const rt = await prep(getRuntime);
      if (!TASK_STATUSES.includes(status as TaskStatus)) {
        throw new CliError(`Status must be one of: ${TASK_STATUSES.join(", ")}.`);
      }
      await moveTask(rt, taskId, status as TaskStatus, opts.reason);
    });

  task
    .command("start <taskId>")
    .description("Move a task to in_progress (shorthand for `task move`).")
    .action(async (taskId: string) => {
      const rt = await prep(getRuntime);
      await moveTask(rt, taskId, "in_progress");
    });

  task
    .command("done <taskId>")
    .description("Mark a task as done (shorthand for `task move`).")
    .action(async (taskId: string) => {
      const rt = await prep(getRuntime);
      await moveTask(rt, taskId, "done");
    });

  task
    .command("assign <taskId> <who>")
    .description('Assign a task to a teammate — an email, a name, or "me".')
    .action(async (taskId: string, who: string) => {
      const rt = await prep(getRuntime);
      const member = await resolveMember(rt, who);
      const updated = await rt.client.task.assignTo.mutate({ taskId, userId: member.userId });
      if (!updated) throw new CliError("Task not found.");

      if (rt.json) return printJson(updated);
      success(`${updated.title} → assigned to ${member.label}`);
    });

  task
    .command("notes <taskId>")
    .description("Show the discussion thread on a task.")
    .action(async (taskId: string) => {
      const rt = await prep(getRuntime);
      const notes = await rt.client.task.listNotes.query({ taskId });

      if (rt.json) return printJson(notes);
      if (notes.length === 0) return info("No notes on this task yet. Add one: VelocityAI task note <id> <text>");

      for (const note of notes) {
        const when = new Date(note.createdAt).toLocaleString();
        info(`${note.parentId ? "  ↳ " : ""}${note.authorName} · ${when}`);
        info(`${note.parentId ? "    " : "  "}${note.content}\n`);
      }
    });

  task
    .command("note <taskId> <message...>")
    .description("Add a note to a task's discussion thread.")
    .action(async (taskId: string, message: string[]) => {
      const rt = await prep(getRuntime);
      const note = await rt.client.task.addNote.mutate({ taskId, content: message.join(" ") });
      if (rt.json) return printJson(note);
      success("Note added.");
    });
}

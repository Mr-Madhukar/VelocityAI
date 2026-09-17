import { writeFileSync } from "node:fs";
import { resolve } from "node:path";

import type { Command } from "commander";

import { CliError, dim, info, printJson, success } from "../output";
import { ensureOrg, requireToken, type Runtime } from "../runtime";

async function prep(getRuntime: () => Runtime): Promise<Runtime> {
  const rt = getRuntime();
  requireToken(rt);
  await ensureOrg(rt);
  return rt;
}

/** Print the prompt, emit JSON, or save it to a markdown file. */
function deliver(
  rt: Runtime,
  prompt: string,
  meta: Record<string, unknown>,
  output?: string,
): void {
  if (output) {
    const file = resolve(output);
    writeFileSync(file, prompt.endsWith("\n") ? prompt : `${prompt}\n`);
    if (rt.json) return printJson({ ...meta, file });
    success(`Saved prompt to ${file}.`);
    return;
  }
  if (rt.json) return printJson({ ...meta, prompt });
  info(prompt);
}

export function registerPromptCommands(program: Command, getRuntime: () => Runtime): void {
  const prompt = program
    .command("prompt")
    .description("Generate copy-paste-ready prompts for AI coding agents.");

  prompt
    .command("feature <featureId>")
    .description("The implementation prompt for a feature's approved PRD (cached per tech stack).")
    .option("--stack <stack>", "Tech stack to tailor the prompt to (defaults to the project's stack).")
    .option("--regenerate", "Generate fresh instead of using a cached prompt (spends a generation).")
    .option("-o, --output <file>", "Save the prompt to a markdown file instead of printing it.")
    .action(
      async (
        featureId: string,
        opts: { stack?: string; regenerate?: boolean; output?: string },
      ) => {
        const rt = await prep(getRuntime);

        const current = await rt.client.prompts.getByFeature.query({
          featureId,
          techStack: opts.stack,
        });

        let record = current.record;
        let stale = current.stale;

        if (!record || opts.regenerate) {
          const stack =
            opts.stack ?? current.defaults.projectTechStack ?? current.defaults.repoStack;
          if (!stack) {
            throw new CliError(
              'No tech stack known for this project — pass one with --stack "Next.js + tRPC + PostgreSQL".',
            );
          }
          const generated = await rt.client.prompts.generate.mutate({
            featureId,
            techStack: stack,
          });
          record = generated.record;
          stale = generated.stale;
        }

        if (!record) throw new CliError("Prompt generation returned nothing — try again.");

        deliver(
          rt,
          record.combinedPrompt,
          { featureId, techStack: record.techStack, stale, updatedAt: record.updatedAt },
          opts.output,
        );
        if (!rt.json && stale) {
          dim(
            "  Note: the PRD or task set changed since this prompt was generated — refresh with --regenerate.",
          );
        }
      },
    );

  prompt
    .command("quick <message...>")
    .description("Generate an implementation prompt from a plain description — no PRD needed.")
    .option("--stack <stack>", "Tech stack to tailor the prompt to (inferred when omitted).")
    .option("-o, --output <file>", "Save the prompt to a markdown file instead of printing it.")
    .action(async (messageParts: string[], opts: { stack?: string; output?: string }) => {
      const rt = await prep(getRuntime);
      const message = messageParts.join(" ").trim();
      if (message.length < 8) {
        throw new CliError('Describe what to build, e.g. VelocityAI prompt quick "a pomodoro timer web app".');
      }

      const result = await rt.client.prompts.generateFromMessage.mutate({
        message,
        techStack: opts.stack,
      });

      deliver(rt, result.prompt, { message, techStack: opts.stack ?? null }, opts.output);
    });
}

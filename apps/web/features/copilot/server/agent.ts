import "server-only";

import { openai } from "../../../lib/ai";
import { generateText, Output } from "ai";
import { z } from "zod";

import { formatContextForPrompt, getRepoContext } from "./repo-context";

export type CopilotMode = "build" | "fix" | "improve";

export type CopilotInput = {
  repositoryId: string;
  prompt: string;
  mode: CopilotMode;
  /** PRD problem + acceptance criteria, when the request is tied to a feature. */
  prd?: { problem: string; acceptanceCriteria: string[] } | null;
  /** Outstanding review findings, for the "fix review issues" mode. */
  reviewFindings?: string[] | null;
};

const planSchema = z.object({
  title: z.string().describe("Short title for this change."),
  plan: z
    .array(z.string())
    .describe("Ordered, concrete implementation steps."),
  files: z
    .array(
      z.object({
        path: z.string().describe("Repo-relative path of the file to create or modify."),
        action: z.enum(["create", "modify"]),
        content: z
          .string()
          .describe("The FULL intended contents of the file after the change (not a diff)."),
        rationale: z.string().describe("Why this file changes."),
      }),
    )
    .describe("Every file that must change, with full resulting content."),
  notes: z
    .string()
    .describe("Caveats, assumptions, manual follow-ups (migrations, env vars, tests)."),
});

export type CopilotPlan = z.infer<typeof planSchema>;

const MODE_INSTRUCTION: Record<CopilotMode, string> = {
  build:
    "Implement the requested feature. Add the minimal set of files/edits needed, following the repo's existing conventions and structure.",
  fix:
    "Fix the listed review findings. Address each finding precisely; do not introduce unrelated changes.",
  improve:
    "Improve the relevant code (readability, correctness, performance, or safety) where there is clear scope. Keep changes focused and justified.",
};

/**
 * The Copilot agent: given a prompt + the stored repo context (and optional PRD /
 * review findings), produce a concrete plan and the full content of each changed
 * file. Output is shown in-app; the same `files` can be committed to a draft PR.
 */
export async function generateImplementation(input: CopilotInput): Promise<CopilotPlan> {
  const context = await getRepoContext(input.repositoryId);
  if (!context) {
    throw new Error(
      "This repository hasn't been indexed yet. Build its context first, then try again.",
    );
  }

  let prdBlock = "";
  if (input.prd) {
    const criteriaList = input.prd.acceptanceCriteria.map((c) => `- ${c}`).join("\n");
    prdBlock = `\nLinked PRD:\nProblem: ${input.prd.problem}\nAcceptance criteria:\n${criteriaList}\n`;
  }

  let reviewBlock = "";
  if (input.mode === "fix" && input.reviewFindings?.length) {
    const findingsList = input.reviewFindings.map((f) => `- ${f}`).join("\n");
    reviewBlock = `\nReview findings to fix:\n${findingsList}\n`;
  }

  const { output } = await generateText({
    model: openai(process.env.OPENAI_MODEL ?? "gpt-4o-mini"),
    output: Output.object({
      schema: planSchema,
    }),
    system: `You are a senior engineer making a change to an EXISTING repository.
${MODE_INSTRUCTION[input.mode]}
Match the repo's stack, file layout, naming, and import conventions exactly — reuse existing utilities and paths rather than inventing new ones.
For every file you touch, output its complete resulting contents (not a diff) so it can be committed directly. Keep the change set as small as possible.
If something can't be done safely without more info, say so in notes rather than guessing.`,
    prompt: `${formatContextForPrompt(context)}
${prdBlock}${reviewBlock}
Request (${input.mode}): ${input.prompt}`,
  });

  return output;
}

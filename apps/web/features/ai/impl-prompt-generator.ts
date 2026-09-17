import { generateText, Output } from "ai";
import { openai } from "../../lib/ai";
import { z } from "zod";

export type GenerateImplPromptsInput = {
  feature: { title: string; description: string };
  prd: {
    problemStatement: string;
    goals: string[];
    nonGoals: string[];
    userStories: string[];
    acceptanceCriteria: string[];
    edgeCases: string[];
    technicalRequirements: string[];
    dependencies: string[];
    risks: string[];
  };
  tasks: Array<{
    id: string;
    title: string;
    description: string;
    type: string;
    priority: string;
    estimatedHours: number | null;
  }>;
  techStack: string;
};

export type GenerateImplPromptsResult = {
  combinedPrompt: string;
};

const bullets = (items: string[]): string =>
  items.length > 0 ? items.map((i) => `- ${i}`).join("\n") : "- (none)";

// Deterministic fallback so the user always gets *something* to copy if the
// model returns an empty prompt.
function fallbackPrompt(input: GenerateImplPromptsInput): string {
  return `# ${input.feature.title}

## Goal
${input.prd.problemStatement}

## Tech stack
Use exactly: ${input.techStack}. Follow its standard file layout and idioms.

## Build steps
${input.tasks.map((t, i) => `${i + 1}. ${t.title}: ${t.description}`).join("\n")}

## Acceptance criteria
${bullets(input.prd.acceptanceCriteria)}`;
}

export async function generateImplPrompts(
  input: GenerateImplPromptsInput,
): Promise<GenerateImplPromptsResult> {
  const taskList = input.tasks
    .map((t) => `- [${t.type}/${t.priority}] ${t.title}: ${t.description}`)
    .join("\n");

  const { output } = await generateText({
    model: openai(process.env.OPENAI_MODEL ?? "gpt-4o-mini"),
    output: Output.object({
      schema: z.object({
        prompt: z
          .string()
          .describe("One complete markdown implementation prompt for the whole feature"),
      }),
    }),
    system: `You are a staff engineer writing ONE implementation prompt for an AI coding agent (Claude Code, Cursor, etc.). The user pastes it once and the agent builds the entire feature from it.

Write a single Markdown prompt with exactly these sections:
# <feature title>
## Goal — 2-3 sentences: what to build and the problem it solves.
## Tech stack — the exact stack to use. Name every language, framework, and library, and state that no substitutions are allowed.
## Files to create — one line per file: path — purpose — how it connects to the others (e.g. "index.html — page markup — loads styles.css via <link> and script.js via <script defer>").
## Build steps — an ordered list (5-10 steps) from setup to done, folding the task breakdown in. Each step names what to produce and how to wire it to the previous steps.
## Inputs & outputs — what the user provides or does (inputs, events) and what the system shows, returns, or persists (outputs, side effects).
## Acceptance criteria — a short checklist distilled from the PRD, including must-handle edge cases.

Rules:
- Tailor everything to the given tech stack and its idioms. For plain HTML/CSS/JS, use concrete filenames (index.html, styles.css, script.js) and show the linking; for frameworks, use their conventional project layout.
- Cover the whole feature in this one prompt — never split it per task.
- Be specific but brief: target 350-500 words total. Distill the PRD; do not restate it verbatim. No filler.`,
    prompt: `Tech stack: ${input.techStack}

Feature: ${input.feature.title}
${input.feature.description}

PRD:
Problem: ${input.prd.problemStatement}
Goals:
${bullets(input.prd.goals)}
Non-Goals:
${bullets(input.prd.nonGoals)}
User Stories:
${bullets(input.prd.userStories)}
Acceptance Criteria:
${bullets(input.prd.acceptanceCriteria)}
Edge Cases:
${bullets(input.prd.edgeCases)}
Technical Requirements:
${bullets(input.prd.technicalRequirements)}
Dependencies:
${bullets(input.prd.dependencies)}
Risks:
${bullets(input.prd.risks)}

Task breakdown (fold these into the build steps):
${taskList}`,
  });

  const combinedPrompt = output.prompt.trim() || fallbackPrompt(input);
  return { combinedPrompt };
}

export type GenerateQuickPromptInput = {
  /** Free-form description of what to build — no PRD required. */
  message: string;
  techStack?: string | null;
};

export type GenerateQuickPromptResult = {
  prompt: string;
};

/**
 * One-shot prompt generation from a plain message (CLI `VelocityAI prompt quick`).
 * Same structured sections as the PRD-based prompt, but the requirements are
 * distilled from the user's description instead of a PRD/task breakdown.
 */
export async function generateQuickPrompt(
  input: GenerateQuickPromptInput,
): Promise<GenerateQuickPromptResult> {
  const stackLine = input.techStack?.trim()
    ? `Tech stack: ${input.techStack.trim()}`
    : "Tech stack: not specified — choose the most natural minimal stack for the request and name it explicitly.";

  const { output } = await generateText({
    model: openai(process.env.OPENAI_MODEL ?? "gpt-4o-mini"),
    output: Output.object({
      schema: z.object({
        prompt: z
          .string()
          .describe("One complete markdown implementation prompt for the request"),
      }),
    }),
    system: `You are a staff engineer writing ONE implementation prompt for an AI coding agent (Claude Code, Cursor, etc.). The user pastes it once and the agent builds the requested software from it.

Write a single Markdown prompt with exactly these sections:
# <short title for the request>
## Goal — 2-3 sentences: what to build and the problem it solves.
## Tech stack — the exact stack to use. Name every language, framework, and library, and state that no substitutions are allowed.
## Files to create — one line per file: path — purpose — how it connects to the others (e.g. "index.html — page markup — loads styles.css via <link> and script.js via <script defer>").
## Build steps — an ordered list (5-10 steps) from setup to done. Each step names what to produce and how to wire it to the previous steps.
## Inputs & outputs — what the user provides or does (inputs, events) and what the system shows, returns, or persists (outputs, side effects).
## Acceptance criteria — a short checklist of observable behaviors that prove the request is satisfied.

Rules:
- Tailor everything to the tech stack and its idioms. For plain HTML/CSS/JS, use concrete filenames (index.html, styles.css, script.js) and show the linking; for frameworks, use their conventional project layout.
- Fill reasonable gaps in the request with sensible defaults instead of asking questions.
- Be specific but brief: target 350-500 words total. No filler.`,
    prompt: `${stackLine}

Request:
${input.message}`,
  });

  return { prompt: output.prompt.trim() };
}

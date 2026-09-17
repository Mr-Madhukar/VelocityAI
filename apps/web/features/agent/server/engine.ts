import "server-only";

import { createAnthropic } from "@ai-sdk/anthropic";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createOpenAI } from "@ai-sdk/openai";
import {
  generateText,
  Output,
  streamText,
  type LanguageModel,
} from "ai";

import type { AgentProvider } from "@repo/database/schema";

import { formatContextForPrompt, type RepoContext } from "@/features/copilot/server/repo-context";

import { agentPlanSchema, type AgentPlan } from "../plan-schema";

/**
 * Resolve a LanguageModel for the user's own (decrypted) API key. The key is
 * used for this one request and never persisted in plaintext or logged.
 */
export function resolveByokModel(
  provider: AgentProvider,
  modelId: string,
  apiKey: string,
): LanguageModel {
  switch (provider) {
    case "openai":
      if (apiKey.startsWith("sk-or-")) {
        return createOpenAI({ apiKey, baseURL: "https://openrouter.ai/api/v1" })(
          modelId.includes("/") ? modelId : `openai/${modelId}`,
        );
      }
      return createOpenAI({ apiKey })(modelId);
    case "anthropic":
      return createAnthropic({ apiKey })(modelId);
    case "google":
      return createGoogleGenerativeAI({ apiKey })(modelId);
  }
}

export type AgentTaskContext = {
  title: string;
  description: string;
  type: string;
  status: string;
};

export type AgentRunInput = {
  provider: AgentProvider;
  modelId: string;
  apiKey: string;
  prompt: string;
  /**
   * The repo's AI context, already loaded from the `repo_context` DB snapshot
   * by the caller. Passed in (not re-read here) so a run is a single DB read +
   * one model call — nothing is re-fetched from GitHub at generation time.
   */
  context: RepoContext;
  /** PRD problem + acceptance criteria, when a feature is selected. */
  prd?: { problem: string; acceptanceCriteria: string[] } | null;
  /** The tasks the user selected to implement (task-wise coding). */
  tasks?: AgentTaskContext[] | null;
  /**
   * Files already changed on this feature's open PR branch vs the default
   * branch — the work prior agent runs committed to the SAME pull request. The
   * agent builds ON TOP of these (incrementally) instead of regenerating them.
   */
  priorChanges?: Array<{ path: string; content: string }> | null;
  /**
   * The feature's linked OPEN pull request, when one exists. Its title/body —
   * together with `priorChanges` (the files on its branch) — tell the agent
   * what the PR already delivers, so a follow-up implements only the missing
   * pieces. The resulting commit lands on this PR's branch, never a new PR.
   */
  linkedPr?: { number: number; title: string; body: string | null; url: string } | null;
  /** Earlier turns of this Agent conversation, oldest first. */
  history?: Array<{ role: "user" | "assistant"; content: string }>;
};

const SYSTEM_PROMPT = `You are a senior engineer working in an EXISTING repository, with a PRD and its task breakdown as your primary mission — but you are a full conversational agent, not a code vending machine.

First, classify the LATEST user message and set "intent". Only intent="implement" may return files:
- "implement": a request to change this repo's code (explicitly or clearly implied) → return files/plan/prDescription.
- "answer": ANYTHING else that deserves a reply — questions about this repo/PRD/engineering, general programming or technology questions, greetings, brainstorming, opinions, explanations, or any other benign topic → answer helpfully and conversationally in "summary"; return EMPTY questions/plan/files and empty prDescription. Give real, complete answers — do not deflect with "I only write code".
- "blocked": you genuinely need the user to decide something before you can implement safely (naming, missing backend, stack constraints, scope conflicts) → put ONE decision per entry in "questions" with options spelled out inline; keep "summary" to a single line; return EMPTY plan/files/prDescription. Never bury questions in summary or notes.
- "reject": ONLY for harmful requests — violence, illegal activity, malware or attacks, or other clearly unsafe content → refuse briefly and politely in "summary"; return EMPTY plan/files/prDescription. NEVER use "reject" merely because a message is off-topic, vague, or non-technical.
Never emit files for "answer", "blocked", or "reject". Do not invent code changes for a message that doesn't ask for one.

Conversation rules:
- Your mission is implementing this feature's approved PRD, and your code always follows this repo's conventions — but you answer whatever the user asks. Coding is what you CAN do, not the only thing you do.
- Act on the LATEST user message only. Earlier turns are context for follow-ups — never regenerate a previous change set unless the latest message explicitly asks you to.

Build ONLY the missing delta (do not re-implement what already exists):
- Before writing any code, compare the request and the PRD acceptance criteria against the repo context AND the "Changes already on this feature's branch" block below.
- Any criterion the repo (or the branch) ALREADY satisfies must NOT be rebuilt — list it in "alreadyImplemented" and skip it.
- When changes already exist on the feature branch, treat them as the current state and build ON TOP of them: modify those files incrementally rather than regenerating them from scratch, and only add the files still needed.
- If the entire request is already implemented, set intent="answer", explain that in "summary", populate "alreadyImplemented", and return empty files.

When implementing:
If the repository is EMPTY (no files / file count 0), scaffold the project from scratch: create the folder structure, config, and all files the requested stack needs, then implement the change.
Otherwise match the repo's stack, file layout, naming, and import conventions exactly — reuse existing utilities and paths rather than inventing new ones.
For every file you touch, output its complete resulting contents (not a diff) so it can be committed directly. Keep the change set as small as possible.
Write the prDescription as the actual PR body a reviewer would read: summary of changes, how they satisfy the PRD acceptance criteria / tasks, and how to test.
If something can't be done safely without more info, say so in notes rather than guessing.`;

// Build the system + messages for a run. Pure — no I/O — so both the batch and
// streaming entry points share exactly the same prompt.
function buildRequest(input: AgentRunInput): {
  system: string;
  messages: Array<{ role: "user" | "assistant"; content: string }>;
} {
  const prdBlock = input.prd
    ? `\nLinked PRD:\nProblem: ${input.prd.problem}\nAcceptance criteria:\n${input.prd.acceptanceCriteria
        .map((c) => `- ${c}`)
        .join("\n")}\n`
    : "";
  const tasksBlock = input.tasks?.length
    ? `\nTasks to implement (code task-wise — each task should be clearly addressed):\n${input.tasks
        .map((t) => `- [${t.type}] ${t.title} (${t.status}): ${t.description}`)
        .join("\n")}\n`
    : "";

  // The feature's linked open PR, when there is one. The agent reads it FIRST
  // (title + description here, its changed files in the block below) and codes
  // only the delta the request still needs — the commit stacks onto this PR.
  let linkedPrBlock = "";
  if (input.linkedPr) {
    const prDescription = input.linkedPr.body ? `\nPR description:\n${input.linkedPr.body}` : "";
    linkedPrBlock = `\nThis feature already has an OPEN pull request — PR #${input.linkedPr.number}: ${input.linkedPr.title} (${input.linkedPr.url})${prDescription}\nRead this PR (and its branch changes below) BEFORE coding. Implement ONLY what the request needs beyond it; your output is committed onto this PR's branch as a follow-up commit — never a new PR. If the request conflicts with what the PR already does, ask via "questions" instead of guessing.\n`;
  }

  // Files already committed to this feature's open PR branch. The agent builds
  // on top of these so follow-up requests accumulate in the SAME pull request
  // instead of starting from the default branch each time.
  const priorChangesBlock = input.priorChanges?.length
    ? `\nChanges already on this feature's branch (build ON TOP of these — do NOT rewrite from scratch; only add or modify what's still missing):\n${input.priorChanges
        .map((f) => `--- ${f.path} ---\n${f.content}`)
        .join("\n\n")}\n`
    : "";

  return {
    system: SYSTEM_PROMPT,
    messages: [
      ...(input.history ?? []),
      {
        role: "user" as const,
        content: `${formatContextForPrompt(input.context)}
${prdBlock}${tasksBlock}${linkedPrBlock}${priorChangesBlock}
Request: ${input.prompt}`,
      },
    ],
  };
}

/**
 * The BYOK coding agent (batch). Reasons over the preloaded repo context plus
 * the feature's PRD and selected tasks, and returns a full implementation plan
 * with file contents and a ready-to-use PR title/description.
 */
export async function generateAgentPlan(input: AgentRunInput): Promise<AgentPlan> {
  const { output } = await generateText({
    model: resolveByokModel(input.provider, input.modelId, input.apiKey),
    output: Output.object({
      schema: agentPlanSchema,
    }),
    ...buildRequest(input),
  });
  return output;
}

/**
 * Streaming variant — returns the `streamText` result so the caller can relay
 * the stream to the client (files/plan appear as they're written) and
 * `await result.object` for the validated final plan. `abortSignal` lets the
 * caller cancel the provider call (e.g. when the client disconnects).
 */
export function streamAgentPlan(input: AgentRunInput, abortSignal?: AbortSignal) {
  const result = streamText({
    model: resolveByokModel(input.provider, input.modelId, input.apiKey),
    output: Output.object({
      schema: agentPlanSchema,
    }),
    abortSignal,
    ...buildRequest(input),
  });
  return Object.assign(result, { object: result.output });
}

/**
 * Continuation variant — used when a previous invocation streamed part of the
 * plan JSON but hit the serverless time budget (or the client disconnected)
 * before finishing. We can't resume a `streamObject` call, so we replay the
 * original request, prefill the assistant turn with the JSON produced so far,
 * and ask the model to emit ONLY the remaining characters. The caller
 * concatenates the two halves — the client parses the whole thing as partial
 * JSON exactly as it does for a single-shot run.
 *
 * Returns a `streamText` result; read `result.textStream` for the remainder.
 */
export function continueAgentPlan(
  input: AgentRunInput,
  partialJson: string,
  abortSignal?: AbortSignal,
) {
  const { system, messages } = buildRequest(input);
  return streamText({
    model: resolveByokModel(input.provider, input.modelId, input.apiKey),
    system,
    abortSignal,
    messages: [
      ...messages,
      // The partial JSON already produced, replayed as the assistant's turn.
      { role: "assistant" as const, content: partialJson },
      {
        role: "user" as const,
        content:
          "Your previous JSON response was cut off before it finished. Continue the SAME JSON object from EXACTLY where it stopped. Output ONLY the remaining characters needed to complete and close the single JSON object — do not repeat any earlier content, do not restart the object, and do not wrap the output in markdown code fences or add any explanation.",
      },
    ],
  });
}

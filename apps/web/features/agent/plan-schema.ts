import { z } from "zod";

// Client-safe (no server-only imports) so both the streaming engine and the
// Agent page can share the plan shape. The page imports only the *types* — the
// zod value is tree-shaken out of the client bundle.

export const agentPlanSchema = z.object({
  intent: z
    .enum(["implement", "answer", "blocked", "reject"])
    .describe(
      "Classify the latest user message. 'implement' = a concrete change to build (the ONLY value that may return files). 'answer' = anything else deserving a helpful reply — repo/engineering questions, general questions, greetings, discussion (answer it fully in summary; never deflect as off-topic). 'blocked' = you need decisions first (put them in questions). 'reject' = ONLY harmful requests: violence, illegal activity, malware/attacks. For anything other than 'implement', files/plan/prDescription MUST be empty.",
    ),
  title: z.string().describe("Short, PR-ready title for this change (imperative mood)."),
  summary: z
    .string()
    .describe("2-3 sentence reply to the user: what you're building and how it maps to the PRD/tasks."),
  questions: z
    .array(z.string())
    .describe(
      "Decisions the user must make before a safe implementation — one entry per decision, with the options spelled out inline. Empty when nothing blocks you. NEVER bury questions in summary or notes.",
    ),
  plan: z.array(z.string()).describe("Ordered, concrete implementation steps."),
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
  alreadyImplemented: z
    .array(z.string())
    .describe(
      "PRD acceptance criteria / parts of the request that the repo (and any changes already on this feature's branch) ALREADY satisfies, which you deliberately did NOT rebuild. Empty when nothing pre-exists. Use this to prove you scoped the change to only the missing delta.",
    ),
  prDescription: z
    .string()
    .describe(
      "A complete, well-structured PR description in markdown: what changed, why, how it satisfies the PRD/tasks, and testing notes.",
    ),
  notes: z
    .string()
    .describe("Caveats, assumptions, manual follow-ups (migrations, env vars, tests)."),
});

export type AgentPlan = z.infer<typeof agentPlanSchema>;
export type AgentPlanFile = AgentPlan["files"][number];

// Recursive Partial that also descends into arrays — matches what the AI SDK's
// partialObjectStream emits while the object is still being generated.
export type DeepPartial<T> = T extends Array<infer U>
  ? Array<DeepPartial<U>>
  : T extends object
    ? { [P in keyof T]?: DeepPartial<T[P]> }
    : T;

export type PartialAgentPlan = DeepPartial<AgentPlan>;

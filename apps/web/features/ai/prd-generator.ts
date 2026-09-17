import { generatePrdMarkdown, type PrdDraft } from "@repo/services/shipflow/agents";
import { generateText, Output } from "ai";
import { openai } from "../../lib/ai";
import { z } from "zod";

export function generatePrdFromDraft(draft: PrdDraft) {
  return generatePrdMarkdown(draft);
}

const prdSchema = z.object({
  problemStatement: z.string().describe("Clear explanation of the user problem being solved"),
  goals: z.array(z.string()).describe("Specific, measurable goals this feature achieves"),
  nonGoals: z.array(z.string()).describe("Explicitly out-of-scope items — what this feature will NOT do"),
  userStories: z
    .array(z.string())
    .describe('User stories in the format "As a [user type], I want [goal] so that [reason]"'),
  acceptanceCriteria: z.array(z.string()).describe("Concrete, testable criteria that define done"),
  edgeCases: z.array(z.string()).describe("Edge cases and boundary conditions to handle"),
  successMetrics: z
    .array(z.string())
    .describe("Quantitative metrics to measure success post-launch"),
  technicalRequirements: z
    .array(z.string())
    .describe(
      "Technical requirements, architecture decisions, API contracts, and implementation constraints for developers",
    ),
  dependencies: z
    .array(z.string())
    .describe(
      "External services, internal systems, third-party libraries, or team dependencies required",
    ),
  risks: z
    .array(z.string())
    .describe(
      'Potential risks and mitigations in the format "Risk: [risk] — Mitigation: [mitigation]"',
    ),
  estimatedTotalHours: z
    .number()
    .int()
    .nullable()
    .describe(
      "Total development hours, estimated for a modern AI-assisted developer (using tools like Copilot/Cursor) — NOT traditional hand-coding timelines. Building software is dramatically faster now: a complete CRUD/todo-style app is 5–10 hours; a typical single feature is often 3–8 hours. Scale by real complexity (integrations, novel algorithms, infra). Add a ~8-hour (one day) buffer only for genuinely complex/risky work. Null only if truly impossible to estimate.",
    ),
});

export type PrdContent = z.infer<typeof prdSchema>;

const disciplineEnum = z.enum(["frontend", "backend", "devops", "ai"]);

// Generation also declares which engineering disciplines the feature needs, so
// task assignment only asks for the roles that are actually relevant.
const prdGenerationSchema = prdSchema.extend({
  requiredDisciplines: z
    .array(disciplineEnum)
    .describe(
      "The engineering disciplines this feature genuinely requires. Only include 'ai' if the feature involves AI/ML/LLM work (model calls, embeddings, recommendations, NLP, generative). Only include 'devops' for real infra/CI/CD/deployment work. Most features need just 'frontend' and/or 'backend'.",
    ),
});

export type PrdGenerationContent = z.infer<typeof prdGenerationSchema>;

const PRD_SYSTEM_PROMPT = `You are a senior product manager writing a production-quality PRD.
The PRD must be actionable for both managers (who need business context and success metrics) and developers (who need technical detail and acceptance criteria).
Be specific and concrete — avoid vague language.
Estimate effort for the modern AI-assisted era: developers ship far faster with AI coding tools, so keep hour estimates lean and proportional to genuine complexity rather than legacy hand-coding timelines.`;

export type GeneratePrdInput = {
  title: string;
  description: string;
  messages: Array<{ role: "user" | "assistant"; content: string }>;
};

export async function generatePrd(
  input: GeneratePrdInput,
): Promise<PrdGenerationContent & { rawMarkdown: string }> {
  const conversation = input.messages
    .map((m) => `**${m.role === "user" ? "User" : "Assistant"}**: ${m.content}`)
    .join("\n\n");

  const { output } = await generateText({
    model: openai("gpt-4o-mini"),
    output: Output.object({
      schema: prdGenerationSchema,
    }),
    system: PRD_SYSTEM_PROMPT,
    prompt: `Feature Title: ${input.title}\nDescription: ${input.description}\n\nClarification conversation:\n${conversation || "(none)"}`,
  });

  const rawMarkdown = generatePrdMarkdown({
    title: input.title,
    problem: output.problemStatement,
    goals: output.goals,
    nonGoals: output.nonGoals,
    userStories: output.userStories,
    acceptanceCriteria: output.acceptanceCriteria,
    edgeCases: output.edgeCases,
    successMetrics: output.successMetrics,
  });

  return { ...output, rawMarkdown };
}

export type EditPrdInput = {
  currentPrd: PrdContent;
  editPrompt: string;
};

export async function editPrdWithAI(input: EditPrdInput): Promise<PrdContent & { rawMarkdown: string }> {
  const { output } = await generateText({
    model: openai("gpt-4o-mini"),
    output: Output.object({
      schema: prdSchema,
    }),
    system: `${PRD_SYSTEM_PROMPT}\nYou are updating an existing PRD. Apply only the changes requested. Preserve all sections not mentioned in the edit request. Keep the same level of detail and structure.`,
    prompt: `CURRENT PRD:\n${JSON.stringify(input.currentPrd, null, 2)}\n\nEDIT REQUEST:\n${input.editPrompt}`,
  });

  const rawMarkdown = generatePrdMarkdown({
    title: "PRD",
    problem: output.problemStatement,
    goals: output.goals,
    nonGoals: output.nonGoals,
    userStories: output.userStories,
    acceptanceCriteria: output.acceptanceCriteria,
    edgeCases: output.edgeCases,
    successMetrics: output.successMetrics,
  });

  return { ...output, rawMarkdown };
}

import { generateText, Output } from "ai";
import { openai } from "../../lib/ai";
import { z } from "zod";

export type Developer = {
  userId: string;
  name: string;
  specialty?: string;
  skills: string[];
};

export type GeneratedTask = {
  title: string;
  description: string;
  type: "frontend" | "backend" | "database" | "infra" | "testing" | "docs";
  priority: "p0" | "p1" | "p2" | "p3" | "p4";
  status: "todo";
  assignedTo: string | null; // userId
  estimatedHours: number; // AI-era estimate, includes complexity buffer
};

export type GenerateTasksInput = {
  problemStatement: string;
  goals: string[];
  nonGoals: string[];
  acceptanceCriteria: string[];
  edgeCases: string[];
  developers?: Developer[]; // optional — if provided, AI will assign tasks
};

export async function generateTasks(input: GenerateTasksInput): Promise<GeneratedTask[]> {
  const devContext =
    input.developers && input.developers.length > 0
      ? `\n\nAvailable developers (assign tasks based on their skills):\n${input.developers
          .map((d) => `- ${d.name} (userId: ${d.userId})`)
          .join("\n")}`
      : "";

  const { output } = await generateText({
    model: openai("gpt-4o-mini"),
    output: Output.object({
      schema: z.object({
        tasks: z.array(
          z.object({
            title: z.string(),
            description: z.string(),
            type: z.enum(["frontend", "backend", "database", "infra", "testing", "docs"]),
            priority: z.enum(["p0", "p1", "p2", "p3", "p4"]),
            estimatedHours: z
              .number()
              .describe(
                "Hours for a modern AI-assisted developer to complete this task — keep it lean (most tasks are 1–4 hours). Analyze the task's real complexity. Add up to an 8-hour (one day) buffer ONLY for genuinely complex or risky tasks.",
              ),
            assignedToUserId: z
              .string()
              .nullable()
              .describe(
                "The userId of the developer to assign this task to, or null if no developers available",
              ),
          }),
        ),
      }),
    }),
    system: `You are an expert technical product manager. Break down the PRD into 3–10 actionable engineering tasks.
- Assign each task to the most suitable developer based on their name and implied skills (frontend = React/UI, backend = API/server, database = schema/migrations, infra = DevOps/CI, testing = QA, docs = documentation).
- If no developers are listed, set assignedToUserId to null.
- Distribute work evenly — avoid piling everything on one person.
- Set priority: p0 = critical blocker, p1 = high, p2 = normal, p3 = low, p4 = nice-to-have.
- Estimate estimatedHours for the modern AI-assisted era (developers ship far faster with AI tools). Be realistic and lean: a whole todo-style app is ~5–10 hours total. Scale by genuine complexity and add a one-day (~8h) buffer only for truly complex tasks.`,
    prompt: `PRD:
Problem: ${input.problemStatement}
Goals: ${input.goals.join("; ")}
Non-Goals: ${input.nonGoals.join("; ")}
Acceptance Criteria: ${input.acceptanceCriteria.join("; ")}
Edge Cases: ${input.edgeCases.join("; ")}${devContext}`,
  });

  const validUserIds = new Set(input.developers?.map((d) => d.userId) ?? []);

  return output.tasks.map((task) => ({
    title: task.title,
    description: task.description,
    type: task.type,
    priority: task.priority,
    status: "todo" as const,
    // Guard against a missing/negative estimate; round to whole hours.
    estimatedHours: Math.max(1, Math.round(task.estimatedHours || 1)),
    assignedTo:
      task.assignedToUserId && validUserIds.has(task.assignedToUserId)
        ? task.assignedToUserId
        : null,
  }));
}

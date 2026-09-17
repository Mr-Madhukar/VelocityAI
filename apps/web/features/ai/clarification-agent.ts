import { generateText, Output } from "ai";
import { openai } from "../../lib/ai";
import { z } from "zod";

export type ClarifyInput = {
  title: string;
  description: string;
  messages: Array<{ role: "user" | "assistant"; content: string }>;
};

export type ClarifyResult = {
  reply: string;
  isDone: boolean;
};

export async function runClarificationAgent(input: ClarifyInput): Promise<ClarifyResult> {
  const conversation = input.messages
    .map((m) => `${m.role === "user" ? "User" : "AI"}: ${m.content}`)
    .join("\n");

  const { output } = await generateText({
    model: openai("gpt-4o-mini"),
    output: Output.object({
      schema: z.object({
        reply: z.string().describe(
          "Your next message — either a focused follow-up question or a brief confirmation that you have enough information to write the PRD.",
        ),
        isDone: z.boolean().describe(
          "true when you have gathered enough information to write a complete PRD (users, problem, success metrics, and scope are clear). false if you need more clarification.",
        ),
      }),
    }),
    system: `You are a product manager helping clarify a feature request before writing a PRD.
Your goal is to ask focused questions to understand:
1. Who the target users are
2. The core problem being solved
3. How success will be measured
4. What is explicitly out of scope

Rules:
- Ask ONE focused question at a time
- Stop after 2–4 exchanges — don't over-question if the description already covers a topic
- When isDone is true, write a short confirmation like "Thanks, I have everything I need. Generating your PRD now."
- Never ask about implementation details — that is the developer's job`,
    prompt: `Feature: ${input.title}\nDescription: ${input.description}\n\nConversation so far:\n${conversation || "(no conversation yet — ask your first question)"}`,
  });

  return output;
}

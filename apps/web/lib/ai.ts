import { createOpenAI } from "@ai-sdk/openai";

const apiKey =
  process.env.OPENAI_API_KEY ||
  process.env.OPENROUTER_API_KEY ||
  "dummy-key";

const baseURL =
  process.env.OPENAI_BASE_URL ||
  (process.env.OPENROUTER_API_KEY ? "https://openrouter.ai/api/v1" : undefined);

export const openai = createOpenAI({
  apiKey,
  baseURL,
  headers: baseURL?.includes("openrouter.ai")
    ? {
        "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL || "https://my-ai-code-reviewer.onrender.com",
        "X-Title": "VelocityAI",
      }
    : undefined,
});

export function getAiModel(fallback = "gpt-4o-mini") {
  const envModel = process.env.OPENAI_MODEL;
  if (!envModel) {
    return baseURL?.includes("openrouter.ai") ? openai(`openai/${fallback}`) : openai(fallback);
  }
  if (baseURL?.includes("openrouter.ai") && !envModel.includes("/")) {
    return openai(`openai/${envModel}`);
  }
  return openai(envModel);
}

// Shared (client-safe) catalog of the BYOK Agent's supported AI providers and
// their selectable models. Keys themselves never live here — they're encrypted
// server-side (see server/crypto.ts) and only a 4-char hint reaches the client.

import type { AgentProvider } from "@repo/database/schema";

export type ProviderInfo = {
  id: AgentProvider;
  /** Display name, e.g. "OpenAI (ChatGPT)". */
  label: string;
  /** Short name for compact UI spots. */
  shortLabel: string;
  /** Model ids selectable in the Agent's model picker; first is the default. */
  models: string[];
  /** Placeholder shown in the API-key input. */
  keyPlaceholder: string;
  /** Where users create an API key. */
  keysUrl: string;
};

export const AGENT_PROVIDER_INFO: ProviderInfo[] = [
  {
    id: "openai",
    label: "OpenAI (ChatGPT)",
    shortLabel: "OpenAI",
    models: ["gpt-5.2", "gpt-5.1", "gpt-5", "gpt-4o", "gpt-4o-mini"],
    keyPlaceholder: "sk-...",
    keysUrl: "https://platform.openai.com/api-keys",
  },
  {
    id: "anthropic",
    label: "Anthropic (Claude)",
    shortLabel: "Claude",
    models: ["claude-opus-4-8", "claude-sonnet-5", "claude-sonnet-4-6", "claude-haiku-4-5"],
    keyPlaceholder: "sk-ant-...",
    keysUrl: "https://platform.claude.com/settings/keys",
  },
  {
    id: "google",
    label: "Google (Gemini)",
    shortLabel: "Gemini",
    models: ["gemini-3-pro-preview", "gemini-2.5-pro", "gemini-2.5-flash", "gemini-2.5-flash-lite"],
    keyPlaceholder: "AIza...",
    keysUrl: "https://aistudio.google.com/apikey",
  },
];

export function providerInfo(id: AgentProvider): ProviderInfo {
  const info = AGENT_PROVIDER_INFO.find((p) => p.id === id);
  if (!info) throw new Error(`Unknown agent provider: ${id}`);
  return info;
}

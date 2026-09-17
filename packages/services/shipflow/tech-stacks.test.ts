import assert from "node:assert/strict";
import test from "node:test";

import { recommendedStacks } from "./tech-stacks";

test("frontend-only features show frontend frameworks, no backend", () => {
  const stacks = recommendedStacks(["frontend"]);
  assert.ok(stacks.includes("React + Tailwind CSS"));
  assert.ok(stacks.some((s) => /next\.js/i.test(s)));
  // No server frameworks in a frontend-only list.
  assert.ok(!stacks.some((s) => /express|django|rails|spring|fastapi/i.test(s)));
});

test("backend-only features show server frameworks, no pure UI stacks", () => {
  const stacks = recommendedStacks(["backend"]);
  assert.ok(stacks.some((s) => /express|django|rails|spring|fastapi/i.test(s)));
  assert.ok(!stacks.includes("SvelteKit"));
});

test("full-stack features show the full-stack presets", () => {
  const stacks = recommendedStacks(["frontend", "backend"]);
  assert.ok(stacks.includes("Next.js + tRPC + Drizzle + PostgreSQL"));
});

test("empty / unknown disciplines fall back to full-stack presets", () => {
  assert.deepEqual(recommendedStacks([]), recommendedStacks(["frontend", "backend"]));
  assert.deepEqual(recommendedStacks(null), recommendedStacks(["frontend", "backend"]));
  assert.deepEqual(recommendedStacks(undefined), recommendedStacks(["frontend", "backend"]));
});

test("ai and devops append their specialized tooling", () => {
  const withAi = recommendedStacks(["frontend", "ai"]);
  assert.ok(withAi.some((s) => /openai|anthropic|langchain/i.test(s)));

  const withDevops = recommendedStacks(["backend", "devops"]);
  assert.ok(withDevops.some((s) => /docker|terraform/i.test(s)));
});

test("disciplines are matched case-insensitively and de-duped", () => {
  const stacks = recommendedStacks(["Frontend", "FRONTEND"]);
  assert.deepEqual(stacks, [...new Set(stacks)]);
  assert.ok(stacks.includes("React + Tailwind CSS"));
});

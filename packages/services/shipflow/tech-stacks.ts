// Pure, dependency-free tech-stack recommendations keyed on a feature's
// engineering disciplines (the PRD's `requiredDisciplines`). A frontend-only
// feature (e.g. "dark mode") should never be asked to pick a backend
// framework, so the implementation-prompt UI shows only the stacks that match
// what the feature actually needs. Shared + unit-tested here so both the tRPC
// layer and the client render the same taxonomy.

export type Discipline = "frontend" | "backend" | "devops" | "ai";

// Frontend-only work: UI frameworks with no server component.
const FRONTEND_STACKS = [
  "React + Tailwind CSS",
  "Next.js (App Router)",
  "Vue 3 + Vite",
  "SvelteKit",
] as const;

// Backend-only work: API/server frameworks.
const BACKEND_STACKS = [
  "Node.js + Express + PostgreSQL",
  "Django REST Framework",
  "Ruby on Rails (API)",
  "Spring Boot",
  "FastAPI + PostgreSQL",
] as const;

// Full-stack (frontend + backend, or unknown/legacy PRDs): the original presets.
const FULLSTACK_STACKS = [
  "Next.js + tRPC + Drizzle + PostgreSQL",
  "Next.js + Prisma + PostgreSQL",
  "React + Node/Express + PostgreSQL",
  "Django + React",
  "Ruby on Rails",
  "Spring Boot + React",
  "Laravel + Vue",
] as const;

// Discipline add-ons appended to the chosen base when the feature needs them.
const AI_STACKS = ["OpenAI / Anthropic SDK", "LangChain + Vector DB"] as const;
const DEVOPS_STACKS = ["Docker + GitHub Actions", "Terraform + AWS"] as const;

/**
 * Recommend tech-stack presets for a feature given its required disciplines.
 *
 * - frontend only → frontend frameworks (no backend noise);
 * - backend only → server frameworks;
 * - both, empty, or unrecognized → the full-stack presets (safe default for
 *   legacy PRDs that predate discipline tagging);
 * - `ai` / `devops` append their specialized tooling to whichever base applies.
 */
export function recommendedStacks(disciplines?: string[] | null): string[] {
  const set = new Set((disciplines ?? []).map((d) => d.trim().toLowerCase()));
  const hasFrontend = set.has("frontend");
  const hasBackend = set.has("backend");

  let base: string[];
  if (hasFrontend && !hasBackend) base = [...FRONTEND_STACKS];
  else if (hasBackend && !hasFrontend) base = [...BACKEND_STACKS];
  else base = [...FULLSTACK_STACKS];

  if (set.has("ai")) base = [...base, ...AI_STACKS];
  if (set.has("devops")) base = [...base, ...DEVOPS_STACKS];

  // De-dupe while preserving order.
  return [...new Set(base)];
}

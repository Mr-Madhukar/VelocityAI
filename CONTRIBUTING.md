# Contributing to VelocityAI

Thanks for working on VelocityAI! This guide covers local setup, the conventions we
follow, and how to get a change merged. For the big picture, read
[ARCHITECTURE.md](./ARCHITECTURE.md) first.

---

## Prerequisites

- **Node.js ≥ 18** (CI uses Node 22)
- **pnpm 9** (`corepack enable` recommended)
- **Docker** (local Postgres + Inngest) — or your own Postgres 15
- An **OpenAI API key** for AI features

## Local setup

```bash
pnpm install
./setup.sh                 # .env.example → .env, symlinked into each package
docker compose up -d       # Postgres :5432, Inngest dev UI :8288
pnpm db:migrate            # apply the schema
pnpm dev                   # turbo dev + ngrok tunnel (GitHub webhooks)
# or: pnpm dev:app         # without the tunnel
```

App: <http://localhost:3000> · Inngest: <http://localhost:8288>. For a quick spin-up
you can keep `SHIPFLOW_DEMO_AUTH=true` and `SKIP_ENV_VALIDATION=1`. Env surface is
documented in the [README](./README.md#-environment-variables) (`turbo.json` →
`globalEnv` is the source of truth).

---

## Branching & commits

- Branch off `main`: `feat/…`, `fix/…`, `chore/…`, `docs/…`.
- Commit messages follow **Conventional Commits**, scoped where it helps:

  ```text
  feat(billing): meter and block AI-review credits per review cycle
  fix(auth): stop back button restoring the dashboard after sign-out
  docs(readme): add ARCHITECTURE / CONTRIBUTING / SECURITY links
  ```

- Keep commits **small and logically grouped** — one concern per commit. History
  should stay buildable commit-to-commit (schema → service → consumers).
- Do **not** commit secrets. `.env` is git-ignored; `PLAN.md` is local-only.

---

## Where code goes

| Change | Location |
|--------|----------|
| Typed API procedure | `packages/trpc/server/routes/**` |
| **Testable** domain rule (model-free) | `packages/services/shipflow/**` |
| AI agent | `apps/web/features/ai/**`, `apps/web/features/copilot/server/**` |
| Background job | `apps/web/features/inngest/functions/**` |
| DB schema | `packages/database/models/shipflow.ts` → `pnpm db:generate` |
| Auth / route protection | `apps/web/middleware.ts`, `apps/web/features/auth/**` |
| UI page | `apps/web/app/(protected)/**`, components in `apps/web/components/**` |

**Conventions**

- Match the surrounding code — naming, imports (`@/…` and `~/…` both map to
  `apps/web/`), comment density, and Tailwind token usage (`border-border`,
  `text-muted-foreground`, …).
- Reuse existing helpers; don't introduce a new utility that duplicates one.
- Anything that runs an AI model or Octokit belongs in `apps/web` (server action or
  Inngest function), **never** in `@repo/trpc`/`@repo/services` — see
  [ARCHITECTURE.md §2](./ARCHITECTURE.md#2-package-boundaries).
- Every domain query must be **organization-scoped**.

---

## Database changes

```bash
# 1. edit packages/database/models/shipflow.ts
pnpm db:generate          # creates a new drizzle/NNNN_*.sql migration
pnpm db:migrate           # apply to your local DATABASE_URL
```

Commit the generated SQL **and** the `meta/` snapshot together with the schema change.
Never hand-edit an already-applied migration — add a new one.

---

## Quality gates (run before pushing)

All four must pass; CI (`.github/workflows/ci.yml`) runs the same on Node 22 / pnpm 9:

```bash
pnpm test          # node:test via tsx (services + web helpers)
pnpm check-types   # next typegen + tsc --noEmit
pnpm lint          # eslint, zero-warning policy
pnpm build         # production build of every package/app
```

Add or update **unit tests** for domain logic in `packages/services/shipflow/**`
(that's the layer that can be tested without hitting a model or the network).

---

## Opening a pull request

1. Ensure the four gates above pass locally.
2. Write a clear description: what changed, why, and how you verified it.
3. Keep the diff focused; split unrelated changes into separate PRs.
4. VelocityAI will run its own **AI review** against the linked PRD where applicable —
   address blocking findings (or use the **Copilot → Fix review** flow to draft fixes).

By contributing you agree your work is licensed under the repository's license.

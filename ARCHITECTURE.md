# Architecture

This document goes a level deeper than the [README](./README.md) on how VelocityAI is
put together — the request lifecycle, package boundaries, the AI/durability model,
the Copilot repo-context pipeline, and the security model.

> **One deployable.** VelocityAI is a single Next.js application. The "backend" is the
> set of Route Handlers under `apps/web/app/api/**` plus the shared `@repo/trpc`
> router. Frontend, API, webhooks, and the durable-workflow endpoint all serve from
> the same origin (`https://my-ai-code-reviewer.onrender.com`).

---

## 1. High-level shape

```text
                  https://my-ai-code-reviewer.onrender.com
                                  │
   ┌───────────────┬──────────────┼───────────────┬────────────────┐
   │               │              │               │                │
 React UI     tRPC router    Route Handlers   middleware       Server Actions
 app/**       @repo/trpc     app/api/**       (auth gate)      features/**/server
   │               │              │               │                │
   └───────────────┴──────────────┴───────┬───────┴────────────────┘
                                           │
                        @repo/services  (pure domain logic)
                                           │
                        @repo/database  (Drizzle ORM)
                                           │
                                    PostgreSQL 15
```

External systems the app talks to: **OpenAI** (AI SDK), **Inngest** (durable jobs),
**GitHub App** (Octokit), **Razorpay** (billing), **Pusher** (real-time), **Resend**
(email).

---

## 2. Package boundaries

| Package | Responsibility | May import |
|---------|----------------|------------|
| `apps/web` | UI, Route Handlers, server actions, AI agents, integrations (Octokit, Pusher, Razorpay, Resend) | every `@repo/*` package |
| `@repo/trpc` | Type-safe API router, access-level procedures | `@repo/database`, `@repo/services` |
| `@repo/services` | **Pure, unit-tested domain logic** (workflow rules, deterministic review/agents, billing math) | `@repo/database` (types only) |
| `@repo/database` | Drizzle schema + Postgres client, migrations | — |
| `@repo/logger`, `@repo/eslint-config`, `@repo/typescript-config` | Cross-cutting tooling | — |

**Why AI agents live in `apps/web`, not `@repo/services`:** the live agents pull in
`@ai-sdk/openai`, `octokit`, and `server-only`, which are app-runtime concerns. The
`@repo/trpc` router can't import them (it would drag those deps across the package
boundary), so anything that runs an agent is invoked from **`apps/web`** — either an
Inngest function or a **server action**. `@repo/services` keeps *deterministic*,
model-free versions of the same logic so the business rules stay unit-testable.

---

## 3. Request lifecycles

### 3.1 A typed data call (tRPC)

```text
React component → TanStack Query → /api/trpc/<router>.<proc>
   → procedure middleware (publicProcedure | protectedProcedure | orgProcedure | …)
   → @repo/services domain logic → Drizzle → Postgres
```

The same `ServerRouter` type is imported into the browser, so the client and API can
never drift.

### 3.2 A protected page navigation

```text
Browser → middleware.ts (edge): getSessionCookie()
   ├─ no cookie  → 307 /sign-in?callbackUrl=…   (+ Cache-Control: no-store)
   └─ has cookie → NextResponse.next()          (+ Cache-Control: no-store)
        → (protected)/layout.tsx: requireAuth() does the real DB session check
```

Middleware is an **optimistic** cookie gate (no DB hit) plus a **bfcache killer** —
the `no-store` header stops the browser restoring an authenticated page after
sign-out. The layout's `requireAuth()` is the authoritative check. See
[SECURITY.md](./SECURITY.md).

### 3.3 A GitHub PR → AI review

```text
GitHub → POST /api/github/webhook  (verify x-hub-signature-256)
   → upsert pull_request row
   → enqueue Inngest "github/pull_request.review_requested"
        └─ if Inngest unreachable → run review INLINE (fallback)
   → review pipeline (features/github/review.ts):
        consume 1 AI-review credit  → fetch per-file patches + commits
        → qa-reviewer (per-criterion scoring) → persist review_cycle + review_issue
        → post a comment back to the PR
   → on PR merge → refresh repo_context (Copilot stays current)
```

---

## 4. Durable AI (Inngest)

Every multi-second AI task is an **Inngest function** with `step.run` checkpoints, not
a fire-and-forget request — so it survives retries, timeouts, and redeploys, and AI
calls aren't repeated unnecessarily.

| Function | Trigger | Notes |
|----------|---------|-------|
| `generate-prd` | `feature/clarification-complete` | Idempotent; never overwrites an approved PRD |
| `generate-tasks` | `prd/approved` | Auto-assigns by member specialty; recomputes estimate |
| `generate-tasks-on-failure` | `inngest/function.failed` | Reverts feature to `prd_ready` on failure |
| `review-pull-request` | `github/pull_request.review_requested` | Spends a credit; `ReviewCreditError` is terminal (no retry/re-charge) |

The webhook→Inngest path always has an **inline fallback** so a review never silently
drops when the dev Inngest server is offline.

---

## 5. AI code review (scoring)

The PR reviewer (`features/ai/qa-reviewer.ts`) evaluates **each PRD acceptance
criterion** as `met` / `partial` / `not_met` with cited evidence. The compliance
score is **derived from that breakdown** (met = 100%, partial = 50%, not_met = 0%),
not a flat constant — so it tracks the actual PR. Every non-positive finding carries a
concrete `suggestion`, and the reviewer reads the **full per-file diff + commit
messages**. The deterministic mirror in `@repo/services/shipflow/code-review.ts`
computes the same met-ratio score and is unit-tested.

---

## 6. Copilot & repo context

Copilot turns a prompt (build a feature / fix review findings / improve code) into a
concrete plan plus full file contents, optionally opened as a **draft PR**.

```text
Connect repo ──► buildRepoContext()  (features/copilot/server/repo-context.ts)
   walk git tree → pick high-priority files → 1 AI summarize call
   → upsert repo_context { overview, stack, tree[], summaries{}, lastSha }

Prompt ──► generateImplementation()  (features/copilot/server/agent.ts)
   load repo_context (+ PRD / open review findings if a feature is selected)
   → 1 AI call → { plan[], files[{path, action, content, rationale}], notes }
   → shown in-app; openDraftPrAction() commits files via the git data API
       (blob → tree → commit → ref → draft PR)

PR merged ──► refreshRepoContextIfStale()  (rebuilds only if head sha changed)
```

Storage is a **structured summary snapshot** (one `repo_context` row per repo), not a
vector store — cheap, no extra infrastructure, refreshed after each merged PR. Copilot
runs through **server actions** (it needs the AI SDK + Octokit, which live in
`apps/web`), each guarded by an org-ownership check on the target repo.

---

## 7. Data & multi-tenancy

- Every domain table carries an `organization_id`; queries are scoped through
  `orgProcedure` / explicit org checks.
- Pusher private channels (`private-org-{id}`) are authorized against real DB
  membership in `/api/pusher/auth`.
- Inbound provider webhooks are **idempotent** via the `processed_webhook_event`
  ledger (keyed by the provider event id).
- Migrations are generated from the Drizzle schema (`pnpm db:generate`) and applied
  with `pnpm db:migrate`.

---

## 8. Where to look

| You want to… | Start here |
|--------------|-----------|
| Add a typed API procedure | `packages/trpc/server/routes/**` |
| Change domain rules (testable) | `packages/services/shipflow/**` |
| Touch an AI agent | `apps/web/features/ai/**`, `apps/web/features/copilot/server/**` |
| Add a background job | `apps/web/features/inngest/functions/**` |
| Edit the schema | `packages/database/models/shipflow.ts` → `pnpm db:generate` |
| Adjust auth/route protection | `apps/web/middleware.ts`, `apps/web/features/auth/**` |

See [CONTRIBUTING.md](./CONTRIBUTING.md) for workflow and [SECURITY.md](./SECURITY.md)
for the security model.

<div align="center">

```text
██╗   ██╗███████╗██╗      ██████╗  ██████╗██╗████████╗██╗   ██╗ █████╗ ██╗
██║   ██║██╔════╝██║     ██╔═══██╗██╔════╝██║╚══██╔══╝╚██╗ ██╔╝██╔══██╗██║
██║   ██║█████╗  ██║     ██║   ██║██║     ██║   ██║    ╚████╔╝ ███████║██║
╚██╗ ██╔╝██╔══╝  ██║     ██║   ██║██║     ██║   ██║     ╚██╔╝  ██╔══██║██║
 ╚████╔╝ ███████╗███████╗╚██████╔╝╚██████╗██║   ██║      ██║   ██║  ██║██║
  ╚═══╝  ╚══════╝╚══════╝ ╚═════╝  ╚═════╝╚═╝   ╚═╝      ╚═╝   ╚═╝  ╚═╝╚═╝
```

# 🚀 **VelocityAI**

### AI-assisted product delivery platform for modern software teams

Turn messy feature requests into structured PRDs, engineering tasks, GitHub-connected
PR reviews, an AI **Copilot** that drafts the code, fix loops, human approval, and
shipped releases — end to end.

[![Live](https://img.shields.io/badge/Live-VelocityAI.in-6366f1?style=for-the-badge&logo=vercel&logoColor=white)](https://VelocityAI.in)
[![Demo Video](https://img.shields.io/badge/Demo_Video-Loom_Walkthrough-6366f1?style=for-the-badge&logo=loom&logoColor=white)](https://VelocityAI.in/demo)
[![Next.js](https://img.shields.io/badge/Next.js-16-000000?style=for-the-badge&logo=next.js)](https://nextjs.org)
[![React](https://img.shields.io/badge/React-19-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Turborepo](https://img.shields.io/badge/Turborepo-monorepo-EF4444?style=for-the-badge&logo=turborepo)](https://turbo.build)

**🌐 Production:** **<https://VelocityAI.in>** · **🎥 Demo Video:** **<https://VelocityAI.in/demo>**

📖 [Architecture](./ARCHITECTURE.md) · 🤝 [Contributing](./CONTRIBUTING.md) · 🔐 [Security](./SECURITY.md)

</div>

---

## 🎥 Video Walkthrough (End-to-End Demo)

> **Watch the 3-minute comprehensive tour of VelocityAI:**  
> 👉 **[Click here to watch the full Loom / YouTube Demo Walkthrough](https://VelocityAI.in/demo)**

| Timestamp | Milestone | Demonstrated Features |
|:---|:---|:---|
| **0:00 - 0:45** | **Product Discovery** | Natural-language intake form, AI clarification agent interactive Q&A |
| **0:45 - 1:20** | **PRD & Tasks** | Durable Inngest PRD generation, approval, specialty-based task decomposition & Kanban board |
| **1:20 - 2:05** | **GitHub Integration** | Automated webhook ingestion, Octokit PR review against PRD criteria, commit status checks |
| **2:05 - 2:35** | **Fix Loop** | Finding resolution loop, blocking vs non-blocking severity, re-review trigger |
| **2:35 - 3:00** | **Strict Release Gate** | Live checklist validation (4/4 requirements), human approval, ship to production |

---

## 📑 Table of Contents

1. [Video Walkthrough](#-video-walkthrough-end-to-end-demo)
2. [Project Overview](#-project-overview)
3. [The Core Workflow](#-the-core-workflow)
4. [Tech Stack](#-tech-stack)
5. [Architecture](#-architecture)
6. [Monorepo Structure](#-monorepo-structure)
7. [Backend Routes & URLs](#-backend-routes--urls)
8. [tRPC API Surface](#-trpc-api-surface)
9. [Inngest Workflow Explanation](#-inngest-workflow-explanation)
10. [AI Features Implemented](#-ai-features-implemented)
11. [AI Model Evaluation Benchmarks](#-ai-model-evaluation-benchmarks)
12. [AI Copilot — build / fix / improve](#-ai-copilot--build--fix--improve)
13. [GitHub Integration Setup](#-github-integration-setup)
14. [Billing & Plans](#-billing--plans)
15. [Authentication & Security](#-authentication--security)
16. [Real-time Sync](#-real-time-sync)
17. [Database Schema](#-database-schema)
18. [Setup Instructions](#-setup-instructions)
19. [Environment Variables](#-environment-variables)
20. [Scripts & Commands](#-scripts--commands)
21. [Testing & CI](#-testing--ci)
22. [Deployment](#-deployment)
23. [Further Documentation](#-further-documentation)

---

## 🎯 Project Overview

**VelocityAI** (internal package name `shipflow-ai`) is a full-stack SaaS product that
compresses the entire path from *"someone wants a feature"* to *"the feature is reviewed,
approved, and shipped"* — with AI handling the repetitive, structured parts and humans
keeping control of the decisions that matter.

A team drops in a raw feature request. VelocityAI then:

- **Clarifies** the request with an AI product-manager agent that asks focused questions.
- **Writes a PRD** (problem, goals, user stories, acceptance criteria, edge cases, risks, estimates).
- **Generates engineering tasks** and auto-assigns them to real teammates by specialty.
- **Connects GitHub**, watches pull requests, and runs an **AI code review** of each PR against the PRD's acceptance criteria — scoring each criterion individually and posting concrete fix suggestions.
- **Posts findings back to GitHub** and tracks fix/re-review cycles, surfaced in an org-wide review history with a resolve-finding workflow.
- **Drafts the code itself** — the AI **Copilot** indexes the connected repo and turns a prompt (build a feature / fix review findings / improve code) into a plan plus full file contents, optionally opened as a **draft PR**.
- **Gates on human approval** before a feature is marked shipped.
- **Meters AI reviews** as billable credits via Razorpay subscriptions, enforced server-side.
- **Broadcasts live updates** to every teammate in the org through Pusher.

It is a multi-tenant, organization-scoped application with role-based access control,
authentication via BetterAuth, and a fully type-safe API via tRPC.

---

## 🔄 The Core Workflow

```text
   Feature Request
        │
        ▼
   AI Clarification        ← features/ai/clarification-agent.ts
        │
        ▼
        PRD                ← Inngest: generate-prd  (event: feature/clarification-complete)
        │
        ▼  (human approves PRD)
   Engineering Tasks       ← Inngest: generate-tasks (event: prd/approved)
        │
        ▼
   GitHub Pull Request     ← GitHub App webhook
        │
        ▼
   AI Review               ← Inngest: review-pull-request (event: github/pull_request.review_requested)
        │
        ▼
   Fixes / Re-review       ← review cycles + issues posted back to the PR
        │
        ▼
   Human Approval          ← approval router (approve / reject / ship)
        │
        ▼
      Shipped 🚢
```

Each transition is enforced by the domain logic in `packages/services/shipflow/` and
persisted through Drizzle. The long-running AI steps run as **durable Inngest functions**
so they survive retries, timeouts, and redeploys.

---

## 🧰 Tech Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| **Monorepo** | Turborepo + pnpm workspaces | turbo 2.7 / pnpm 9 |
| **Framework** | Next.js (App Router) | 16.1 |
| **UI runtime** | React | 19.2 |
| **Language** | TypeScript | 5.9 |
| **API** | tRPC (end-to-end type safety) | 11.8 |
| **ORM / DB** | Drizzle ORM + PostgreSQL 15 | drizzle 0.45 |
| **Auth** | BetterAuth (+ organization plugin) | 1.6 |
| **AI** | Vercel AI SDK + OpenAI | ai 6.0 |
| **Workflows** | Inngest (durable functions) | 4.11 |
| **GitHub** | Octokit GitHub App | octokit 5.0 |
| **Billing** | Razorpay subscriptions | 2.9 |
| **Real-time** | Pusher Channels | 5.3 |
| **Email** | Resend | latest |
| **Validation** | Zod | 4.3 |
| **Styling** | Tailwind CSS 4 + shadcn/Radix UI primitives | 4.1 |
| **Data fetching** | TanStack Query (via tRPC) | latest |
| **Animation** | Framer Motion, Lenis, Embla, Recharts | latest |
| **CI** | GitHub Actions | — |

---

## 🏛 Architecture

VelocityAI is a **single deployable Next.js application** backed by shared workspace
packages. There is **no separate backend server** — the "backend" is the set of
Next.js **Route Handlers** under `apps/web/app/api/**` plus the shared `@repo/trpc`
router. This is why the production deployment exposes only one URL
(**<https://VelocityAI.in>**): the frontend, the API, the webhooks, and the AI workflow
endpoint are all served from that same origin.

```text
                         https://VelocityAI.in
                                 │
        ┌────────────────────────┼─────────────────────────┐
        │                        │                          │
   React UI (App Router)   API Route Handlers          tRPC Router
   apps/web/app/**         apps/web/app/api/**          @repo/trpc
        │                        │                          │
        │                ┌───────┼────────┐                 │
        │                │       │        │                 │
   TanStack Query    BetterAuth  Inngest  Webhooks      protected /
   (typed client)    (sessions) (durable) (GitHub,      org procedures
        │                │       jobs)    Razorpay,          │
        │                │        │       Pusher)            │
        └────────────────┴────────┴───────┴─────────────────┘
                                 │
                    @repo/database (Drizzle ORM)
                                 │
                          PostgreSQL 15
```

**Key design decisions**

- **Type-safe seam:** the client calls tRPC procedures; the same `ServerRouter` type
  flows to the browser, so the API can never drift from the UI.
- **Durable AI:** every multi-second AI task (PRD, tasks, review) is an Inngest
  function with explicit `step.run` checkpoints and idempotency guards, not a fire-and-forget request.
- **Resilient reviews:** the GitHub webhook enqueues an Inngest job; if Inngest is
  unreachable it falls back to running the review **inline** so reviews never silently drop.
- **Org isolation:** every domain table carries an `organization_id`, and Pusher
  private channels (`private-org-{id}`) are authorized against real DB membership.
- **Edge auth gate:** `apps/web/middleware.ts` optimistically checks the session
  cookie on protected routes and sends `Cache-Control: no-store`, so the browser can't
  restore an authenticated page from bfcache after sign-out — the protected layout's
  `requireAuth()` remains the authoritative check.
- **Repo-aware Copilot:** a cached `repo_context` snapshot (file tree + AI summaries)
  gives the Copilot agent repo-wide context; it's refreshed after each merged PR.

> 📖 For the deeper dive — request lifecycles, package boundaries, the durability
> model, and the Copilot context pipeline — see **[ARCHITECTURE.md](./ARCHITECTURE.md)**.

---

## 🗂 Monorepo Structure

```text
VelocityAI/
├── apps/
│   └── web/                       # The Next.js product (UI + API + workflows)
│       ├── app/
│       │   ├── (auth)/            # Sign-in routes
│       │   ├── (protected)/       # Authenticated app shell (dashboard, features, …)
│       │   └── api/               # ← Backend route handlers (see Backend Routes)
│       ├── features/              # Vertical feature modules
│       │   ├── ai/                # AI agents (clarify, PRD, tasks, QA review)
│       │   ├── auth/              # Sign-in forms, session helpers
│       │   ├── billing/           # Razorpay, credits, subscription server logic
│       │   ├── copilot/           # Repo-context indexer + code-drafting agent (server actions)
│       │   ├── github/            # Installation, review pipeline, GitHub App
│       │   └── inngest/           # Inngest client + durable functions
│       ├── middleware.ts          # Edge auth gate for protected routes (+ no-store)
│       ├── lib/                   # auth, db wiring, email, github, realtime, razorpay
│       ├── components/            # shadcn/ui-style primitives + product components
│       ├── hooks/ providers/ trpc/
│       └── env.js                 # @t3-oss/env-nextjs validation
│
├── packages/
│   ├── database/                  # Drizzle schema + Postgres client
│   │   ├── models/user.ts         # auth tables (user, session, account, verification)
│   │   ├── models/shipflow.ts     # product tables (org, prd, task, PR, review, …)
│   │   └── schema.ts              # barrel export consumed everywhere
│   ├── trpc/                      # Type-safe API router (14 sub-routers)
│   ├── services/                  # Pure, tested domain logic & agent helpers
│   │   └── shipflow/              # workflow, agents, code-review, billing, github
│   ├── logger/                    # Shared logging
│   ├── eslint-config/             # Shared lint config
│   └── typescript-config/         # Shared tsconfig presets
│
├── docs/ui/                       # Design notes (landing-page.md)
├── docker-compose.yml             # Local Postgres + Inngest dev server
├── turbo.json                     # Task graph + globalEnv (env source of truth)
├── pnpm-workspace.yaml
└── setup.sh                       # Bootstraps .env and symlinks it into each package
```

---

## 🌐 Backend Routes & URLs

Because VelocityAI is a Next.js app, the **backend lives at the same domain as the
frontend**. Every route below is a Next.js Route Handler (`app/api/**/route.ts`).

> **Production base URL:** `https://VelocityAI.in`
> **Local base URL:** `http://localhost:3000`
> Prepend the base URL to any path below.

| Method(s) | Path | Production URL | Purpose |
|-----------|------|----------------|---------|
| `GET` `POST` | `/api/auth/[...all]` | `https://VelocityAI.in/api/auth/*` | BetterAuth — sign-in/up, sessions, OAuth (GitHub & Google), organization endpoints |
| `GET` `POST` | `/api/trpc/[trpc]` | `https://VelocityAI.in/api/trpc/*` | tRPC fetch handler — **all** typed app queries/mutations (e.g. `…/api/trpc/feature.create`) |
| `GET` `POST` `PUT` | `/api/inngest` | `https://VelocityAI.in/api/inngest` | Inngest serve endpoint — registers & executes durable workflow functions |
| `POST` | `/api/github/webhook` | `https://VelocityAI.in/api/github/webhook` | GitHub App webhook — verifies signature, caches PRs, enqueues AI review |
| `GET` | `/api/github/callback` | `https://VelocityAI.in/api/github/callback` | GitHub App installation callback → hands off to `/github-connected` |
| `POST` | `/api/pusher/auth` | `https://VelocityAI.in/api/pusher/auth` | Pusher private-channel authorization (verifies org membership) |
| `POST` | `/api/razorpay/webhook` | `https://VelocityAI.in/api/razorpay/webhook` | Razorpay subscription webhook — verifies HMAC, updates plan & credits |
| `POST` | `/api/webhooks/github` | `https://VelocityAI.in/api/webhooks/github` | Alias → re-exports the GitHub webhook handler |
| `POST` | `/api/webhooks/razorpay` | `https://VelocityAI.in/api/webhooks/razorpay` | Alias → re-exports the Razorpay webhook handler |
| `POST` | `/api/webhooks/gmail` | `https://VelocityAI.in/api/webhooks/gmail` | Placeholder (`{ ok: true }`) for a future email-intake integration |
| `POST` | `/api/webhooks` | `https://VelocityAI.in/api/webhooks` | Generic health/ack stub (`{ ok: true }`) |

### App (page) routes

| Route | Group | Description |
|-------|-------|-------------|
| `/` | public | Marketing landing page |
| `/sign-in` | auth | Email/password + GitHub + Google sign-in |
| `/dashboard` | protected | Org workspace overview & progress |
| `/features` · `/features/new` · `/features/[featureId]` | protected | Feature request list, intake, and detail (clarification chat → PRD → tasks) |
| `/prd` | protected | PRD view |
| `/tasks` | protected | Engineering task board |
| `/reviews` | protected | Org-wide AI review history (cycles + issues) — status filter, detail drawer, resolve findings |
| `/copilot` | protected | AI Copilot — index a repo and draft features / fixes / improvements, open a draft PR |
| `/github` | protected | GitHub App connection & repository management |
| `/projects` | protected | Projects within the org |
| `/billing` | protected | Plan, AI-review credits, repo limits, renewal |
| `/settings` · `/settings/team` | protected | Workspace & team/member management |
| `/search` | protected | Global org search |
| `/profile` | — | User profile & memberships |
| `/invite` · `/github-connected` | — | Invitation acceptance & GitHub OAuth popup handoff |

---

## 🔌 tRPC API Surface

All typed app calls go through the **single** endpoint `/api/trpc/[trpc]`, invoked as
`…/api/trpc/<router>.<procedure>`. The root router (`packages/trpc/server/index.ts`)
composes **14 sub-routers**. Procedures are guarded by access level —
`publicProcedure`, `protectedProcedure` (signed in), `orgProcedure` (org member),
`managerProcedure`, `adminProcedure`.

| Router | Key procedures | Access |
|--------|----------------|--------|
| `health` | `getHealth` | public |
| `org` | `create`, `list`, `current`, `getBySlug`, `update` | protected / org |
| `member` | `list`, `invite`, `directAdd`, `updateRole`, `updateSpecialty`, `remove`, `acceptInvitation`, `getInvitation`, `listInvitations`, `cancelInvitation`, `getAssignedTasks` | org / admin / public |
| `project` | `create`, `list`, `getById` | org |
| `feature` | `create`, `list`, `getById`, `updateStatus`, `sendClarificationMessage`, `triggerPrdGeneration`, `cancelPrdGeneration`, `triggerTaskGeneration`, `cancelTaskGeneration` | org |
| `prd` | `getByFeature`, `byFeature`, `editWithAI`, `updateEstimate`, `setDeadline`, `approve` | org / manager |
| `task` | `byFeature`, `listByFeature`, `updateStatus`, `reorder`, `assignTo` | org |
| `review` | `listAllCycles`, `getCycle`, `listCyclesByFeature`, `getLatestCycle`, `resolveIssue` | org |
| `approval` | `approve`, `reject`, `ship` | manager |
| `github` | `getInstallationStatus`, `saveInstallation`, `repositories`, `listRepos`, `connectRepo`, `disconnectRepo`, `pullRequestsByRepo` | protected / org |
| `billing` | `getSubscription`, `summary`, `usage` | org |
| `profile` | `memberships`, `myTasks` | protected |
| `search` | `global` | org |
| `shipflow` | `getWorkspace`, `generatePrd`, `reviewPullRequest` | public (snapshot/demo) |

> The **Copilot** flow (index repo, generate plan + patches, open a draft PR) runs
> through **Next.js server actions** in `apps/web/features/copilot/server/`, not tRPC —
> the agent needs the AI SDK + Octokit, which live in `apps/web`. Each action is
> guarded by an org-ownership check on the target repository.

---

## ⚙️ Inngest Workflow Explanation

Inngest provides **durable, event-driven background functions**. VelocityAI registers them
at `POST/GET/PUT /api/inngest` (`apps/web/app/api/inngest/route.ts`) via Inngest's Next.js
adapter. The client id is `shipflow-ai` (`features/inngest/client.ts`). All functions are
collected in `apps/web/lib/inngest.ts`.

Each function uses `step.run(...)` to checkpoint progress — if a later step fails, Inngest
retries from the last successful step rather than re-running the whole job, and AI calls
aren't repeated unnecessarily.

### Registered functions

| Function ID | Trigger event | What it does |
|-------------|---------------|--------------|
| **`generate-prd`** | `feature/clarification-complete` | Loads the feature + clarification messages, sets status `prd_generating`, calls the PRD AI agent, saves structured PRD (or bumps version on regenerate), sets `prd_ready`, broadcasts `prd.generated`. Idempotency-guarded; **never overwrites an approved PRD**. |
| **`generate-tasks`** | `prd/approved` | Loads the approved PRD + org members, sets `in_progress`, asks the AI to break the PRD into tasks, **auto-assigns** each task to a teammate by specialty (with client overrides), recomputes the PRD's total hour estimate, sets `tasks_ready`, broadcasts `tasks.generated`. |
| **`generate-tasks-on-failure`** | `inngest/function.failed` | Failure handler — if `generate-tasks` fails, reverts the feature back to `prd_ready` so the user can retry cleanly. |
| **`review-pull-request`** | `github/pull_request.review_requested` | Runs the shared PR review pipeline for a cached PR. Spends one AI-review credit; if the org is out of credits (`ReviewCreditError`) the run is skipped (terminal — no retry/re-charge). Supports a legacy inline-payload path. |

### Event flow

```text
feature.sendClarificationMessage (AI says "done")
        │  emits
        ▼
feature/clarification-complete ──► generate-prd ──► status: prd_ready
                                                          │
                                   prd.approve            │ (human)
                                        │  emits          ▼
                                  prd/approved ──► generate-tasks ──► status: tasks_ready
                                                                            │
GitHub PR opened/sync/reopen ──► /api/github/webhook                        │
        │  emits                                                            │
        ▼                                                                   │
github/pull_request.review_requested ──► review-pull-request ──► review cycle + issues
                                                                  posted back to GitHub
```

### Local Inngest

`docker-compose.yml` ships an `inngest dev` container pointed at
`http://host.docker.internal:3000/api/inngest`. Because the container can't reach the
host's `localhost`, the app advertises itself via **`INNGEST_SERVE_ORIGIN`**
(`http://host.docker.internal:3000`) — this is unset in production, where Inngest infers
the real origin from the request. The Inngest dev dashboard runs at
**<http://localhost:8288>**.

---

## 🤖 AI Features Implemented

Production AI calls use the **Vercel AI SDK** (`generateObject`) with **OpenAI**,
defaulting to `gpt-4o-mini` (override with `OPENAI_MODEL`). Each agent defines a Zod
schema so the model returns **strongly-typed, validated structured output**.

| # | Feature | File | What it produces |
|---|---------|------|------------------|
| 1 | **Clarification agent** | `features/ai/clarification-agent.ts` | Acts as a product manager: asks one focused question at a time (target users, core problem, success metrics, scope), stops after 2–4 exchanges, returns `{ reply, isDone }`. When `isDone`, the clarification-complete event fires. |
| 2 | **PRD generator** | `features/ai/prd-generator.ts` | Full structured PRD: problem statement, goals, non-goals, user stories, acceptance criteria, edge cases, success metrics, technical requirements, dependencies, risks, required disciplines, hour estimate, and raw markdown. Also exposes `editPrdWithAI` for AI-assisted PRD edits. |
| 3 | **Task generator** | `features/ai/task-generator.ts` | Breaks the PRD into engineering tasks (title, description, type, priority, estimated hours) and assigns each to a real teammate using member specialties (`frontend / backend / devops / ai / fullstack / testing`). |
| 4 | **QA / code reviewer** | `features/ai/qa-reviewer.ts` | **PRD-aware** PR review. Reads the **full per-file diff + commit messages** and judges **each acceptance criterion** as `met` / `partial` / `not_met` with cited evidence. The PRD-compliance score (0–100) is **derived from that breakdown** — not a flat constant — and every finding carries a concrete fix `suggestion`. Without a PRD it falls back to a general quality/security review. |
| 5 | **Copilot agent** | `features/copilot/server/agent.ts` | Given a prompt + repo context (+ PRD / open review findings), produces an implementation **plan** and the **full content of each changed file**, plus notes. Drives the build / fix-review / improve modes and the draft-PR action. |
| 6 | **Repo-context indexer** | `features/copilot/server/repo-context.ts` | Walks the connected repo's git tree, summarizes the key files in one AI call, and upserts a compact `repo_context` snapshot. Refreshed on demand and after each merged PR so Copilot stays current. |

Deterministic, fully unit-tested versions of the agent/review/workflow logic live in
`packages/services/shipflow/` (`agents.ts`, `code-review.ts`, `workflow.ts`) so the core
business rules are testable without hitting the model.

**The AI workflow end-to-end covers:** clarification → structured PRD → task generation
& assignment → PRD-aware PR review → release-readiness/approval gating.

---

## 🧪 AI Model Evaluation Benchmarks

VelocityAI incorporates an automated evaluation test suite (`packages/services/shipflow/evals.test.ts`) covering all AI agent pipelines to ensure deterministic accuracy, schema adherence, and zero hallucination.

| Benchmark Test | Pipeline Evaluated | Evaluation Metric | Result |
|:---|:---|:---|:---:|
| **EVAL 1: Clarification Agent** | `features/ai/clarification-agent.ts` | Probes users, success metrics, and out-of-scope bounds; skips redundant inquiries when context is already provided. | **PASS (100%)** |
| **EVAL 2: PRD Generator Agent** | `features/ai/prd-generator.ts` | Renders all 7 core sections (Problem, Goals, Non-Goals, Stories, Acceptance Criteria, Edge Cases, Metrics) in valid markdown. | **PASS (100%)** |
| **EVAL 3: Compliance Scoring Engine** | `packages/services/shipflow/code-review.ts` | Derives weighted compliance scores (`met` = 1.0, `partial` = 0.5, `not_met` = 0.0) with mathematical clamping (0–100). | **PASS (100%)** |
| **EVAL 4: QA Reviewer Severity** | `features/ai/qa-reviewer.ts` | Flags missing acceptance criteria with `blocking` severity and actionable remediation suggestions. | **PASS (100%)** |
| **EVAL 5: Criteria Isolation** | `packages/services/shipflow/agents.ts` | Separates blocking vs non-blocking findings during diff evaluation. | **PASS (100%)** |
| **EVAL 6: Workflow State Machine** | `packages/services/shipflow/workflow.ts` | Enforces acyclic progression through intake → clarifying → prd → tasks → review → approved → shipped. | **PASS (100%)** |

Run the full evaluation suite anytime with:
```bash
pnpm --filter @repo/services test
```

---

## 🪄 AI Copilot — build / fix / improve

The **Copilot** (`/copilot`) closes the loop: instead of only *reviewing* code, VelocityAI
can *draft* it. It gives the agent **repo-wide context** so its output fits your
codebase's conventions, then turns a prompt into a concrete change set.

**Repo context (the snapshot).** On demand (and after each merged PR), the indexer walks
the connected repo's git tree, picks the highest-signal files, and summarizes them in a
single AI call into a compact `repo_context` row:

```text
repo_context = { overview, stack, tree[], summaries{ path → one-liner }, lastSha }
```

This is a **structured summary snapshot** (not a vector store) — cheap, no extra
infrastructure, and refreshed only when the head commit changes.

**Three modes.** Pick a repo (and optionally a feature/PRD), then:

| Mode | Uses | Produces |
|------|------|----------|
| **Build** | prompt + repo context (+ PRD if selected) | a new feature implementation |
| **Fix review** | the linked feature's **open review findings** | targeted fixes for each finding |
| **Improve** | the prompt + repo context | focused refactors / hardening |

**Output → draft PR.** The agent returns an ordered **plan** plus the **full content of
each file** to create/modify (with a rationale), shown in-app with copy buttons. One
click commits those files to a new branch and opens a **draft PR** via the GitHub git
data API (blob → tree → commit → ref → PR) — which then flows straight into the AI
review pipeline.

All of this runs through org-scoped **server actions** in
`apps/web/features/copilot/server/` (`repo-context.ts`, `agent.ts`, `actions.ts`).

---

## 🐙 GitHub Integration Setup

VelocityAI connects to repositories as a **GitHub App** (via Octokit), not a personal token,
so installs are org-scoped and permissions are least-privilege.

**Entry points**

```text
apps/web/lib/github/app.ts                     # getGithubApp() — builds the Octokit App
apps/web/features/github/server/installation.ts # parses the install callback
apps/web/features/github/review.ts             # runReviewForPullRequest() pipeline
apps/web/app/api/github/webhook/route.ts       # signed webhook receiver
apps/web/app/api/github/callback/route.ts      # install callback → /github-connected
```

**How it works**

1. A user installs the GitHub App; GitHub redirects to `/api/github/callback`, which
   forwards `installation_id` + CSRF `state` to the `/github-connected` popup page.
2. The installation is persisted (`github_installation` table) and repos are connected
   via the `github` tRPC router (`connectRepo`, `listRepos`).
3. GitHub sends `pull_request` events (`opened`, `synchronize`, `reopened`) to
   `/api/github/webhook`. The handler **verifies `x-hub-signature-256`** against
   `GITHUB_WEBHOOK_SECRET`, then upserts the PR into `pull_request` (every PR for a
   connected repo is cached — even ones not on a `feature/{featureId}` branch).
4. It enqueues `github/pull_request.review_requested` on Inngest. If Inngest is down,
   it runs the review **inline** as a fallback so reviews never drop.
5. The review pipeline fetches the **per-file patches + commit messages**, runs the AI
   reviewer against the PRD (per-criterion scoring + fix suggestions), stores a
   `review_cycle` + `review_issue` rows, and posts the verdict, compliance score, and
   suggestions back to the PR.
6. When a PR is **merged**, the webhook refreshes the repo's `repo_context` snapshot so
   Copilot reasons over the latest code.

**Required GitHub env vars** (see [Environment Variables](#-environment-variables)):
`GITHUB_APP_ID`, `GITHUB_APP_PRIVATE_KEY`, `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`,
`GITHUB_WEBHOOK_SECRET`, `NEXT_PUBLIC_GITHUB_APP_NAME`.

> **Tip:** the private key may contain literal `\n`; the app normalizes them to real
> newlines, so you can paste it as a single-line value in Vercel env vars.

**Local webhooks:** GitHub can't reach `localhost`, so `pnpm dev` opens an **ngrok**
tunnel and the app is reachable at a stable ngrok domain — set that as the GitHub App's
webhook URL during development.

---

## 💳 Billing & Plans

Subscriptions and **AI-review credits** are handled with **Razorpay**. The webhook
(`/api/razorpay/webhook`) verifies the HMAC `x-razorpay-signature`, is **idempotent**
(dedupes by `x-razorpay-event-id` via the `processed_webhook_event` ledger), and updates
the org's `subscription` row — plan, status, credit allowance, and repository limit.

| Plan | Price (₹/mo) | AI-review credits | Repository limit | Seats |
|------|-------------|-------------------|------------------|-------|
| **Free** | 0 | 100 | 1 | — |
| **Pro** | 999 | 1,000 | 10 | — |
| **Scale** | 1,999 | 5,000 | 50 | 20 |

Each review cycle (initial + re-runs) consumes one credit; the review pipeline gates on
available credits **before** doing any AI work. Plan logic lives in
`packages/services/shipflow/billing.ts` and `features/billing/`.

Handled webhook events: `subscription.activated`, `subscription.charged`,
`subscription.cancelled`, `subscription.halted`, `subscription.completed`.

---

## 🔐 Authentication & Security

Auth is handled by **BetterAuth** (email/password + GitHub & Google OAuth) with the
organization plugin for multi-tenancy. Protected routes are guarded in two layers:

1. **Edge middleware** (`apps/web/middleware.ts`) — an optimistic session-cookie check
   redirects unauthenticated requests to `/sign-in?callbackUrl=…` and stamps every
   protected response with **`Cache-Control: no-store`**. That header stops the browser
   restoring an authenticated page from the back/forward cache after sign-out (and
   sign-out does a hard navigation to clear the client router cache).
2. **`requireAuth()`** in the protected layout — the authoritative DB session check.

Other guarantees: every domain query is **organization-scoped** (including
`review.resolveIssue` and all Copilot actions); GitHub and Razorpay webhooks **verify
signatures** and Razorpay is **idempotent**; AI-review credits and the repo limit are
**enforced server-side**; GitHub access uses a least-privilege **GitHub App**, not PATs.

> Full model and disclosure process: **[SECURITY.md](./SECURITY.md)**.

---

## 📡 Real-time Sync

Org-wide live updates use **Pusher Channels**. Clients subscribe to the private channel
`private-org-{organizationId}`; `/api/pusher/auth` authorizes a subscription only if the
signed-in user is a real DB member of that org. Server code emits events such as
`prd.generated` and `tasks.generated` via `publishOrgEvent`, so every teammate sees
progress without refreshing. Pusher is **optional** — if keys are unset, publishing
no-ops gracefully.

---

## 🗄 Database Schema

PostgreSQL via **Drizzle ORM**. Schema is split across two model files and re-exported
from `packages/database/schema.ts`:

```text
packages/database/models/user.ts        # BetterAuth identity tables
packages/database/models/shipflow.ts    # product/domain tables
```

### Tables

**Auth / identity** (`models/user.ts`)

| Table | Purpose |
|-------|---------|
| `user` | Accounts; also carries plan + Razorpay customer/subscription mirror fields |
| `session` | Active sessions, including `active_organization_id` |
| `account` | OAuth/provider linkage (GitHub, Google), tokens |
| `verification` | Email/verification tokens |

**Organizations & people** (`models/shipflow.ts`)

| Table | Purpose |
|-------|---------|
| `organization` | Tenant; unique `slug` |
| `member` | User ↔ org with `role` and `specialty`; unique per (org, user) |
| `invitation` | Pending org invites with status & expiry |

**Product domain**

| Table | Purpose |
|-------|---------|
| `project` | Projects inside an org |
| `repository` | Connected GitHub repos (installation id, default branch, webhook id) |
| `github_installation` | GitHub App installations per user/org |
| `feature_request` | The unit of work; `status` drives the whole lifecycle |
| `clarification_message` | Chat transcript between user and the clarification agent |
| `prd` | Structured PRD (1:1 with feature), versioned, with approval fields |
| `task` | Generated engineering tasks; type, priority, estimate, assignee, order |
| `pull_request` | Cached PRs for connected repos (linked to a feature when on a `feature/*` branch) |
| `review_cycle` | One AI review pass over a PR (verdict, summary, PRD-compliance score) |
| `review_issue` | Individual findings within a cycle (category, severity, file, line, resolved) |
| `subscription` | Org plan, status, AI-review credits (allowance + used + reset), repo limit |
| `processed_webhook_event` | Idempotency ledger for inbound provider webhooks |
| `repo_context` | Cached, AI-summarized snapshot of a connected repo (overview, stack, file tree, per-file summaries, last sha) for the Copilot agent |

### Notable enums & rules

- **Member roles** (most → least privileged): `owner`, `admin`, `manager`, `developer`, `viewer` — `hasRole()` compares precedence.
- **Member specialties:** `frontend`, `backend`, `devops`, `ai`, `fullstack`, `testing` — mapped to task types via `SPECIALTY_TASK_TYPES` for auto-assignment.
- **Feature status lifecycle:** `intake` → (`clarifying`) → `prd_generating` → `prd_ready` → `in_progress` → `tasks_ready` → … → shipped.
- **PRD is locked once approved** — regeneration is blocked on approved PRDs.

### Migrations

```bash
pnpm db:generate   # generate Drizzle migrations from schema changes
pnpm db:migrate    # apply migrations to DATABASE_URL
```

Config: `packages/database/drizzle.config.ts`.

---

## 🛠 Setup Instructions

### Prerequisites

- **Node.js ≥ 18** (CI uses Node 22)
- **pnpm 9** (`corepack enable` recommended)
- **Docker** (for local Postgres + Inngest) — or your own Postgres 15
- An **OpenAI API key** for AI features

### 1. Install dependencies

```bash
pnpm install
```

### 2. Create your environment file

```bash
./setup.sh        # copies .env.example → .env and symlinks it into every workspace package
```

Then fill in `.env` (see [Environment Variables](#-environment-variables)). For a quick
local spin-up you can keep `SHIPFLOW_DEMO_AUTH=true` and `SKIP_ENV_VALIDATION=1`.

### 3. Start infrastructure (Postgres + Inngest)

```bash
docker compose up -d        # Postgres on :5432, Inngest dev UI on :8288
pnpm db:migrate             # apply the schema
```

### 4. Run the app

```bash
pnpm dev          # turbo dev + ngrok tunnel (for GitHub webhooks)
# or, without the tunnel:
pnpm dev:app
```

Open **<http://localhost:3000>** · Inngest dashboard at **<http://localhost:8288>**.

---

## 🔐 Environment Variables

> `turbo.json`'s `globalEnv` is the **source of truth** for the full env surface.
> Copy `.env.example` and fill these in.

```bash
# ── Core ──────────────────────────────────────────────
DATABASE_URL=postgres://postgres:postgres@localhost:5432/shipflow
BETTER_AUTH_SECRET=replace-with-32-plus-character-random-secret
BETTER_AUTH_URL=http://localhost:3000          # https://VelocityAI.in in prod
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_API_URL=/api/trpc
SHIPFLOW_DEMO_AUTH=true                          # demo bypass; disable in prod
SKIP_ENV_VALIDATION=                             # set to 1 for Docker builds

# ── AI (OpenAI via Vercel AI SDK) ─────────────────────
OPENAI_API_KEY=replace-me
OPENAI_MODEL=gpt-4o-mini

# ── Inngest (durable workflows) ───────────────────────
INNGEST_EVENT_KEY=replace-me
INNGEST_SIGNING_KEY=replace-me
INNGEST_SERVE_ORIGIN=http://host.docker.internal:3000   # local Docker only; unset in prod
INNGEST_DEV=

# ── Auth providers ────────────────────────────────────
GITHUB_CLIENT_ID=replace-me
GITHUB_CLIENT_SECRET=replace-me
GOOGLE_CLIENT_ID=replace-me
GOOGLE_CLIENT_SECRET=replace-me

# ── GitHub App (PR reviews) ───────────────────────────
GITHUB_APP_ID=replace-me
GITHUB_APP_PRIVATE_KEY=replace-me                # \n-escaped single line is fine
GITHUB_WEBHOOK_SECRET=replace-me
NEXT_PUBLIC_GITHUB_APP_NAME=replace-me

# ── Razorpay (billing) ────────────────────────────────
RAZORPAY_KEY_ID=replace-me
RAZORPAY_KEY_SECRET=replace-me
NEXT_PUBLIC_RAZORPAY_KEY_ID=replace-me
RAZORPAY_PRO_PLAN_ID=replace-me
RAZORPAY_SCALE_PLAN_ID=replace-me
RAZORPAY_WEBHOOK_SECRET=replace-me

# ── Pusher (real-time; optional) ──────────────────────
PUSHER_APP_ID=replace-me
PUSHER_KEY=replace-me
PUSHER_SECRET=replace-me
PUSHER_CLUSTER=ap2
NEXT_PUBLIC_PUSHER_KEY=replace-me
NEXT_PUBLIC_PUSHER_CLUSTER=ap2

# ── Email (Resend) ────────────────────────────────────
RESEND_API_KEY=replace-me
RESEND_FROM_EMAIL=replace-me
```

Validation is enforced client-side via `@t3-oss/env-nextjs` (`apps/web/env.js`); set
`SKIP_ENV_VALIDATION=1` to bypass during Docker builds.

---

## 📜 Scripts & Commands

Run from the repo root (Turborepo orchestrates each package):

| Command | What it does |
|---------|--------------|
| `pnpm dev` | Run all apps in dev **+ ngrok tunnel** (for GitHub webhooks) |
| `pnpm dev:app` | Run apps in dev without the tunnel |
| `pnpm dev:tunnel` | Run just the ngrok tunnel |
| `pnpm build` | Production build of every package/app |
| `pnpm test` | Run all tests (`tsx --test`) |
| `pnpm lint` | Lint everything (zero-warning policy) |
| `pnpm check-types` | Type-check (Next typegen + `tsc --noEmit`) |
| `pnpm format` | Prettier across `**/*.{ts,tsx,md}` |
| `pnpm db:generate` | Generate Drizzle migrations |
| `pnpm db:migrate` | Apply migrations |

---

## ✅ Testing & CI

- **Unit tests** run with Node's built-in test runner via `tsx`, covering the
  deterministic domain logic in `packages/services/shipflow/` (workflow, agents,
  code-review, billing, github) and helpers in `apps/web/features` & `lib`.
- **GitHub Actions** (`.github/workflows/ci.yml`) runs on every PR and push to `main`:
  installs with a frozen lockfile, then **tests → type-check → lint → build** on Node 22 / pnpm 9.

```bash
pnpm test && pnpm check-types && pnpm lint && pnpm build
```

---

## 🚢 Deployment

- **Production:** **<https://VelocityAI.in>** — a single Next.js deployment that serves the
  UI, the tRPC API, all webhook handlers, and the Inngest endpoint from one origin.
- Set `BETTER_AUTH_URL` and `NEXT_PUBLIC_APP_URL` to `https://VelocityAI.in`, **leave
  `INNGEST_SERVE_ORIGIN` unset** (Inngest infers the origin), and provide the production
  keys for OpenAI, Inngest, the GitHub App, Razorpay, Pusher, and Resend.
- Point the **GitHub App webhook** at `https://VelocityAI.in/api/github/webhook` and the
  **Razorpay webhook** at `https://VelocityAI.in/api/razorpay/webhook`.

---

## 📚 Further Documentation

| Document | What's inside |
|----------|---------------|
| **[ARCHITECTURE.md](./ARCHITECTURE.md)** | Request lifecycles, package boundaries, the durability model, AI review scoring, and the Copilot context pipeline |
| **[CONTRIBUTING.md](./CONTRIBUTING.md)** | Local setup, conventions, where code goes, database changes, and the quality gates |
| **[SECURITY.md](./SECURITY.md)** | Security model and how to report a vulnerability |

---

<div align="center">

**VelocityAI** — from feature request to shipped, with AI doing the heavy lifting and
humans keeping the wheel. 🚀

📖 [Architecture](./ARCHITECTURE.md) · 🤝 [Contributing](./CONTRIBUTING.md) · 🔐 [Security](./SECURITY.md)

Built with Next.js · tRPC · Drizzle · Inngest · OpenAI · GitHub · Razorpay

</div>

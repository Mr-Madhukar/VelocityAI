Product Requirements Document (PRD)
VelocityAI — AI-Assisted Product Delivery Platform
Version: 1.0 Status: Draft for Hackathon Build (ChaiCode Builder Mode) Owner: [Madhukar]

1. Problem Statement
Software teams lose velocity not because AI can't write code fast enough, but because the process around code — requirement gathering, PRD writing, task breakdown, code review, and release approval — is manual, slow, and scattered across tools (email, Slack, Jira, GitHub, spreadsheets).

There is no single platform that takes a raw feature request and carries it, in a structured and auditable way, all the way to a shipped, human-approved release — with AI actively doing the product thinking, task planning, and code review along the way.

VelocityAI solves this by acting as an AI-native delivery pipeline: Request → PRD → Tasks → Code → AI Review → Fixes → Human Approval → Ship.

2. Goals
Let a customer/product owner submit a feature request in natural language and have AI turn it into a structured PRD.
Automatically break a PRD into actionable, trackable engineering tasks.
Connect directly to GitHub repos and track real pull requests (no mocked/hardcoded PR data).
Run AI-powered code review against the PRD's actual acceptance criteria — not just linting.
Support a fix → re-review loop until the AI review is clean.
Require a human to give final sign-off before a feature is marked "Shipped."
Support multiple isolated workspaces (multi-tenant), each with its own users, repos, PRDs, and billing.
Run long AI/GitHub operations asynchronously (Inngest) with visible progress in the UI.
Monetize via Razorpay with free vs. paid tiers (AI review credits, repo limits, premium workflows).

3. Non-Goals (v1)
Not building a full project-management replacement (no full Gantt charts, no custom Kanban automations beyond what's needed for the core loop).
Not supporting GitLab/Bitbucket in v1 — GitHub only.
Not auto-merging or auto-deploying code — humans approve releases; VelocityAI marks status, it does not push to production infra.
Not replacing human code review entirely — AI review is advisory + blocking-gate, final approval is always human.
No native mobile app in v1 (responsive web only).
No custom AI model training — uses AI SDK against hosted LLM providers.

4. Target Users / Personas
Persona	Description	Needs
Product Owner (Priya)	Submits feature requests, wants PRDs written for her fast and accurately	Fast, structured PRDs; ability to answer clarifying questions; visibility into progress
Engineering Lead (Arjun)	Approves task breakdown, oversees dev team, connects repos	Reliable task generation, GitHub integration, review history, control over release
Developer / Coding Agent (Dev)	Implements tasks, opens PRs	Clear tasks tied to PRD, actionable AI review comments
QA/Reviewer (Human Approver)	Final gatekeeper before release	Full audit trail: PRD, tasks, PR, AI review history, outstanding issues
Org Admin	Manages workspace, billing, users	Multi-tenant workspace control, usage limits, plan management

5. User Stories
As a product owner, I can submit a feature request via a form (email/ticket-style) so AI can start processing it.
As a product owner, I want the AI to ask me clarifying questions when my request is ambiguous, so the PRD is accurate.
As a product owner, if a similar feature already exists, I want to be told before a duplicate PRD is generated.
As an eng lead, I want the AI-generated PRD broken into tasks on a Kanban board automatically.
As an eng lead, I want to review and approve the task plan before development starts.
As a developer, I want to link a GitHub repo so my PRs are automatically tracked against the feature.
As a developer, I want AI review feedback on my PR that references specific PRD acceptance criteria, not generic code style comments.
As a developer, when AI review finds blocking issues, I want the feature to return to a "fix needed" state with a clear issue list.
As a human reviewer, I want to see full review history (all AI review rounds) before approving a release.
As a human reviewer, I can approve or reject a release; only approved features move to "Shipped."
As an org admin, I want each workspace to have isolated data (users, repos, PRDs, billing).
As an org admin, I want to see AI review credit usage and upgrade plans via Razorpay when limits are hit.
As any user, I want to see real-time progress on long-running AI/GitHub jobs (e.g., "Analyzing PR diff...").

6. Core Workflow (The Loop)
Feature Request → Context Gathering (AI Q&A) → PRD Generation → Task Breakdown
   → Kanban Planning Approval → GitHub Repo Connected → PR Created
   → AI Code Review (vs PRD + criteria) → [Blocking Issues?] 
        → Yes: Fix Needed → Developer Updates → Re-Review (loop)
        → No: Ready for Human Review
   → Human Approval/Rejection → Shipped
Phase 1 — Product Discovery
Multi-channel intake (web form modeling email/ticket/call transcript input).
AI agent asks follow-up questions when request is incomplete or ambiguous.
AI checks existing PRDs/features in the workspace for duplicates; if a close match exists, it informs the user instead of generating a new PRD.
On confirmation, AI generates a structured PRD: Problem Statement, Goals, Non-Goals, User Stories, Acceptance Criteria, Edge Cases, Success Metrics.
Phase 2 — Planning
PRD is parsed into discrete engineering tasks (title, description, estimated complexity, linked acceptance criteria).
Tasks appear on a Kanban board (Backlog → In Progress → In Review → Done).
Eng lead reviews/edits/approves the task plan before development is considered "started."
Phase 3 — Development
Repo connected via Octokit/GitHub App install.
Developers or coding agents implement tasks and open PRs referencing the feature.
Webhooks capture PR open/sync/close events in real time.
Phase 4 — AI Review Loop
On PR open/update, an Inngest workflow triggers: fetch diff → analyze against PRD/acceptance criteria/tasks → check security, performance, edge cases, code quality.
Issues are tagged Blocking or Non-blocking, each with an explanation of why it's an issue and a suggested fix.
Review comments are posted back to the PR (GitHub) and stored in VelocityAI's review history.
If blocking issues exist → feature status becomes Fix Needed. On new commits, the loop re-triggers automatically (Re-Review).
When no blocking issues remain → status becomes Ready for Human Review.
Phase 5 — Human Approval & Release
Human reviewer sees a consolidated view: PRD, tasks, PR diff summary, full AI review history, any outstanding non-blocking issues.
Reviewer clicks Approve or Reject (with comments).
Approved features move to Shipped; rejected ones return to Fix Needed or Planning.

7. Functional Requirements by Module
7.1 Feature Requests
Create request (title, description, source channel, submitter).
AI clarification Q&A thread attached to the request.
Duplicate-detection check against existing workspace PRDs.
Status: New → Clarifying → PRD Generated → Planning → In Dev → In Review → Fix Needed → Ready for Approval → Shipped / Rejected.
7.2 PRD Editor
AI-generated draft, human-editable rich text/structured sections.
Versioning (track edits after AI generation).
Export/share PRD.
7.3 Task Board (Kanban)
Tasks auto-generated from PRD, linked to specific acceptance criteria.
Drag-and-drop status changes.
Assign to user; complexity/estimate field.
Approval gate before "Development" phase officially opens.
7.4 GitHub Integration
OAuth/GitHub App connection per workspace.
Repo selection & linking to a project.
Webhook receiver: pull_request.opened, synchronize, closed, push.
Fetch PR metadata, changed files, and diffs via Octokit — no hardcoded/mocked PR data.
Display PR status, linked feature, and commit history in-app.
7.5 AI Review Engine
Triggered via Inngest on PR open/update.
Inputs: PRD, acceptance criteria, task list, PR diff, changed files.
Outputs: categorized issues (Blocking/Non-blocking), rationale, suggested fix, confidence/severity.
Posts summary comment to GitHub PR + stores structured review record.
Supports multiple review rounds (history preserved, diffed against previous round).
7.6 Human Approval & Release
Consolidated release-readiness dashboard.
Approve/Reject action with mandatory comment on reject.
Immutable audit log of who approved, when, and against which review round.
"Shipped" marks feature complete; optional changelog entry.
7.7 Workspaces / Multi-Tenancy
Organization → Workspace → Projects hierarchy.
Per-workspace: users & roles (Admin/Eng Lead/Developer/Viewer), projects, repos, feature requests, PRDs, tasks, review history, billing status.
Role-based access control on sensitive actions (approve release, manage billing, connect repos).
7.8 Billing (Razorpay)
Free tier: limited AI review credits/month, 1 repo, basic workflow.
Paid tier(s): higher/unlimited AI credits, multiple repos, premium workflow features (e.g., custom review rules, priority queue).
Usage metering (AI review credits consumed per review round).
Razorpay checkout + webhook-driven subscription/plan status updates.
7.9 Async Workflows (Inngest)
Each of the following runs as a durable, retryable, observable background job:

PRD generation
Task generation
Repository analysis (on connect)
PR processing (fetch diff/files)
AI review + re-review
Release readiness checks
In-app job status/progress stream (e.g., step-by-step "Fetching diff → Running AI review → Posting comments").

8. Non-Functional Requirements
Type safety: end-to-end via tRPC across monorepo apps/packages.
Auditability: every AI decision (PRD, task, review) and human action (approve/reject) is logged and retrievable.
Reliability: async jobs must be retryable/idempotent (Inngest) — a failed AI review shouldn't corrupt state.
Security: GitHub tokens/webhook secrets stored securely; workspace data isolation enforced at the query layer.
Performance: PR diff analysis should scale to typical PR sizes; large diffs should be chunked for the AI SDK calls.
Extensibility: review rule set and PRD template should be workspace-configurable (stretch goal).
9. Success Metrics
Time from feature request → generated PRD (target: minutes, not hours).
% of feature requests that reach "Shipped" without manual PRD rewriting.
Average number of AI review rounds before human approval (lower is better, tracks code quality).
AI review issue precision (developer-confirmed valid blocking issues / total flagged).
Time from "Ready for Human Review" → Approved.
Workspace activation rate (repo connected + first PR reviewed) for new signups.

10. Edge Cases
Feature request is too vague even after 2–3 rounds of clarifying questions → escalate to "Needs Manual Definition" instead of forcing a PRD.
Requested feature already exists → inform user, link existing feature, do not generate duplicate PRD (unless user explicitly confirms they still want one).
PR opened against a task that has no linked PRD/acceptance criteria (e.g., hotfix) → allow "unlinked PR" review mode with reduced context.
GitHub webhook delivery failure/delay → reconciliation job periodically polls repo for missed events.
AI review service temporarily unavailable → job retries via Inngest with backoff; UI shows "Review pending" not a false pass.
Reviewer approves despite outstanding non-blocking issues → allowed, but issues are logged as "accepted debt" in the audit trail.
Free-tier AI credits exhausted mid-review-loop → block further AI reviews, prompt upgrade, allow human-only approval path.
Multiple developers pushing to the same PR concurrently → re-review debounced/queued, not run per-commit in parallel.

11. Technical Architecture
11.1 Monorepo Structure (tRPC Monorepo — Turborepo/pnpm workspaces)
apps/
  web/            → Next.js app (Shadcn UI, dashboard, all product pages)
  workers/         → Inngest functions (or hosted inside web via /api/inngest)
packages/
  api/            → tRPC routers (feature-requests, prds, tasks, github, reviews, billing, workspaces)
  db/             → Prisma or Drizzle schema + client
  auth/           → BetterAuth config & helpers
  ai/             → AI SDK wrappers: clarify, generate-PRD, generate-tasks, review-PR
  github/         → Octokit client, webhook verification, diff fetch helpers
  billing/        → Razorpay client, plan/credit logic
  ui/             → Shared Shadcn-based components
  config/         → eslint/tsconfig/tailwind shared config
11.2 Core Data Model (high level)
Organization 1—N Workspace
Workspace 1—N User (via membership + role), Project, Repository, FeatureRequest, BillingAccount
FeatureRequest 1—1 PRD; PRD 1—N Task
Repository 1—N PullRequest; PullRequest 1—N ReviewRound
ReviewRound 1—N ReviewIssue (blocking/non-blocking)
ApprovalDecision linked to FeatureRequest + ReviewRound (final human sign-off)
BillingAccount 1—N Subscription, CreditLedger entries
11.3 Key tRPC Routers
featureRequest.create / clarify / listByWorkspace
prd.generate / update / getVersionHistory
task.generateFromPRD / updateStatus / listByProject
github.connectRepo / listRepos / handleWebhookEvent (internal)
review.trigger / getHistory / postDecision
approval.approve / reject / getAuditTrail
billing.createCheckout / getUsage / webhookHandler
workspace.create / inviteUser / getSettings
11.4 AI SDK Usage Points
Clarifier agent — asks targeted follow-up questions, detects duplicates.
PRD generator — structured-output generation (problem, goals, non-goals, stories, criteria, edge cases, metrics).
Task planner — decomposes PRD into engineering tasks with acceptance-criteria links.
Repo analyzer — summarizes repo structure/stack on connect for review context.
PR reviewer — evaluates diff vs. PRD/criteria/tasks; outputs categorized issues + rationale.
Release-readiness checker — final pass summarizing whether the feature is production-ready.
11.5 Inngest Event Map (examples)
feature-request/created → run clarifier + duplicate check
prd/generation.requested → generate PRD → emit prd/generated
prd/approved → generate tasks → emit tasks/generated
github/pr.opened / github/pr.synchronized → fetch diff → run AI review → post comments → emit review/completed
review/completed (blocking issues found) → set status fix-needed
approval/decision.made → if approved, mark shipped, write changelog

12. Recommended Pages
Page	Purpose
Landing Page	Product marketing, pricing teaser
Auth (BetterAuth)	Sign up/login, org creation
Dashboard	Cross-project overview, active features, pending approvals
Workspace Management	Members, roles, repos, billing
Project View	Features, tasks, repos scoped to a project
Feature Request Detail	Clarification thread, status timeline
PRD Editor	AI draft + human edits, version history
Task Board	Kanban view
GitHub Integration	Connect/manage repos, webhook status
Pull Request Reviews	PR list, diff summary, AI review results
Review History	All rounds, blocking/non-blocking trend
Billing	Plan, usage, upgrade (Razorpay)
Final Approval & Release	Consolidated readiness view, approve/reject
13. Rollout / Milestone Plan (Hackathon-scoped)
Day 1: Monorepo scaffold, BetterAuth, workspace/org data model, tRPC base routers.
Day 2: Feature request intake + AI clarifier + PRD generation (AI SDK).
Day 3: Task generation + Kanban board; GitHub App connect + webhook receiver (Octokit).
Day 4: AI review engine (Inngest) + fix/re-review loop + review history UI.
Day 5: Human approval flow + Razorpay billing (plans/credits) + polish/landing page.
Day 6: Deploy to Vercel, record demo video, finalize README, social posts.

14. Deliverables Checklist
 Public GitHub repo (monorepo)
 Live deployed app (Vercel)
 Demo video
 README (overview, stack, architecture, setup, env vars, DB schema notes, GitHub integration setup, Inngest workflow explanation, AI features)
 LinkedIn + X/Twitter launch post tagging ChaiCode, Hitesh Sir, Piyush, with hashtag #chaicode and the line "Builder Mode On | iPhone Giveaway Hackathon"
 
15. Risks & Open Questions
Risk: AI review false positives could frustrate developers — mitigate with confidence scoring + non-blocking bucket.
Risk: GitHub webhook reliability in a hackathon timeframe — mitigate with polling fallback.
Open question: Should free-tier users be able to connect private repos, or public-only?
Open question: Does "duplicate feature" detection compare against PRDs in the same workspace only, or org-wide?
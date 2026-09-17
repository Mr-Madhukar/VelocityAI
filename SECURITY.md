# Security Policy

We take the security of VelocityAI and its users' code seriously. This document explains
how to report a vulnerability and the security model the app is built on.

---

## Reporting a vulnerability

**Please do not open a public issue for security problems.**

- Email **security@velocityai.in** (or the maintainer at the address in the repo profile)
  with a description, reproduction steps, and impact.
- Use GitHub's **private "Report a vulnerability"** (Security advisories) on the repo if
  you prefer.

We aim to acknowledge within **72 hours**, provide a remediation timeline after triage,
and credit reporters who want it once a fix ships. Please give us a reasonable window to
fix before any public disclosure.

### In scope
Authentication/session handling, multi-tenant data isolation, webhook signature
verification, billing/credit enforcement, the GitHub App integration, and the Copilot
draft-PR path.

### Out of scope
Findings that require a compromised host/browser, social engineering, rate-limit/volumetric
reports without an underlying vulnerability, and issues in third-party services
(GitHub, OpenAI, Razorpay, Pusher, Vercel) — report those upstream.

---

## Security model

**Authentication & sessions**
- Auth is handled by **BetterAuth** (email/password + GitHub & Google OAuth), with
  the organization plugin for multi-tenancy.
- Protected routes are gated by edge **middleware** (`apps/web/middleware.ts`): an
  optimistic session-cookie check redirects unauthenticated requests to `/sign-in`.
  The authoritative check is `requireAuth()` in the protected layout (real DB session
  lookup).
- Protected responses are sent with **`Cache-Control: no-store`** so the browser cannot
  restore an authenticated page from the back/forward cache after sign-out. Sign-out
  performs a hard navigation to clear the client router cache.

**Multi-tenant isolation**
- Every domain table carries an `organization_id`; access goes through
  `orgProcedure`/explicit org-ownership checks (including the review `resolveIssue`
  mutation and all Copilot server actions).
- Pusher private channels (`private-org-{id}`) are authorized against real DB
  membership in `/api/pusher/auth`.

**Webhooks**
- **GitHub**: `x-hub-signature-256` is verified against `GITHUB_WEBHOOK_SECRET` before
  any processing.
- **Razorpay**: the HMAC `x-razorpay-signature` is verified, and delivery is
  **idempotent** — each `x-razorpay-event-id` is recorded in `processed_webhook_event`
  so retries/duplicates apply once.

**Billing enforcement**
- AI-review credits are **metered and blocked** server-side before any AI work; the
  repository limit is enforced on connect. Out-of-credit reviews fail terminally
  (no retry/re-charge).

**Secrets & least privilege**
- GitHub access uses a **GitHub App** (org-scoped, least-privilege installation
  tokens), not personal access tokens.
- Secrets live only in environment variables (`.env` is git-ignored; `turbo.json`
  `globalEnv` documents the surface). Never commit credentials. If a secret is exposed,
  rotate it at the provider immediately.

**Dependencies**
- Keep dependencies current; CI runs install with a frozen lockfile and the full
  test/type/lint/build gates on every PR.

---

## Supported versions

VelocityAI is delivered as a continuously deployed application
(<https://VelocityAI.in>); security fixes land on `main` and ship to production. There is
no separate LTS branch.

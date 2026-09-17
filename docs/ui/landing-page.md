# Build Prompt — Landing Page Redesign (VelocityAI)

> First page in the page-by-page UI revamp. Source of truth for the landing page **and** the
> shared theming foundation every later page reuses. Status: approved, ready to build. 2026-06-29.

## Decision (locked by product owner)

- **Design direction:** **"Linear-grade / technical-blueprint"** — dark-first, monochrome
  surfaces + a single electric accent, real product UI rendered as isometric line-art, mono
  annotations, restrained glows. Inverts to a clean premium **light mode**.
- **Brand accent:** **Amber/orange (primary/interactive) + Emerald (success: passed/approved/shipped)**,
  standardized app-wide. *(Updated 2026-06-29: reverted from cyan back to amber — read every "cyan"
  below as "amber". Primary uses a dark foreground for AA contrast on amber.)*
- **Shape language:** **SQUARE / SHARP — `border-radius: 0`** everywhere, like better-auth.com.
  No rounded corners, no pills. Tags, buttons, inputs, cards, nav = hairline-bordered rectangles.
- **Typography:** **Geist** (sans) for headings/body, **Geist Mono** for labels/tags/annotations/
  code/links — both **Regular (400)** as the base weight. Build hierarchy from **scale + opacity +
  mono**, not heavy weights (Medium/500 is the max for display; no bold/700 blocks).
- **Opacity:** deliberate **mix of full and low opacity** is a core device (see §1.6).
- **Modes:** ship **both light + dark**, system-aware, manual toggle; dark is default.

## Inspiration (reference only — build our own, our theme)

Images live in `e:\ShipFlow\learning\UI\`. We take composition/technique, not colors or copy:
- `hero.png` (Runlayer) · `below_hero.png` (LangSmith) · `feature.png` (Raycast) · `Below_footer.png` (LangChain).
- Shared language across all four: near-black bg, thin glowing **line-art / isometric blueprint**
  illustrations, **monospace** technical labels (`FIG_0X`, node tags), oversized type, and
  **mixed-opacity** layering. We map each to a section in §2.

## Design principles

1. **Simple but expensive** — generous negative space, one accent, hierarchy via scale+opacity.
2. **Show the product as a schematic** — the Clarify→PRD→Tasks→Review pipeline rendered as
   isometric wireframe line-art, not stock illustration.
3. **Technical/blueprint texture** — faint grid, `FIG_0X` mono captions, leader-line labels.
4. **Subtle motion only** — line-draw, scroll-reveal, magnetic CTA, cursor glow; all respect
   `prefers-reduced-motion`.
5. **Token-driven** — no hardcoded hex; light/dark + later pages inherit from CSS variables.

---

## Part 1 — Theming foundation (prerequisite, build first)

### 1.1 Tokens — `apps/web/app/globals.css`
Replace the grayscale palette with cyan/emerald; keep shadcn variable names. Targets in `oklch`
(tune for **WCAG AA** during build):

**Dark (`.dark`)**
- `--background: oklch(0.15 0.006 240)` · `--foreground: oklch(0.98 0 0)`
- `--card: oklch(0.19 0.008 240)` · `--popover: oklch(0.18 0.008 240)`
- `--muted: oklch(0.27 0.008 240)` · `--muted-foreground: oklch(0.70 0.02 230)`
- `--border: oklch(1 0 0 / 10%)` · `--input: oklch(1 0 0 / 14%)`
- `--primary: oklch(0.80 0.13 195)` (cyan) · `--primary-foreground: oklch(0.18 0.02 220)`
- `--ring: oklch(0.80 0.13 195 / 55%)`
- `--success: oklch(0.72 0.15 162)` (emerald) · `--success-foreground: oklch(0.18 0.02 160)`
- `--glow-primary: oklch(0.80 0.13 195 / 18%)` · `--glow-success: oklch(0.72 0.15 162 / 12%)`

**Light (`:root`)**
- `--background: oklch(0.99 0.002 230)` · `--foreground: oklch(0.20 0.02 240)`
- `--card: oklch(1 0 0)` · `--muted: oklch(0.96 0.004 230)` · `--muted-foreground: oklch(0.48 0.02 235)`
- `--border: oklch(0.90 0.006 235)` · `--input: oklch(0.90 0.006 235)`
- `--primary: oklch(0.60 0.13 215)` · `--primary-foreground: oklch(0.99 0 0)`
- `--success: oklch(0.58 0.14 162)` · glow tokens ≈8–10% alpha.

### 1.2 Square shape language — **set `--radius: 0rem`**
All derived `--radius-*` collapse to 0. In components, replace every `rounded-*` with
`rounded-none` (or delete). Hairline borders (`border border-border`) do the visual separation.

### 1.3 `@theme inline`
Add `--color-success`, `--color-success-foreground`, `--glow-primary`, `--glow-success` so
`bg-success`, `text-success`, etc. work as utilities.

### 1.4 Theme provider — `apps/web/providers/global.tsx`
Remove `forcedTheme="dark"`; add `enableSystem`; keep `defaultTheme="dark"`, `attribute="class"`,
`disableTransitionOnChange`.

### 1.5 Root layout — `apps/web/app/layout.tsx`
- `<html>`: drop hardcoded `className="dark"` (next-themes owns it); keep `suppressHydrationWarning`.
- `<body>`: replace `bg-[#0a0a0a] text-white selection:bg-orange-500/30 …` with
  `bg-background text-foreground selection:bg-primary/25 selection:text-foreground`.
- Confirm `--font-geist-sans` / `--font-geist-mono` are mapped to Tailwind `font-sans` / `font-mono`
  (add to `@theme inline` if missing) so Geist Mono is a first-class utility.

### 1.6 Opacity layering scale (document + reuse)
- **Surfaces:** base `bg-card`, raised `bg-foreground/[0.03]`, hover `bg-foreground/[0.06]`.
- **Borders:** hairline `border-border` (≈10%), emphasis `border-foreground/20`.
- **Text:** primary = `text-foreground`; secondary = `text-muted-foreground`; ghost/decorative =
  `text-foreground/40` and below (e.g., the footer wordmark). Highlight words in a heading sit at
  full opacity while the rest of the line drops to `~/55` (the LangSmith effect).

### 1.7 Global background — `apps/web/components/animated-background.tsx`
Remove hardcoded `#0a0a0a` → transparent/`bg-background`. Grid + orbs read from tokens; orbs become
**cyan + emerald** (no orange) and dim in light mode. Grid is a faint square blueprint lattice.

### 1.8 New component — `apps/web/components/theme-toggle.tsx`
Square icon button (Sun/Moon, lucide), animated swap, `useTheme()`, mounted-guard (no flash),
accessible label. Lives in nav + later the app shell.

---

## Part 2 — Landing sections (maps to the inspiration images)

Files: rewrite `apps/web/app/_components/landing-page.tsx`; extract sections into
`apps/web/app/_components/landing/` (e.g., `nav.tsx`, `hero.tsx`, `pipeline-connector.tsx`,
`feature-schematic.tsx`, `metrics.tsx`, `cta.tsx`, `footer.tsx`) and SVG illustrations into
`landing/illustrations/`.

1. **Nav** — logo left, center/right mono links (Features · PRDs · Reviews · Pricing), ThemeToggle,
   square "Sign in" button (solid foreground-on-bg, shine-sweep recolored cyan). Hairline bottom
   border or floating square bar. Mobile → square sheet menu.

2. **Hero** *(ref hero.png)* — left: oversized Geist headline
   "Turn feature ideas into **shipped code.**" (highlight word full opacity, rest `~/55`); mono
   subcopy; two **square** CTAs ("Generate first PRD" solid cyan; "Watch a PR review" ghost). Right:
   **isometric exploded-layer schematic** of the VelocityAI pipeline — stacked translucent panels
   (Clarify / PRD / Tasks / Review) connected by thin cyan lines, a glowing cyan node at center,
   square mono tags (`CLARIFY`, `PRD`, `TASKS`, `REVIEW`) on leader lines. Cursor-aware glow behind.

3. **Connected workflow canvas — the centerpiece explainer**
   *(ref conneting_flow_with_AI.png; n8n-style node graph)* — a node canvas that shows how VelocityAI
   connects your stack, with **data visibly flowing through the connectors**. This merges the old
   converging-line connector AND the scrollytelling walkthrough into one section: a connected diagram
   that *also* sequences like a guided video.
   - **Left persona rail** (mixed opacity; active = square card + cyan left-accent bar, rest muted):
     `Product teams can` — turn messy requests into PRDs · `Engineering can` — get PRD-aligned tasks +
     AI PR review · `Leads can` — gate releases on requirement coverage · `Clients can` — watch an idea
     become shipped software. Selecting one highlights the relevant nodes/path.
   - **Main happy-path (solid connectors; pulses travel L→R):**
     `⚡ Feature request` → **VelocityAI AI hub** → `PRD` → `Tasks` → `GitHub PR` → decision
     **"PRD satisfied?"** → **passed** → `Approve` → `Ship 🚀` (emerald); **changes requested** →
     `Blockers` → loops back to `Tasks` (cyan).
   - **Attached capabilities (dashed connectors from the hub, diamond joints):**
     `Model` → OpenAI · `Memory` → PostgreSQL · `Tools` → GitHub · Inngest · Pusher · Resend · Razorpay.
     Dashes **flow toward the hub** (data ingest) via animated `stroke-dashoffset`.
   - **Shapes:** every node is a **sharp square** (no circles — honor `--radius:0`); junctions are
     **diamonds** (rotated squares); active node = cyan glow + border emphasis; terminal `Ship` = emerald.
     Node captions + branch labels (`passed` / `changes requested`) in **Geist Mono**.
   - **Sequencing:** on scroll-into-view and on persona change, pulses fire along the path and nodes
     activate in staggered order; the branch lights up; loops subtly (`useScroll` + in-view triggers).
   - **Degrade:** `prefers-reduced-motion` / mobile → static connected diagram (no traveling pulses, no
     flowing dashes); persona rail still switches the highlighted path; stacks vertically on small screens.

4. **Feature schematics** *(ref feature.png)* — faint square blueprint grid background. 2–3 stacked
   blocks, each: left = big Geist headline + mono body + mono link ("Read the spec ↗"); right =
   isometric wireframe of a real VelocityAI surface with `FIG_0X` caption and mono leader-line labels
   (e.g. `ACCEPTANCE CRITERIA`, `DIFF`, `VERDICT`, `BLOCKER`). One layer highlighted cyan; emerald on
   the "passed" verdict. Topics: PRD generation · PRD-aware PR review · GitHub sync.

5. **Metrics band** — the 4 metric cards as square hairline tiles, count-up on scroll-in, mono labels.

6. **Final CTA** — full-width square panel, cyan glow wash, single primary CTA + ghost secondary.

7. **Footer + ghost wordmark** *(ref Below_footer.png)* — compact mono link columns, then an
   **oversized outlined "VelocityAI" logotype** (stroke-only, `text-foreground/10–15`, transparent
   fill) spanning the width. Bottom row: left `● All systems operational` (emerald dot + mono),
   right `Privacy policy   Terms of service` (mono links).

---

## Part 3 — Motion & smoothness (locked: SVG + scroll, **no Three.js**)

**Stack**
- **framer-motion** (already installed) — entrances, hovers, `useScroll`/`useTransform` for the
  scrollytelling walkthrough and line-draw.
- **Lenis** (new dep, ~3kb) — inertial smooth scroll; the biggest perceived-smoothness win. Wire a
  single app-level instance, rAF-driven; **disable when `prefers-reduced-motion`**.
- **SVG/Canvas** for all illustrations (hero isometric, converging connector, `FIG_0X` schematics).
  No WebGL / Three.js / R3F — decided against for bundle, mobile cost, and on-brand crispness.

**Patterns**
- Variants: `fadeUp`, `staggerChildren`, `scaleIn`; **SVG path line-draw** (`pathLength` 0→1) for
  connectors + schematic leader lines.
- **Data-flow on the workflow canvas (§2.3):** traveling **pulse dots** along solid SVG paths
  (`offset-path` / `animateMotion`, or framer `useMotionValue` sampled along the path); **flowing
  dashes** on the integration links via animated `stroke-dashoffset` (toward the hub); staggered node
  activation as pulses arrive. Pause when offscreen; persona change re-triggers the sequence.
- Hover: magnetic primary CTA, cyan cursor-follow glow on hero panel, count-up metrics on scroll-in.
- Easing: spring entrances (stiffness ~300, damping ~24); 150–250ms hovers.

**Smoothness guardrails (the "how it stays 60fps")**
- Animate **only `transform` + `opacity`** — never layout props or `box-shadow` on scroll.
- Lazy-mount below-the-fold scenes; start/stop with `IntersectionObserver`; `will-change` only while active.
- No heavy work in scroll handlers — let framer/Lenis manage rAF timelines.
- Target **60fps on a mid-range phone**; the pinned walkthrough must not jank or trap scroll.
- **Reduced motion:** render final states only — no transforms, no line-draw, no autoplay, Lenis off,
  walkthrough falls back to a static stacked sequence.

## Part 4 — Acceptance criteria
- [ ] Light **and** dark render correctly; system-aware; toggle persists; no hydration flash.
- [ ] **Zero rounded corners** — `--radius: 0`, no `rounded-*` in landing/nav/footer; pills replaced
      by squares.
- [ ] **Zero orange** reachable from landing (grep `orange`); accent cyan, success emerald.
- [ ] Only **Geist + Geist Mono** used; base weight Regular; mono drives labels/tags/annotations.
- [ ] **Mixed-opacity** layering present (surfaces, borders, ghost wordmark, highlight-word headings).
- [ ] No hardcoded bg/fg hex in landing/layout — all tokens. WCAG AA contrast both modes.
- [ ] Responsive 360px → ultrawide; nav collapses; hero/schematics stack gracefully.
- [ ] **No Three.js/WebGL** in the bundle; illustrations are SVG/Canvas.
- [ ] Connected-workflow canvas: pulses animate along solid connectors and dashes flow on integration
      links; nodes activate in sequence; persona rail switches the highlighted path; nodes are squares,
      junctions are diamonds; degrades to a static diagram on reduced-motion / small screens.
- [ ] Lenis smooth scroll active, disabled under `prefers-reduced-motion`; holds ~60fps on mid mobile.
- [ ] Gates green: `pnpm lint` (web `--max-warnings 0`), `pnpm check-types`, `pnpm build`. No CLS.

## Out of scope (later pages, same system)
Dashboard, features, PRD, tasks, reviews, GitHub, settings/team, billing, auth, profile — each gets
its own spec reusing these tokens, shapes, type, and motion.

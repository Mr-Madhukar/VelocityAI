"use client";

import { motion } from "framer-motion";
import {
  Bot,
  BotMessageSquare,
  Check,
  Copy,
  Download,
  FileText,
  GitPullRequestArrow,
  ListChecks,
  Share2,
  ShieldCheck,
  Sparkles,
  Terminal,
  Workflow,
  type LucideIcon,
} from "lucide-react";
import { SiGithub } from "react-icons/si";

import { cn } from "@/lib/utils";

/**
 * Feature wall — Pinterest-style masonry of technical cards, one per product
 * capability. Built from explicit flex columns (not CSS multicol, which
 * reflows unpredictably and fights framer-motion transforms) so gaps stay
 * even and each column is hand-balanced by card height.
 */

function Fig({ tag, children }: { tag: string; children: React.ReactNode }) {
  return (
    <div className="relative mt-4 overflow-hidden border border-border bg-foreground/[0.02] p-3.5">
      <span className="pointer-events-none absolute right-2.5 top-2 font-mono text-[8.5px] uppercase tracking-[0.2em] text-muted-foreground/45">
        {tag}
      </span>
      <div className="mt-3">{children}</div>
    </div>
  );
}

/* ================= figures ================= */

function VizPrd() {
  return (
    <div>
      <div className="flex items-center justify-between">
        <p className="font-mono text-[8.5px] uppercase tracking-[0.16em] text-primary">
          Product requirements document
        </p>
        <span className="border border-border px-1.5 py-0.5 font-mono text-[8px] text-muted-foreground">v1</span>
      </div>
      <p className="mt-2 text-xs font-medium text-foreground/90">Dark mode toggle</p>
      <div className="mt-2 space-y-1.5">
        {["92%", "78%", "86%", "60%"].map((w, i) => (
          <motion.div
            key={i}
            initial={{ scaleX: 0 }}
            whileInView={{ scaleX: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.3 + i * 0.15, duration: 0.5 }}
            style={{ width: w }}
            className="h-1.5 origin-left bg-foreground/12"
          />
        ))}
      </div>
      <div className="mt-3 flex items-center gap-2 border-t border-border pt-2.5">
        <span className="inline-flex items-center gap-1 border border-success/40 bg-success/10 px-1.5 py-0.5 font-mono text-[8.5px] uppercase tracking-widest text-success">
          <Check className="size-2.5" /> approved
        </span>
        <span className="font-mono text-[8.5px] text-muted-foreground">3 acceptance criteria</span>
      </div>
    </div>
  );
}

function VizScore() {
  const R = 30;
  const C = 2 * Math.PI * R;
  return (
    <div className="flex items-center gap-4">
      <div className="relative">
        <svg width="84" height="84" viewBox="0 0 84 84" className="-rotate-90">
          <circle cx="42" cy="42" r={R} fill="none" strokeWidth="5" className="stroke-foreground/10" />
          <motion.circle
            cx="42"
            cy="42"
            r={R}
            fill="none"
            strokeWidth="5"
            strokeLinecap="square"
            className="stroke-primary"
            strokeDasharray={C}
            initial={{ strokeDashoffset: C }}
            whileInView={{ strokeDashoffset: C * (1 - 0.92) }}
            viewport={{ once: true, margin: "-40px" }}
            transition={{ duration: 1.3, ease: "easeOut", delay: 0.3 }}
          />
        </svg>
        <div className="absolute inset-0 grid place-items-center">
          <div className="text-center">
            <p className="font-[family-name:var(--font-display)] text-lg leading-none text-foreground">92</p>
            <p className="font-mono text-[7px] uppercase tracking-widest text-muted-foreground">score</p>
          </div>
        </div>
      </div>
      <div className="flex-1 space-y-1.5">
        {[
          ["Criteria met", "3/3"],
          ["Security", "pass"],
          ["Blocking findings", "0"],
        ].map(([k, v]) => (
          <div key={k} className="flex items-center justify-between border-b border-border/60 pb-1 font-mono text-[9px]">
            <span className="text-muted-foreground">{k}</span>
            <span className="text-foreground/85">{v}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function VizTasks() {
  const tasks = [
    ["Add theme context + persistence", "2h"],
    ["Build toggle component", "3h"],
    ["Audit contrast tokens", "2h"],
  ];
  return (
    <div className="space-y-1.5">
      {tasks.map(([t, h], i) => (
        <motion.div
          key={t}
          initial={{ opacity: 0, x: -8 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.3 + i * 0.15 }}
          className="flex items-center justify-between gap-2 border border-border/70 bg-card/50 px-2 py-1.5"
        >
          <span className="flex min-w-0 items-center gap-1.5 font-mono text-[9px] text-foreground/85">
            <span className="grid size-3 shrink-0 place-items-center border border-success/50 bg-success/10">
              <Check className="size-2 text-success" />
            </span>
            <span className="truncate">{t}</span>
          </span>
          <span className="shrink-0 border border-border px-1 py-px font-mono text-[7.5px] text-muted-foreground">{h}</span>
        </motion.div>
      ))}
      <p className="pt-1 font-mono text-[8.5px] text-muted-foreground">
        Sized, ordered, and assignable — generated from the approved PRD.
      </p>
    </div>
  );
}

function VizPrompt() {
  return (
    <div>
      <div className="flex items-center justify-between border border-border bg-background/60 px-2 py-1.5">
        <span className="font-mono text-[8.5px] uppercase tracking-widest text-muted-foreground">
          prompt · build-toggle-component
        </span>
        <Copy className="size-3 text-muted-foreground" />
      </div>
      <div className="border border-t-0 border-border bg-background/40 p-2.5 font-mono text-[9px] leading-relaxed text-muted-foreground">
        <p><span className="text-primary">You are implementing</span> task 2 of PRD v1</p>
        <p>&quot;Dark mode toggle&quot;. Constraints:</p>
        <p>- persist theme across sessions</p>
        <p>- respect prefers-color-scheme</p>
        <p>Acceptance criteria: <span className="text-foreground/80">3 attached</span> …</p>
      </div>
    </div>
  );
}

function VizModels() {
  const models = [
    { name: "Claude", role: "AI score · review verification", tone: "text-primary border-primary/40 bg-primary/[0.06]" },
    { name: "GPT", role: "PRD drafting · task breakdown", tone: "text-foreground/80 border-border bg-foreground/[0.04]" },
  ];
  return (
    <div className="space-y-1.5">
      {models.map((m, i) => (
        <motion.div
          key={m.name}
          initial={{ opacity: 0, y: 6 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.3 + i * 0.18 }}
          className="flex items-center justify-between border border-border/70 bg-card/50 px-2 py-2"
        >
          <span className={cn("border px-1.5 py-0.5 font-mono text-[8.5px] uppercase tracking-widest", m.tone)}>
            {m.name}
          </span>
          <span className="font-mono text-[8.5px] text-muted-foreground">{m.role}</span>
        </motion.div>
      ))}
      <p className="pt-1 font-mono text-[8.5px] text-muted-foreground">
        Provider-agnostic core — each job routed to the model that does it best.
      </p>
    </div>
  );
}

function VizAgent() {
  const files = [
    ["app/api/todos/route.ts", "create"],
    ["components/todo-list.tsx", "create"],
    ["lib/db/schema.ts", "modify"],
  ] as const;
  return (
    <div className="font-mono text-[9px] leading-relaxed">
      {/* the ask */}
      <p>
        <span className="text-primary">you ▸</span>{" "}
        <span className="text-foreground/85">implement the approved PRD, tasks 1–3</span>
      </p>

      {/* files stream in one by one, each flipping to written */}
      <div className="mt-2 space-y-1">
        {files.map(([path, action], i) => (
          <motion.div
            key={path}
            initial={{ opacity: 0, x: -8 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.35 + i * 0.35 }}
            className="flex items-center justify-between gap-2 border border-border/70 bg-card/50 px-2 py-1"
          >
            <span className="truncate text-foreground/80">{path}</span>
            <span className="flex shrink-0 items-center gap-1.5">
              <span className="border border-border px-1 py-px text-[7.5px] uppercase text-muted-foreground">
                {action}
              </span>
              <motion.span
                initial={{ opacity: 0, scale: 0.6 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ delay: 0.65 + i * 0.35 }}
                className="text-success"
              >
                ✔
              </motion.span>
            </span>
          </motion.div>
        ))}
      </div>

      {/* the payoff — a ready-to-review PR */}
      <motion.p
        initial={{ opacity: 0, y: 4 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ delay: 1.6 }}
        className="mt-2 flex items-center gap-1.5 border-t border-border pt-2 text-success"
      >
        <GitPullRequestArrow className="size-3" />
        PR #142 opened — VelocityAI-agent/todo-crud
      </motion.p>
    </div>
  );
}

function VizCli() {
  return (
    <div className="font-mono text-[9.5px] leading-relaxed">
      <p>
        <span className="text-primary">$</span> <span className="text-foreground/90">npm i -g VelocityAI</span>
      </p>
      <p>
        <span className="text-primary">$</span> <span className="text-foreground/90">VelocityAI prd approve 0b75cf3a</span>
      </p>
      <p className="text-success">✔ approved — task generation triggered</p>
      <p>
        <span className="text-primary">$</span> <span className="text-foreground/90">VelocityAI review watch</span>
        <span className="animate-pulse text-primary">▍</span>
      </p>
    </div>
  );
}

function VizShare() {
  return (
    <div>
      <div className="flex gap-1.5">
        <span className="flex flex-1 items-center justify-center gap-1.5 border border-border bg-foreground/[0.04] px-2 py-1.5 font-mono text-[8.5px] uppercase tracking-widest text-foreground/85">
          <Download className="size-2.5" /> PDF
        </span>
        <span className="flex flex-1 items-center justify-center gap-1.5 border border-primary/40 bg-primary/[0.06] px-2 py-1.5 font-mono text-[8.5px] uppercase tracking-widest text-primary">
          <Share2 className="size-2.5" /> Share link
        </span>
      </div>
      <p className="mt-2 font-mono text-[8.5px] text-muted-foreground">
        Rendered PDF export + shareable links, straight from the PRD view.
      </p>
    </div>
  );
}

function VizGithub() {
  return (
    <svg viewBox="0 0 220 74" className="h-[68px] w-full" fill="none">
      <line x1="24" y1="68" x2="24" y2="6" className="stroke-border" strokeWidth="2" />
      <circle cx="24" cy="58" r="3" className="fill-muted-foreground/40" />
      <circle cx="24" cy="34" r="3" className="fill-muted-foreground/40" />
      <motion.path
        d="M24 58 C 62 58 54 18 100 18 C 148 18 142 34 186 34"
        className="stroke-primary/70"
        strokeWidth="1.8"
        initial={{ pathLength: 0 }}
        whileInView={{ pathLength: 1 }}
        viewport={{ once: true, margin: "-40px" }}
        transition={{ duration: 1.4, ease: "easeOut", delay: 0.3 }}
      />
      <circle cx="100" cy="18" r="4.5" className="fill-none stroke-primary" strokeWidth="1.8" />
      <circle cx="186" cy="34" r="4" className="fill-success" />
      <text x="92" y="8" className="fill-muted-foreground font-mono text-[8px] uppercase tracking-widest">
        pr #128
      </text>
      <text x="174" y="52" className="fill-success font-mono text-[8px] uppercase tracking-widest">
        merged
      </text>
    </svg>
  );
}

function VizJobs() {
  return (
    <div className="flex items-center gap-0 overflow-x-auto py-0.5">
      {["prd.generate", "tasks.breakdown", "review.run"].map((job, i, arr) => (
        <div key={job} className="flex shrink-0 items-center">
          <span
            className={cn(
              "border px-2 py-1 font-mono text-[8.5px] uppercase tracking-widest",
              i === arr.length - 1 ? "border-success/40 text-success" : "border-primary/30 text-primary/90",
            )}
          >
            {job}
          </span>
          {i < arr.length - 1 && (
            <svg width="26" height="10" className="shrink-0">
              <line x1="0" y1="5" x2="26" y2="5" strokeWidth="1.5" className="flow-dash stroke-primary/40" />
            </svg>
          )}
        </div>
      ))}
    </div>
  );
}

/* ================= cards ================= */

type CardDef = {
  icon: LucideIcon | null;
  brand?: boolean;
  title: string;
  body: string;
  tag: string;
  viz: React.ReactNode;
};

const CARDS: CardDef[] = [
  {
    icon: BotMessageSquare,
    title: "BYOK coding agent",
    body: "Bring your own OpenAI, Anthropic, or Gemini key and chat the approved PRD into code — files stream live and land as a ready-to-review PR.",
    tag: "agent.byok",
    viz: <VizAgent />,
  },
  {
    icon: FileText,
    title: "PRD generation",
    body: "One rough ask in — a structured, versioned spec out: goals, non-goals, user stories, and acceptance criteria your team can approve.",
    tag: "prd.gen",
    viz: <VizPrd />,
  },
  {
    icon: ShieldCheck,
    title: "PR review & scoring",
    body: "Every pull request is reviewed against the approved PRD and scored — compliance, security, and correctness gate the release.",
    tag: "review.score",
    viz: <VizScore />,
  },
  {
    icon: Sparkles,
    title: "Implementation prompts",
    body: "Every feature and task ships with a ready-to-paste prompt — context, constraints, and criteria included, for your editor or agent.",
    tag: "prompt.copy",
    viz: <VizPrompt />,
  },
  {
    icon: ListChecks,
    title: "Task creation",
    body: "The approved PRD breaks itself into sized engineering tasks with estimates and a drag-and-drop board.",
    tag: "tasks.gen",
    viz: <VizTasks />,
  },
  {
    icon: Terminal,
    title: "CLI for developers",
    body: "The full pipeline from your terminal — same account, same review gates. Pipe --json output into CI.",
    tag: "npm.VelocityAI",
    viz: <VizCli />,
  },
  {
    icon: Bot,
    title: "Multi-model AI",
    body: "Claude verifies and scores reviews; GPT drafts specs and tasks. One agentic core, the right model per job.",
    tag: "ai.router",
    viz: <VizModels />,
  },
  {
    icon: null,
    brand: true,
    title: "GitHub-native",
    body: "Branch-name matching auto-links PRs to features; every new commit re-triggers the spec review.",
    tag: "gh.sync",
    viz: <VizGithub />,
  },
  {
    icon: Share2,
    title: "PRD share & export",
    body: "Hand the spec to stakeholders — download a rendered PDF or share the live document.",
    tag: "prd.export",
    viz: <VizShare />,
  },
  {
    icon: Workflow,
    title: "Durable background jobs",
    body: "Generation, breakdown, and reviews run as resumable workflows — crashed steps retry, nothing is lost.",
    tag: "jobs.durable",
    viz: <VizJobs />,
  },
];

const CARD_BY_TAG = new Map(CARDS.map((c) => [c.tag, c]));

/**
 * Column layouts per breakpoint — order reads left-to-right across the top
 * row, and cards are placed so column bottoms land close together.
 */
const COLUMNS_LG: string[][] = [
  ["agent.byok", "prompt.copy", "ai.router"],
  ["prd.gen", "tasks.gen", "prd.export"],
  ["review.score", "npm.VelocityAI", "gh.sync", "jobs.durable"],
];

const COLUMNS_SM: string[][] = [
  ["agent.byok", "review.score", "tasks.gen", "ai.router", "prd.export"],
  ["prd.gen", "prompt.copy", "npm.VelocityAI", "gh.sync", "jobs.durable"],
];

function Card({ card, delay }: { card: CardDef; delay: number }) {
  const Icon = card.icon;
  return (
    <motion.div
      initial={{ opacity: 0, y: 18 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-50px" }}
      transition={{ duration: 0.5, delay }}
      className="neon-card p-5"
    >
      <div className="flex items-center gap-3">
        <span className="grid size-9 shrink-0 place-items-center border border-border bg-foreground/[0.04] text-primary">
          {card.brand ? <SiGithub className="size-4 text-foreground" /> : Icon ? <Icon className="size-4" /> : null}
        </span>
        <p className="font-[family-name:var(--font-display)] text-[15px] font-medium">{card.title}</p>
      </div>
      <p className="mt-3 font-mono text-xs leading-relaxed text-muted-foreground">{card.body}</p>
      <Fig tag={card.tag}>{card.viz}</Fig>
    </motion.div>
  );
}

function Wall({ columns, className }: { columns: string[][]; className: string }) {
  return (
    <div className={cn("mt-10 gap-4", className)}>
      {columns.map((col, ci) => (
        <div key={ci} className="flex min-w-0 flex-col gap-4">
          {col.map((tag) => {
            const card = CARD_BY_TAG.get(tag);
            return card ? <Card key={tag} card={card} delay={ci * 0.06} /> : null;
          })}
        </div>
      ))}
    </div>
  );
}

export function FeatureBento() {
  return (
    <section id="features" className="mt-32 w-full scroll-mt-24 px-3 sm:px-5">
      <div className="mx-auto w-full max-w-6xl">
      <div className="max-w-2xl">
        <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-primary">Everything included</p>
        <h2 className="mt-4 font-[family-name:var(--font-display)] text-3xl tracking-tight sm:text-4xl">
          Not just a chat box —{" "}
          <span className="font-[family-name:var(--font-serif)] italic text-foreground/60">
            a delivery system.
          </span>
        </h2>
        <p className="mt-4 font-mono text-sm leading-relaxed text-muted-foreground">
          Every capability in the pipeline, from the first rough ask to the release gate.
        </p>
      </div>

      {/* masonry wall — one layout per breakpoint so columns stay balanced */}
      <div className="mt-10 flex flex-col gap-4 sm:hidden">
        {CARDS.map((card) => (
          <Card key={card.tag} card={card} delay={0} />
        ))}
      </div>
      <Wall columns={COLUMNS_SM} className="hidden grid-cols-2 sm:grid lg:hidden" />
      <Wall columns={COLUMNS_LG} className="hidden grid-cols-3 lg:grid" />

      {/* quiet proof line */}
      <div className="mt-4 flex flex-wrap items-center justify-center gap-x-8 gap-y-2 border border-border bg-foreground/[0.02] px-6 py-4 font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
        <span className="flex items-center gap-2">
          <GitPullRequestArrow className="size-3 text-primary" /> Reviews on every commit
        </span>
        <span className="flex items-center gap-2">
          <ShieldCheck className="size-3 text-primary" /> Server-enforced credits
        </span>
        <span className="flex items-center gap-2">
          <Sparkles className="size-3 text-primary" /> One agentic core
        </span>
      </div>
      </div>
    </section>
  );
}

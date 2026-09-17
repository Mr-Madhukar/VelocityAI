"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowRight,
  ArrowUpDown,
  BadgeIndianRupee,
  Bell,
  Boxes,
  Check,
  Circle,
  Clock,
  FileText,
  FolderKanban,
  GitBranch,
  GitPullRequestArrow,
  Keyboard,
  LayoutDashboard,
  ListChecks,
  MessagesSquare,
  Plus,
  Rocket,
  ScrollText,
  Search,
  Settings,
  ShieldCheck,
  Sparkles,
  Sun,
  UserCircle,
  Users,
  type LucideIcon,
} from "lucide-react";
import { SiGithub } from "react-icons/si";

import { cn } from "@/lib/utils";

/**
 * Interactive replica of the real VelocityAI app (learning/ss screenshots):
 * clickable sidebar with per-view pages, scope selector, ⌘K search, Alt+key
 * shortcuts, and the feature-lifecycle animation running in the Features view
 * on the real stage stepper (Clarify → PRD → Tasks → Review → Release).
 */

type View = "dashboard" | "features" | "prd" | "tasks" | "reviews" | "github";

const VIEW_PATH: Record<View, string> = {
  dashboard: "/dashboard",
  features: "/features",
  prd: "/prd",
  tasks: "/tasks",
  reviews: "/reviews",
  github: "/github",
};

type NavEntry = { label: string; icon: LucideIcon; key: string; view?: View };

const NAV: { group: string; items: NavEntry[] }[] = [
  {
    group: "Delivery",
    items: [
      { label: "Dashboard", icon: LayoutDashboard, key: "D", view: "dashboard" },
      { label: "Features", icon: Boxes, key: "F", view: "features" },
      { label: "PRDs", icon: ScrollText, key: "P", view: "prd" },
      { label: "Tasks", icon: ListChecks, key: "T", view: "tasks" },
      { label: "Reviews", icon: ShieldCheck, key: "R", view: "reviews" },
      { label: "Copilot", icon: Sparkles, key: "C" },
      { label: "GitHub", icon: GitBranch, key: "G", view: "github" },
    ],
  },
  {
    group: "Workspace",
    items: [
      { label: "Projects", icon: FolderKanban, key: "O" },
      { label: "Billing", icon: BadgeIndianRupee, key: "B" },
      { label: "Team", icon: Users, key: "M" },
      { label: "Profile", icon: UserCircle, key: "U" },
      { label: "Settings", icon: Settings, key: "S" },
    ],
  },
];

const VIEW_LABEL: Record<View, string> = {
  dashboard: "Dashboard",
  features: "Features",
  prd: "PRDs",
  tasks: "Tasks",
  reviews: "Reviews",
  github: "GitHub",
};

/* ================= shared bits ================= */

function Kbd({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <kbd className="border border-border/80 bg-foreground/4 px-1 py-px font-mono text-[7.5px] leading-none text-muted-foreground/70">
      {children}
    </kbd>
  );
}

function PageTitle({ title, sub }: Readonly<{ title: string; sub: string }>) {
  return (
    <div>
      <p className="text-lg font-medium leading-tight text-foreground sm:text-xl">
        {title}
      </p>
      <p className="mt-1 line-clamp-1 text-[10.5px] leading-relaxed text-muted-foreground">{sub}</p>
    </div>
  );
}

function StatusBadge({ label, tone }: Readonly<{ label: string; tone: "active" | "done" | "muted" }>) {
  return (
    <span
      className={cn(
        "border px-1.5 py-0.5 font-mono text-[8.5px] uppercase tracking-widest",
        tone === "done" && "border-success/40 bg-success/10 text-success",
        tone === "active" && "border-primary/40 bg-primary/10 text-primary",
        tone === "muted" && "border-border bg-muted text-muted-foreground",
      )}
    >
      {label}
    </span>
  );
}

/** Types out `text` character by character once mounted. */
function Typer({ text, speed = 34, delay = 0 }: Readonly<{ text: string; speed?: number; delay?: number }>) {
  const [n, setN] = useState(0);
  useEffect(() => {
    let i = 0;
    let interval: ReturnType<typeof setInterval> | undefined;
    const start = setTimeout(() => {
      interval = setInterval(() => {
        i += 1;
        setN(i);
        if (i >= text.length && interval) clearInterval(interval);
      }, speed);
    }, delay);
    return () => {
      clearTimeout(start);
      if (interval) clearInterval(interval);
    };
  }, [text, speed, delay]);
  return (
    <span>
      {text.slice(0, n)}
      {n < text.length && <span className="animate-pulse text-primary">▍</span>}
    </span>
  );
}

/* ================= feature lifecycle (animated, Features view only) ================= */

const STAGES = [
  { id: "clarify", label: "Clarify", icon: MessagesSquare },
  { id: "prd", label: "PRD", icon: FileText },
  { id: "tasks", label: "Tasks", icon: ListChecks },
  { id: "review", label: "Review", icon: ShieldCheck },
  { id: "release", label: "Release", icon: Rocket },
];

/** The real feature-detail stage stepper: squares joined by lines. */
function StageStepper({ active }: Readonly<{ active: number }>) {
  return (
    <div className="flex items-center border border-border bg-card/60 px-4 py-3">
      {STAGES.map((s, i) => {
        const done = i < active;
        const current = i === active;
        let labelColor = "text-muted-foreground/50";
        if (current) {
          labelColor = "text-primary";
        } else if (done) {
          labelColor = "text-success/80";
        }
        return (
          <div key={s.id} className={cn("flex items-center", i > 0 && "flex-1")}>
            {i > 0 && (
              <span
                className={cn("mx-2 h-px flex-1 transition-colors duration-500", done || current ? "bg-success/50" : "bg-border")}
              />
            )}
            <div className="flex flex-col items-center gap-1">
              <span
                className={cn(
                  "grid size-7 place-items-center border transition-all duration-500",
                  done && "border-success/60 bg-success/10 text-success",
                  current && "border-primary bg-primary/10 text-primary",
                  !done && !current && "border-border text-muted-foreground/50",
                )}
              >
                {done ? <Check className="size-3" /> : <s.icon className="size-3" />}
              </span>
              <span className={cn("font-mono text-[7.5px] uppercase tracking-widest", labelColor)}>
                {s.label}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

const FLOW = [
  { id: "request", stage: -1, status: "Intake", dur: 5200 },
  { id: "clarify", stage: 0, status: "Clarifying", dur: 5200 },
  { id: "prdgen", stage: 1, status: "PRD ready", dur: 5600 },
  { id: "tasks", stage: 2, status: "Tasks ready", dur: 5200 },
  { id: "review", stage: 3, status: "AI review", dur: 5600 },
  { id: "release", stage: 4, status: "Shipped", dur: 5600 },
] as const;

function FlowRequest() {
  return (
    <div className="space-y-3">
      <PageTitle
        title="Feature requests"
        sub="Capture rough product asks, clarify missing context, generate PRDs, and track each feature until it ships."
      />
      <div className="border border-primary/35 bg-primary/5 p-3">
        <p className="flex items-center gap-1.5 text-[10px] font-medium text-primary">
          <Sparkles className="size-3" /> AI intake starts here
        </p>
        <p className="mt-1 text-[10px] leading-relaxed text-muted-foreground">
          Add a request to To Do App. VelocityAI will clarify it, produce a PRD, create tasks, and
          review the final PR.
        </p>
      </div>
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        className="max-w-sm border border-border bg-card p-3"
      >
        <div className="flex items-start justify-between gap-2">
          <p className="text-[11px] font-medium text-foreground">
            <Typer text="Create a calculator app" delay={900} />
          </p>
          <motion.span
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 3.4 }}
          >
            <StatusBadge label="Intake" tone="muted" />
          </motion.span>
        </div>
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 3.8 }}
          className="mt-2 flex items-center justify-between font-mono text-[8.5px] text-muted-foreground"
        >
          <span className="flex items-center gap-1">
            <Clock className="size-2.5" /> ~26h · High priority
          </span>
          <span className="flex items-center gap-1">
            30/6/2026 <ArrowRight className="size-2.5" />
          </span>
        </motion.div>
      </motion.div>
    </div>
  );
}

function FlowClarify() {
  return (
    <div className="space-y-2.5">
      <p className="flex items-center gap-1.5 text-[10.5px] font-medium text-foreground">
        <MessagesSquare className="size-3 text-primary" /> Clarification conversation
      </p>
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="border border-primary/50 bg-primary/90 px-3 py-2 text-[10px] font-medium text-primary-foreground"
      >
        Who are the target users for the calculator app, and what specific needs should it address?
      </motion.div>
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1.6 }}
        className="border border-border bg-card px-3 py-2 text-[10px] text-muted-foreground"
      >
        <Typer text="Students and professionals — basic arithmetic, fast and offline." delay={2000} speed={22} />
      </motion.div>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1, scale: [1, 1, 0.95, 1] }}
        transition={{ delay: 4, duration: 0.8, times: [0, 0.6, 0.75, 1] }}
        className="inline-flex items-center gap-1.5 bg-primary px-2.5 py-1 font-mono text-[9px] font-medium uppercase tracking-widest text-primary-foreground"
      >
        Send
      </motion.div>
    </div>
  );
}

function FlowPrd() {
  return (
    <div className="space-y-2.5">
      <div className="flex items-center justify-between">
        <div className="flex gap-1">
          <span className="flex items-center gap-1 bg-primary px-2 py-1 font-mono text-[8.5px] font-medium uppercase tracking-widest text-primary-foreground">
            Structured
          </span>
          <span className="flex items-center gap-1 border border-border px-2 py-1 font-mono text-[8.5px] uppercase tracking-widest text-muted-foreground">
            Document
          </span>
        </div>
        <span className="border border-border px-2 py-1 font-mono text-[8.5px] uppercase tracking-widest text-muted-foreground">
          Download PDF
        </span>
      </div>
      <div className="border border-border bg-card p-3">
        <div className="flex items-center justify-between">
          <p className="font-mono text-[8.5px] uppercase tracking-[0.18em] text-primary">
            Product requirements document
          </p>
          <div className="flex items-center gap-1.5">
            <span className="border border-border px-1.5 py-0.5 font-mono text-[8px] text-muted-foreground">v1</span>
            <motion.span
              initial={{ opacity: 0, scale: 0.6 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 3.2, type: "spring", stiffness: 300, damping: 16 }}
            >
              <StatusBadge label="Approved" tone="done" />
            </motion.span>
          </div>
        </div>
        <p className="mt-2 text-[11px] font-medium text-foreground">Create a calculator app</p>
        <div className="mt-2 space-y-1.5">
          {["94%", "88%", "64%"].map((w, i) => (
            <motion.div
              key={w}
              initial={{ scaleX: 0 }}
              animate={{ scaleX: 1 }}
              transition={{ delay: 0.6 + i * 0.35, duration: 0.45 }}
              style={{ width: w }}
              className="h-1.5 origin-left bg-foreground/12"
            />
          ))}
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2 border-t border-border pt-2">
          <div>
            <p className="flex items-center gap-1 font-mono text-[8.5px] uppercase tracking-widest text-success">
              <Circle className="size-1.5 fill-success" /> Goals
            </p>
            {[0, 1].map((i) => (
              <motion.div
                key={i}
                initial={{ scaleX: 0 }}
                animate={{ scaleX: 1 }}
                transition={{ delay: 1.8 + i * 0.3 }}
                className="mt-1.5 h-1 w-[85%] origin-left bg-foreground/10"
              />
            ))}
          </div>
          <div>
            <p className="flex items-center gap-1 font-mono text-[8.5px] uppercase tracking-widest text-destructive/80">
              <Circle className="size-1.5 fill-destructive/80" /> Non-goals
            </p>
            {[0, 1].map((i) => (
              <motion.div
                key={i}
                initial={{ scaleX: 0 }}
                animate={{ scaleX: 1 }}
                transition={{ delay: 2.2 + i * 0.3 }}
                className="mt-1.5 h-1 w-[75%] origin-left bg-foreground/10"
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function FlowTasks() {
  const cols: { name: string; n: number; cards: { t: string; h: string }[] }[] = [
    { name: "Todo", n: 2, cards: [{ t: "Cross-platform testing", h: "5h" }, { t: "User feedback setup", h: "3h" }] },
    { name: "In progress", n: 1, cards: [{ t: "Design UI for calculator", h: "4h" }] },
    { name: "Done", n: 2, cards: [{ t: "Error handling", h: "2h" }, { t: "Core arithmetic", h: "3h" }] },
  ];
  return (
    <div className="space-y-2">
      <p className="font-mono text-[8.5px] text-muted-foreground">
        Drag tasks between columns or use the quick-move buttons.
      </p>
      <div className="grid grid-cols-3 gap-2">
        {cols.map((col, ci) => (
          <div key={col.name} className="border border-border bg-card/50 p-2">
            <div className="flex items-center justify-between">
              <p className="text-[9.5px] font-medium text-foreground">{col.name}</p>
              <span className="grid size-4 place-items-center rounded-full bg-foreground/6 font-mono text-[8px] text-muted-foreground">
                {col.n}
              </span>
            </div>
            <div className="mt-2 space-y-1.5">
              {col.cards.map((card, i) => (
                <motion.div
                  key={card.t}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4 + ci * 0.5 + i * 0.3 }}
                  className="border border-border bg-card p-2"
                >
                  <div className="flex items-start justify-between gap-1">
                    <p className="text-[9px] font-medium leading-snug text-foreground/90">{card.t}</p>
                    <span className="flex shrink-0 items-center gap-0.5 border border-border px-1 py-px font-mono text-[7.5px] text-muted-foreground">
                      <Clock className="size-2" /> {card.h}
                    </span>
                  </div>
                  {col.name === "Done" && (
                    <motion.p
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 2.4 + i * 0.3 }}
                      className="mt-1 flex items-center gap-1 font-mono text-[7.5px] uppercase tracking-widest text-success"
                    >
                      <Check className="size-2" /> done
                    </motion.p>
                  )}
                </motion.div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function FlowReview() {
  return (
    <div className="space-y-2.5">
      <div className="flex items-center justify-between border border-border bg-card px-3 py-2">
        <p className="font-mono text-[9px] text-muted-foreground">
          Branch: <span className="text-foreground/85">feature/create-a-calculator-app</span>
        </p>
        <span className="border border-border px-2 py-0.5 font-mono text-[8.5px] uppercase tracking-widest text-muted-foreground">
          Link a PR
        </span>
      </div>
      <div className="relative overflow-hidden border border-border bg-card p-3">
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-2 font-mono text-[10px] text-foreground/90">
            <GitPullRequestArrow className="size-3 text-primary" /> feat: calculator core
            <span className="text-muted-foreground">#1</span>
          </span>
          <motion.span
            initial={{ opacity: 0, scale: 0.6 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 3.4, type: "spring", stiffness: 300, damping: 16 }}
          >
            <StatusBadge label="passed" tone="done" />
          </motion.span>
        </div>
        <div className="mt-2.5 space-y-1">
          {["+ export function evaluate(expr: string)", "+ <CalculatorPad onKey={press} />", "- // TODO: handle divide by zero"].map(
            (l, i) => (
              <motion.p
                key={l}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.5 + i * 0.3 }}
                className={cn(
                  "font-mono text-[9px]",
                  l.startsWith("+") ? "text-success/80" : "text-destructive/70",
                )}
              >
                {l}
              </motion.p>
            ),
          )}
        </div>
        <motion.div
          initial={{ top: "18%" }}
          animate={{ top: ["18%", "96%", "18%"] }}
          transition={{ delay: 0.6, duration: 2.6, ease: "easeInOut" }}
          className="absolute inset-x-0 h-px bg-primary/60"
        />
      </div>
      <div className="flex gap-1.5">
        {["security", "correctness", "criteria 3/3"].map((c, i) => (
          <motion.span
            key={c}
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 2.2 + i * 0.3 }}
            className="border border-border bg-foreground/3 px-1.5 py-0.5 font-mono text-[8px] uppercase tracking-widest text-muted-foreground"
          >
            {c}
          </motion.span>
        ))}
      </div>
    </div>
  );
}

function FlowRelease() {
  const items = ["PRD approved", "Engineering tasks created", "Pull request linked", "AI review passed"];
  return (
    <div className="space-y-1.5">
      {items.map((item, i) => (
        <div key={item} className="flex items-center gap-2 border border-border bg-card px-3 py-2">
          <motion.span
            initial={{ backgroundColor: "transparent", borderColor: "var(--border)" }}
            animate={{ backgroundColor: "var(--success)", borderColor: "var(--success)" }}
            transition={{ delay: 0.5 + i * 0.55 }}
            className="grid size-3.5 place-items-center rounded-full border"
          >
            <Check className="size-2.5 text-background" />
          </motion.span>
          <span className="text-[10px] text-foreground/85">{item}</span>
        </div>
      ))}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 3, type: "spring", stiffness: 260, damping: 18 }}
        className="flex items-center gap-2 border border-success/40 bg-success/8 px-3 py-2.5"
      >
        <Rocket className="size-3.5 text-success" />
        <div>
          <p className="text-[10.5px] font-medium text-foreground">Release approved — shipped</p>
          <p className="font-mono text-[8px] uppercase tracking-widest text-muted-foreground">
            Reviewed · Approved · Live
          </p>
        </div>
      </motion.div>
    </div>
  );
}

function FeaturesFlow({ running }: Readonly<{ running: boolean }>) {
  const [idx, setIdx] = useState(0);
  const phase = FLOW[idx]!;

  useEffect(() => {
    if (!running) return;
    const t = setTimeout(() => setIdx((i) => (i + 1) % FLOW.length), phase.dur);
    return () => clearTimeout(t);
  }, [running, idx, phase.dur]);

  return (
    <div className="space-y-3">
      {phase.id !== "request" && (
        <>
          <div className="flex items-start justify-between gap-3">
            <PageTitle
              title="Create a calculator app"
              sub="Feature detail connects the original request to PRD, tasks, GitHub PR, AI review, and release approval."
            />
            <AnimatePresence mode="wait">
              <motion.span
                key={phase.status}
                initial={{ opacity: 0, y: -5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 5 }}
              >
                <StatusBadge label={phase.status} tone={phase.status === "Shipped" ? "done" : "active"} />
              </motion.span>
            </AnimatePresence>
          </div>
          <StageStepper active={phase.stage} />
        </>
      )}
      <AnimatePresence mode="wait">
        <motion.div
          key={phase.id}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.32 }}
        >
          {phase.id === "request" && <FlowRequest />}
          {phase.id === "clarify" && <FlowClarify />}
          {phase.id === "prdgen" && <FlowPrd />}
          {phase.id === "tasks" && <FlowTasks />}
          {phase.id === "review" && <FlowReview />}
          {phase.id === "release" && <FlowRelease />}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

/* ================= static views ================= */

function DashboardView() {
  const stats = [
    { label: "Features shipped", value: "50%", sub: "1 of 2 features live", icon: Rocket },
    { label: "Approved flow", value: "1", sub: "Approved or already shipped", icon: ShieldCheck },
    { label: "Active work", value: "2", sub: "Requests moving through VelocityAI", icon: Clock },
    { label: "Open blockers", value: "0", sub: "Issues preventing release today", icon: GitPullRequestArrow },
  ];
  const pipeline = [
    ["Intake", "0"],
    ["PRD", "1"],
    ["Tasks", "2"],
    ["Review", "1"],
    ["Shipped", "1"],
  ];
  return (
    <div className="space-y-3.5">
      <PageTitle
        title="Dashboard"
        sub="One control room for product discovery, PRD generation, engineering tasks, AI review, and release approval."
      />
      <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="border border-border bg-card p-3">
            <div className="flex items-center justify-between">
              <p className="font-mono text-[8px] uppercase tracking-[0.16em] text-muted-foreground">{s.label}</p>
              <span className="grid size-6 place-items-center border border-border text-muted-foreground">
                <s.icon className="size-3" />
              </span>
            </div>
            <p className="mt-2 text-xl text-foreground">{s.value}</p>
            <p className="mt-1 text-[8.5px] text-muted-foreground">{s.sub}</p>
          </div>
        ))}
      </div>
      <div>
        <p className="font-mono text-[8.5px] uppercase tracking-[0.2em] text-primary">Delivery pipeline</p>
        <div className="mt-1.5 grid grid-cols-5 border border-border bg-card">
          {pipeline.map(([label, n], i) => (
            <div key={label} className={cn("flex items-center justify-between p-2.5", i > 0 && "border-l border-border")}>
              <div>
                <p className="font-mono text-[7.5px] uppercase tracking-widest text-muted-foreground">{label}</p>
                <p className="mt-1 text-sm text-foreground">{n}</p>
              </div>
              {i < 4 && <ArrowRight className="size-2.5 text-muted-foreground/40" />}
            </div>
          ))}
        </div>
      </div>
      <div className="border border-border bg-card">
        <div className="border-b border-border px-3 py-2">
          <p className="text-[10.5px] font-medium text-foreground">Active features</p>
          <p className="text-[8.5px] text-muted-foreground">Requests in To Do App.</p>
        </div>
        {[
          { t: "Create a calculator app", pr: "High", d: "Jun 30, 2026", h: "~26h" },
          { t: "Create task feature", pr: "Medium", d: "Jun 29, 2026", h: "~5h" },
        ].map((f) => (
          <div key={f.t} className="flex items-center justify-between border-b border-border/60 px-3 py-2 last:border-b-0">
            <div className="flex min-w-0 items-center gap-2">
              <p className="truncate text-[10px] font-medium text-foreground">{f.t}</p>
              <StatusBadge label="tasks ready" tone="active" />
              <span className="hidden items-center gap-0.5 border border-border px-1 py-px font-mono text-[7.5px] text-muted-foreground md:flex">
                <Clock className="size-2" /> {f.h}
              </span>
            </div>
            <div className="flex shrink-0 items-center gap-3 font-mono text-[8.5px] text-muted-foreground">
              <span>{f.pr}</span>
              <span className="hidden sm:inline">{f.d}</span>
              <ArrowRight className="size-2.5" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function PrdView() {
  return (
    <div className="space-y-3">
      <PageTitle title="PRDs" sub="Every generated spec, versioned and approvable — the contract every PR is reviewed against." />
      {[
        { t: "Create a calculator app", v: "v1", tone: "done" as const, label: "Approved", eff: "~26h" },
        { t: "Create task feature", v: "v2", tone: "active" as const, label: "In review", eff: "~5h" },
      ].map((d) => (
        <div key={d.t} className="flex items-center justify-between border border-border bg-card px-3 py-2.5">
          <div className="flex min-w-0 items-center gap-2">
            <span className="grid size-6 shrink-0 place-items-center border border-border text-muted-foreground">
              <ScrollText className="size-3" />
            </span>
            <div className="min-w-0">
              <p className="truncate text-[10.5px] font-medium text-foreground">{d.t}</p>
              <p className="font-mono text-[8px] text-muted-foreground">
                Product requirements document · {d.eff}
              </p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            <span className="border border-border px-1.5 py-0.5 font-mono text-[8px] text-muted-foreground">{d.v}</span>
            <StatusBadge label={d.label} tone={d.tone} />
          </div>
        </div>
      ))}
    </div>
  );
}

function TasksView() {
  return (
    <div className="space-y-3">
      <PageTitle title="Task board" sub="Engineering tasks across To Do App." />
      <div className="flex items-center gap-2">
        <div className="flex flex-1 border border-border bg-card">
          {["All", "Active", "In review", "Done", "Blocked"].map((f, i) => (
            <span
              key={f}
              className={cn(
                "flex-1 px-2 py-1.5 text-center font-mono text-[8.5px] uppercase tracking-widest",
                i === 0 ? "border border-primary/40 bg-primary/10 text-primary" : "text-muted-foreground",
              )}
            >
              {f}
            </span>
          ))}
        </div>
        <span className="hidden items-center gap-1 border border-border px-2 py-1.5 font-mono text-[8.5px] text-muted-foreground sm:flex">
          <ArrowUpDown className="size-2.5" /> Newest first
        </span>
        <span className="hidden items-center gap-1 border border-border px-2 py-1.5 font-mono text-[8.5px] text-muted-foreground md:flex">
          <Search className="size-2.5" /> Search tasks…
        </span>
      </div>
      {["Create a calculator app", "Create task feature"].map((t) => (
        <div key={t} className="border border-border bg-card px-3 py-2.5">
          <div className="flex items-center justify-between">
            <p className="text-[10.5px] font-medium text-foreground">{t}</p>
            <StatusBadge label="tasks ready" tone="active" />
          </div>
          <p className="mt-1.5 flex items-center gap-1 font-mono text-[8.5px] text-primary/80">
            Open feature to view and manage tasks <ArrowRight className="size-2.5" />
          </p>
        </div>
      ))}
    </div>
  );
}

function ReviewsView() {
  return (
    <div className="space-y-3">
      <PageTitle title="Reviews" sub="Every pull request, reviewed against the PRD it implements." />
      {[
        { t: "feat: calculator core", n: "#1", tone: "done" as const, label: "passed", chips: ["3/3 criteria", "0 blocking"] },
        { t: "feat: task creation flow", n: "#2", tone: "active" as const, label: "changes requested", chips: ["2/3 criteria", "1 blocking"] },
      ].map((r) => (
        <div key={r.n} className="border border-border bg-card px-3 py-2.5">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-2 font-mono text-[10px] text-foreground/90">
              <GitPullRequestArrow className="size-3 text-primary" /> {r.t}
              <span className="text-muted-foreground">{r.n}</span>
            </span>
            <StatusBadge label={r.label} tone={r.tone} />
          </div>
          <div className="mt-2 flex gap-1.5">
            {r.chips.map((c) => (
              <span key={c} className="border border-border bg-foreground/3 px-1.5 py-0.5 font-mono text-[8px] uppercase tracking-widest text-muted-foreground">
                {c}
              </span>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function GithubView() {
  return (
    <div className="space-y-3">
      <PageTitle title="GitHub Integration" sub="Connect repositories to enable AI code review and track PRs, commits, and contributors." />
      <div className="grid gap-2 lg:grid-cols-2">
        <div className="border border-border bg-card p-3">
          <div className="flex items-center gap-2">
            <span className="grid size-7 place-items-center border border-border text-foreground">
              <SiGithub className="size-3.5" />
            </span>
            <div>
              <p className="text-[10.5px] font-medium text-foreground">GitHub App</p>
              <p className="font-mono text-[8px] text-muted-foreground">Repository access</p>
            </div>
          </div>
          <div className="mt-2.5 border border-success/40 bg-success/[0.07] px-2.5 py-2">
            <p className="flex items-center gap-1.5 text-[10px] font-medium text-success">
              <ShieldCheck className="size-3" /> Connected
            </p>
            <p className="mt-0.5 font-mono text-[8px] text-muted-foreground">@Mr-Madhukar</p>
          </div>
          <span className="mt-2.5 inline-flex items-center gap-1 border border-border px-2 py-1 font-mono text-[8.5px] uppercase tracking-widest text-muted-foreground">
            <Settings className="size-2.5" /> Manage repositories
          </span>
        </div>
        <div className="border border-border bg-card p-3">
          <p className="flex items-center gap-1.5 text-[10.5px] font-medium text-foreground">
            <GitBranch className="size-3 text-primary" /> How it works
          </p>
          <div className="mt-2 space-y-1.5">
            {["Install the GitHub App", "Connect a repo to this project", "Create a feature branch", "Open a pull request", "Automated AI review"].map(
              (s, i) => (
                <p key={s} className="flex items-center gap-2 text-[9px] text-muted-foreground">
                  <span className="grid size-4 shrink-0 place-items-center rounded-full border border-primary/40 font-mono text-[7.5px] text-primary">
                    {i + 1}
                  </span>
                  {s}
                </p>
              ),
            )}
          </div>
        </div>
      </div>
      <div className="flex items-center justify-between border border-border bg-card px-3 py-2">
        <div className="flex items-center gap-2">
          <Check className="size-3 text-success" />
          <div>
            <p className="font-mono text-[9.5px] text-foreground/90">Mr-Madhukar/todo-app-velocity-test</p>
            <p className="font-mono text-[8px] text-muted-foreground">branch: main</p>
          </div>
        </div>
        <span className="font-mono text-[8.5px] text-primary/80">View dashboard →</span>
      </div>
    </div>
  );
}

/* ================= shell ================= */

export function DemoDashboard({
  running,
  onPathChange,
}: Readonly<{
  running: boolean;
  onPathChange?: (path: string) => void;
}>) {
  const [view, setView] = useState<View>("features");

  useEffect(() => {
    onPathChange?.(VIEW_PATH[view]);
  }, [view, onPathChange]);

  return (
    <div className="grid h-140 grid-cols-[46px_1fr] text-left sm:h-155 sm:grid-cols-[186px_1fr]">
      {/* ---- Sidebar ---- */}
      <aside className="flex flex-col overflow-hidden border-r border-border bg-sidebar/80">
        {/* logo */}
        <div className="flex items-center gap-2 px-3 py-3">
          <Image src="/icons/velocity-mark.svg" alt="VelocityAI" width={22} height={22} className="size-5.5 shrink-0" />
          <div className="hidden min-w-0 sm:block">
            <p className="text-[11.5px] font-medium leading-tight text-foreground">VelocityAI</p>
            <p className="truncate font-mono text-[7px] uppercase tracking-[0.14em] text-muted-foreground">
              Product delivery OS
            </p>
          </div>
        </div>

        {/* nav groups */}
        <nav className="flex-1 overflow-y-auto pt-1">
          {NAV.map((group) => (
            <div key={group.group}>
              <p className="hidden px-3 pb-1 pt-2.5 font-mono text-[7.5px] uppercase tracking-[0.2em] text-muted-foreground/55 sm:block">
                {group.group}
              </p>
              <div className="grid">
                {group.items.map((item) => {
                  const active = item.view === view;
                  const clickable = !!item.view;
                  let itemStyle = "text-muted-foreground/45";
                  if (active) {
                    itemStyle = "bg-primary/10 text-primary";
                  } else if (clickable) {
                    itemStyle = "text-muted-foreground/80 hover:bg-foreground/4 hover:text-foreground";
                  }
                  return (
                    <button
                      key={item.label}
                      type="button"
                      aria-label={item.label}
                      disabled={!clickable}
                      onClick={() => item.view && setView(item.view)}
                      className={cn(
                        "relative flex items-center gap-2 px-3 py-[5.5px] text-left transition-colors duration-300",
                        itemStyle,
                      )}
                      style={!clickable ? { opacity: 1, filter: "none", cursor: "default" } : undefined}
                    >
                      {active && (
                        <motion.span layoutId="demo-nav-indicator" className="absolute inset-y-0 left-0 w-0.5 bg-primary" />
                      )}
                      <item.icon className="size-3 shrink-0" />
                      <span className="hidden flex-1 truncate font-mono text-[10px] sm:inline">{item.label}</span>
                      <span className="hidden items-center gap-0.5 sm:flex">
                        <Kbd>Alt</Kbd>
                        <Kbd>{item.key}</Kbd>
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* footer: shortcuts + org + status */}
        <div className="hidden space-y-1.5 border-t border-border px-2.5 py-2.5 sm:block">
          <div className="flex items-center justify-between px-0.5">
            <span className="flex items-center gap-1.5 font-mono text-[8.5px] text-muted-foreground">
              <Keyboard className="size-3" /> Keyboard shortcuts
            </span>
            <Kbd>?</Kbd>
          </div>
          <div className="flex items-center justify-between border border-border bg-foreground/2 px-2 py-1.5">
            <span className="flex items-center gap-1.5">
              <span className="grid size-4 place-items-center bg-linear-to-br from-violet-500 to-cyan-600 font-mono text-[7px] font-semibold text-white">
                M
              </span>
              <span className="font-mono text-[8.5px] text-foreground/85">Madhukar</span>
            </span>
            <ArrowUpDown className="size-2.5 text-muted-foreground/60" />
          </div>
          <div className="flex items-center gap-1.5 border border-border bg-foreground/2 px-2 py-1.5">
            <span className="size-1 bg-success" />
            <span className="truncate font-mono text-[7.5px] uppercase tracking-wider text-muted-foreground">
              All systems operational
            </span>
          </div>
        </div>
      </aside>

      {/* ---- Main ---- */}
      <div className="flex min-w-0 flex-col">
        {/* top bar */}
        <div className="flex h-11 items-center justify-between gap-2 border-b border-border bg-background/60 px-3">
          <div className="flex min-w-0 items-center gap-2.5">
            <p className="hidden min-w-0 truncate font-mono text-[9.5px] text-muted-foreground md:block">
              VelocityAI <span className="text-foreground/30">›</span>{" "}
              <span className="text-foreground">{VIEW_LABEL[view]}</span>
            </p>
            {/* scope selector */}
            <span className="flex items-center gap-1.5 border border-border bg-foreground/2 px-2 py-1">
              <FolderKanban className="size-3 text-primary" />
              <span className="min-w-0">
                <span className="block font-mono text-[6.5px] uppercase tracking-[0.18em] text-muted-foreground">Scope</span>
                <span className="block text-[9px] font-medium leading-tight text-foreground">To Do App</span>
              </span>
              <ArrowUpDown className="size-2.5 text-muted-foreground/60" />
            </span>
          </div>

          <div className="flex shrink-0 items-center gap-1.5">
            <span className="hidden items-center gap-1.5 border border-border bg-foreground/3 px-2 py-1.5 text-muted-foreground lg:flex">
              <Search className="size-2.5" />
              <span className="font-mono text-[9px]">Search…</span>
              <Kbd>⌘K</Kbd>
            </span>
            <span className="hidden size-6 place-items-center border border-border text-muted-foreground sm:grid">
              <Sun className="size-3" />
            </span>
            <span className="hidden size-6 place-items-center border border-border text-muted-foreground sm:grid">
              <Bell className="size-3" />
            </span>
            <span className="flex items-center gap-1 bg-primary px-2 py-1.5 font-mono text-[9px] font-medium text-primary-foreground">
              <Plus className="size-2.5" />
              <span className="hidden sm:inline">New feature</span>
            </span>
            <span className="grid size-6 place-items-center bg-linear-to-br from-orange-500 to-amber-600 font-mono text-[8px] font-semibold text-white">
              MK
            </span>
          </div>
        </div>

        {/* view content */}
        <div className="relative flex-1 overflow-y-auto p-4 sm:p-5">
          <AnimatePresence mode="wait">
            <motion.div
              key={view}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.25 }}
            >
              {view === "features" && <FeaturesFlow running={running} />}
              {view === "dashboard" && <DashboardView />}
              {view === "prd" && <PrdView />}
              {view === "tasks" && <TasksView />}
              {view === "reviews" && <ReviewsView />}
              {view === "github" && <GithubView />}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

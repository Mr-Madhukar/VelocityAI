"use client";

import { useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  Bot,
  GitPullRequestArrow,
  KeyRound,
  Layers,
  ShieldCheck,
  Terminal,
  type LucideIcon,
} from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * Hero capability constellation — the product's flagship features as floating
 * glassmorphic orbs flanking the headline, each cluster threaded by an animated
 * circuit line. Hovering (or focusing) an orb dims its siblings and springs out
 * a glass dossier card with the details. Below xl the same content renders as a
 * tappable chip strip + shared detail panel (hover doesn't exist on touch).
 */

type Feature = {
  id: string;
  icon: LucideIcon;
  /** Short chip/aria label. */
  label: string;
  title: string;
  desc: string;
  tag: string;
  side: "left" | "right";
  /** Orb center, in % of the hero section. */
  x: number;
  y: number;
};

const FEATURES: Feature[] = [
  {
    id: "agent",
    icon: Bot,
    label: "Coding agent",
    title: "BYOK coding agent",
    desc: "Chat an approved PRD into working code — full file contents streamed live, task by task, on your own OpenAI, Anthropic, or Gemini key.",
    tag: "/agent",
    side: "left",
    x: 8,
    y: 28,
  },
  {
    id: "prs",
    icon: GitPullRequestArrow,
    label: "Auto PRs",
    title: "Agent-raised pull requests",
    desc: "One click turns a generated change set into a branch, commits, and a ready-to-review pull request on your connected repo.",
    tag: "VelocityAI-agent/*",
    side: "left",
    x: 14.5,
    y: 47,
  },
  {
    id: "keys",
    icon: KeyRound,
    label: "Key vault",
    title: "Encrypted API keys",
    desc: "Provider keys are AES-256-GCM encrypted at rest — only a last-4 hint ever reaches the browser, and runs never log them.",
    tag: "aes-256-gcm",
    side: "left",
    x: 8.5,
    y: 66,
  },
  {
    id: "cli",
    icon: Terminal,
    label: "Dev CLI",
    title: "VelocityAI on npm",
    desc: "The whole pipeline from your terminal: device-code login, PRD approvals, tasks, and review watch — with --json output for CI.",
    tag: "npm i -g VelocityAI",
    side: "right",
    x: 92,
    y: 28,
  },
  {
    id: "models",
    icon: Layers,
    label: "Multi-model",
    title: "Multi-model core",
    desc: "OpenAI, Anthropic, and Google behind one engine — every job routed to the model that does it best, swappable per run.",
    tag: "ai.router",
    side: "right",
    x: 85.5,
    y: 47,
  },
  {
    id: "reviews",
    icon: ShieldCheck,
    label: "Spec reviews",
    title: "Spec-aware PR review",
    desc: "Every commit is re-reviewed against the approved PRD and scored — compliance, security, and correctness gate the merge.",
    tag: "review.score",
    side: "right",
    x: 91.5,
    y: 66,
  },
];

const cluster = (side: Feature["side"]) => FEATURES.filter((f) => f.side === side);
const points = (side: Feature["side"]) =>
  cluster(side)
    .map((f) => `${f.x},${f.y}`)
    .join(" ");

/* ================= desktop: floating orbs ================= */

function Orb({
  feature,
  index,
  active,
  dimmed,
  setActive,
  reduceMotion,
}: Readonly<{
  feature: Feature;
  index: number;
  active: boolean;
  dimmed: boolean;
  setActive: (id: string | null) => void;
  reduceMotion: boolean;
}>) {
  const Icon = feature.icon;
  const towardCenter = feature.side === "left";

  return (
    // Plain (non-motion) wrapper owns the centering translate — framer-motion
    // rewrites `transform` on animated elements, so Tailwind -translate-* and
    // motion scale/x must never share a node.
    <div
      className="pointer-events-auto absolute -translate-x-1/2 -translate-y-1/2"
      style={{ left: `${feature.x}%`, top: `${feature.y}%` }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.5 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ type: "spring", stiffness: 260, damping: 20, delay: 0.9 + index * 0.12 }}
      >
      {/* independent slow bob — phase-shifted per orb so the field feels alive.
          Hover handlers live HERE (the card is a DOM child), so moving the
          pointer from the orb into the card doesn't close it. */}
      <motion.div
        animate={reduceMotion ? undefined : { y: [0, -7, 0] }}
        transition={{
          duration: 5.2 + index * 0.7,
          repeat: Infinity,
          ease: "easeInOut",
          delay: index * 0.55,
        }}
        className="relative"
        onHoverStart={() => setActive(feature.id)}
        onHoverEnd={() => setActive(null)}
      >
        <motion.button
          type="button"
          aria-label={`${feature.label} — ${feature.title}`}
          onFocus={() => setActive(feature.id)}
          onBlur={() => setActive(null)}
          animate={{ opacity: dimmed ? 0.35 : 1, scale: active ? 1.08 : 1 }}
          transition={{ duration: 0.25 }}
          className={cn(
            "group relative grid size-16 cursor-default place-items-center rounded-full border backdrop-blur-md transition-[border-color,box-shadow,background-color] duration-300 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary",
            active
              ? "border-primary/60 bg-background/70 shadow-[0_0_30px_var(--glow-primary),inset_0_1px_0_0_rgb(255_255_255/0.08)]"
              : "border-border bg-background/50 shadow-[0_0_18px_var(--glow-primary),inset_0_1px_0_0_rgb(255_255_255/0.06)]",
          )}
        >
          {/* breathing halo */}
          <motion.span
            aria-hidden
            animate={reduceMotion ? undefined : { opacity: [0.35, 0.8, 0.35] }}
            transition={{ duration: 3.6, repeat: Infinity, ease: "easeInOut", delay: index * 0.4 }}
            className="pointer-events-none absolute -inset-1.5 rounded-full border border-primary/15"
          />
          <Icon
            className={cn(
              "size-5 transition-colors duration-300",
              active ? "text-primary" : "text-muted-foreground group-hover:text-primary",
            )}
          />
        </motion.button>

        {/* dossier card — springs toward the page center */}
        <AnimatePresence>
          {active && (
            <motion.div
              initial={{ opacity: 0, x: towardCenter ? -10 : 10, scale: 0.96 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: towardCenter ? -6 : 6, scale: 0.97 }}
              transition={{ type: "spring", stiffness: 380, damping: 28 }}
              // vertical centering via motion's own y so it composes with the
              // animated x/scale instead of being overwritten
              style={{ y: "-50%" }}
              className={cn(
                "absolute top-1/2 z-30 w-64 border border-primary/25 bg-background/75 p-4 shadow-[0_0_32px_var(--glow-primary)] backdrop-blur-xl",
                towardCenter ? "left-[calc(50%+3rem)]" : "right-[calc(50%+3rem)]",
              )}
            >
              {/* invisible hover bridge — spans the gap back to the orb so the
                  pointer never "leaves" while crossing from orb to card */}
              <span
                aria-hidden
                className={cn("absolute top-0 h-full w-4", towardCenter ? "-left-4" : "-right-4")}
              />
              {/* connector stub back to the orb */}
              <span
                aria-hidden
                className={cn(
                  "absolute top-1/2 h-px w-4 -translate-y-1/2 bg-primary/40",
                  towardCenter ? "-left-4" : "-right-4",
                )}
              />
              <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-primary">
                {feature.tag}
              </p>
              <p className="mt-2 font-display text-sm font-medium text-foreground">
                {feature.title}
              </p>
              <p className="mt-1.5 font-mono text-[11px] leading-relaxed text-muted-foreground">
                {feature.desc}
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
      </motion.div>
    </div>
  );
}

/** Absolute overlay for the hero section — xl and up only. */
export function HeroFeatureOrbs() {
  const [active, setActive] = useState<string | null>(null);
  const reduceMotion = useReducedMotion() ?? false;

  return (
    <div className="pointer-events-none absolute inset-0 hidden xl:block" aria-hidden={false}>
      {/* circuit threads through each cluster */}
      <motion.svg
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.5, duration: 0.9 }}
        className="absolute inset-0 h-full w-full"
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        aria-hidden
      >
        {(["left", "right"] as const).map((side) => (
          <polyline
            key={side}
            points={points(side)}
            fill="none"
            strokeWidth="1"
            vectorEffect="non-scaling-stroke"
            className={cn("stroke-primary/25", !reduceMotion && "flow-dash")}
          />
        ))}
      </motion.svg>

      {FEATURES.map((f, i) => (
        <Orb
          key={f.id}
          feature={f}
          index={i}
          active={active === f.id}
          dimmed={active !== null && active !== f.id}
          setActive={setActive}
          reduceMotion={reduceMotion}
        />
      ))}
    </div>
  );
}

/* ================= below xl: chip strip + shared panel ================= */

export function HeroFeatureStrip() {
  const [active, setActive] = useState<string | null>(null);
  const current = FEATURES.find((f) => f.id === active) ?? null;

  return (
    <div className="mt-10 xl:hidden">
      <div className="flex flex-wrap items-center justify-center gap-2">
        {FEATURES.map((f) => {
          const Icon = f.icon;
          const isActive = active === f.id;
          return (
            <button
              key={f.id}
              type="button"
              onClick={() => setActive(isActive ? null : f.id)}
              className={cn(
                "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 backdrop-blur-sm transition-colors",
                isActive
                  ? "border-primary/50 bg-primary/8 text-primary shadow-[0_0_16px_var(--glow-primary)]"
                  : "border-border bg-background/55 text-muted-foreground hover:border-primary/35 hover:text-foreground",
              )}
            >
              <Icon className="size-3.5" />
              <span className="font-mono text-[10px] uppercase tracking-[0.14em]">{f.label}</span>
            </button>
          );
        })}
      </div>

      <AnimatePresence mode="wait">
        {current && (
          <motion.div
            key={current.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.22 }}
            className="mx-auto mt-4 max-w-md border border-primary/25 bg-background/70 p-4 text-left shadow-[0_0_24px_var(--glow-primary)] backdrop-blur-xl"
          >
            <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-primary">{current.tag}</p>
            <p className="mt-2 font-display text-sm font-medium text-foreground">
              {current.title}
            </p>
            <p className="mt-1.5 font-mono text-[11px] leading-relaxed text-muted-foreground">
              {current.desc}
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

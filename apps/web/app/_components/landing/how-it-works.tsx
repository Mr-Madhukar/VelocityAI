"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useInView } from "framer-motion";
import {
  Bot,
  Check,
  FileText,
  GitPullRequestArrow,
  ListChecks,
  MessagesSquare,
  Rocket,
  ShieldCheck,
  type LucideIcon,
} from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * "How VelocityAI works" — the agentic core powers up each pipeline station in
 * sequence, connected by curvy flight-path arcs (countries on a route map).
 * Loop: arc draws to station → station runs → green tick → next arc fades in.
 * Stations are evenly spaced across the viewBox (step 162) so cards never
 * overlap down to the lg breakpoint.
 */

const VB_W = 1200;
const VB_H = 500;

type Station = {
  id: string;
  n: string;
  title: string;
  sub: string;
  icon: LucideIcon;
  at: [number, number];
};

const CORE: [number, number] = [110, 300];

const STATIONS: Station[] = [
  { id: "clarify", n: "01", title: "Clarify", sub: "AI asks what's missing", icon: MessagesSquare, at: [290, 110] },
  { id: "prd", n: "02", title: "PRD", sub: "Structured, approvable spec", icon: FileText, at: [452, 350] },
  { id: "tasks", n: "03", title: "Tasks", sub: "Sized dev breakdown", icon: ListChecks, at: [614, 105] },
  { id: "agent", n: "04", title: "Agent", sub: "Codes tasks, raises the PR", icon: Bot, at: [776, 345] },
  { id: "review", n: "05", title: "Review", sub: "Every PR vs the spec", icon: ShieldCheck, at: [938, 110] },
  { id: "ship", n: "06", title: "Ship", sub: "Gated, reviewed release", icon: Rocket, at: [1100, 350] },
];

const DRAW_MS = 950;
const RUN_MS = 2100;
const HOLD_MS = 2400;

type Stage = { step: number; mode: "draw" | "run" } | { step: number; mode: "hold" };

/** Curvy flight path between two points — gentle alternating lift, route-map style. */
function arcPath(a: [number, number], b: [number, number], i: number): string {
  const mx = (a[0] + b[0]) / 2;
  const my = (a[1] + b[1]) / 2;
  const lift = (i % 2 === 0 ? -1 : 1) * 64;
  return `M ${a[0]} ${a[1]} Q ${mx} ${my + lift} ${b[0]} ${b[1]}`;
}

const ARCS = STATIONS.map((s, i) => arcPath(i === 0 ? CORE : STATIONS[i - 1]!.at, s.at, i));

/* ---- per-station mini animations while the station is "running" ---- */
function StationViz({ id }: Readonly<{ id: string }>) {
  switch (id) {
    case "clarify":
      return (
        <div className="flex items-center gap-1.5">
          {[0, 1, 2].map((i) => (
            <motion.span
              key={i}
              animate={{ y: [0, -4, 0], opacity: [0.4, 1, 0.4] }}
              transition={{ duration: 0.8, repeat: Infinity, delay: i * 0.18 }}
              className="size-1.5 rounded-full bg-primary"
            />
          ))}
        </div>
      );
    case "prd":
      return (
        <div className="w-full space-y-1">
          {["90%", "72%", "84%"].map((w, i) => (
            <motion.div
              key={w}
              initial={{ scaleX: 0 }}
              animate={{ scaleX: 1 }}
              transition={{ delay: i * 0.35, duration: 0.5 }}
              style={{ width: w }}
              className="h-1 origin-left bg-primary/50"
            />
          ))}
        </div>
      );
    case "tasks":
      return (
        <div className="flex gap-1.5">
          {[0, 1, 2, 3].map((i) => (
            <motion.span
              key={i}
              initial={{ backgroundColor: "transparent" }}
              animate={{ backgroundColor: "var(--primary)" }}
              transition={{ delay: 0.3 + i * 0.4 }}
              className="size-2.5 border border-primary/50"
            />
          ))}
        </div>
      );
    case "agent":
      return (
        <div className="flex w-full items-center gap-1.5">
          {/* code lines write themselves… */}
          <div className="flex-1 space-y-1">
            {["100%", "72%"].map((w, i) => (
              <motion.div
                key={w}
                initial={{ scaleX: 0 }}
                animate={{ scaleX: 1 }}
                transition={{ delay: 0.2 + i * 0.45, duration: 0.55 }}
                style={{ width: w }}
                className="h-1 origin-left bg-primary/50"
              />
            ))}
          </div>
          {/* …then the PR pops out */}
          <motion.span
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 1.35, type: "spring", stiffness: 380, damping: 18 }}
            className="text-primary"
          >
            <GitPullRequestArrow className="size-3.5" />
          </motion.span>
        </div>
      );
    case "review":
      return (
        <div className="relative h-4 w-full overflow-hidden border border-primary/25">
          <motion.div
            animate={{ left: ["-10%", "105%"] }}
            transition={{ duration: 1, repeat: Infinity, ease: "easeInOut" }}
            className="absolute top-0 h-full w-2 bg-primary/40 blur-[1px]"
          />
        </div>
      );
    case "ship":
      return (
        <motion.div
          animate={{ x: [0, 26], opacity: [1, 0] }}
          transition={{ duration: 1.1, repeat: Infinity, ease: "easeIn" }}
          className="flex items-center gap-1 text-primary"
        >
          <Rocket className="size-3.5 rotate-45" />
          <span className="h-px w-5 bg-linear-to-l from-primary to-transparent" />
        </motion.div>
      );
    default:
      return null;
  }
}

function StationCard({
  station,
  state,
}: Readonly<{
  station: Station;
  state: "idle" | "drawing" | "running" | "done";
}>) {
  const Icon = station.icon;
  let iconBoxStyle = "border-border bg-foreground/4 text-muted-foreground";
  if (state === "running") {
    iconBoxStyle = "border-primary/50 bg-primary/10 text-primary";
  } else if (state === "done") {
    iconBoxStyle = "border-success/40 bg-success/10 text-success";
  }
  let statusContent = (
    <span className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground/40">
      standby
    </span>
  );
  if (state === "running") {
    statusContent = <StationViz id={station.id} />;
  } else if (state === "done") {
    statusContent = (
      <span className="font-mono text-[9px] uppercase tracking-widest text-success">complete</span>
    );
  }

  return (
    <div
      className={cn(
        "relative w-40 border bg-card/85 p-3 backdrop-blur-sm transition-all duration-500",
        state === "running" && "border-primary/60 shadow-[0_0_18px_var(--glow-primary)]",
        state === "done" && "border-success/40 shadow-[0_0_10px_var(--glow-success)]",
        (state === "idle" || state === "drawing") && "border-border opacity-70",
      )}
    >
      {/* green tick on completion */}
      <AnimatePresence>
        {state === "done" && (
          <motion.span
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            transition={{ type: "spring", stiffness: 400, damping: 16 }}
            className="absolute -right-2 -top-2 grid size-5 place-items-center rounded-full bg-success text-success-foreground shadow-[0_0_14px_var(--glow-success)]"
          >
            <Check className="size-3" />
          </motion.span>
        )}
      </AnimatePresence>

      <div className="flex items-center justify-between">
        <span
          className={cn(
            "grid size-7 place-items-center border transition-colors duration-500",
            iconBoxStyle,
          )}
        >
          <Icon className="size-3.5" />
        </span>
        <span className="font-mono text-[9px] text-muted-foreground/60">{station.n}</span>
      </div>

      <p className="mt-2.5 text-[13px] font-medium leading-none">{station.title}</p>
      <p className="mt-1 font-mono text-[9px] uppercase tracking-[0.14em] text-muted-foreground">
        {station.sub}
      </p>

      <div className="mt-2.5 flex h-4 items-center">
        {statusContent}
      </div>
    </div>
  );
}

function CoreNode({ powering }: Readonly<{ powering: boolean }>) {
  return (
    <div
      className={cn(
        "relative flex w-40 flex-col items-center border border-primary/45 bg-card/90 p-4 text-center backdrop-blur-sm transition-shadow duration-500",
        powering ? "shadow-[0_0_26px_var(--glow-primary)]" : "shadow-[0_0_14px_var(--glow-primary)]",
      )}
    >
      <span className="relative grid size-12 place-items-center rounded-full border border-primary/40 bg-primary/5">
        <span
          className={cn(
            "absolute inline-flex size-12 rounded-full bg-primary/15",
            powering && "animate-ping",
          )}
        />
        <Image
          src="/icons/velocity-mark.svg"
          alt="VelocityAI"
          width={30}
          height={30}
          className="relative size-7.5"
        />
      </span>
      <p className="mt-2.5 text-[13px] font-medium">VelocityAI</p>
      <p className="mt-0.5 font-mono text-[9px] uppercase tracking-[0.18em] text-primary">
        Agentic core
      </p>
    </div>
  );
}

/* ---- arcs layer ---- */
function Arcs({ stage }: Readonly<{ stage: Stage }>) {
  return (
    <svg viewBox={`0 0 ${VB_W} ${VB_H}`} className="absolute inset-0 size-full" fill="none">
      {ARCS.map((d, i) => {
        const drawn = i < stage.step || stage.mode === "hold";
        const drawing = stage.mode === "draw" && i === stage.step;
        const active = stage.mode === "run" && i === stage.step;
        if (!drawn && !drawing && !active) return null;
        const stationId = STATIONS[i]?.id ?? `arc-${i}`;
        return (
          <g key={stationId}>
            {drawing && (
              <motion.path
                d={d}
                strokeWidth={1.5}
                className="stroke-primary"
                initial={{ pathLength: 0, opacity: 0.9 }}
                animate={{ pathLength: 1 }}
                transition={{ duration: DRAW_MS / 1000, ease: "easeInOut" }}
              />
            )}
            {active && (
              <path d={d} strokeWidth={1.5} className="flow-dash stroke-primary" strokeLinecap="round" />
            )}
            {drawn && !active && (
              <path
                d={d}
                strokeWidth={1.2}
                strokeDasharray="4 7"
                className="stroke-success/45"
                strokeLinecap="round"
              />
            )}
          </g>
        );
      })}
    </svg>
  );
}

function useStageMachine(running: boolean) {
  const [stage, setStage] = useState<Stage>({ step: 0, mode: "draw" });

  useEffect(() => {
    if (!running) return;
    let t: ReturnType<typeof setTimeout>;
    if (stage.mode === "draw") {
      t = setTimeout(() => setStage({ step: stage.step, mode: "run" }), DRAW_MS);
    } else if (stage.mode === "run") {
      t = setTimeout(() => {
        if (stage.step === STATIONS.length - 1) setStage({ step: STATIONS.length, mode: "hold" });
        else setStage({ step: stage.step + 1, mode: "draw" });
      }, RUN_MS);
    } else {
      t = setTimeout(() => setStage({ step: 0, mode: "draw" }), HOLD_MS);
    }
    return () => clearTimeout(t);
  }, [running, stage]);

  return stage;
}

function stationState(i: number, stage: Stage): "idle" | "drawing" | "running" | "done" {
  if (i < stage.step || stage.mode === "hold") return "done";
  if (i > stage.step) return "idle";
  return stage.mode === "draw" ? "drawing" : "running";
}

function getStageLabel(stage: Stage): string {
  if (stage.mode === "hold") {
    return "pipeline complete — restarting";
  }
  const action = stage.mode === "draw" ? "· powering up" : "· running";
  const stationTitle = STATIONS[stage.step]?.title.toLowerCase() ?? "";
  return `step ${stage.step + 1}/${STATIONS.length} — ${stationTitle} ${action}`;
}

export function HowItWorks() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { margin: "-100px" });
  const stage = useStageMachine(inView);
  const currentLabel = getStageLabel(stage);

  return (
    <section id="how-it-works" className="mt-32 w-full scroll-mt-24 px-3 sm:px-5">
      <div className="mx-auto w-full max-w-6xl">
      <div className="max-w-2xl">
        <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-primary">How VelocityAI works</p>
        <h2 className="mt-4 font-display text-3xl tracking-tight sm:text-4xl">
          One core, powering every{" "}
          <span className="font-serif italic text-foreground/60">
            station in the loop.
          </span>
        </h2>
        <p className="mt-4 font-mono text-sm leading-relaxed text-muted-foreground">
          The agentic core lights up each stage in order — when a station finishes, its route turns
          green and the next connection comes alive.
        </p>
      </div>

      <div
        ref={ref}
        className="dot-map relative mt-10 overflow-hidden border border-border bg-card/30"
      >
        {/* Desktop route map */}
        <div className="relative hidden aspect-12/5 lg:block">
          <Arcs stage={stage} />

          <div
            className="absolute -translate-x-1/2 -translate-y-1/2"
            style={{ left: `${(CORE[0] / VB_W) * 100}%`, top: `${(CORE[1] / VB_H) * 100}%` }}
          >
            <CoreNode powering={stage.mode === "draw"} />
          </div>

          {STATIONS.map((s, i) => (
            <div
              key={s.id}
              className="absolute -translate-x-1/2 -translate-y-1/2"
              style={{ left: `${(s.at[0] / VB_W) * 100}%`, top: `${(s.at[1] / VB_H) * 100}%` }}
            >
              <StationCard station={s} state={stationState(i, stage)} />
            </div>
          ))}

          {/* radar status line */}
          <div className="absolute bottom-3 left-4 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
            <span
              className={cn(
                "size-1.5 rounded-full",
                stage.mode === "hold" ? "bg-success" : "animate-pulse bg-primary",
              )}
            />
            {currentLabel}
          </div>
        </div>

        {/* Mobile: vertical route */}
        <div className="flex flex-col items-center gap-0 px-5 py-8 lg:hidden">
          <CoreNode powering={stage.mode === "draw"} />
          {STATIONS.map((s, i) => {
            const state = stationState(i, stage);
            const connActive = stage.step === i && stage.mode !== "hold";
            const connDone = i < stage.step || stage.mode === "hold";
            let connBorder = "border-border";
            if (connDone) {
              connBorder = "border-success/50";
            } else if (connActive) {
              connBorder = "border-primary";
            }
            return (
              <div key={s.id} className="flex flex-col items-center">
                <span
                  className={cn(
                    "my-1 h-8 w-px border-l border-dashed transition-colors duration-500",
                    connBorder,
                  )}
                />
                <StationCard station={s} state={state} />
              </div>
            );
          })}
        </div>
      </div>
      </div>
    </section>
  );
}

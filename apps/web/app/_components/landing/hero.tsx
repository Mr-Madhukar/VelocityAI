"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { motion, type Variants } from "framer-motion";
import {
  ArrowRight,
  FileText,
  GitPullRequestArrow,
  ListChecks,
  MessagesSquare,
  Rocket,
  ShieldCheck,
  Sparkles,
} from "lucide-react";

import { HeroFeatureOrbs, HeroFeatureStrip } from "./hero-feature-orbs";

const HeroBackground = dynamic(() => import("./hero-background"), { ssr: false });

const fadeUp: Variants = {
  hidden: { opacity: 0, y: 22 },
  show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 300, damping: 26 } },
};

const container: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.11 } },
};

const steps = [
  { icon: MessagesSquare, label: "Clarify" },
  { icon: FileText, label: "PRD" },
  { icon: ListChecks, label: "Tasks" },
  { icon: ShieldCheck, label: "Review" },
  { icon: Rocket, label: "Ship" },
];

export function LandingHero() {
  return (
    <section className="relative isolate flex min-h-[100svh] flex-col justify-center overflow-hidden pb-56 pt-28">
      {/* interactive particle field — runs to the horizon at the very top,
          stays visible at the bottom so the demo window sits on it */}
      <div
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          maskImage:
            "linear-gradient(to bottom, black 0%, black 88%, rgba(0,0,0,0.35) 100%)",
          WebkitMaskImage:
            "linear-gradient(to bottom, black 0%, black 88%, rgba(0,0,0,0.35) 100%)",
        }}
      >
        <HeroBackground className="absolute inset-0" />
      </div>

      <motion.div
        initial="hidden"
        animate="show"
        variants={container}
        className="mx-auto w-full max-w-4xl px-5 text-center sm:px-8"
      >
        <motion.div
          variants={fadeUp}
          className="inline-flex items-center gap-2 border border-border bg-background/60 px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground backdrop-blur-sm"
        >
          <Sparkles className="size-3.5 text-primary" />
          AI product delivery OS
        </motion.div>

        <motion.h1
          variants={fadeUp}
          className="mx-auto mt-8 max-w-3xl font-[family-name:var(--font-display)] text-5xl leading-[1.04] tracking-tight sm:text-7xl"
        >
          Ship exactly{" "}
          <span className="font-[family-name:var(--font-serif)] italic text-foreground/60">
            what was asked.
          </span>
        </motion.h1>

        <motion.p
          variants={fadeUp}
          className="mx-auto mt-7 max-w-xl font-mono text-sm leading-relaxed text-muted-foreground"
        >
          VelocityAI turns a rough ask into a clarified PRD, sized tasks, and a spec-aware review on
          every pull request — one agentic core, from idea to release.
        </motion.p>

        <motion.div variants={fadeUp} className="mt-10 flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/sign-in?callbackUrl=/features/new"
            className="group inline-flex h-11 items-center gap-2 border border-primary bg-primary px-5 text-sm font-medium text-primary-foreground shadow-[0_0_22px_var(--glow-primary)] transition-colors hover:bg-transparent hover:text-foreground"
          >
            Generate first PRD
            <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
          </Link>
          <Link
            href="/sign-in?callbackUrl=/reviews"
            className="inline-flex h-11 items-center gap-2 border border-border bg-background/60 px-5 text-sm font-medium text-foreground backdrop-blur-sm transition-colors hover:bg-foreground/[0.06]"
          >
            Watch a PR review
            <GitPullRequestArrow className="size-4" />
          </Link>
        </motion.div>

        {/* pipeline strip */}
        <motion.div variants={fadeUp} className="mt-14 flex items-center justify-center gap-0 overflow-x-auto">
          {steps.map((s, i) => (
            <div key={s.label} className="flex shrink-0 items-center">
              <span className="group flex items-center gap-2 border border-border bg-background/60 px-3 py-2 backdrop-blur-sm transition-colors hover:border-primary/40">
                <s.icon className="size-3.5 text-muted-foreground transition-colors group-hover:text-primary" />
                <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground transition-colors group-hover:text-foreground">
                  {s.label}
                </span>
              </span>
              {i < steps.length - 1 && <span className="h-px w-4 shrink-0 bg-border sm:w-6" />}
            </div>
          ))}
        </motion.div>

        {/* capability chips — compact stand-in for the orb constellation below xl */}
        <motion.div variants={fadeUp}>
          <HeroFeatureStrip />
        </motion.div>
      </motion.div>

      {/* floating capability constellation — flanks the headline on xl+ */}
      <HeroFeatureOrbs />
    </section>
  );
}

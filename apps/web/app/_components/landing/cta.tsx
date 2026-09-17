"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight, MessageSquareText } from "lucide-react";

export function LandingCta() {
  return (
    <section className="mt-32 w-full px-3 sm:px-5">
      <div className="mx-auto w-full max-w-6xl">
      <motion.div
        initial={{ opacity: 0, y: 28 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-100px" }}
        transition={{ duration: 0.7, ease: "easeOut" }}
        className="relative overflow-hidden border border-border bg-card/40 px-6 py-20 text-center sm:px-10"
      >
        <div className="pointer-events-none absolute left-1/2 top-1/2 h-72 w-176 max-w-full -translate-x-1/2 -translate-y-1/2 bg-foreground/3 blur-[140px]" />

        <div className="relative mx-auto max-w-2xl">
          <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-primary">Ship with confidence</p>
          <h2 className="mt-5 font-display text-4xl tracking-tight sm:text-5xl">
            Ship what the PRD{" "}
            <span className="font-serif italic text-foreground/60">
              promised.
            </span>
          </h2>
          <p className="mt-5 font-mono text-sm leading-relaxed text-muted-foreground">
            Capture an idea, generate the PRD, and let VelocityAI gate every release on the
            requirement — from first request to shipped code.
          </p>
          <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/sign-in?callbackUrl=/features/new"
              className="group inline-flex h-11 items-center gap-2 border border-primary bg-primary px-5 text-sm font-medium text-primary-foreground shadow-[0_0_40px_var(--glow-primary)] transition-colors hover:bg-transparent hover:text-foreground"
            >
              Generate first PRD
              <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
            <Link
              href="/sign-in?callbackUrl=/reviews"
              className="inline-flex h-11 items-center gap-2 border border-border bg-foreground/3 px-5 text-sm font-medium text-foreground transition-colors hover:bg-foreground/6"
            >
              Watch a PR review
              <MessageSquareText className="size-4" />
            </Link>
          </div>
        </div>
      </motion.div>
      </div>
    </section>
  );
}

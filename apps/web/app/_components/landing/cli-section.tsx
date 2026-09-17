"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowUpRight, BookOpen, Braces, ScanLine, Terminal } from "lucide-react";
import { SiGithub, SiNpm } from "react-icons/si";

/**
 * Developer section — promotes the VelocityAI CLI as a first-class way to drive
 * the pipeline. Static terminal, install command, and npm/GitHub links.
 */

const bullets = [
  {
    icon: <ScanLine className="size-4" />,
    title: "Browser login — nothing to paste",
    body: "VelocityAI login opens your browser to approve, like signing into a smart TV. No API keys copied by hand.",
  },
  {
    icon: <Braces className="size-4" />,
    title: "Type-safe, generated from the same API",
    body: "The CLI is generated from the exact API the web app uses — commands can never drift from the product.",
  },
  {
    icon: <Terminal className="size-4" />,
    title: "--json for scripts & CI",
    body: "Pipe features, PRDs, and reviews into automation. Set VelocityAI_TOKEN and run it headless in CI.",
  },
];

type TerminalLine = { kind: "cmd" | "ok" | "out"; text: string };

const TERMINAL_LINES: TerminalLine[] = [
  { kind: "cmd", text: "npm install -g VelocityAI" },
  { kind: "out", text: "added 6 packages in 2s" },
  { kind: "cmd", text: "VelocityAI login" },
  { kind: "ok", text: "signed in as you@team.com" },
  { kind: "cmd", text: 'VelocityAI feature create "Dark mode toggle"' },
  { kind: "ok", text: "feature 0b75cf3a created" },
  { kind: "cmd", text: "VelocityAI prd approve 0b75cf3a" },
  { kind: "ok", text: "approved — task generation triggered" },
  { kind: "cmd", text: "VelocityAI review watch" },
  { kind: "out", text: "PR #128 → reviewing against PRD…" },
  { kind: "ok", text: "review passed — 3/3 criteria · score 92" },
];

function getLineClassName(kind: TerminalLine["kind"]): string | undefined {
  if (kind === "ok") return "text-success";
  if (kind === "out") return "text-muted-foreground";
  return undefined;
}

function renderTerminalLine(l: TerminalLine) {
  if (l.kind === "cmd") {
    return (
      <>
        <span className="text-primary">$ </span>
        <span className="text-foreground/90">{l.text}</span>
      </>
    );
  }
  if (l.kind === "ok") {
    return <>✔ {l.text}</>;
  }
  return <>→ {l.text}</>;
}

export function CliSection() {
  return (
    <section id="cli" className="mt-32 w-full scroll-mt-24 px-3 sm:px-5">
      <div className="mx-auto grid w-full max-w-6xl items-center gap-10 lg:grid-cols-2 lg:gap-14">
        {/* Copy */}
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-primary">For developers</p>
          <h2 className="mt-4 font-display text-3xl tracking-tight sm:text-4xl">
            The whole pipeline,{" "}
            <span className="font-serif italic text-foreground/60">
              one npm install away.
            </span>
          </h2>
          <p className="mt-4 font-mono text-sm leading-relaxed text-muted-foreground">
            Skip the dashboard when you&apos;re in flow — create features, approve PRDs, and watch
            reviews land without leaving your terminal. Same account, same data, same gates.
          </p>

          {/* install command */}
          <div className="mt-7 flex max-w-md items-center justify-between border border-border bg-card/60 px-4 py-3">
            <p className="font-mono text-sm">
              <span className="text-primary">$</span>{" "}
              <span className="text-foreground/90">npm install -g VelocityAI</span>
            </p>
            <span className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground">
              node ≥ 18
            </span>
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-3">
            <Link
              href="/docs/cli"
              className="group inline-flex h-10 items-center gap-2 border border-primary bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-transparent hover:text-foreground"
            >
              <BookOpen className="size-4" />
              CLI docs
              <ArrowUpRight className="size-3.5 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
            </Link>
            <a
              href="https://www.npmjs.com/package/VelocityAI"
              target="_blank"
              rel="noreferrer"
              className="group inline-flex h-10 items-center gap-2 border border-border bg-foreground/3 px-4 text-sm font-medium text-foreground transition-colors hover:border-primary/40"
            >
              <SiNpm className="size-4 text-[#cb3837]" />
              npm
              <ArrowUpRight className="size-3.5 text-muted-foreground transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
            </a>
            <a
              href="https://github.com/Mr-Madhukar/VelocityAI"
              target="_blank"
              rel="noreferrer"
              className="group inline-flex h-10 items-center gap-2 border border-border bg-foreground/3 px-4 text-sm font-medium text-foreground transition-colors hover:border-primary/40"
            >
              <SiGithub className="size-4" />
              Source
              <ArrowUpRight className="size-3.5 text-muted-foreground transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
            </a>
          </div>

          {/* bullets */}
          <div className="mt-8 grid gap-2.5">
            {bullets.map((b, i) => (
              <motion.div
                key={b.title}
                initial={{ opacity: 0, y: 12 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-40px" }}
                transition={{ duration: 0.4, delay: i * 0.08 }}
                className="flex gap-3.5 border border-border bg-card/40 p-4"
              >
                <span className="grid size-8 shrink-0 place-items-center border border-border bg-foreground/4 text-primary">
                  {b.icon}
                </span>
                <div>
                  <p className="text-sm font-medium">{b.title}</p>
                  <p className="mt-1 font-mono text-xs leading-relaxed text-muted-foreground">{b.body}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Terminal */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: 0.55 }}
          className="overflow-hidden border border-border bg-card/70 backdrop-blur-sm"
        >
          <div className="flex items-center gap-2 border-b border-border bg-foreground/3 px-4 py-2.5">
            <span className="size-2.5 rounded-full bg-destructive/60" />
            <span className="size-2.5 rounded-full bg-amber-400/70" />
            <span className="size-2.5 rounded-full bg-success/60" />
            <span className="ml-2 font-mono text-[11px] text-muted-foreground">VelocityAI — zsh</span>
            <span className="ml-auto flex items-center gap-1.5 font-mono text-[9px] uppercase tracking-widest text-muted-foreground/60">
              <SiNpm className="size-3 text-[#cb3837]" /> VelocityAI
            </span>
          </div>
          <div className="space-y-1 p-5 font-mono text-[12.5px] leading-relaxed">
            {TERMINAL_LINES.map((l, i) => (
              <motion.p
                key={`${l.kind}-${l.text}`}
                initial={{ opacity: 0 }}
                whileInView={{ opacity: 1 }}
                viewport={{ once: true, margin: "-40px" }}
                transition={{ delay: 0.3 + i * 0.14 }}
                className={getLineClassName(l.kind)}
              >
                {renderTerminalLine(l)}
              </motion.p>
            ))}
            <motion.p
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              transition={{ delay: 0.3 + TERMINAL_LINES.length * 0.14 }}
            >
              <span className="text-primary">$ </span>
              <span className="animate-pulse text-primary">▍</span>
            </motion.p>
          </div>
        </motion.div>
      </div>
    </section>
  );
}

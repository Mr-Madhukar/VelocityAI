"use client";

import { useRef, useState } from "react";
import { AnimatePresence, motion, useInView } from "framer-motion";
import { Globe, Lock, Terminal } from "lucide-react";

import { cn } from "@/lib/utils";
import { DemoDashboard } from "./demo-dashboard";
import { DemoTerminal } from "./demo-terminal";

type TabId = "web" | "cli";

/**
 * The live product demo. No heading — the window rises straight out of the
 * hero (negative margin) with browser-style tabs to switch web ↔ terminal.
 */
export function ProductDemo() {
  const [tab, setTab] = useState<TabId>("web");
  const [path, setPath] = useState("/features");
  const frameRef = useRef<HTMLDivElement>(null);
  const inView = useInView(frameRef, { margin: "-60px" });

  return (
    <section id="demo" className="relative z-10 -mt-44 w-full scroll-mt-24 px-3 sm:px-5">
      <div className="mx-auto w-full max-w-6xl">
      <motion.div
        ref={frameRef}
        initial={{ opacity: 0, y: 34 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, delay: 0.5, ease: "easeOut" }}
        className="relative"
      >
        {/* soft halo behind the window — kept subtle */}
        <div className="pointer-events-none absolute -inset-8 -z-10 bg-glow-primary opacity-30 blur-[90px]" />

        <div className="overflow-hidden border border-border bg-card/80 backdrop-blur-md">
          {/* chrome: traffic lights + browser tabs */}
          <div className="flex items-end gap-1 border-b border-border bg-foreground/4 px-3 pt-2 sm:px-4">
            <div className="mb-2.5 mr-2 flex items-center gap-1.5 self-center sm:mr-3">
              <span className="size-2.5 rounded-full bg-destructive/60" />
              <span className="size-2.5 rounded-full bg-amber-400/70" />
              <span className="size-2.5 rounded-full bg-success/60" />
            </div>

            {(
              [
                {
                  id: "web" as const,
                  icon: Globe,
                  label: (
                    <span className="flex items-center gap-1">
                      <Lock className="size-2.5 text-success/80" />
                      VelocityAI.in
                      <AnimatePresence mode="popLayout">
                        <motion.span
                          key={path}
                          initial={{ opacity: 0, y: 3 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -3 }}
                          className="hidden text-muted-foreground sm:inline"
                        >
                          {path}
                        </motion.span>
                      </AnimatePresence>
                    </span>
                  ),
                },
                {
                  id: "cli" as const,
                  icon: Terminal,
                  label: <span>VelocityAI — zsh</span>,
                },
              ]
            ).map((t) => {
              const active = tab === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTab(t.id)}
                  className={cn(
                    "relative -mb-px flex min-w-0 items-center gap-2 border px-3 py-2 font-mono text-[10.5px] transition-colors sm:px-4",
                    active
                      ? "border-border border-b-transparent bg-card text-foreground"
                      : "border-transparent text-muted-foreground hover:bg-foreground/4 hover:text-foreground/80",
                  )}
                >
                  {active && (
                    <motion.span
                      layoutId="demo-tab-accent"
                      className="absolute inset-x-0 top-0 h-px bg-primary shadow-[0_0_10px_var(--primary)]"
                      transition={{ type: "spring", stiffness: 500, damping: 40 }}
                    />
                  )}
                  <t.icon className={cn("size-3 shrink-0", active && "text-primary")} />
                  <span className="truncate">{t.label}</span>
                </button>
              );
            })}

            <span className="ml-auto mb-2.5 hidden items-center gap-1.5 self-center font-mono text-[9px] uppercase tracking-widest text-muted-foreground/60 md:flex">
              <span className="size-1 animate-pulse rounded-full bg-success" />
              <span>live demo</span>
            </span>
          </div>

          <AnimatePresence mode="wait">
            <motion.div
              key={tab}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.3 }}
            >
              {tab === "web" ? (
                <DemoDashboard running={inView && tab === "web"} onPathChange={setPath} />
              ) : (
                <DemoTerminal running={inView && tab === "cli"} />
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </motion.div>
      </div>
    </section>
  );
}

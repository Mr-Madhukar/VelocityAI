"use client";

import { useEffect, useRef, useState } from "react";

import { cn } from "@/lib/utils";

/**
 * "Video-style" terminal replay — types the full CLI pipeline (install →
 * login → feature → PRD → review → ship) character by character, then loops.
 */

type ScriptLine = {
  id: string;
  kind: "cmd" | "out" | "ok" | "wait" | "blank";
  text: string;
  /** pause after the line is fully shown (ms) */
  hold?: number;
};

const SCRIPT: ScriptLine[] = [
  { id: "step-1", kind: "cmd", text: "npm install -g VelocityAI" },
  { id: "step-2", kind: "out", text: "added 6 packages in 2s" },
  { id: "step-3", kind: "blank", text: "" },
  { id: "step-4", kind: "cmd", text: "VelocityAI login" },
  { id: "step-5", kind: "wait", text: "opening browser to approve…", hold: 700 },
  { id: "step-6", kind: "ok", text: "signed in as you@team.com" },
  { id: "step-7", kind: "blank", text: "" },
  { id: "step-8", kind: "cmd", text: 'VelocityAI feature create "Dark mode toggle" --priority urgent' },
  { id: "step-9", kind: "ok", text: "feature 0b75cf3a created — clarifying questions ready" },
  { id: "step-10", kind: "blank", text: "" },
  { id: "step-11", kind: "cmd", text: "VelocityAI prd generate 0b75cf3a" },
  { id: "step-12", kind: "wait", text: "drafting spec from clarified requirements…", hold: 900 },
  { id: "step-13", kind: "ok", text: "PRD ready — 3 acceptance criteria" },
  { id: "step-14", kind: "blank", text: "" },
  { id: "step-15", kind: "cmd", text: "VelocityAI prd approve 0b75cf3a" },
  { id: "step-16", kind: "ok", text: "approved — task breakdown triggered" },
  { id: "step-17", kind: "blank", text: "" },
  { id: "step-18", kind: "cmd", text: "VelocityAI review watch" },
  { id: "step-19", kind: "out", text: "PR #128 opened → reviewing against PRD…", hold: 900 },
  { id: "step-20", kind: "ok", text: "review passed — 3/3 criteria met" },
  { id: "step-21", kind: "ok", text: "feature shipped 🚀", hold: 3400 },
];

const TYPE_MS = 26;
const LINE_GAP_MS = 340;

function LineView({ line, chars }: Readonly<{ line: ScriptLine; chars: number }>) {
  if (line.kind === "blank") return <div className="h-3" />;
  if (line.kind === "cmd") {
    return (
      <div>
        <span className="text-primary">$ </span>
        <span className="text-foreground/90">{line.text.slice(0, chars)}</span>
        {chars < line.text.length && <span className="animate-pulse text-primary">▍</span>}
      </div>
    );
  }
  const done = chars >= line.text.length;
  return (
    <div
      className={cn(
        line.kind === "ok" && "text-success",
        line.kind === "out" && "text-muted-foreground",
        line.kind === "wait" && "text-muted-foreground/80",
      )}
    >
      {line.kind === "ok" && "✔ "}
      {line.kind === "wait" && <span className={cn("mr-1 inline-block", !done && "animate-spin")}>⠋</span>}
      {line.kind === "out" && "→ "}
      {line.text}
    </div>
  );
}

export function DemoTerminal({ running }: Readonly<{ running: boolean }>) {
  // number of fully revealed lines + typing progress within the current one
  const [pos, setPos] = useState<{ line: number; chars: number }>({ line: 0, chars: 0 });
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!running) return;
    const current = SCRIPT[pos.line];

    // finished the whole script → hold, then loop
    if (!current) {
      const t = setTimeout(() => setPos({ line: 0, chars: 0 }), 3200);
      return () => clearTimeout(t);
    }

    // commands type char-by-char; output lines appear whole
    if (current.kind === "cmd" && pos.chars < current.text.length) {
      const t = setTimeout(() => setPos((p) => ({ ...p, chars: p.chars + 1 })), TYPE_MS);
      return () => clearTimeout(t);
    }

    const gap = (current.hold ?? 0) + (current.kind === "cmd" ? 420 : LINE_GAP_MS);
    const t = setTimeout(() => setPos((p) => ({ line: p.line + 1, chars: 0 })), gap);
    return () => clearTimeout(t);
  }, [running, pos]);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [pos]);

  return (
    <div
      ref={scrollRef}
      className="h-140 overflow-y-auto p-5 text-left font-mono text-[12px] leading-relaxed sm:h-155 sm:text-[12.5px]"
    >
      {SCRIPT.slice(0, pos.line + 1).map((line, i) => (
        <LineView key={line.id} line={line} chars={i < pos.line ? line.text.length : pos.chars} />
      ))}
    </div>
  );
}

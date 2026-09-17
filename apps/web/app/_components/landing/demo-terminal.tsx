"use client";

import { useEffect, useRef, useState } from "react";

import { cn } from "@/lib/utils";

/**
 * "Video-style" terminal replay — types the full CLI pipeline (install →
 * login → feature → PRD → review → ship) character by character, then loops.
 */

type ScriptLine = {
  kind: "cmd" | "out" | "ok" | "wait" | "blank";
  text: string;
  /** pause after the line is fully shown (ms) */
  hold?: number;
};

const SCRIPT: ScriptLine[] = [
  { kind: "cmd", text: "npm install -g VelocityAI" },
  { kind: "out", text: "added 6 packages in 2s" },
  { kind: "blank", text: "" },
  { kind: "cmd", text: "VelocityAI login" },
  { kind: "wait", text: "opening browser to approve…", hold: 700 },
  { kind: "ok", text: "signed in as you@team.com" },
  { kind: "blank", text: "" },
  { kind: "cmd", text: 'VelocityAI feature create "Dark mode toggle" --priority urgent' },
  { kind: "ok", text: "feature 0b75cf3a created — clarifying questions ready" },
  { kind: "blank", text: "" },
  { kind: "cmd", text: "VelocityAI prd generate 0b75cf3a" },
  { kind: "wait", text: "drafting spec from clarified requirements…", hold: 900 },
  { kind: "ok", text: "PRD ready — 3 acceptance criteria" },
  { kind: "blank", text: "" },
  { kind: "cmd", text: "VelocityAI prd approve 0b75cf3a" },
  { kind: "ok", text: "approved — task breakdown triggered" },
  { kind: "blank", text: "" },
  { kind: "cmd", text: "VelocityAI review watch" },
  { kind: "out", text: "PR #128 opened → reviewing against PRD…", hold: 900 },
  { kind: "ok", text: "review passed — 3/3 criteria met" },
  { kind: "ok", text: "feature shipped 🚀", hold: 3400 },
];

const TYPE_MS = 26;
const LINE_GAP_MS = 340;

function LineView({ line, chars }: { line: ScriptLine; chars: number }) {
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

export function DemoTerminal({ running }: { running: boolean }) {
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
      className="h-[560px] overflow-y-auto p-5 text-left font-mono text-[12px] leading-relaxed sm:h-[620px] sm:text-[12.5px]"
    >
      {SCRIPT.slice(0, pos.line + 1).map((line, i) => (
        <LineView key={i} line={line} chars={i < pos.line ? line.text.length : pos.chars} />
      ))}
    </div>
  );
}

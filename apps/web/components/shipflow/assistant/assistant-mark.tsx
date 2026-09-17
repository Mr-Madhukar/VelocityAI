"use client";

import { useId } from "react";
import { motion, useReducedMotion } from "framer-motion";

import { cn } from "~/lib/utils";

export type AgentState = "idle" | "hover" | "thinking";

/**
 * The assistant's identity mark — a live version of the VelocityAI logo. Same
 * dark glass tile + cyan→emerald rising chevrons + node, wrapped in a
 * rotating neon border sweep and a breathing glow so it reads as "on".
 * States: hover scales up; thinking speeds the sweep up and cascades the
 * chevrons upward like a signal. Honors prefers-reduced-motion with a
 * static logo fallback.
 */
export function AssistantMark({
  state = "idle",
  size = 44,
  className,
}: Readonly<{
  state?: AgentState;
  size?: number;
  className?: string;
}>) {
  const reduceMotion = useReducedMotion();
  const gradId = useId();
  const thinking = state === "thinking";

  const sweepDur = thinking ? "1.4s" : "4.5s";
  const pulseDur = thinking ? "1.2s" : "3.4s";

  function getChevronAnim(baseOpacity: number) {
    if (reduceMotion) return undefined;
    if (thinking) {
      return { opacity: [baseOpacity * 0.35, 1, baseOpacity * 0.35], y: [1.5, -1.5, 1.5] };
    }
    return { opacity: baseOpacity, y: 0 };
  }

  return (
    <motion.div
      aria-hidden
      animate={reduceMotion ? undefined : { scale: state === "hover" ? 1.07 : 1 }}
      transition={{ type: "spring", stiffness: 300, damping: 20 }}
      className={cn("relative", className)}
      style={{ width: size, height: size }}
    >
      <style>{MARK_CSS}</style>

      {/* Breathing neon glow */}
      <div
        className="sf-mark-glow absolute -inset-[12%] rounded-[32%]"
        style={{
          animationDuration: pulseDur,
          animationPlayState: reduceMotion ? "paused" : undefined,
          opacity: thinking ? 0.95 : undefined,
        }}
      />

      {/* Rotating gradient border sweep */}
      <div className="absolute inset-0 overflow-hidden rounded-[25%] bg-white/[0.14]">
        <div
          className="sf-mark-sweep absolute -inset-1/2"
          style={{
            animationDuration: sweepDur,
            animationPlayState: reduceMotion ? "paused" : undefined,
          }}
        />
      </div>

      {/* Dark glass tile (matches the logo tile) */}
      <div className="absolute inset-[1.5px] rounded-[24%] bg-[#0a0e12]">
        <svg viewBox="0 0 64 64" className="size-full">
          <defs>
            <linearGradient id={gradId} x1="16" y1="48" x2="48" y2="16" gradientUnits="userSpaceOnUse">
              <stop stopColor="#22d3ee" />
              <stop offset="1" stopColor="#10b981" />
            </linearGradient>
          </defs>

          {/* Rising chevrons — cascade upward while thinking */}
          <g
            stroke={`url(#${gradId})`}
            strokeWidth="5"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          >
            <motion.path
              d="M17 39 L32 24 L47 39"
              animate={getChevronAnim(1)}
              transition={{ repeat: thinking ? Infinity : 0, duration: 1.3, ease: "easeInOut" }}
            />
            <motion.path
              d="M17 49 L32 34 L47 49"
              animate={getChevronAnim(0.45)}
              transition={{
                repeat: thinking ? Infinity : 0,
                duration: 1.3,
                delay: 0.18,
                ease: "easeInOut",
              }}
              opacity={0.45}
            />
          </g>

          {/* Signal node — always alive */}
          <motion.circle
            cx="32"
            cy="16.5"
            r="3.2"
            fill={`url(#${gradId})`}
            animate={
              reduceMotion
                ? undefined
                : { opacity: [0.55, 1, 0.55], scale: thinking ? [1, 1.35, 1] : [1, 1.12, 1] }
            }
            transition={{
              repeat: Infinity,
              duration: thinking ? 0.9 : 2.6,
              ease: "easeInOut",
            }}
            style={{ transformOrigin: "32px 16.5px" }}
          />
        </svg>
      </div>
    </motion.div>
  );
}

const MARK_CSS = `
@keyframes sf-mark-spin { to { transform: rotate(360deg); } }
@keyframes sf-mark-pulse {
  0%, 100% { opacity: 0.45; transform: scale(1); }
  50% { opacity: 0.8; transform: scale(1.05); }
}
.sf-mark-glow {
  background:
    radial-gradient(58% 58% at 32% 72%, rgba(34, 211, 238, 0.6), transparent 72%),
    radial-gradient(58% 58% at 70% 28%, rgba(16, 185, 129, 0.55), transparent 72%);
  filter: blur(9px);
  animation: sf-mark-pulse 3.4s ease-in-out infinite;
}
.sf-mark-sweep {
  background: conic-gradient(
    from 0deg,
    transparent 0deg 250deg,
    rgba(34, 211, 238, 0.9) 300deg,
    rgba(16, 185, 129, 0.9) 330deg,
    transparent 360deg
  );
  animation: sf-mark-spin 4.5s linear infinite;
}
@media (prefers-reduced-motion: reduce) {
  .sf-mark-glow, .sf-mark-sweep { animation: none; }
}
`;

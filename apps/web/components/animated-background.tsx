"use client";

import { motion, useReducedMotion } from "framer-motion";

/**
 * Global ambient background — only a soft blurred wash (no grid, no amber).
 * The grid + amber glow live inside the hero section so they fade away below it.
 */
export function AnimatedBackground() {
  const reduce = useReducedMotion();

  return (
    <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
      <motion.div
        initial={reduce ? false : { opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 2, ease: "easeOut" }}
        className="absolute left-1/2 top-1/2 h-[680px] w-[900px] -translate-x-1/2 -translate-y-1/2 bg-foreground/[0.025] blur-[170px]"
      />
    </div>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";
import { motion, useInView, useReducedMotion } from "framer-motion";

const metrics = [
  { value: 4.8, decimals: 1, suffix: "x", label: "Feature cycle", detail: "faster from request to release" },
  { value: 92, decimals: 0, suffix: "%", label: "PRD coverage", detail: "requirements mapped before code" },
  { value: 38, decimals: 0, suffix: "%", label: "Review signal", detail: "fewer escaped requirement bugs" },
  { value: 24, decimals: 0, suffix: "", label: "Blockers found", detail: "issues caught before approval" },
];

function CountUp({ value, decimals, suffix }: { value: number; decimals: number; suffix: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });
  const reduce = useReducedMotion();
  const [n, setN] = useState(0);

  useEffect(() => {
    if (!inView) return;
    if (reduce) {
      setN(value);
      return;
    }
    let raf = 0;
    const start = performance.now();
    const dur = 1200;
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / dur);
      const eased = 1 - Math.pow(1 - p, 3);
      setN(value * eased);
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [inView, value, reduce]);

  return (
    <span ref={ref}>
      {n.toFixed(decimals)}
      {suffix}
    </span>
  );
}

export function LandingMetrics() {
  return (
    <section className="mt-32 w-full px-3 sm:px-5">
      <div className="mx-auto grid w-full max-w-6xl grid-cols-2 border-l border-t border-border lg:grid-cols-4">
        {metrics.map((m, i) => (
          <motion.div
            key={m.label}
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ duration: 0.5, delay: i * 0.08 }}
            className="border-r border-b border-border p-6"
          >
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">{m.label}</p>
            <p className="mt-4 text-4xl tracking-tight">
              <CountUp value={m.value} decimals={m.decimals} suffix={m.suffix} />
            </p>
            <p className="mt-2 font-mono text-xs text-muted-foreground">{m.detail}</p>
          </motion.div>
        ))}
      </div>
    </section>
  );
}

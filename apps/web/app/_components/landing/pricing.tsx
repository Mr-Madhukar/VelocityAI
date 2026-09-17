"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight, Check, Zap } from "lucide-react";

import { cn } from "@/lib/utils";

type Plan = {
  name: string;
  price: string;
  cadence: string;
  tagline: string;
  credits: { label: string; pct: number };
  features: string[];
  cta: string;
  href: string;
  highlighted?: boolean;
};

// Mirrors packages/services/shipflow/billing.ts (INR pricing).
const plans: Plan[] = [
  {
    name: "Free",
    price: "₹0",
    cadence: "/mo",
    tagline: "For trying the whole loop end to end.",
    credits: { label: "100 credits / mo", pct: 16 },
    features: [
      "5 feature requests",
      "2 organizations",
      "3 connected repositories",
      "3 projects",
      "Up to 3 teammates",
      "Full CLI access",
    ],
    cta: "Start free",
    href: "/sign-in?callbackUrl=/features/new",
  },
  {
    name: "Pro",
    price: "₹999",
    cadence: "/mo",
    tagline: "For teams shipping features every week.",
    credits: { label: "1,000 credits / mo", pct: 56 },
    features: [
      "200 feature requests",
      "5 organizations",
      "10 connected repositories",
      "10 projects",
      "Up to 10 teammates",
      "Everything in Free",
    ],
    cta: "Upgrade to Pro",
    href: "/sign-in?callbackUrl=/billing",
    highlighted: true,
  },
  {
    name: "Scale",
    price: "₹1,999",
    cadence: "/mo",
    tagline: "For larger orgs with many repos.",
    credits: { label: "5,000 credits / mo", pct: 92 },
    features: [
      "2,000 feature requests",
      "20 organizations",
      "50 connected repositories",
      "50 projects",
      "Unlimited teammates",
      "Everything in Pro",
    ],
    cta: "Go Scale",
    href: "/sign-in?callbackUrl=/billing",
  },
];

export function LandingPricing() {
  return (
    <section id="pricing" className="mt-32 w-full scroll-mt-24 px-3 sm:px-5">
      <div className="mx-auto w-full max-w-6xl">
      <div className="mx-auto max-w-2xl text-center">
        <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-primary">Pricing</p>
        <h2 className="mt-4 font-[family-name:var(--font-display)] text-3xl tracking-tight sm:text-4xl">
          Start free.{" "}
          <span className="font-[family-name:var(--font-serif)] italic text-foreground/60">
            Pay as you ship more.
          </span>
        </h2>
        <p className="mt-4 font-mono text-sm leading-relaxed text-muted-foreground">
          Every plan includes the full workflow and the CLI. AI reviews are metered as credits,
          enforced server-side — bigger plans just lift the limits.
        </p>
      </div>

      <div className="mt-12 grid gap-4 lg:grid-cols-3">
        {plans.map((plan, i) => (
          <motion.div
            key={plan.name}
            initial={{ opacity: 0, y: 18 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ duration: 0.5, delay: i * 0.08 }}
            className={cn(
              "neon-card relative flex flex-col p-7",
              plan.highlighted && "border-primary/50 shadow-[0_0_30px_var(--glow-primary)] lg:-mt-4 lg:mb-[-1px]",
            )}
          >
            {plan.highlighted ? (
              <span className="absolute -top-3 left-7 inline-flex items-center gap-1.5 border border-primary/60 bg-background px-2.5 py-1 font-mono text-[10px] uppercase tracking-widest text-primary">
                <Zap className="size-3" /> Most popular
              </span>
            ) : null}

            <div className="flex items-baseline justify-between">
              <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
                {plan.name}
              </p>
              <p className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground/60">
                billed monthly
              </p>
            </div>

            <div className="mt-5 flex items-baseline gap-1">
              <span className="text-[2.6rem] leading-none tracking-tight">{plan.price}</span>
              <span className="font-mono text-sm text-muted-foreground">{plan.cadence}</span>
            </div>
            <p className="mt-2.5 font-mono text-xs leading-relaxed text-muted-foreground">{plan.tagline}</p>

            {/* credit meter */}
            <div className="mt-6 border border-border bg-foreground/[0.02] p-3">
              <div className="flex items-center justify-between font-mono text-[9.5px] uppercase tracking-widest">
                <span className="text-muted-foreground">AI review credits</span>
                <span className={plan.highlighted ? "text-primary" : "text-foreground/70"}>
                  {plan.credits.label}
                </span>
              </div>
              <div className="mt-2 h-1 bg-foreground/10">
                <motion.div
                  initial={{ width: 0 }}
                  whileInView={{ width: `${plan.credits.pct}%` }}
                  viewport={{ once: true, margin: "-60px" }}
                  transition={{ duration: 0.9, delay: 0.3 + i * 0.1, ease: "easeOut" }}
                  className={cn("h-full", plan.highlighted ? "bg-primary" : "bg-foreground/35")}
                />
              </div>
            </div>

            <ul className="mt-5 divide-y divide-border/60">
              {plan.features.map((f) => (
                <li key={f} className="flex items-start gap-2.5 py-2 text-sm">
                  <Check className={cn("mt-0.5 size-3.5 shrink-0", plan.highlighted ? "text-primary" : "text-muted-foreground")} />
                  <span className="text-foreground/80">{f}</span>
                </li>
              ))}
            </ul>

            <Link
              href={plan.href}
              className={cn(
                "group mt-7 inline-flex h-11 items-center justify-center gap-2 border px-5 text-sm font-medium transition-colors",
                plan.highlighted
                  ? "border-primary bg-primary text-primary-foreground hover:bg-transparent hover:text-foreground"
                  : "border-border bg-foreground/[0.03] text-foreground hover:bg-foreground/[0.06]",
              )}
            >
              {plan.cta}
              <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
          </motion.div>
        ))}
      </div>

      <p className="mt-6 text-center font-mono text-[11px] text-muted-foreground">
        Prices in INR, billed monthly via Razorpay. Cancel anytime — access lasts to the period end.
      </p>
      </div>
    </section>
  );
}

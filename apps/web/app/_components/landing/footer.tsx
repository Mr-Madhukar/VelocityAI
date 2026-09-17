"use client";

import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { SiGithub } from "react-icons/si";

const columns = [
  {
    title: "Product",
    links: [
      { href: "/#demo", label: "Demo" },
      { href: "/#how-it-works", label: "How it works" },
      { href: "/#features", label: "Features" },
      { href: "/#pricing", label: "Pricing" },
    ],
  },
  {
    title: "Workflow",
    links: [
      { href: "/sign-in?callbackUrl=/features/new", label: "Generate a PRD" },
      { href: "/sign-in?callbackUrl=/tasks", label: "Task board" },
      { href: "/sign-in?callbackUrl=/reviews", label: "AI reviews" },
      { href: "/sign-in?callbackUrl=/github", label: "GitHub sync" },
    ],
  },
  {
    title: "Developers",
    links: [
      { href: "/#cli", label: "VelocityAI CLI" },
      { href: "/docs/cli", label: "CLI docs" },
      { href: "https://www.npmjs.com/package/VelocityAI", label: "npm package", external: true },
      { href: "https://github.com/Mr-Madhukar/My-ai-code-reviewer", label: "GitHub", external: true },
    ],
  },
  {
    title: "Account",
    links: [
      { href: "/sign-in", label: "Sign in" },
      { href: "/settings/team", label: "Team" },
      { href: "/profile", label: "Profile" },
    ],
  },
];

export function LandingFooter() {
  return (
    <footer className="relative mt-32 w-full overflow-hidden border-t border-border">
      {/* faint top glow */}
      <div className="pointer-events-none absolute left-1/2 top-0 h-40 w-180 max-w-full -translate-x-1/2 -translate-y-1/2 bg-glow-primary blur-[120px]" />

      <div className="w-full px-3 py-16 sm:px-5">
      <div className="mx-auto w-full max-w-6xl">
        <div className="grid gap-10 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-[1.3fr_repeat(4,1fr)]">
          <div>
            <div>
              <p className="text-base font-semibold tracking-tight text-foreground">VelocityAI</p>
              <p className="font-mono text-[9px] uppercase tracking-[0.18em] text-muted-foreground">
                Product delivery OS
              </p>
            </div>
            <p className="mt-4 max-w-xs font-mono text-xs leading-relaxed text-muted-foreground">
              From feature request to reviewed, approved, shipped software — one agentic core.
            </p>
            <div className="mt-5 flex items-center gap-2">
              <a
                href="https://github.com/Mr-Madhukar/My-ai-code-reviewer"
                target="_blank"
                rel="noreferrer"
                aria-label="VelocityAI on GitHub"
                className="grid size-9 place-items-center border border-border bg-foreground/3 text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
              >
                <SiGithub className="size-4" />
              </a>
              <Link
                href="/sign-in?callbackUrl=/features/new"
                className="group inline-flex h-9 items-center gap-1.5 border border-border bg-foreground/3 px-3 font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
              >
                Start shipping
                <ArrowUpRight className="size-3.5 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
              </Link>
            </div>
          </div>

          {columns.map((col) => (
            <div key={col.title}>
              <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                {col.title}
              </p>
              {/* hovering one link lights its border; the rest of the column picks up a soft text glow */}
              <ul className="group mt-4 space-y-1.5">
                {col.links.map((l) => {
                  const linkClass =
                    "-mx-2 inline-flex items-center gap-1 border border-transparent px-2 py-1 text-sm text-foreground/70 transition-all duration-300 group-hover:[text-shadow:0_0_12px_var(--glow-primary)] hover:border-primary/35 hover:bg-primary/[0.04] hover:text-foreground hover:shadow-[0_0_14px_var(--glow-primary)]";
                  return (
                    <li key={l.label}>
                      {"external" in l && l.external ? (
                        <a href={l.href} target="_blank" rel="noreferrer" className={linkClass}>
                          {l.label}
                          <ArrowUpRight className="size-3 text-muted-foreground/60" />
                        </a>
                      ) : (
                        <Link href={l.href} className={linkClass}>
                          {l.label}
                        </Link>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      </div>
      </div>

      {/* Oversized outlined wordmark with a slow light sheen sweeping through */}
      <div className="overflow-hidden border-t border-border px-3 sm:px-5">
        <div className="relative mx-auto w-full max-w-6xl py-10 text-center">
          <span
            aria-hidden
            className="wordmark-outline inline-block w-full select-none font-display text-[clamp(3rem,17vw,13rem)] font-semibold leading-[0.85] tracking-tighter transition-all duration-300 hover:[-webkit-text-stroke:1.2px_var(--primary)] hover:filter-[drop-shadow(0_0_26px_var(--glow-primary))]"
          >
            VelocityAI
          </span>
          <span
            aria-hidden
            className="wordmark-sheen pointer-events-none absolute inset-x-0 top-10 inline-block w-full select-none font-display text-[clamp(3rem,17vw,13rem)] font-semibold leading-[0.85] tracking-tighter"
          >
            VelocityAI
          </span>
        </div>
      </div>

      <div className="border-t border-border px-3 sm:px-5">
        <div className="mx-auto flex w-full max-w-6xl flex-col items-center justify-between gap-3 py-5 sm:flex-row">
          <div className="inline-flex items-center gap-2 font-mono text-xs text-muted-foreground">
            <span className="size-1.5 bg-success" />
            <span>All systems operational</span>
          </div>
          <p className="font-mono text-[11px] text-muted-foreground/70">
            © {new Date().getFullYear()} VelocityAI
          </p>
          <div className="flex items-center gap-6 font-mono text-xs text-muted-foreground">
            <Link href="/privacy" className="transition-colors hover:text-foreground">
              Privacy policy
            </Link>
            <Link href="/terms" className="transition-colors hover:text-foreground">
              Terms of service
            </Link>
            <Link href="/account-deletion" className="transition-colors hover:text-foreground">
              Account deletion
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}

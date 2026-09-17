"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { SiGithub } from "react-icons/si";

import { ThemeToggle } from "@/components/theme-toggle";
import { cn } from "@/lib/utils";

// Root-anchored so they navigate home first when clicked from /docs/* pages
const links = [
  { href: "/#demo", label: "Demo" },
  { href: "/#how-it-works", label: "How it works" },
  { href: "/#features", label: "Features" },
  { href: "/#cli", label: "CLI" },
  { href: "/#pricing", label: "Pricing" },
];

export function LandingNav() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header className="fixed inset-x-0 top-0 z-50 px-3 pt-3 sm:px-5">
      <nav
        className={cn(
          "mx-auto flex h-14 w-full max-w-6xl items-center justify-between border px-3 transition-all duration-300 sm:px-4",
          scrolled
            ? "border-border bg-background/80 backdrop-blur-xl"
            : "border-transparent bg-transparent",
        )}
      >
        {/* brand */}
        <Link href="/" className="flex items-center gap-2.5 transition-opacity hover:opacity-80">
          <span className="relative grid size-9 place-items-center border border-border bg-foreground/3">
            <Image
              src="/icons/velocity-mark.svg"
              alt="VelocityAI"
              width={24}
              height={24}
              className="size-6"
              priority
            />
            <span className="absolute -bottom-px left-1.5 right-1.5 h-px bg-linear-to-r from-transparent via-primary/60 to-transparent" />
          </span>
          <span className="hidden min-w-0 sm:block">
            <span className="block font-display text-sm font-medium leading-tight tracking-tight">
              VelocityAI
            </span>
            <span className="block font-mono text-[8px] uppercase tracking-[0.2em] text-muted-foreground">
              Product delivery OS
            </span>
          </span>
        </Link>

        {/* links */}
        <div className="hidden items-center gap-1 md:flex">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="group relative px-3 py-2 font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground transition-colors hover:text-foreground"
            >
              <span className="absolute inset-x-3 bottom-1 h-px origin-left scale-x-0 bg-primary transition-transform duration-300 group-hover:scale-x-100" />
              {l.label}
            </Link>
          ))}
        </div>

        {/* actions */}
        <div className="flex items-center gap-1.5">
          <a
            href="https://github.com/Mr-Madhukar/My-ai-code-reviewer"
            target="_blank"
            rel="noreferrer"
            aria-label="VelocityAI on GitHub"
            className="hidden size-9 place-items-center border border-border bg-foreground/2 text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground sm:grid"
          >
            <SiGithub className="size-4" />
          </a>
          <ThemeToggle />
          <span className="mx-1 hidden h-5 w-px bg-border sm:block" />
          <Link
            href="/sign-in"
            className="hidden h-9 items-center px-3 font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground transition-colors hover:text-foreground sm:inline-flex"
          >
            Sign in
          </Link>
          <Link
            href="/sign-in?callbackUrl=/features/new"
            className="group inline-flex h-9 items-center gap-1.5 border border-primary bg-primary px-3.5 text-xs font-medium text-primary-foreground transition-colors hover:bg-transparent hover:text-foreground"
          >
            Get started
            <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
          </Link>
        </div>
      </nav>
    </header>
  );
}

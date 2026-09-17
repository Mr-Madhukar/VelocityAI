import type { ReactNode } from "react";

import { LandingNav } from "../landing/nav";
import { LandingFooter } from "../landing/footer";

export function LegalPage({
  title,
  updated,
  intro,
  children,
}: {
  title: string;
  updated: string;
  intro?: ReactNode;
  children: ReactNode;
}) {
  return (
    <main className="relative flex min-h-screen flex-col overflow-x-hidden">
      <LandingNav />

      <article className="mx-auto w-full max-w-[76.7rem] px-5 pb-24 pt-32 sm:px-8 lg:px-10">
        <header className="border-b border-border pb-8">
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
            Legal
          </p>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight sm:text-5xl">{title}</h1>
          <p className="mt-4 font-mono text-xs text-muted-foreground">Last updated: {updated}</p>
          {intro ? (
            <p className="mt-6 text-base leading-7 text-foreground/80">{intro}</p>
          ) : null}
        </header>

        <div className="mt-10 space-y-10">{children}</div>
      </article>

      <LandingFooter />
    </main>
  );
}

export function LegalSection({
  n,
  heading,
  children,
}: {
  n: number;
  heading: string;
  children: ReactNode;
}) {
  return (
    <section className="space-y-3 scroll-mt-24">
      <h2 className="text-lg font-semibold tracking-tight text-foreground">
        <span className="mr-2 font-mono text-sm text-muted-foreground">{n}.</span>
        {heading}
      </h2>
      <div className="space-y-3 text-sm leading-7 text-foreground/75">{children}</div>
    </section>
  );
}

export function LegalList({ items }: { items: ReactNode[] }) {
  return (
    <ul className="space-y-2">
      {items.map((item, i) => (
        <li key={i} className="flex gap-2.5">
          <span className="mt-2.5 size-1.5 shrink-0 rounded-full bg-muted-foreground/60" />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

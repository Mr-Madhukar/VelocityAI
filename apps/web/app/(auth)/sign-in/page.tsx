import Link from "next/link";
import Image from "next/image";
import {
  ArrowLeft,
  FileText,
  GitPullRequestArrow,
  ListChecks,
  MessagesSquare,
  Rocket,
  ShieldCheck,
  Sparkles,
} from "lucide-react";

import { GithubSignInForm } from "@/features/auth/components/github-sign-in-form";
import { GoogleSignInForm } from "@/features/auth/components/google-sign-in-form";
import { EmailSignInForm } from "@/features/auth/components/email-sign-in-form";

const steps = [
  { icon: MessagesSquare, label: "Clarify" },
  { icon: FileText, label: "PRD" },
  { icon: ListChecks, label: "Tasks" },
  { icon: ShieldCheck, label: "Review" },
  { icon: Rocket, label: "Ship" },
];

const trust = [
  { icon: ShieldCheck, text: "PRD-first AI review on every PR" },
  { icon: GitPullRequestArrow, text: "GitHub-native sync & release gates" },
  { icon: Sparkles, text: "One agentic core, web + CLI" },
];

function Divider({ label }: Readonly<{ label: string }>) {
  return (
    <div className="flex items-center gap-3">
      <div className="h-px flex-1 bg-border" />
      <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">{label}</span>
      <div className="h-px flex-1 bg-border" />
    </div>
  );
}

export default async function SignInPage({
  searchParams,
}: Readonly<{
  searchParams: Promise<{ callbackUrl?: string }>;
}>) {
  const params = await searchParams;

  return (
    <main className="relative min-h-dvh overflow-hidden bg-background text-foreground">
      <div className="relative grid min-h-dvh lg:grid-cols-[1.05fr_1fr]">
        {/* Left — brand / marketing */}
        <section className="relative isolate hidden flex-col justify-between overflow-hidden border-r border-border px-10 py-9 lg:flex lg:px-14">
          <div className="pointer-events-none absolute inset-0 -z-10">
            <div
              className="app-grid absolute inset-0"
              style={{
                maskImage: "linear-gradient(to bottom, black 0%, black 45%, transparent 90%)",
                WebkitMaskImage: "linear-gradient(to bottom, black 0%, black 45%, transparent 90%)",
              }}
            />
            <div className="absolute left-0 top-0 h-105 w-140 -translate-x-1/4 -translate-y-1/4 bg-glow-primary blur-[130px]" />
          </div>

          <Link
            href="/"
            className="inline-flex w-fit items-center gap-2 font-mono text-[11px] uppercase tracking-widest text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="size-4" />
            Back to VelocityAI
          </Link>

          <div className="max-w-xl">
            <div className="inline-flex items-center gap-2 border border-border bg-background/60 px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground backdrop-blur-sm">
              <Sparkles className="size-3.5 text-primary" />
              AI product delivery OS
            </div>

            <h1 className="mt-7 font-display text-4xl tracking-tight sm:text-5xl sm:leading-[1.06]">
              Sign in and ship exactly{" "}
              <span className="font-serif italic text-foreground/60">
                what was asked.
              </span>
            </h1>

            <p className="mt-5 max-w-lg font-mono text-sm leading-relaxed text-muted-foreground">
              Feature requests, PRDs, tasks, GitHub PRs, AI review, and release approval — one
              clean workflow, in the browser or your terminal.
            </p>

            {/* pipeline strip — same language as the landing hero */}
            <div className="mt-8 flex items-center gap-0 overflow-x-auto">
              {steps.map((s, i) => (
                <div key={s.label} className="flex shrink-0 items-center">
                  <span className="group flex items-center gap-2 border border-border bg-background/60 px-3 py-2 backdrop-blur-sm transition-colors hover:border-primary/40">
                    <s.icon className="size-3.5 text-muted-foreground transition-colors group-hover:text-primary" />
                    <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground transition-colors group-hover:text-foreground">
                      {s.label}
                    </span>
                  </span>
                  {i < steps.length - 1 && <span className="h-px w-4 shrink-0 bg-border" />}
                </div>
              ))}
            </div>

            <div className="mt-8 grid grid-cols-3 gap-px border border-border bg-border">
              {trust.map((t) => (
                <div key={t.text} className="bg-card/80 p-4 backdrop-blur-sm">
                  <t.icon className="size-4 text-primary" />
                  <p className="mt-3 font-mono text-[11px] leading-relaxed text-muted-foreground">{t.text}</p>
                </div>
              ))}
            </div>
          </div>

          <p className="font-mono text-[11px] text-muted-foreground/70">
            From idea to reviewed, approved, shipped code — aligned.
          </p>
        </section>

        {/* Right — auth panel */}
        <section className="relative flex items-center justify-center px-4 py-12 sm:px-8">
          {/* quiet backdrop so the card reads as glass */}
          <div className="pointer-events-none absolute inset-0 -z-10">
            <div
              className="app-grid absolute inset-0 opacity-60 lg:hidden"
              style={{
                maskImage: "linear-gradient(to bottom, black 0%, transparent 70%)",
                WebkitMaskImage: "linear-gradient(to bottom, black 0%, transparent 70%)",
              }}
            />
            <div className="absolute right-0 top-1/3 h-80 w-105 translate-x-1/3 bg-glow-primary opacity-70 blur-[130px]" />
          </div>

          <div className="w-full max-w-md">
            <Link
              href="/"
              className="mb-6 inline-flex items-center gap-2 font-mono text-[11px] uppercase tracking-widest text-muted-foreground transition-colors hover:text-foreground lg:hidden"
            >
              <ArrowLeft className="size-4" />
              Back
            </Link>

            <div className="relative border border-border bg-card/85 backdrop-blur-sm">
              <div className="absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-primary/60 to-transparent" />

              <div className="p-6 sm:p-7">
                <div className="flex items-center gap-3 border-b border-border pb-5">
                  <span className="relative grid size-11 shrink-0 place-items-center border border-border bg-foreground/3">
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
                  <div>
                    <p className="font-display text-base font-medium leading-tight">
                      Welcome back
                    </p>
                    <p className="mt-0.5 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                      Sign in to your workspace
                    </p>
                  </div>
                </div>

                <div className="mt-6 grid gap-3">
                  <GithubSignInForm callbackUrl={params.callbackUrl} />
                  <GoogleSignInForm callbackUrl={params.callbackUrl} />
                  <Divider label="or continue with email" />
                  <EmailSignInForm callbackUrl={params.callbackUrl} />
                </div>

                <div className="mt-6 border border-border bg-foreground/2 p-4">
                  <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.18em] text-primary">
                    <Sparkles className="size-3.5" />
                    After login
                  </div>
                  <div className="mt-3 grid gap-2 font-mono text-xs text-muted-foreground">
                    <p className="flex items-center gap-2">
                      <GitPullRequestArrow className="size-3.5 shrink-0 text-primary" /> Connect GitHub repos &
                      webhooks.
                    </p>
                    <p className="flex items-center gap-2">
                      <ShieldCheck className="size-3.5 shrink-0 text-primary" /> Review PRs against approved PRDs.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <p className="mt-5 text-center font-mono text-[11px] leading-relaxed text-muted-foreground">
              By signing in you agree to our{" "}
              <Link href="/terms" className="text-foreground transition-colors hover:text-primary">
                Terms
              </Link>{" "}
              &{" "}
              <Link href="/privacy" className="text-foreground transition-colors hover:text-primary">
                Privacy
              </Link>
              .
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}

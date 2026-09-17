import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowUpRight, Terminal } from "lucide-react";

import { LandingNav } from "../../_components/landing/nav";
import { LandingFooter } from "../../_components/landing/footer";

export const metadata: Metadata = {
  title: "CLI docs · VelocityAI",
  description:
    "Reference for the VelocityAI CLI — drive features, PRDs, tasks, and AI code reviews from your terminal.",
};

/* ---------- doc building blocks ---------- */

function CodeBlock({ lines }: Readonly<{ lines: (string | { c: string })[] }>) {
  let counter = 0;
  return (
    <pre className="overflow-x-auto border border-border bg-card/60 p-4 font-mono text-[12.5px] leading-relaxed">
      {lines.map((l) => {
        counter++;
        const isComment = typeof l !== "string";
        const text = isComment ? l.c : l;
        return (
          <div key={`line-${counter}-${text}`} className={isComment ? "text-muted-foreground/70" : undefined}>
            {isComment ? (
              <>{text}</>
            ) : (
              <>
                <span className="text-primary">$ </span>
                <span className="text-foreground/90">{text}</span>
              </>
            )}
          </div>
        );
      })}
    </pre>
  );
}

function DocSection({
  id,
  heading,
  children,
}: Readonly<{ id: string; heading: string; children: ReactNode }>) {
  return (
    <section id={id} className="scroll-mt-28 space-y-4">
      <h2 className="border-b border-border pb-2 font-display text-xl font-medium tracking-tight">
        {heading}
      </h2>
      <div className="space-y-4 text-sm leading-7 text-foreground/75">{children}</div>
    </section>
  );
}

function FlagRow({ flag, desc }: Readonly<{ flag: string; desc: string }>) {
  return (
    <div className="grid grid-cols-[160px_1fr] items-baseline gap-3 border-b border-border/60 py-2 last:border-b-0">
      <code className="font-mono text-xs text-primary">{flag}</code>
      <span className="text-sm text-foreground/75">{desc}</span>
    </div>
  );
}

function CommandRow({ cmd, desc }: Readonly<{ cmd: string; desc: string }>) {
  return (
    <div className="grid grid-cols-1 items-baseline gap-1 border-b border-border/60 py-2 last:border-b-0 sm:grid-cols-[minmax(240px,340px)_1fr] sm:gap-3">
      <code className="font-mono text-xs text-primary">{cmd}</code>
      <span className="text-sm text-foreground/75">{desc}</span>
    </div>
  );
}

function CommandTable({ rows }: Readonly<{ rows: [string, string][] }>) {
  return (
    <div className="border border-border bg-card/40 px-4 py-1">
      {rows.map(([cmd, desc]) => (
        <CommandRow key={cmd} cmd={cmd} desc={desc} />
      ))}
    </div>
  );
}

const TOC = [
  { id: "install", label: "Install" },
  { id: "sign-in", label: "Sign in" },
  { id: "global-flags", label: "Global flags" },
  { id: "configuration", label: "Configuration" },
  { id: "workspace", label: "Orgs & workspace" },
  { id: "features", label: "Features" },
  { id: "prds", label: "PRDs" },
  { id: "prompts", label: "AI prompts" },
  { id: "tasks", label: "Tasks" },
  { id: "reviews", label: "Reviews" },
  { id: "scripting", label: "Scripting & CI" },
  { id: "troubleshooting", label: "Troubleshooting" },
  { id: "how-it-works", label: "How it works" },
];

export default function CliDocsPage() {
  return (
    <main className="relative flex min-h-screen flex-col overflow-x-hidden">
      <LandingNav />

      <div className="w-full px-3 pb-24 pt-32 sm:px-5">
      <div className="mx-auto w-full max-w-6xl">
        {/* header */}
        <header className="border-b border-border pb-8">
          <p className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.18em] text-primary">
            <Terminal className="size-3.5" /> Developer docs
          </p>
          <h1 className="mt-3 font-display text-4xl font-medium tracking-tight sm:text-5xl">
            VelocityAI{" "}
            <span className="font-serif italic text-foreground/60">CLI</span>
          </h1>
          <p className="mt-4 max-w-2xl font-mono text-sm leading-relaxed text-muted-foreground">
            Drive your AI product delivery pipeline — features → PRD → tasks → AI code review —
            straight from the terminal. Companion to the web app at VelocityAI.in.
          </p>
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <a
              href="https://www.npmjs.com/package/VelocityAI"
              target="_blank"
              rel="noreferrer"
              className="group inline-flex h-9 items-center gap-2 border border-border bg-foreground/3 px-3.5 text-xs font-medium text-foreground transition-colors hover:border-primary/40"
            >
              npm package
              <ArrowUpRight className="size-3 text-muted-foreground transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
            </a>
            <span className="border border-border bg-foreground/2 px-2.5 py-1.5 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
              VelocityAI@0.2.0 · node ≥ 18
            </span>
          </div>
        </header>

        <div className="mt-10 grid gap-10 lg:grid-cols-[200px_1fr]">
          {/* table of contents */}
          <aside className="hidden lg:block">
            <nav className="sticky top-28 space-y-1 border-l border-border pl-4">
              <p className="pb-2 font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                On this page
              </p>
              {TOC.map((t) => (
                <a
                  key={t.id}
                  href={`#${t.id}`}
                  className="block py-1 text-[13px] text-foreground/60 transition-colors hover:text-foreground"
                >
                  {t.label}
                </a>
              ))}
            </nav>
          </aside>

          {/* content */}
          <article className="min-w-0 space-y-12">
            <DocSection id="install" heading="Install">
              <CodeBlock
                lines={[
                  "npm install -g VelocityAI",
                  { c: "# or run without installing:" },
                  "npx VelocityAI --help",
                ]}
              />
              <p>
                Requires Node.js ≥ 18. The binary is{" "}
                <code className="font-mono text-xs text-foreground/90">VelocityAI</code>. Run{" "}
                <code className="font-mono text-xs text-foreground/90">VelocityAI &lt;command&gt; --help</code>{" "}
                for the options of any command.
              </p>
            </DocSection>

            <DocSection id="sign-in" heading="Sign in">
              <p>
                VelocityAI uses the OAuth 2.0 Device Authorization flow — no passwords or tokens to
                copy by hand:
              </p>
              <CodeBlock
                lines={[
                  "VelocityAI login",
                  { c: "" },
                  { c: "  Signing in to https://VelocityAI.in" },
                  { c: "" },
                  { c: "  Open this URL to approve the login:" },
                  { c: "    https://VelocityAI.in/device?user_code=XXXX-XXXX" },
                  { c: "  Your device code: XXXX-XXXX" },
                ]}
              />
              <p>
                It prints a URL and a short code, opens your browser, and waits while you approve
                the request. If you belong to exactly one organization it becomes active
                automatically; otherwise pick one with{" "}
                <code className="font-mono text-xs text-foreground/90">VelocityAI org use &lt;slug&gt;</code>.
                The credential is stored at{" "}
                <code className="font-mono text-xs text-foreground/90">~/.VelocityAI/config.json</code>{" "}
                (mode 0600).
              </p>
              <p>For CI / headless use, set a token in the environment instead:</p>
              <CodeBlock lines={['export VelocityAI_TOKEN="<token>"']} />
            </DocSection>

            <DocSection id="global-flags" heading="Global flags">
              <p>
                Global flags go <strong className="text-foreground/90">before</strong> the
                subcommand, e.g.{" "}
                <code className="font-mono text-xs text-foreground/90">VelocityAI --json feature list</code>.
              </p>
              <div className="border border-border bg-card/40 px-4 py-1">
                <FlagRow flag="--json" desc="Machine-readable JSON output, for scripting and CI." />
                <FlagRow flag="--api <url>" desc="Target a non-default deployment for this call (persisted on login)." />
                <FlagRow flag="--org <slug>" desc="Run against a specific organization for this call." />
              </div>
            </DocSection>

            <DocSection id="configuration" heading="Configuration">
              <p>
                The API base URL resolves in this order:{" "}
                <code className="font-mono text-xs text-foreground/90">--api</code> flag →{" "}
                <code className="font-mono text-xs text-foreground/90">VelocityAI_API_URL</code> env →
                stored config → default{" "}
                <code className="font-mono text-xs text-foreground/90">https://VelocityAI.in</code>.
                Login always prints which deployment it targets, and only persists a URL you passed
                explicitly.
              </p>
              <CommandTable
                rows={[
                  ["VelocityAI config list", "Show the effective configuration (token redacted)."],
                  ["VelocityAI config set-api <url>", "Pin the CLI to a self-hosted or staging deployment."],
                  ["VelocityAI config unset-api", "Go back to the default https://VelocityAI.in."],
                  ["VelocityAI config path", "Print the config file location."],
                  ["VelocityAI ping", "Check the configured deployment is reachable (+ latency)."],
                  ["VelocityAI whoami", "Signed-in user, active org, and API URL."],
                  ["VelocityAI logout", "Remove stored credentials from this machine."],
                ]}
              />
            </DocSection>

            <DocSection id="workspace" heading="Organizations & workspace">
              <CommandTable
                rows={[
                  ["VelocityAI org list", "Organizations you belong to (* marks the active one)."],
                  ["VelocityAI org use <slug>", "Set the active organization."],
                  ["VelocityAI project list", "Projects in the active organization."],
                  ["VelocityAI member list", "Teammates, roles, and email verification state."],
                  ["VelocityAI status", "Pipeline snapshot: features by status, review cycles."],
                  ["VelocityAI search <query>", "Search projects, features, tasks, PRDs, repos, reviews."],
                ]}
              />
            </DocSection>

            <DocSection id="features" heading="Features">
              <CodeBlock
                lines={[
                  "VelocityAI feature list [--status prd_ready] [--project <id>]",
                  'VelocityAI feature create --title "Dark mode" --description "Add a theme toggle" [--priority high]',
                  "VelocityAI feature show <featureId>",
                  'VelocityAI feature clarify <featureId> "Target users are mobile web visitors"',
                  "VelocityAI feature open <featureId>",
                ]}
              />
              <p>Managers can drive the approval pipeline end to end:</p>
              <CodeBlock
                lines={[
                  { c: "# feature in review → approved" },
                  "VelocityAI feature approve <featureId> [--notes <notes>]",
                  { c: "# reject with a reason → blocked" },
                  'VelocityAI feature reject <featureId> "Needs a security review first"',
                  { c: "# approved → shipped 🚀" },
                  "VelocityAI feature ship <featureId>",
                ]}
              />
            </DocSection>

            <DocSection id="prds" heading="PRDs">
              <CodeBlock
                lines={[
                  { c: "# trigger PRD generation / regeneration" },
                  "VelocityAI prd generate <featureId>",
                  { c: "# print the PRD (markdown)" },
                  "VelocityAI prd show <featureId>",
                  { c: "# approve the PRD → generates engineering tasks" },
                  "VelocityAI prd approve <featureId>",
                  { c: "# save the PRD as a PDF" },
                  "VelocityAI prd download <featureId> [-o dark-mode.pdf]",
                  { c: "# email the PRD (PDF attached) to anyone" },
                  'VelocityAI prd share <featureId> --to pm@company.com --message "Please review"',
                ]}
              />
              <p>
                <code className="font-mono text-xs text-foreground/90">prd share</code> sends to
                teammates and outside addresses alike; teammates must have a verified email — check
                with <code className="font-mono text-xs text-foreground/90">VelocityAI member list</code>.
              </p>
            </DocSection>

            <DocSection id="prompts" heading="AI prompts">
              <p>
                Generate a copy-paste-ready implementation prompt for an AI coding agent — from a
                feature&apos;s approved PRD, or from a plain description with no PRD at all.
              </p>
              <CodeBlock
                lines={[
                  { c: "# the feature's implementation prompt (cached per tech stack)" },
                  "VelocityAI prompt feature <featureId> [--stack <stack>]",
                  { c: "# force a fresh generation (spends a generation credit)" },
                  "VelocityAI prompt feature <featureId> --regenerate",
                  { c: "# save it as markdown for your agent" },
                  "VelocityAI prompt feature <featureId> -o prompt.md",
                  { c: "# one-shot prompt from a plain message — no PRD needed" },
                  'VelocityAI prompt quick "a pomodoro timer web app" --stack "HTML + CSS + JS"',
                ]}
              />
              <p>
                The prompt covers the goal, exact tech stack, files to create (and how they link),
                ordered build steps, inputs &amp; outputs, and acceptance criteria. Omit{" "}
                <code className="font-mono text-xs text-foreground/90">--stack</code> on{" "}
                <code className="font-mono text-xs text-foreground/90">quick</code> and the AI picks
                a sensible minimal stack.
              </p>
            </DocSection>

            <DocSection id="tasks" heading="Tasks">
              <CommandTable
                rows={[
                  ["VelocityAI task list <featureId>", "The feature's task board, grouped by status."],
                  ["VelocityAI task mine", "Tasks assigned to you, across all organizations."],
                  ["VelocityAI task start <taskId>", "Move a task to in_progress."],
                  ["VelocityAI task done <taskId>", "Mark a task as done."],
                  ["VelocityAI task move <taskId> <status>", "Any move: todo, in_progress, done, blocked (--reason)."],
                  ["VelocityAI task assign <taskId> <who>", 'Assign by email, name, or "me".'],
                  ["VelocityAI task notes <taskId>", "Read a task's discussion thread."],
                  ["VelocityAI task note <taskId> <text…>", "Add a note to the thread."],
                ]}
              />
            </DocSection>

            <DocSection id="reviews" heading="Reviews">
              <CodeBlock
                lines={[
                  "VelocityAI review list [--status passed|failed|running]",
                  "VelocityAI review show <cycleId>",
                  "VelocityAI review resolve <issueId>",
                ]}
              />
            </DocSection>

            <DocSection id="scripting" heading="Scripting & CI">
              <p>
                Every command supports{" "}
                <code className="font-mono text-xs text-foreground/90">--json</code>, so output
                pipes cleanly into <code className="font-mono text-xs text-foreground/90">jq</code>:
              </p>
              <CodeBlock
                lines={[
                  { c: "# full ids of all features that are ready for PRD review" },
                  "VelocityAI --json feature list | jq -r '.[] | select(.status == \"prd_ready\") | .id'",
                  { c: "# fail a CI step if any AI review cycle failed" },
                  "test \"$(VelocityAI --json review list --status failed | jq length)\" = \"0\"",
                ]}
              />
              <p>
                In CI, authenticate with{" "}
                <code className="font-mono text-xs text-foreground/90">VelocityAI_TOKEN</code> and pin
                the deployment with{" "}
                <code className="font-mono text-xs text-foreground/90">VelocityAI_API_URL</code> — no
                interactive login needed.
              </p>
            </DocSection>

            <DocSection id="troubleshooting" heading="Troubleshooting">
              <div className="space-y-4">
                <div>
                  <p className="font-medium text-foreground/90">Login opens the wrong URL (an old dev or staging domain).</p>
                  <p>
                    The CLI is pinned to another deployment. Check with{" "}
                    <code className="font-mono text-xs text-foreground/90">VelocityAI config list</code>, reset with{" "}
                    <code className="font-mono text-xs text-foreground/90">VelocityAI config unset-api</code>, then{" "}
                    <code className="font-mono text-xs text-foreground/90">VelocityAI login</code> again.
                  </p>
                </div>
                <div>
                  <p className="font-medium text-foreground/90">&ldquo;You&apos;re not signed in&rdquo; or 401 errors.</p>
                  <p>
                    Your token expired or belongs to a different deployment — run{" "}
                    <code className="font-mono text-xs text-foreground/90">VelocityAI login</code>.
                  </p>
                </div>
                <div>
                  <p className="font-medium text-foreground/90">&ldquo;Select an organization before accessing this resource.&rdquo;</p>
                  <p>
                    Run <code className="font-mono text-xs text-foreground/90">VelocityAI org use &lt;slug&gt;</code>{" "}
                    once, or pass <code className="font-mono text-xs text-foreground/90">--org &lt;slug&gt;</code>{" "}
                    per command.
                  </p>
                </div>
                <div>
                  <p className="font-medium text-foreground/90">No browser opens on login.</p>
                  <p>
                    Headless environments can&apos;t spawn a browser — open the printed URL on any
                    device and enter the device code.
                  </p>
                </div>
              </div>
            </DocSection>

            <DocSection id="how-it-works" heading="How it works">
              <p>
                The CLI is a thin, fully type-safe tRPC client against the same API the web app
                uses; its types are derived from the server&apos;s router, so the CLI can never
                drift from the API. Authentication rides on BetterAuth&apos;s device grant and
                bearer tokens.
              </p>
              <p>
                Ready to try it?{" "}
                <Link href="/sign-in" className="text-primary underline-offset-4 hover:underline">
                  Create an account
                </Link>{" "}
                and run{" "}
                <code className="font-mono text-xs text-foreground/90">VelocityAI login</code>.
              </p>
            </DocSection>
          </article>
        </div>
      </div>
      </div>

      <LandingFooter />
    </main>
  );
}

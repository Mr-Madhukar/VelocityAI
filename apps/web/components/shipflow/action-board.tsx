"use client";

import { useMemo, useState } from "react";
import { Bot, CheckCircle2, GitPullRequestArrow, MessageSquareText, Rocket } from "lucide-react";

const actions = [
  {
    id: "clarify",
    label: "Ask clarification",
    icon: MessageSquareText,
    result: "AI asked 3 missing-context questions before generating the PRD.",
  },
  {
    id: "prd",
    label: "Generate PRD",
    icon: Bot,
    result: "PRD generated with goals, non-goals, user stories, edge cases, and success metrics.",
  },
  {
    id: "review",
    label: "Run AI review",
    icon: GitPullRequestArrow,
    result: "AI reviewed acme/web#148 and found 1 blocking issue plus 2 suggestions.",
  },
  {
    id: "approve",
    label: "Approve release",
    icon: CheckCircle2,
    result: "Human approval is waiting until the blocking issue is fixed.",
  },
  {
    id: "ship",
    label: "Ship feature",
    icon: Rocket,
    result: "Release is locked until AI review passes and human approval is recorded.",
  },
];

export function ActionBoard() {
  const [selectedAction, setSelectedAction] = useState(actions[0]!);
  const [runs, setRuns] = useState(1);

  const history = useMemo(
    () => actions.slice(0, Math.min(runs, actions.length)),
    [runs],
  );

  return (
    <div className="rounded-lg border border-primary/20 bg-primary/10 p-5">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-lg font-semibold text-foreground">Interactive workflow demo</p>
          <p className="text-sm text-primary/75">Click actions to see how VelocityAI gates release quality.</p>
        </div>
        <button
          className="rounded-md bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground transition hover:bg-primary"
          onClick={() => setRuns((value) => (value >= actions.length ? 1 : value + 1))}
        >
          Run next step
        </button>
      </div>

      <div className="mt-5 grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
        {actions.map((action) => {
          const Icon = action.icon;
          const active = selectedAction.id === action.id;

          return (
            <button
              key={action.id}
              className={`rounded-md border px-3 py-3 text-left text-sm transition ${
                active
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-foreground/10 bg-muted text-foreground hover:bg-foreground/10"
              }`}
              onClick={() => setSelectedAction(action)}
            >
              <Icon className="mb-2 size-4" />
              {action.label}
            </button>
          );
        })}
      </div>

      <div className="mt-5 rounded-md border border-foreground/10 bg-muted p-4">
        <p className="text-xs uppercase tracking-[0.22em] text-primary">Current result</p>
        <p className="mt-2 text-sm leading-6 text-foreground">{selectedAction.result}</p>
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        {history.map((item) => (
          <span key={item.id} className="rounded-full bg-foreground/10 px-3 py-1 text-xs text-foreground">
            {item.label}
          </span>
        ))}
      </div>
    </div>
  );
}

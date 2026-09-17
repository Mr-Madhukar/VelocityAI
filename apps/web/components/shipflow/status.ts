import type { DemoFeature } from "@repo/services/shipflow/demo";

export const statusLabel: Record<DemoFeature["status"], string> = {
  intake: "Intake",
  clarifying: "Clarifying",
  prd_generating: "Generating PRD",
  prd_ready: "PRD ready",
  tasks_ready: "Tasks ready",
  in_progress: "In progress",
  in_review: "AI review",
  approved: "Approved",
  shipped: "Shipped",
  blocked: "Blocked",
};

/**
 * Token-driven, square status tones — single source of truth for every page.
 * Three families: neutral (queued) · amber/primary (in-flight) · emerald/success
 * (ready or done) · destructive (blocked). No hardcoded palette colours.
 */
const NEUTRAL = "border-border bg-muted text-muted-foreground";
const ACTIVE = "border-primary/30 bg-primary/10 text-primary";
const DONE = "border-success/30 bg-success/10 text-success";
const STOPPED = "border-destructive/30 bg-destructive/10 text-destructive";

export const statusTone: Record<DemoFeature["status"], string> = {
  intake: NEUTRAL,
  clarifying: ACTIVE,
  prd_generating: ACTIVE,
  prd_ready: DONE,
  tasks_ready: ACTIVE,
  in_progress: ACTIVE,
  in_review: ACTIVE,
  approved: DONE,
  shipped: DONE,
  blocked: STOPPED,
};

export const reviewTone = {
  processing: ACTIVE,
  passed: DONE,
  changes_requested: ACTIVE,
  blocked: STOPPED,
};

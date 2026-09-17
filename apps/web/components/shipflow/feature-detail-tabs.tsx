"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import type { RouterOutputs } from "@repo/trpc/client";
import {
  AlertTriangle,
  Ban,
  CalendarClock,
  Check,
  CheckCircle2,
  Circle,
  Clock,
  Code2,
  Copy,
  ExternalLink,
  FileText,
  FolderGit2,
  GitBranch,
  GripVertical,
  Link2,
  ListChecks,
  Loader2,
  Maximize2,
  MessageSquareText,
  Pencil,
  Rocket,
  SendHorizontal,
  ShieldCheck,
  Sparkles,
  TriangleAlert,
  Users,
  Wand2,
  X,
  Zap,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "~/components/ui/button";
import { Textarea } from "~/components/ui/textarea";
import { Tabs, TabsContent } from "~/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "~/components/ui/popover";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "~/components/ui/alert-dialog";
import { statusLabel } from "~/components/shipflow/status";
import { StatusBadge } from "~/components/shipflow/ui-kit";
import { TaskNotesModal } from "~/components/shipflow/task-notes-modal";
import {
  PrdDocActions,
  PrdDocumentView,
  type PrdDocFields,
  type PrdDocMeta,
  type PrdView,
} from "~/components/shipflow/prd-document-view";
import {
  ImplementationPromptsPanel,
  TasksViewToggle,
  type TasksView,
} from "~/components/shipflow/implementation-prompts";
import { cn } from "~/lib/utils";
import { trpc } from "~/trpc/client";
import { triggerPrReview } from "@/features/github/actions";

type Feature = RouterOutputs["feature"]["getById"];
type RawPrd = NonNullable<Feature["prd"]>;
type ParsedPrd = Omit<
  RawPrd,
  | "goals"
  | "nonGoals"
  | "userStories"
  | "acceptanceCriteria"
  | "edgeCases"
  | "successMetrics"
  | "technicalRequirements"
  | "dependencies"
  | "risks"
  | "requiredDisciplines"
> & {
  goals: string[];
  nonGoals: string[];
  userStories: string[];
  acceptanceCriteria: string[];
  edgeCases: string[];
  successMetrics: string[];
  technicalRequirements: string[];
  dependencies: string[];
  risks: string[];
  requiredDisciplines: string[];
};
type Message = Feature["messages"][number];
type FeatureStatus = keyof typeof statusLabel;

// The feature workflow is a gated pipeline, not arbitrary tabs — render it as a
// stepper whose nodes carry state derived from `feature.status`.
const PIPELINE_STAGES = [
  { value: "clarify", label: "Clarify", icon: MessageSquareText },
  { value: "prd", label: "PRD", icon: FileText },
  { value: "tasks", label: "Tasks", icon: ListChecks },
  { value: "review-history", label: "Review", icon: ShieldCheck },
  { value: "release", label: "Release", icon: Rocket },
] as const;

const STATUS_STAGE_INDEX: Record<FeatureStatus, number> = {
  intake: 0,
  clarifying: 0,
  prd_generating: 1,
  prd_ready: 1,
  tasks_ready: 2,
  in_progress: 2,
  in_review: 3,
  approved: 4,
  shipped: 4,
  blocked: 3,
};

function currentStageValue(status: FeatureStatus): string {
  return PIPELINE_STAGES[STATUS_STAGE_INDEX[status]]?.value ?? "clarify";
}

type StageState = "done" | "active" | "blocked" | "upcoming";

function stageState(index: number, status: FeatureStatus): StageState {
  if (status === "shipped") return "done";
  const current = STATUS_STAGE_INDEX[status];
  if (index < current) return "done";
  if (index === current) return status === "blocked" ? "blocked" : "active";
  return "upcoming";
}

const NODE_STATE_CLASS: Record<StageState, string> = {
  done: "border-success/40 bg-success/10 text-success",
  active: "border-primary/50 bg-primary/10 text-primary",
  blocked: "border-destructive/40 bg-destructive/10 text-destructive",
  upcoming: "border-border bg-foreground/3 text-muted-foreground",
};

function PipelineStepper({
  status,
  value,
  onSelect,
  isGeneratingPrd,
  isGeneratingTasks,
  hasPrd,
  hasTasks,
}: Readonly<{
  status: FeatureStatus;
  value: string;
  onSelect: (value: string) => void;
  isGeneratingPrd: boolean;
  isGeneratingTasks: boolean;
  hasPrd: boolean;
  hasTasks: boolean;
}>) {
  // A stage whose artifact already exists reads as done even while the
  // pipeline status still sits on it (e.g. tasks generated → green tick).
  function resolveState(index: number, stage: (typeof PIPELINE_STAGES)[number]): StageState {
    const base = stageState(index, status);
    if (base === "blocked") return base;
    if (stage.value === "prd" && hasPrd) return "done";
    if (stage.value === "tasks" && hasTasks) return "done";
    return base;
  }

  return (
    <div className="overflow-x-auto border border-border bg-card p-4">
      <div className="grid w-full min-w-105 grid-cols-5">
        {PIPELINE_STAGES.map((stage, i) => {
          const state = resolveState(i, stage);
          const selected = value === stage.value;
          const Icon = stage.icon;
          const generating =
            (stage.value === "prd" && isGeneratingPrd) ||
            (stage.value === "tasks" && isGeneratingTasks);

          let stepIcon = <Icon className="size-4" />;
          if (generating) {
            stepIcon = <Loader2 className="size-4 animate-spin" />;
          } else if (state === "done") {
            stepIcon = <Check className="size-4" />;
          }

          return (
            <div key={stage.value} className="relative flex flex-col items-center">
              {i < PIPELINE_STAGES.length - 1 ? (
                <span
                  aria-hidden
                  className={cn(
                    "absolute left-[calc(50%+1.75rem)] top-5 h-px w-[calc(100%-3.5rem)]",
                    state === "done" ? "bg-success/40" : "bg-border",
                  )}
                />
              ) : null}
              <button
                type="button"
                onClick={() => onSelect(stage.value)}
                aria-current={selected ? "step" : undefined}
                className="group flex flex-col items-center gap-2 outline-none"
              >
                <span
                  className={cn(
                    "grid size-10 place-items-center border transition-colors",
                    NODE_STATE_CLASS[state],
                    selected && "ring-2 ring-foreground/30 ring-offset-2 ring-offset-card",
                  )}
                >
                  {stepIcon}
                </span>
                <span
                  className={cn(
                    "font-mono text-[10px] uppercase tracking-wider",
                    selected ? "text-foreground" : "text-muted-foreground",
                  )}
                >
                  {stage.label}
                </span>
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

const PROGRESS_MILESTONES = [
  { at: 0, pct: 3 },
  { at: 3000, pct: 20 },
  { at: 9000, pct: 45 },
  { at: 18000, pct: 68 },
  { at: 28000, pct: 85 },
  { at: 38000, pct: 95 },
];

const PRD_AI_STEPS = [
  { label: "Analyzing clarification conversation", threshold: 5 },
  { label: "Drafting goals and user stories", threshold: 30 },
  { label: "Writing acceptance criteria & edge cases", threshold: 60 },
  { label: "Finalizing PRD document", threshold: 80 },
];

function parseList(value: string | string[] | null | undefined): string[] {
  if (Array.isArray(value)) return value;
  if (!value) return [];
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? (parsed as string[]) : [];
  } catch {
    return [];
  }
}

function formatDate(value: Date | string | null | undefined) {
  return value ? new Date(value).toLocaleDateString("en-IN") : "Not set";
}

function ListBlock({
  title,
  items,
  icon,
  accent,
}: Readonly<{
  title: string;
  items: string[];
  icon?: React.ReactNode;
  accent?: string;
}>) {
  const entries = useMemo(
    () => items.map((item, idx) => ({ id: `${item}-${idx}`, text: item })),
    [items],
  );

  return (
    <div className={cn("rounded-lg border bg-foreground/3 p-4", accent ?? "border-foreground/10")}>
      <p className="flex items-center gap-2 text-sm font-semibold text-foreground">
        {icon}
        {title}
      </p>
      {items.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">No entries.</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {entries.map((entry) => (
            <li key={entry.id} className="flex gap-2 text-sm leading-6 text-foreground/80">
              <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-muted-foreground" />
              {entry.text}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function PrdGeneratingCard({
  progress,
  onCancel,
  cancelling,
}: Readonly<{
  progress: number;
  onCancel: () => void;
  cancelling: boolean;
}>) {
  return (
    <div className="relative overflow-hidden rounded-lg border border-primary/20 bg-primary/4 p-6">
      <div className="pointer-events-none absolute -right-16 -top-16 size-48 rounded-full bg-glow-primary opacity-60 blur-3xl" />
      <div className="relative flex items-center gap-4">
        <div className="relative grid size-11 shrink-0 place-items-center rounded-full bg-primary/10 ring-1 ring-primary/20">
          <Sparkles className="size-5 text-primary" />
          <span className="absolute inset-0 animate-ping rounded-full bg-primary/10" />
        </div>
        <div className="flex-1">
          <p className="text-sm font-semibold text-foreground">AI is writing your PRD</p>
          <p className="text-xs text-muted-foreground">Usually takes 15–30 seconds</p>
        </div>
        <button
          type="button"
          onClick={onCancel}
          disabled={cancelling}
          className="flex items-center gap-1.5 rounded-lg border border-border bg-foreground/3 px-3 py-1.5 text-xs text-muted-foreground transition hover:border-destructive/30 hover:bg-destructive/10 hover:text-destructive disabled:opacity-50"
        >
          {cancelling ? <Loader2 className="size-3 animate-spin" /> : <X className="size-3" />}
          {cancelling ? "Cancelling…" : "Cancel"}
        </button>
      </div>
      <div className="relative mt-5">
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-foreground/6">
          <div
            className="h-full rounded-full bg-linear-to-r from-primary/60 via-primary to-primary/60 bg-size-[200%_100%] transition-all duration-1000 ease-out"
            style={{ width: `${progress}%`, animation: "shimmer 2s linear infinite" }}
          />
        </div>
        <style>{`@keyframes shimmer{0%{background-position:100% 0}100%{background-position:-100% 0}}`}</style>
        <p className="mt-1.5 text-right font-mono text-[10px] text-muted-foreground">{progress}%</p>
      </div>
      <div className="mt-4 space-y-2.5">
        {PRD_AI_STEPS.map((step, i) => {
          const nextThreshold = PRD_AI_STEPS[i + 1]?.threshold ?? 101;
          const done = progress >= nextThreshold;
          const active = !done && progress >= step.threshold;

          let stepIcon = <Circle className="size-3.5 shrink-0 text-foreground/10" />;
          if (done) {
            stepIcon = <CheckCircle2 className="size-3.5 shrink-0 text-success" />;
          } else if (active) {
            stepIcon = <Loader2 className="size-3.5 shrink-0 animate-spin text-primary" />;
          }

          let textColorClass = "text-foreground/20";
          if (done) {
            textColorClass = "text-muted-foreground";
          } else if (active) {
            textColorClass = "text-foreground";
          }

          return (
            <div key={step.label} className="flex items-center gap-2.5">
              {stepIcon}
              <span className={cn("text-xs transition-colors", textColorClass)}>
                {step.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function TasksGeneratingBanner({ onCancel }: Readonly<{ onCancel?: () => void }>) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-primary/20 bg-primary/5 px-5 py-4">
      <div className="relative grid size-8 shrink-0 place-items-center rounded-full bg-primary/10">
        <Zap className="size-4 text-primary" />
        <span className="absolute inset-0 animate-ping rounded-full bg-primary/10" />
      </div>
      <div>
        <p className="text-sm font-semibold text-foreground">Generating engineering tasks</p>
        <p className="text-xs text-muted-foreground">AI is breaking the PRD into developer-ready tasks — this takes about 30 seconds</p>
      </div>
      <div className="ml-auto flex items-center gap-3">
        <Loader2 className="size-4 shrink-0 animate-spin text-primary" />
        {onCancel && (
          <button type="button" onClick={onCancel} className="text-xs text-muted-foreground underline-offset-2 hover:text-foreground/80 hover:underline">
            Cancel
          </button>
        )}
      </div>
    </div>
  );
}

function prdToastId(featureId: string) {
  return `prd-generating-${featureId}`;
}

// Inline editor for the PRD estimated effort (manual override, pre-approval only)
function EstimateEditor({
  value,
  onSave,
  pending,
}: Readonly<{
  value: number | null;
  onSave: (hours: number | null) => void;
  pending: boolean;
}>) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value?.toString() ?? "");

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => { setDraft(value?.toString() ?? ""); setEditing(true); }}
        className="group inline-flex items-center gap-1.5 rounded-md border border-sky-400/20 bg-sky-400/10 px-2 py-1 text-xs font-medium text-sky-300 transition hover:border-sky-400/40"
      >
        {value ? `~${value}h` : "Add estimate"}
        <Pencil className="size-3 opacity-50 transition group-hover:opacity-100" />
      </button>
    );
  }

  function commit() {
    const trimmed = draft.trim();
    const parsed = trimmed === "" ? null : Number.parseInt(trimmed, 10);
    if (parsed !== null && (Number.isNaN(parsed) || parsed < 0)) {
      setEditing(false);
      return;
    }
    onSave(parsed);
    setEditing(false);
  }

  return (
    <span className="inline-flex items-center gap-1">
      <input
        type="number"
        min={0}
        ref={(el) => el?.focus()}
        value={draft}
        disabled={pending}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit();
          if (e.key === "Escape") setEditing(false);
        }}
        className="w-20 rounded-md border border-foreground/10 bg-foreground/5 px-2 py-1 text-xs text-foreground"
      />
      <span className="text-xs text-muted-foreground">h</span>
      <button type="button" onClick={commit} disabled={pending} className="grid size-6 place-items-center rounded text-success hover:bg-foreground/10">
        {pending ? <Loader2 className="size-3 animate-spin" /> : <Check className="size-3.5" />}
      </button>
      <button type="button" onClick={() => setEditing(false)} className="grid size-6 place-items-center rounded text-muted-foreground hover:bg-foreground/10">
        <X className="size-3.5" />
      </button>
    </span>
  );
}

type Task = Feature["tasks"][number];
type TaskStatus = "todo" | "in_progress" | "done" | "blocked";

const KANBAN_COLUMNS: { key: TaskStatus; label: string; tone: string }[] = [
  { key: "todo", label: "Todo", tone: "border-muted-foreground/30" },
  { key: "in_progress", label: "In progress", tone: "border-primary/30" },
  { key: "done", label: "Done", tone: "border-success/30" },
  { key: "blocked", label: "Blocked", tone: "border-red-400/30" },
];

function buildColumns(tasks: Task[]): Record<TaskStatus, Task[]> {
  const cols: Record<TaskStatus, Task[]> = { todo: [], in_progress: [], done: [], blocked: [] };
  const seen = new Set<string>();
  [...tasks]
    .sort((a, b) => a.order - b.order)
    .forEach((t) => {
      // Defend the board against duplicate task ids (stale data / double inserts)
      // so React never renders two cards with the same key.
      if (seen.has(t.id)) return;
      seen.add(t.id);
      const status = (cols[t.status as TaskStatus] ? t.status : "todo") as TaskStatus;
      cols[status].push(t);
    });
  return cols;
}

function KanbanBoard({
  featureId,
  tasks: serverTasks,
  generating,
}: Readonly<{
  featureId: string;
  tasks: Task[];
  generating: boolean;
}>) {
  const utils = trpc.useUtils();
  const [columns, setColumns] = useState<Record<TaskStatus, Task[]>>(() => buildColumns(serverTasks));
  const [dragId, setDragId] = useState<string | null>(null);
  const [dragOverCol, setDragOverCol] = useState<TaskStatus | null>(null);
  const [pendingBlock, setPendingBlock] = useState<{ taskId: string; beforeId: string | null } | null>(null);
  const [blockReason, setBlockReason] = useState("");
  // Task whose notes/details modal is open. Looked up from the live server data
  // so the modal reflects the latest note count / status.
  const [notesTaskId, setNotesTaskId] = useState<string | null>(null);
  const notesTask = serverTasks.find((t) => t.id === notesTaskId) ?? null;

  // Re-sync from the server whenever it sends fresh task data (generation, polling, etc.)
  const serverKey = serverTasks.map((t) => `${t.id}:${t.status}:${t.order}`).join("|");
  useEffect(() => {
    setColumns(buildColumns(serverTasks));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serverKey]);

  const reorder = trpc.task.reorder.useMutation({
    onSuccess: () => utils.feature.getById.invalidate({ featureId }),
    onError: (error) => {
      toast.error(error.message);
      utils.feature.getById.invalidate({ featureId });
    },
  });

  const assignTo = trpc.task.assignTo.useMutation({
    onSuccess: () => utils.feature.getById.invalidate({ featureId }),
    onError: (error) => toast.error(error.message),
  });

  const { data: orgMembers = [] } = trpc.member.list.useQuery();

  function persist(next: Record<TaskStatus, Task[]>) {
    const items = KANBAN_COLUMNS.flatMap((col) =>
      next[col.key].map((t, index) => ({
        taskId: t.id,
        status: col.key,
        order: index,
        blockedReason: col.key === "blocked" ? t.blockedReason ?? null : null,
      })),
    );
    reorder.mutate({ items });
  }

  function commitMove(taskId: string, targetStatus: TaskStatus, beforeId: string | null, reason: string | null) {
    setColumns((prev) => {
      let moving: Task | undefined;
      const next: Record<TaskStatus, Task[]> = { todo: [], in_progress: [], done: [], blocked: [] };
      (Object.keys(prev) as TaskStatus[]).forEach((k) => {
        next[k] = prev[k].filter((t) => {
          if (t.id === taskId) { moving = t; return false; }
          return true;
        });
      });
      if (!moving) return prev;
      const updated: Task = {
        ...moving,
        status: targetStatus,
        blockedReason: targetStatus === "blocked" ? reason ?? moving.blockedReason ?? null : null,
      };
      const arr = [...next[targetStatus]];
      const insertAt = beforeId ? arr.findIndex((t) => t.id === beforeId) : arr.length;
      arr.splice(insertAt < 0 ? arr.length : insertAt, 0, updated);
      next[targetStatus] = arr;
      persist(next);
      return next;
    });
  }

  function handleDropOn(targetStatus: TaskStatus, beforeId: string | null) {
    const id = dragId;
    setDragId(null);
    setDragOverCol(null);
    if (!id) return;
    const current = (Object.keys(columns) as TaskStatus[]).find((k) => columns[k].some((t) => t.id === id));
    // No-op if dropping a task onto itself
    if (beforeId === id) return;
    if (targetStatus === "blocked" && current !== "blocked") {
      setPendingBlock({ taskId: id, beforeId });
      setBlockReason("");
      return;
    }
    commitMove(id, targetStatus, beforeId, null);
  }

  function confirmBlock() {
    if (!pendingBlock) return;
    commitMove(pendingBlock.taskId, "blocked", pendingBlock.beforeId, blockReason.trim() || "No reason provided");
    setPendingBlock(null);
    setBlockReason("");
    toast.info("Task marked as blocked");
  }

  return (
    <>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {KANBAN_COLUMNS.map((col) => {
          const colTasks = columns[col.key];
          const isOver = dragOverCol === col.key;
          return (
            <div
              key={col.key}
              onDragOver={(e) => { e.preventDefault(); setDragOverCol(col.key); }}
              onDragLeave={() => setDragOverCol((c) => (c === col.key ? null : c))}
              onDrop={(e) => { e.preventDefault(); handleDropOn(col.key, null); }}
              className={cn(
                "rounded-lg border bg-foreground/3 p-4 transition-colors",
                col.tone,
                isOver && "border-primary/60 bg-primary/6",
              )}
            >
              <div className="flex items-center justify-between">
                <h2 className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
                  {col.key === "blocked" && <Ban className="size-3.5 text-red-400" />}
                  {col.label}
                </h2>
                <span className="rounded-full bg-foreground/10 px-2 py-0.5 text-xs text-muted-foreground">{colTasks.length}</span>
              </div>

              <div className="mt-4 space-y-3">
                {colTasks.length === 0 ? (
                  <p className="rounded-md border border-dashed border-foreground/10 bg-muted p-3 text-center text-xs text-muted-foreground">
                    {generating ? "Generating…" : "Drop tasks here"}
                  </p>
                ) : (
                  colTasks.map((task) => {
                    const noteCountLabel = task.noteCount === 1 ? "1 note" : `${task.noteCount} notes`;
                    const noteTooltip = task.noteCount > 0 ? noteCountLabel : "Add note";

                    return (
                    <div
                      key={task.id}
                      draggable
                      onDragStart={() => setDragId(task.id)}
                      onDragEnd={() => { setDragId(null); setDragOverCol(null); }}
                      onDragOver={(e) => { e.preventDefault(); setDragOverCol(col.key); }}
                      onDrop={(e) => { e.stopPropagation(); e.preventDefault(); handleDropOn(col.key, task.id); }}
                      className={cn(
                        "group cursor-grab rounded-md border border-foreground/10 bg-muted p-3 transition active:cursor-grabbing",
                        dragId === task.id && "opacity-40",
                      )}
                    >
                      <div className="flex items-start gap-2">
                        <GripVertical className="mt-0.5 size-4 shrink-0 text-muted-foreground transition group-hover:text-muted-foreground" />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-2">
                            <p className="text-sm font-medium text-foreground">{task.title}</p>
                            {task.estimatedHours ? (
                              <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-sky-400/20 bg-sky-400/10 px-2 py-0.5 text-[10px] font-medium text-sky-300">
                                <Clock className="size-2.5" />
                                {task.estimatedHours}h
                              </span>
                            ) : null}
                          </div>
                          {task.description ? <p className="mt-1.5 text-xs leading-5 text-muted-foreground">{task.description}</p> : null}

                          {task.status === "blocked" && task.blockedReason ? (
                            <div className="mt-2 flex items-start gap-1.5 rounded border border-red-400/20 bg-red-400/5 px-2 py-1.5">
                              <Ban className="mt-0.5 size-3 shrink-0 text-red-400" />
                              <p className="text-[11px] leading-4 text-red-300">{task.blockedReason}</p>
                            </div>
                          ) : null}

                          <Popover>
                            <PopoverTrigger asChild>
                              <button type="button" className="mt-2 flex items-center gap-1.5 rounded hover:opacity-80">
                                {task.assigneeName ? (
                                  <>
                                    {task.assigneeImage ? (
                                      // eslint-disable-next-line @next/next/no-img-element
                                      <img src={task.assigneeImage} alt={task.assigneeName} className="size-5 rounded-full object-cover ring-1 ring-foreground/10" />
                                    ) : (
                                      <div className="grid size-5 place-items-center rounded-full bg-primary/20 text-[9px] font-bold text-primary ring-1 ring-foreground/10">
                                        {task.assigneeName[0]}
                                      </div>
                                    )}
                                    <span className="text-[11px] text-muted-foreground">{task.assigneeName}</span>
                                  </>
                                ) : (
                                  <div className="flex items-center gap-1 rounded border border-dashed border-foreground/15 px-1.5 py-0.5 text-[10px] text-muted-foreground hover:border-foreground/30 hover:text-muted-foreground">
                                    <Users className="size-3" />
                                    Assign
                                  </div>
                                )}
                              </button>
                            </PopoverTrigger>
                            <PopoverContent className="w-48 border-foreground/10 bg-popover p-1" align="start">
                              <p className="px-2 py-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Reassign to</p>
                              {orgMembers.map((m) => (
                                <button
                                  key={m.userId}
                                  type="button"
                                  onClick={() => assignTo.mutate({ taskId: task.id, userId: m.userId })}
                                  className={cn(
                                    "flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs transition hover:bg-foreground/10",
                                    task.assignedTo === m.userId ? "text-primary" : "text-foreground/80",
                                  )}
                                >
                                  {m.image ? (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img src={m.image} alt={m.name ?? ""} className="size-5 rounded-full object-cover" />
                                  ) : (
                                    <div className="grid size-5 place-items-center rounded-full bg-primary/20 text-[9px] font-bold text-primary">
                                      {(m.name ?? "?")[0]}
                                    </div>
                                  )}
                                  <span className="truncate">{m.name}</span>
                                  {task.assignedTo === m.userId && <Check className="ml-auto size-3 shrink-0" />}
                                </button>
                              ))}
                            </PopoverContent>
                          </Popover>

                          {/* Expand (bottom-left) + notes — both open the task discussion modal */}
                          <div className="mt-3 flex items-center justify-between gap-2">
                            <button
                              type="button"
                              onClick={() => setNotesTaskId(task.id)}
                              className="inline-flex cursor-pointer items-center gap-1.5 rounded-md bg-foreground/6 px-2 py-1 text-[11px] text-muted-foreground transition-colors hover:bg-foreground/10 hover:text-foreground"
                            >
                              <Maximize2 className="size-3" />
                              Expand
                            </button>
                            <button
                              type="button"
                              onClick={() => setNotesTaskId(task.id)}
                              title={noteTooltip}
                              className="inline-flex cursor-pointer items-center gap-1.5 rounded-md bg-primary/10 px-2 py-1 text-[11px] font-medium text-primary transition-colors hover:bg-primary/15"
                            >
                              <MessageSquareText className="size-3" />
                              {task.noteCount > 0 ? (
                                <span className="tabular-nums">{task.noteCount}</span>
                              ) : (
                                "Add note"
                              )}
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                    );
                  })
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Blocked reason dialog */}
      <AlertDialog open={pendingBlock !== null} onOpenChange={(open) => { if (!open) setPendingBlock(null); }}>
        <AlertDialogContent className="border-foreground/10 bg-popover">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-foreground">
              <Ban className="size-4 text-red-400" />
              Why is this task blocked?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground">
              Add a short reason so the team knows what needs to be resolved before work can continue.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Textarea
            autoFocus
            value={blockReason}
            onChange={(e) => setBlockReason(e.target.value)}
            placeholder="e.g. Waiting on design approval / blocked by API change in #1234"
            className="min-h-24 border-foreground/10 bg-foreground/5 text-sm text-foreground placeholder:text-muted-foreground"
          />
          <AlertDialogFooter>
            <AlertDialogCancel className="border-foreground/10 bg-foreground/5 text-foreground/80 hover:bg-foreground/10">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction className="bg-red-500 text-foreground hover:bg-red-400" onClick={confirmBlock}>
              Mark as blocked
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <TaskNotesModal
        task={notesTask}
        open={notesTaskId !== null}
        onOpenChange={(open) => !open && setNotesTaskId(null)}
      />
    </>
  );
}

const SPECIALTY_SLOTS = [
  { key: "frontend", label: "Frontend Developer", taskTypes: ["frontend"] },
  { key: "backend", label: "Backend Developer", taskTypes: ["backend", "database"] },
  { key: "devops", label: "DevOps Engineer", taskTypes: ["infra"] },
  { key: "ai", label: "AI Developer", taskTypes: ["ai"] },
] as const;

type SpecialtySlot = (typeof SPECIALTY_SLOTS)[number];

type OrgMemberItem = {
  userId: string;
  name: string | null;
  image?: string | null;
};

function getReviewHint(reviewClean: boolean, unresolvedBlockingCount: number): string {
  if (reviewClean) return "Passed";
  if (unresolvedBlockingCount > 0) return `${unresolvedBlockingCount} unresolved blocking findings`;
  return "Requires passed review cycle";
}

function getVerdictBadgeClass(verdict: string | null | undefined): string {
  if (verdict === "approve") return "border-success/30 bg-success/10 text-success";
  if (verdict === "request_changes") return "border-red-500/30 bg-red-500/10 text-red-400";
  return "border-foreground/10 bg-foreground/5 text-muted-foreground";
}

function getVerdictLabel(verdict: string | null | undefined, status: string): string {
  if (verdict === "approve") return "Approved";
  if (verdict === "request_changes") return "Changes requested";
  return status;
}

function getSeverityBadgeClass(severity: string): string {
  if (severity === "blocking") return "bg-red-500/15 text-red-700 dark:text-red-300";
  if (severity === "positive") return "bg-success/15 text-success";
  return "bg-amber-500/15 text-amber-700 dark:text-amber-300";
}

function getSeverityLabel(severity: string): string {
  if (severity === "blocking") return "Blocking";
  if (severity === "positive") return "Positive";
  return "Non-blocking";
}

function ClarifyTabContent({
  messages,
  inputMessage,
  onInputChange,
  onSendMessage,
  isSendingPending,
  canGeneratePrd,
  onGeneratePrd,
  isGeneratingPrd,
  prdButtonLabel,
  prd,
  clarificationChangedSincePrd,
}: Readonly<{
  messages: Message[];
  inputMessage: string;
  onInputChange: (val: string) => void;
  onSendMessage: () => void;
  isSendingPending: boolean;
  canGeneratePrd: boolean;
  onGeneratePrd: () => void;
  isGeneratingPrd: boolean;
  prdButtonLabel: string;
  prd: ParsedPrd | null;
  clarificationChangedSincePrd: boolean;
}>) {
  const asked = messages.filter((m) => m.role === "assistant").length;
  const questionCountBadge = asked === 0 ? "Up to 4 quick questions" : `Question ${Math.min(asked, 4)} of ~4`;

  return (
    <div className="rounded-lg border border-foreground/10 bg-foreground/4.5 p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <MessageSquareText className="size-4 text-primary" />
          Clarification conversation
        </div>
        <span className="rounded-full border border-foreground/10 bg-foreground/5 px-2.5 py-1 text-[11px] text-muted-foreground">
          {questionCountBadge}
        </span>
      </div>
      <div className="mt-5 max-h-110 space-y-3 overflow-y-auto pr-1">
        {messages.length === 0 ? (
          <p className="rounded-lg border border-foreground/10 bg-muted p-4 text-sm text-muted-foreground">No messages yet.</p>
        ) : (
          messages.map((item) => (
            <div key={item.id} className={cn("max-w-[88%] rounded-lg p-3 text-sm", item.role === "assistant" ? "bg-primary text-primary-foreground" : "ml-auto bg-foreground/10 text-foreground")}>
              {item.content}
            </div>
          ))
        )}
      </div>
      <div className="mt-5 grid gap-3">
        <Textarea
          value={inputMessage}
          onChange={(e) => onInputChange(e.target.value)}
          placeholder="Add context or answer the AI's question…"
          className="min-h-24 border-foreground/10 bg-foreground/5 text-foreground placeholder:text-muted-foreground"
        />
        <div className="flex flex-wrap gap-3">
          <Button
            type="button"
            onClick={onSendMessage}
            disabled={!inputMessage.trim() || isSendingPending}
            className="bg-primary text-primary-foreground hover:bg-primary"
          >
            {isSendingPending ? <Loader2 className="size-4 animate-spin" /> : <SendHorizontal className="size-4" />}
            Send
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={!canGeneratePrd}
            onClick={onGeneratePrd}
            className="border-foreground/10 bg-foreground/5 text-foreground hover:bg-foreground/10 disabled:opacity-50"
          >
            {isGeneratingPrd ? <><Loader2 className="size-4 animate-spin" />Generating PRD…</> : prdButtonLabel}
          </Button>
        </div>
        {!prd && !isGeneratingPrd ? (
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Sparkles className="size-3 text-primary/70" />
            Answering is optional — you can hit &ldquo;Generate PRD&rdquo; right away and it
            will be written from the description and whatever answers exist so far.
          </p>
        ) : null}
        {prd && !prd.approvedAt && !clarificationChangedSincePrd && !isGeneratingPrd ? (
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Sparkles className="size-3 text-primary/70" />
            A PRD (v{prd.version}) already exists. Add a new clarification message above to regenerate it as v{prd.version + 1}.
          </p>
        ) : null}
        {prd?.approvedAt ? (
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <ShieldCheck className="size-3 text-success/70" />
            The PRD is approved and locked — clarifications no longer regenerate it.
          </p>
        ) : null}
      </div>
    </div>
  );
}

function TeamCoverageForm({
  slots,
  memberBySpecialty,
  specialtyOverrides,
  onOverrideChange,
  orgMembers,
  onNavigateToTeam,
}: Readonly<{
  slots: readonly SpecialtySlot[];
  memberBySpecialty: Record<string, OrgMemberItem | undefined>;
  specialtyOverrides: Record<string, string>;
  onOverrideChange: (slotKey: string, userId: string) => void;
  orgMembers: OrgMemberItem[];
  onNavigateToTeam: () => void;
}>) {
  const missingCount = slots.filter((s) => !memberBySpecialty[s.key]).length;

  return (
    <>
      <div className="my-1 grid gap-2">
        {slots.map((slot) => {
          const covered = memberBySpecialty[slot.key];
          return (
            <div key={slot.key} className="flex items-center gap-3 rounded-lg border border-foreground/10 bg-foreground/3 px-3 py-2.5">
              <span className={cn("size-2 shrink-0 rounded-full", covered ? "bg-success" : "bg-amber-400")} />
              <span className="w-40 shrink-0 text-sm text-foreground/80">{slot.label}</span>
              {covered ? (
                <span className="text-sm text-muted-foreground">{covered.name}</span>
              ) : (
                <Select
                  value={specialtyOverrides[slot.key] ?? ""}
                  onValueChange={(v) => onOverrideChange(slot.key, v)}
                >
                  <SelectTrigger className="h-7 border-foreground/10 bg-foreground/5 text-xs text-foreground/80">
                    <SelectValue placeholder="Assign to…" />
                  </SelectTrigger>
                  <SelectContent className="border-foreground/10 bg-popover">
                    {orgMembers.map((m) => (
                      <SelectItem key={m.userId} value={m.userId} className="text-foreground/80 focus:bg-foreground/10 focus:text-foreground text-xs">
                        {m.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          );
        })}
      </div>

      {missingCount > 0 && (
        <p className="text-xs text-muted-foreground">
          Missing specialties without an assignment will be left unassigned.{" "}
          <button
            type="button"
            className="text-primary underline-offset-2 hover:underline"
            onClick={onNavigateToTeam}
          >
            Add team members →
          </button>
        </p>
      )}
    </>
  );
}

function PrdHeaderCard({
  featureTitle,
  prd,
  onSaveEstimate,
  isEstimatePending,
  onSaveDeadline,
}: Readonly<{
  featureTitle: string;
  prd: ParsedPrd;
  onSaveEstimate: (hours: number | null) => void;
  isEstimatePending: boolean;
  onSaveDeadline: (date: string | null) => void;
}>) {
  const deadlineValue = prd.targetDeadline ? new Date(prd.targetDeadline).toISOString().split("T")[0] : "";
  const effortDisplay = prd.estimatedTotalHours ? `~${prd.estimatedTotalHours}h` : "Not estimated";
  const deadlineDisplay = prd.targetDeadline ? formatDate(prd.targetDeadline) : "Not set";

  return (
    <div className="rounded-lg border border-foreground/10 bg-foreground/4.5 p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex-1">
          <p className="text-xs uppercase tracking-widest text-primary">Product Requirements Document</p>
          <h2 className="mt-1 text-xl font-bold text-foreground">{featureTitle}</h2>
          <p className="mt-3 text-sm leading-7 text-foreground/80">{prd.problem}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full border border-foreground/10 bg-foreground/5 px-3 py-1 text-xs text-muted-foreground">
            v{prd.version}
          </span>
          {prd.approvedAt ? (
            <span className="flex items-center gap-1.5 rounded-full border border-success/30 bg-success/10 px-3 py-1 text-xs font-medium text-success">
              <CheckCircle2 className="size-3" />
              Approved
            </span>
          ) : null}
        </div>
      </div>

      <div className="mt-4 grid gap-4 border-t border-foreground/5 pt-4 sm:grid-cols-2">
        <div className="flex items-center gap-3">
          <Clock className="size-4 shrink-0 text-sky-400" />
          <span className="text-xs text-muted-foreground">Estimated effort:</span>
          {prd.approvedAt ? (
            <span className="text-xs font-medium text-sky-300">
              {effortDisplay}
            </span>
          ) : (
            <EstimateEditor
              key={prd.estimatedTotalHours ?? "none"}
              value={prd.estimatedTotalHours}
              pending={isEstimatePending}
              onSave={onSaveEstimate}
            />
          )}
        </div>

        <div className="flex items-center gap-3">
          <CalendarClock className="size-4 shrink-0 text-purple-300" />
          <span className="text-xs text-muted-foreground">Target deadline:</span>
          {prd.approvedAt ? (
            <span className="text-xs font-medium text-foreground/80">
              {deadlineDisplay}
            </span>
          ) : (
            <input
              type="date"
              defaultValue={deadlineValue}
              onChange={(e) => onSaveDeadline(e.target.value ? e.target.value : null)}
              className="rounded-md border border-foreground/10 bg-foreground/5 px-2 py-1 text-xs text-foreground scheme-dark"
            />
          )}
        </div>
      </div>
    </div>
  );
}

function PrdManagerCard({ prd }: Readonly<{ prd: ParsedPrd }>) {
  return (
    <div className="rounded-lg border border-foreground/10 bg-foreground/3 p-5">
      <p className="mb-4 flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
        <Users className="size-3.5" /> For Managers
      </p>
      <div className="grid gap-4 sm:grid-cols-2">
        <ListBlock title="Goals" items={prd.goals} accent="border-success/15" icon={<span className="size-2 rounded-full bg-success" />} />
        <ListBlock title="Non-goals" items={prd.nonGoals} accent="border-red-400/15" icon={<span className="size-2 rounded-full bg-red-400" />} />
        <ListBlock title="User stories" items={prd.userStories} />
        <ListBlock title="Success metrics" items={prd.successMetrics} accent="border-sky-400/15" icon={<Zap className="size-3.5 text-sky-400" />} />
      </div>
    </div>
  );
}

function PrdDeveloperCard({ prd }: Readonly<{ prd: ParsedPrd }>) {
  return (
    <div className="rounded-lg border border-foreground/10 bg-foreground/3 p-5">
      <p className="mb-4 flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
        <Code2 className="size-3.5" /> For Developers
      </p>
      <div className="grid gap-4 sm:grid-cols-2">
        <ListBlock title="Technical requirements" items={prd.technicalRequirements} accent="border-purple-400/15" icon={<Code2 className="size-3.5 text-purple-400" />} />
        <ListBlock title="Acceptance criteria" items={prd.acceptanceCriteria} accent="border-primary/15" icon={<CheckCircle2 className="size-3.5 text-primary" />} />
        <ListBlock title="Dependencies" items={prd.dependencies} accent="border-amber-400/15" icon={<FolderGit2 className="size-3.5 text-amber-400" />} />
        <ListBlock title="Edge cases" items={prd.edgeCases} />
      </div>
      {prd.risks.length > 0 && (
        <div className="mt-4">
          <ListBlock title="Risks & mitigations" items={prd.risks} accent="border-orange-400/15" icon={<AlertTriangle className="size-3.5 text-orange-400" />} />
        </div>
      )}
    </div>
  );
}

function PrdStructuredView({
  featureTitle,
  prd,
  onSaveEstimate,
  isEstimatePending,
  onSaveDeadline,
}: Readonly<{
  featureTitle: string;
  prd: ParsedPrd;
  onSaveEstimate: (hours: number | null) => void;
  isEstimatePending: boolean;
  onSaveDeadline: (date: string | null) => void;
}>) {
  return (
    <>
      <PrdHeaderCard
        featureTitle={featureTitle}
        prd={prd}
        onSaveEstimate={onSaveEstimate}
        isEstimatePending={isEstimatePending}
        onSaveDeadline={onSaveDeadline}
      />
      <PrdManagerCard prd={prd} />
      <PrdDeveloperCard prd={prd} />
    </>
  );
}

function PrdApproveSection({
  prd,
  aiBusy,
  editPrompt,
  onEditPromptChange,
  onEditPrd,
  isEditPending,
  onApprovePrd,
  isApprovePending,
  relevantSlots,
  memberBySpecialty,
  specialtyOverrides,
  onOverrideChange,
  orgMembers,
  onNavigateToTeam,
}: Readonly<{
  prd: ParsedPrd;
  aiBusy: boolean;
  editPrompt: string;
  onEditPromptChange: (val: string) => void;
  onEditPrd: () => void;
  isEditPending: boolean;
  onApprovePrd: () => void;
  isApprovePending: boolean;
  relevantSlots: readonly SpecialtySlot[];
  memberBySpecialty: Record<string, OrgMemberItem | undefined>;
  specialtyOverrides: Record<string, string>;
  onOverrideChange: (slotKey: string, userId: string) => void;
  orgMembers: OrgMemberItem[];
  onNavigateToTeam: () => void;
}>) {
  return (
    <>
      {/* AI Edit panel */}
      {!prd.approvedAt && (
        <div className="rounded-lg border border-foreground/10 bg-foreground/3 p-5">
          <p className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
            <Wand2 className="size-4 text-purple-300" />
            Edit with AI
          </p>
          <Textarea
            value={editPrompt}
            onChange={(e) => onEditPromptChange(e.target.value)}
            placeholder='Describe what to change — e.g. "Add a section about offline support" or "Make the acceptance criteria more specific"'
            className="min-h-20 border-foreground/10 bg-foreground/5 text-sm text-foreground placeholder:text-muted-foreground"
          />
          <div className="mt-3 flex items-center justify-between">
            <p className="text-xs text-muted-foreground">
              AI will apply your changes and bump the version. Content before approval is never locked.
            </p>
            <Button
              type="button"
              disabled={!editPrompt.trim() || aiBusy}
              onClick={onEditPrd}
              className="shrink-0 bg-purple-500 text-foreground hover:bg-purple-400"
            >
              {isEditPending ? <Loader2 className="size-4 animate-spin" /> : <Wand2 className="size-4" />}
              {isEditPending ? "Editing…" : "Apply changes"}
            </Button>
          </div>
        </div>
      )}

      {/* Approve / locked */}
      <div className="flex items-center gap-3">
        {prd.approvedAt ? (
          <div className="flex items-center gap-2 rounded-lg border border-success/20 bg-success/5 px-4 py-3 text-sm text-success">
            <ShieldCheck className="size-4" />
            PRD approved on {formatDate(prd.approvedAt)} — editing is locked
          </div>
        ) : (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button type="button" disabled={aiBusy} className="bg-primary text-primary-foreground hover:bg-primary disabled:opacity-50">
                {isApprovePending ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />}
                Approve PRD
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent className="border-foreground/10 bg-popover sm:max-w-lg">
              <AlertDialogHeader>
                <AlertDialogTitle className="text-foreground">Team coverage before task generation</AlertDialogTitle>
                <AlertDialogDescription className="text-muted-foreground">
                  AI will assign tasks based on each developer&apos;s specialty. Fill in missing slots or add team members.
                </AlertDialogDescription>
              </AlertDialogHeader>

              <TeamCoverageForm
                slots={relevantSlots}
                memberBySpecialty={memberBySpecialty}
                specialtyOverrides={specialtyOverrides}
                onOverrideChange={onOverrideChange}
                orgMembers={orgMembers}
                onNavigateToTeam={onNavigateToTeam}
              />

              <AlertDialogFooter>
                <AlertDialogCancel className="border-foreground/10 bg-foreground/5 text-foreground/80 hover:bg-foreground/10">
                  Cancel
                </AlertDialogCancel>
                <AlertDialogAction
                  className="bg-primary text-primary-foreground hover:bg-primary"
                  onClick={onApprovePrd}
                >
                  Approve & generate tasks
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </div>
    </>
  );
}

function PrdTabContent({
  featureId,
  featureTitle,
  prd,
  prdProgress,
  prdView,
  onPrdViewChange,
  prdDocFields,
  prdDocMeta,
  canGeneratePrd,
  isGeneratingPrd,
  aiBusy,
  editPrompt,
  onEditPromptChange,
  onTriggerPrd,
  isTriggerPrdPending,
  onCancelPrd,
  isCancelPrdPending,
  onSaveEstimate,
  isEstimatePending,
  onSaveDeadline,
  onEditPrd,
  isEditPending,
  onApprovePrd,
  isApprovePending,
  relevantSlots,
  memberBySpecialty,
  specialtyOverrides,
  onOverrideChange,
  orgMembers,
  onNavigateToTeam,
}: Readonly<{
  featureId: string;
  featureTitle: string;
  prd: ParsedPrd | null;
  prdProgress: number;
  prdView: PrdView;
  onPrdViewChange: (view: PrdView) => void;
  prdDocFields: PrdDocFields | null;
  prdDocMeta: PrdDocMeta;
  canGeneratePrd: boolean;
  isGeneratingPrd: boolean;
  aiBusy: boolean;
  editPrompt: string;
  onEditPromptChange: (val: string) => void;
  onTriggerPrd: () => void;
  isTriggerPrdPending: boolean;
  onCancelPrd: () => void;
  isCancelPrdPending: boolean;
  onSaveEstimate: (hours: number | null) => void;
  isEstimatePending: boolean;
  onSaveDeadline: (date: string | null) => void;
  onEditPrd: () => void;
  isEditPending: boolean;
  onApprovePrd: () => void;
  isApprovePending: boolean;
  relevantSlots: readonly SpecialtySlot[];
  memberBySpecialty: Record<string, OrgMemberItem | undefined>;
  specialtyOverrides: Record<string, string>;
  onOverrideChange: (slotKey: string, userId: string) => void;
  orgMembers: OrgMemberItem[];
  onNavigateToTeam: () => void;
}>) {
  if (isGeneratingPrd) {
    return (
      <PrdGeneratingCard
        progress={prdProgress}
        onCancel={onCancelPrd}
        cancelling={isCancelPrdPending}
      />
    );
  }

  if (!prd) {
    return (
      <div className="rounded-lg border border-foreground/10 bg-foreground/4.5 p-10 text-center">
        <p className="text-sm text-muted-foreground">No PRD generated yet.</p>
        <Button
          type="button"
          variant="outline"
          disabled={!canGeneratePrd}
          onClick={onTriggerPrd}
          className="mt-4 border-foreground/10 bg-foreground/5 text-foreground hover:bg-foreground/10 disabled:opacity-50"
        >
          {isTriggerPrdPending ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
          Generate PRD
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <PrdDocActions
        view={prdView}
        onView={onPrdViewChange}
        prdId={prd.id}
        featureId={featureId}
        featureTitle={featureTitle}
      />

      {prdView === "document" ? (
        <PrdDocumentView fields={prdDocFields!} meta={prdDocMeta} />
      ) : (
        <PrdStructuredView
          featureTitle={featureTitle}
          prd={prd}
          onSaveEstimate={onSaveEstimate}
          isEstimatePending={isEstimatePending}
          onSaveDeadline={onSaveDeadline}
        />
      )}

      <PrdApproveSection
        prd={prd}
        aiBusy={aiBusy}
        editPrompt={editPrompt}
        onEditPromptChange={onEditPromptChange}
        onEditPrd={onEditPrd}
        isEditPending={isEditPending}
        onApprovePrd={onApprovePrd}
        isApprovePending={isApprovePending}
        relevantSlots={relevantSlots}
        memberBySpecialty={memberBySpecialty}
        specialtyOverrides={specialtyOverrides}
        onOverrideChange={onOverrideChange}
        orgMembers={orgMembers}
        onNavigateToTeam={onNavigateToTeam}
      />
    </div>
  );
}

function TasksTabContent({
  featureId,
  tasks,
  hasApprovedPrd,
  taskCountdown,
  isGeneratingTasks,
  aiBusy,
  tasksView,
  onTasksViewChange,
  onOpenTaskGenDialog,
  onCancelTaskGen,
}: Readonly<{
  featureId: string;
  tasks: Task[];
  hasApprovedPrd: boolean;
  taskCountdown: number;
  isGeneratingTasks: boolean;
  aiBusy: boolean;
  tasksView: TasksView;
  onTasksViewChange: (view: TasksView) => void;
  onOpenTaskGenDialog: () => void;
  onCancelTaskGen: () => void;
}>) {
  return (
    <div className="space-y-4">
      {isGeneratingTasks && (
        <TasksGeneratingBanner onCancel={onCancelTaskGen} />
      )}
      {tasks.length === 0 && !isGeneratingTasks ? (
        <div className="rounded-lg border border-foreground/10 bg-foreground/4.5 p-10 text-center">
          {hasApprovedPrd ? (
            <div className="flex flex-col items-center gap-4">
              {taskCountdown > 0 ? (
                <>
                  <Loader2 className="size-6 animate-spin text-primary" />
                  <div className="space-y-1">
                    <p className="text-sm text-foreground/80">
                      PRD approved — engineering task generation starts automatically in{" "}
                      <span className="font-mono font-semibold text-primary">{taskCountdown}s</span>.
                    </p>
                    <p className="text-xs text-muted-foreground">Hang tight — this happens on its own.</p>
                  </div>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Auto-start didn&apos;t kick in. Generate the engineering tasks manually.
                </p>
              )}
              <Button
                type="button"
                disabled={aiBusy || taskCountdown > 0}
                onClick={onOpenTaskGenDialog}
                className="bg-primary text-primary-foreground hover:bg-primary disabled:opacity-50"
              >
                <Zap className="size-4" />
                Generate tasks
              </Button>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3">
              <p className="text-sm text-muted-foreground">Tasks can only be generated after the PRD is approved.</p>
              <button
                type="button"
                onClick={() => {
                  const el = document.querySelector('[data-value="prd"]') as HTMLElement | null;
                  el?.click();
                }}
                className="text-xs text-primary underline-offset-2 hover:underline"
              >
                Go to PRD tab to review and approve →
              </button>
            </div>
          )}
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="flex items-center gap-2 text-xs text-muted-foreground">
              {tasksView === "board" ? (
                <>
                  <GripVertical className="size-3.5" />
                  Drag tasks between columns or use the quick-move buttons. Moving a task to <span className="font-medium text-red-300">Blocked</span> asks for a reason.
                </>
              ) : (
                <>
                  <Sparkles className="size-3.5" />
                  Copy-paste-ready implementation prompts for an AI coding agent, tailored to your stack.
                </>
              )}
            </p>
            <TasksViewToggle view={tasksView} onChange={onTasksViewChange} />
          </div>
          {tasksView === "board" ? (
            <KanbanBoard featureId={featureId} tasks={tasks} generating={isGeneratingTasks} />
          ) : (
            <ImplementationPromptsPanel featureId={featureId} />
          )}
        </>
      )}
    </div>
  );
}

function ReviewIssueCard({
  issue,
}: Readonly<{
  issue: Feature["reviewCycles"][number]["issues"][number];
}>) {
  const severityClass = getSeverityBadgeClass(issue.severity);
  const severityLabel = getSeverityLabel(issue.severity);

  return (
    <div className="rounded-md border border-foreground/10 bg-muted p-3">
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm text-foreground">{issue.title}</p>
        <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium", severityClass)}>
          {severityLabel}
        </span>
      </div>
      {issue.filePath && (
        <p className="mt-1 font-mono text-[11px] text-muted-foreground">
          {issue.filePath}
          {issue.lineNumber ? `:${issue.lineNumber}` : ""}
        </p>
      )}
      {issue.suggestion && <p className="mt-2 text-xs leading-5 text-muted-foreground">{issue.suggestion}</p>}
    </div>
  );
}

function ReviewCycleCard({
  cycle,
  index,
  totalCycles,
  pr,
}: Readonly<{
  cycle: Feature["reviewCycles"][number];
  index: number;
  totalCycles: number;
  pr?: Feature["pullRequests"][number];
}>) {
  const reviewNumber = totalCycles - index;
  const verdictBadgeClass = getVerdictBadgeClass(cycle.overallVerdict);
  const verdictLabel = getVerdictLabel(cycle.overallVerdict, cycle.status);
  const isLatest = index === 0 && totalCycles > 1;

  return (
    <div className="rounded-lg border border-foreground/10 bg-foreground/2 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2.5">
          <span className="text-sm font-medium text-foreground">Review #{reviewNumber}</span>
          {isLatest && (
            <span className="rounded-full border border-primary/25 bg-primary/10 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-primary">
              Latest
            </span>
          )}
          {pr && (
            <a
              href={pr.githubPrUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 font-mono text-xs text-primary transition hover:underline"
              title={`Open ${pr.repoFullName} #${pr.number} on GitHub`}
            >
              PR #{pr.number}
              <ExternalLink className="size-3" />
            </a>
          )}
        </div>
        <span className={cn("inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium", verdictBadgeClass)}>
          {cycle.status === "running" && <Loader2 className="size-3 animate-spin" />}
          {verdictLabel}
        </span>
      </div>
      {cycle.prdComplianceScore != null && (
        <p className="mt-3 text-xs text-muted-foreground">
          PRD compliance: <span className={cycle.prdComplianceScore >= 80 ? "text-success" : "text-amber-400"}>{cycle.prdComplianceScore}/100</span>
        </p>
      )}
      {cycle.summary && <p className="mt-3 text-xs leading-5 text-muted-foreground">{cycle.summary}</p>}

      {cycle.issues.length > 0 && (
        <div className="mt-4 space-y-2 border-t border-foreground/5 pt-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Findings ({cycle.issues.length})
          </p>
          {cycle.issues.map((issue) => (
            <ReviewIssueCard key={issue.id} issue={issue} />
          ))}
        </div>
      )}
    </div>
  );
}

function PrLinkPopover({
  linkOpen,
  onLinkOpenChange,
  linkablePrs,
  onLinkPr,
  isLinkPrPending,
}: Readonly<{
  linkOpen: boolean;
  onLinkOpenChange: (open: boolean) => void;
  linkablePrs: {
    isLoading: boolean;
    data?: { id: string; repoFullName: string; number: number; headBranch: string }[];
  };
  onLinkPr: (pullRequestId: string) => void;
  isLinkPrPending: boolean;
}>) {
  let prListContent: React.ReactNode;
  if (linkablePrs.isLoading) {
    prListContent = (
      <div className="flex items-center justify-center py-6">
        <Loader2 className="size-4 animate-spin text-muted-foreground" />
      </div>
    );
  } else if ((linkablePrs.data?.length ?? 0) === 0) {
    prListContent = <p className="px-3 py-6 text-center text-xs text-muted-foreground">No unlinked pull requests.</p>;
  } else {
    prListContent = linkablePrs.data?.map((pr) => (
      <button
        key={pr.id}
        type="button"
        disabled={isLinkPrPending}
        onClick={() => onLinkPr(pr.id)}
        className="flex w-full items-center justify-between gap-2 rounded-md px-3 py-2 text-left transition hover:bg-foreground/5 disabled:opacity-50"
      >
        <span className="min-w-0">
          <span className="block truncate text-xs text-foreground/90">
            {pr.repoFullName} #{pr.number}
          </span>
          <span className="block truncate font-mono text-[11px] text-muted-foreground">
            <GitBranch className="mr-1 inline size-3" />
            {pr.headBranch}
          </span>
        </span>
        <Link2 className="size-3.5 shrink-0 text-muted-foreground" />
      </button>
    ));
  }

  return (
    <Popover open={linkOpen} onOpenChange={onLinkOpenChange}>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" size="sm" className="gap-1.5">
          <Link2 className="size-3.5" />
          Link a PR
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="border-b border-foreground/10 px-3 py-2">
          <p className="text-xs font-medium text-foreground">Link a pull request</p>
          <p className="text-[11px] text-muted-foreground">Attach a PR whose branch didn&apos;t match this feature. Linking runs a fresh AI review against the latest PRD.</p>
        </div>
        <div className="max-h-64 overflow-y-auto p-1">
          {prListContent}
        </div>
      </PopoverContent>
    </Popover>
  );
}

function ReviewEmptyState({ reviewBranch }: Readonly<{ reviewBranch: string }>) {
  return (
    <div className="py-6 text-center">
      <p className="text-sm text-muted-foreground">No reviews yet. Open a pull request from a branch named:</p>
      <div className="mt-3 inline-flex items-center gap-2 rounded-lg border border-foreground/10 bg-foreground/4 px-3 py-2">
        <span className="font-mono text-xs text-foreground/80">{reviewBranch}</span>
        <button
          type="button"
          onClick={() => {
            void navigator.clipboard.writeText(reviewBranch);
            toast.success("Branch name copied");
          }}
          className="text-muted-foreground transition hover:text-primary"
          title="Copy branch name"
        >
          <Copy className="size-3.5" />
        </button>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        The PR auto-links when its branch matches — or attach a review manually above.
      </p>
    </div>
  );
}

function ReviewHistoryTabContent({
  reviewCycles,
  prById,
  shownBranch,
  reviewBranch,
  alreadyLinked,
  linkOpen,
  onLinkOpenChange,
  linkablePrs,
  onLinkPr,
  isLinkPrPending,
  hasRunningReview,
}: Readonly<{
  reviewCycles: Feature["reviewCycles"];
  prById: Map<string, Feature["pullRequests"][number]>;
  shownBranch: string;
  reviewBranch: string;
  alreadyLinked: boolean;
  linkOpen: boolean;
  onLinkOpenChange: (open: boolean) => void;
  linkablePrs: {
    isLoading: boolean;
    data?: { id: string; repoFullName: string; number: number; headBranch: string }[];
  };
  onLinkPr: (pullRequestId: string) => void;
  isLinkPrPending: boolean;
  hasRunningReview: boolean;
}>) {
  return (
    <div className="rounded-lg border border-foreground/10 bg-foreground/4.5 p-5">
      {/* Branch + manual link control */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Branch:</span>
          <span className="font-mono text-xs text-foreground/80">{shownBranch}</span>
          <button
            type="button"
            onClick={() => {
              void navigator.clipboard.writeText(shownBranch);
              toast.success("Branch name copied");
            }}
            className="text-muted-foreground transition hover:text-primary"
            title="Copy branch name"
          >
            <Copy className="size-3.5" />
          </button>
        </div>

        {!alreadyLinked && (
          <PrLinkPopover
            linkOpen={linkOpen}
            onLinkOpenChange={onLinkOpenChange}
            linkablePrs={linkablePrs}
            onLinkPr={onLinkPr}
            isLinkPrPending={isLinkPrPending}
          />
        )}
      </div>

      {hasRunningReview && (
        <div className="mb-4 overflow-hidden rounded-lg border border-primary/20 bg-primary/5">
          <div className="flex items-center gap-3 px-4 py-3">
            <Loader2 className="size-4 animate-spin text-primary" />
            <p className="text-sm text-primary">AI is reviewing the latest pull request against the PRD…</p>
          </div>
          <div className="relative h-0.5 w-full bg-primary/10">
            <motion.div
              className="absolute inset-y-0 w-1/3 rounded-full bg-primary/70"
              animate={{ left: ["-33%", "100%"] }}
              transition={{ repeat: Infinity, duration: 1.6, ease: "easeInOut" }}
            />
          </div>
        </div>
      )}

      {reviewCycles.length === 0 ? (
        <ReviewEmptyState reviewBranch={reviewBranch} />
      ) : (
        <div className="space-y-4">
          {reviewCycles.map((cycle, index) => (
            <ReviewCycleCard
              key={cycle.id}
              cycle={cycle}
              index={index}
              totalCycles={reviewCycles.length}
              pr={cycle.pullRequestId ? prById.get(cycle.pullRequestId) : undefined}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function ReleaseActionControls({
  status,
  canApprove,
  canShip,
  onApproveRelease,
  isApproveReleasePending,
  onShipFeature,
  isShipFeaturePending,
}: Readonly<{
  status: FeatureStatus;
  canApprove: boolean;
  canShip: boolean;
  onApproveRelease: () => void;
  isApproveReleasePending: boolean;
  onShipFeature: () => void;
  isShipFeaturePending: boolean;
}>) {
  if (status === "in_review") {
    return (
      <div className="space-y-3 pt-2">
        <div className="flex flex-wrap gap-3">
          <Button
            type="button"
            onClick={onApproveRelease}
            disabled={!canApprove || isApproveReleasePending}
            className="bg-primary text-primary-foreground hover:bg-primary disabled:opacity-40"
          >
            <ShieldCheck className="size-4" />
            {isApproveReleasePending ? "Approving…" : "Approve release"}
          </Button>
        </div>
        {!canApprove && (
          <div className="flex items-center gap-2 rounded-lg border border-amber-500/20 bg-amber-500/5 px-4 py-2.5">
            <TriangleAlert className="size-4 shrink-0 text-amber-400" />
            <p className="text-xs text-amber-700 dark:text-amber-300">
              Release approval is locked: AI code review must pass with 0 unresolved blocking findings before sign-off.
            </p>
          </div>
        )}
      </div>
    );
  }

  if (status === "approved") {
    return (
      <div className="space-y-3 pt-2">
        <div className="flex flex-wrap gap-3">
          <Button
            type="button"
            onClick={onShipFeature}
            disabled={!canShip || isShipFeaturePending}
            className="bg-success text-primary-foreground hover:bg-success disabled:opacity-40"
          >
            <Rocket className="size-4" />
            {isShipFeaturePending ? "Shipping…" : "Mark as shipped"}
          </Button>
        </div>
        {!canShip && (
          <div className="flex items-center gap-2 rounded-lg border border-amber-500/20 bg-amber-500/5 px-4 py-2.5">
            <TriangleAlert className="size-4 shrink-0 text-amber-400" />
            <p className="text-xs text-amber-700 dark:text-amber-300">
              Shipping is locked: All engineering tasks on the board must be marked done before shipping.
            </p>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 rounded-lg border border-amber-500/20 bg-amber-500/5 px-4 py-3">
      <TriangleAlert className="size-4 text-amber-400" />
      <p className="text-xs text-amber-700 dark:text-amber-300">
        Feature must reach in-review state before release approval.
      </p>
    </div>
  );
}

function ReleaseTabContent({
  status,
  tasks,
  pullRequests,
  reviewCycles,
  prd,
  onApproveRelease,
  isApproveReleasePending,
  onShipFeature,
  isShipFeaturePending,
}: Readonly<{
  status: FeatureStatus;
  tasks: Task[];
  pullRequests: Feature["pullRequests"];
  reviewCycles: Feature["reviewCycles"];
  prd: ParsedPrd | null;
  onApproveRelease: () => void;
  isApproveReleasePending: boolean;
  onShipFeature: () => void;
  isShipFeaturePending: boolean;
}>) {
  if (status === "shipped") {
    return (
      <div className="rounded-lg border border-success/30 bg-success/6 p-8 text-center">
        <Rocket className="mx-auto size-10 text-success" />
        <h2 className="mt-4 text-xl font-bold text-foreground">Feature shipped</h2>
        <p className="mt-2 text-sm text-muted-foreground">This feature has been approved and shipped to production.</p>
      </div>
    );
  }

  const isPrdApproved = Boolean(prd?.approvedAt);
  const doneTasksCount = tasks.filter((t) => t.status === "done").length;
  const allTasksDone = tasks.length > 0 && doneTasksCount === tasks.length;
  const hasLinkedPr = pullRequests.length > 0;
  const latestReview = reviewCycles[0];
  const isReviewPassed =
    latestReview?.overallVerdict === "approve" || latestReview?.status === "passed";
  const unresolvedBlockingCount =
    latestReview?.issues?.filter(
      (i: { severity?: string; resolved?: boolean }) =>
        i.severity === "blocking" && !i.resolved,
    ).length ?? 0;
  const reviewClean = isReviewPassed && unresolvedBlockingCount === 0;

  const checks = [
    { label: "PRD approved", done: isPrdApproved, hint: isPrdApproved ? "Approved" : "Pending approval in PRD tab" },
    {
      label: `Engineering tasks completed (${doneTasksCount}/${tasks.length})`,
      done: allTasksDone,
      hint: allTasksDone ? "All tasks done" : "Tasks still in progress on board",
    },
    { label: "Pull request linked", done: hasLinkedPr, hint: hasLinkedPr ? "PR linked" : "Connect repo & open PR" },
    {
      label: "AI code review passed (0 blocking findings)",
      done: reviewClean,
      hint: getReviewHint(reviewClean, unresolvedBlockingCount),
    },
  ];

  const completedChecks = checks.filter((c) => c.done).length;
  const canApprove = status === "in_review" && reviewClean && isPrdApproved;
  const canShip = status === "approved" && allTasksDone;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">Release Verification Checklist</h3>
        <span className="text-xs text-muted-foreground font-medium">
          {completedChecks} of {checks.length} criteria met
        </span>
      </div>

      <div className="space-y-2">
        {checks.map((check) => (
          <div
            key={check.label}
            className="flex items-center justify-between rounded-lg border border-foreground/5 bg-foreground/2 px-4 py-3"
          >
            <div className="flex items-center gap-3">
              {check.done ? (
                <CheckCircle2 className="size-4 shrink-0 text-success" />
              ) : (
                <Circle className="size-4 shrink-0 text-muted-foreground" />
              )}
              <span className={cn("text-sm", check.done ? "text-foreground font-medium" : "text-muted-foreground")}>
                {check.label}
              </span>
            </div>
            <span className="text-xs text-muted-foreground">{check.hint}</span>
          </div>
        ))}
      </div>

      <ReleaseActionControls
        status={status}
        canApprove={canApprove}
        canShip={canShip}
        onApproveRelease={onApproveRelease}
        isApproveReleasePending={isApproveReleasePending}
        onShipFeature={onShipFeature}
        isShipFeaturePending={isShipFeaturePending}
      />
    </div>
  );
}

export function FeatureDetailTabs({ feature: initialFeature }: Readonly<{ feature: Feature }>) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState<string>(() => {
    const requested = searchParams.get("tab");
    if (requested && PIPELINE_STAGES.some((s) => s.value === requested)) return requested;
    return currentStageValue(initialFeature.status as FeatureStatus);
  });

  // Apply the `?tab=` param whenever it changes. The useState initializer above
  // can miss it — on a client-side navigation from /prd or /tasks the first
  // render may read an empty search params snapshot — so re-sync here to make
  // sure a PRD/Task card always lands on the tab it linked to.
  const requestedTab = searchParams.get("tab");
  useEffect(() => {
    if (requestedTab && PIPELINE_STAGES.some((s) => s.value === requestedTab)) {
      setActiveTab(requestedTab);
    }
  }, [requestedTab]);

  const [messages, setMessages] = useState<Message[]>(initialFeature.messages);
  const [inputMessage, setInputMessage] = useState("");
  const [prdProgress, setPrdProgress] = useState(0);
  const [taskCountdown, setTaskCountdown] = useState(10);
  const [editPrompt, setEditPrompt] = useState("");
  const [prdView, setPrdView] = useState<PrdView>(
    searchParams.get("view") === "document" ? "document" : "structured",
  );
  const [tasksView, setTasksView] = useState<TasksView>("board");
  const [shouldPoll, setShouldPoll] = useState(
    initialFeature.status === "prd_generating" ||
    (initialFeature.status === "in_progress" && initialFeature.tasks.length === 0) ||
    initialFeature.status === "in_review" ||
    initialFeature.reviewCycles.some((c) => c.status === "running"),
  );
  const [pollInterval, setPollInterval] = useState(3000);
  const wasGeneratingRef = useRef(false);

  // Exponential backoff: 3s → 4.5s → 6.75s → ... → 15s max, resets when polling stops
  useEffect(() => {
    if (!shouldPoll) { setPollInterval(3000); return; }
    const id = setInterval(() => {
      setPollInterval((prev) => Math.min(Math.round(prev * 1.5), 15000));
    }, 15000);
    return () => clearInterval(id);
  }, [shouldPoll]);

  const { data: feature } = trpc.feature.getById.useQuery(
    { featureId: initialFeature.id },
    {
      initialData: initialFeature,
      refetchInterval: shouldPoll ? pollInterval : false,
      refetchIntervalInBackground: false,
    },
  );

  // Suggested PR branch for auto-linking — readable slug, id fallback.
  const reviewBranch = `feature/${feature.branchName ?? feature.id}`;

  // Look up each review cycle's pull request so the Review tab can link out to
  // the actual PR on GitHub.
  const prById = useMemo(
    () => new Map(feature.pullRequests.map((p) => [p.id, p])),
    [feature.pullRequests],
  );

  // The currently linked PR — prefer an open one, then the most recently
  // updated. The Review tab header shows its real branch instead of the
  // suggested slug once a PR is linked.
  const linkedPr = useMemo(() => {
    const prs = [...feature.pullRequests].sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
    );
    return prs.find((p) => p.state === "open") ?? prs[0] ?? null;
  }, [feature.pullRequests]);
  const shownBranch = linkedPr?.headBranch ?? reviewBranch;

  const isGeneratingPrd = feature.status === "prd_generating";
  const isGeneratingTasks = feature.status === "in_progress" && feature.tasks.length === 0;
  const status = feature.status as FeatureStatus;
  const rawPrd = feature.prd;

  // Parse all PRD fields including the new ones
  const prd = useMemo<ParsedPrd | null>(() => {
    if (!rawPrd) return null;
    return {
      ...rawPrd,
      goals: parseList(rawPrd.goals),
      nonGoals: parseList(rawPrd.nonGoals),
      userStories: parseList(rawPrd.userStories),
      acceptanceCriteria: parseList(rawPrd.acceptanceCriteria),
      edgeCases: parseList(rawPrd.edgeCases),
      successMetrics: parseList(rawPrd.successMetrics),
      technicalRequirements: parseList(rawPrd.technicalRequirements),
      dependencies: parseList(rawPrd.dependencies),
      risks: parseList(rawPrd.risks),
      requiredDisciplines: parseList(rawPrd.requiredDisciplines),
    };
  }, [rawPrd]);

  // Flattened shapes the document view / download / share all consume.
  const prdDocFields = useMemo<PrdDocFields | null>(() => {
    if (!prd) return null;
    return {
      version: prd.version,
      problem: prd.problem,
      goals: prd.goals,
      nonGoals: prd.nonGoals,
      userStories: prd.userStories,
      acceptanceCriteria: prd.acceptanceCriteria,
      edgeCases: prd.edgeCases,
      successMetrics: prd.successMetrics,
      technicalRequirements: prd.technicalRequirements,
      dependencies: prd.dependencies,
      risks: prd.risks,
      estimatedTotalHours: prd.estimatedTotalHours,
      targetDeadline: prd.targetDeadline,
      approvedAt: prd.approvedAt,
    };
  }, [prd]);

  const prdDocMeta = useMemo<PrdDocMeta>(
    () => ({
      featureTitle: feature.title,
      priority: feature.priority,
      status: feature.status,
      createdByName: feature.createdByName,
      createdAt: feature.createdAt,
      orgName: feature.orgName,
    }),
    [feature.title, feature.priority, feature.status, feature.createdByName, feature.createdAt, feature.orgName],
  );

  // Sync polling state with live feature data
  const hasRunningReview = feature.reviewCycles.some((c) => c.status === "running");
  useEffect(() => {
    setShouldPoll(
      feature.status === "prd_generating" ||
      (feature.status === "in_progress" && feature.tasks.length === 0) ||
      feature.status === "in_review" ||
      hasRunningReview,
    );
  }, [feature.status, feature.tasks.length, hasRunningReview]);

  // Progress animation — picks up from elapsed time on re-mount
  useEffect(() => {
    if (!isGeneratingPrd) {
      setPrdProgress(0);
      return;
    }
    const elapsed = Date.now() - new Date(feature.updatedAt).getTime();
    const passed = PROGRESS_MILESTONES.filter((m) => m.at <= elapsed);
    const startPct = passed.at(-1)?.pct ?? PROGRESS_MILESTONES[0]!.pct;
    setPrdProgress(startPct);
    const remaining = PROGRESS_MILESTONES.filter((m) => m.at > elapsed);
    const timers = remaining.map(({ at, pct }) => setTimeout(() => setPrdProgress(pct), at - elapsed));
    return () => timers.forEach(clearTimeout);
  }, [isGeneratingPrd, feature.updatedAt]);

  // Stable toast via ID — no duplication on navigation
  useEffect(() => {
    const toastId = prdToastId(feature.id);
    if (isGeneratingPrd) {
      wasGeneratingRef.current = true;
      toast.custom(
        (tid) => (
          <div className="flex items-center gap-3 rounded-lg border border-primary/20 bg-popover px-4 py-3 shadow-2xl ring-1 ring-foreground/5">
            <div className="relative grid size-7 shrink-0 place-items-center rounded-full bg-primary/10">
              <Sparkles className="size-3.5 text-primary" />
              <span className="absolute inset-0 animate-ping rounded-full bg-primary/10" />
            </div>
            <div className="flex-1">
              <p className="text-xs font-semibold text-foreground">Generating PRD</p>
              <p className="text-[10px] text-muted-foreground">AI is writing your product requirements</p>
            </div>
            <button type="button" onClick={() => toast.dismiss(tid)} className="grid size-6 place-items-center rounded-md text-muted-foreground hover:bg-foreground/10 hover:text-foreground">
              <X className="size-3.5" />
            </button>
          </div>
        ),
        { id: toastId, duration: Infinity, position: "bottom-right" },
      );
    } else {
      toast.dismiss(toastId);
      if (wasGeneratingRef.current && prd) {
        toast.success("PRD is ready — review it in the PRD tab", { position: "bottom-right" });
      }
      wasGeneratingRef.current = false;
    }
  }, [isGeneratingPrd, feature.id, prd]);

  const utils = trpc.useUtils();
  const refreshFeature = () => utils.feature.getById.invalidate({ featureId: feature.id });

  // Whether this feature already carries a PR or review history — linking
  // another PR is still allowed, but gets a "history will change" warning.
  const alreadyLinked =
    feature.pullRequests.length > 0 || feature.reviewCycles.length > 0;

  // Unlinked PRs (with their branches) the user can attach to this feature.
  const [linkOpen, setLinkOpen] = useState(false);
  const linkablePrs = trpc.github.listLinkablePullRequests.useQuery(
    { projectId: feature.projectId },
    { enabled: linkOpen },
  );
  const linkPr = trpc.github.linkPullRequestToFeature.useMutation({
    onSuccess: async (_res, vars) => {
      setLinkOpen(false);
      toast.success("Pull request linked — starting AI review against the latest PRD…");
      void refreshFeature();
      void utils.github.listLinkablePullRequests.invalidate();
      // Catch the freshly-opened "running" cycle so the reviewing banner and
      // polling kick in while the inline review is in flight.
      setTimeout(() => void refreshFeature(), 2000);
      const res = await triggerPrReview(vars.pullRequestId, { force: true });
      if (!res.ok) toast.error(res.error ?? "Review failed to start");
      void refreshFeature();
    },
    onError: (error) => toast.error(error.message),
  });

  const sendMessage = trpc.feature.sendClarificationMessage.useMutation({
    onSuccess: (result) => {
      setMessages((current) => [
        ...current,
        { id: `assistant-${Date.now()}`, featureId: feature.id, role: "assistant", content: result.reply, createdAt: new Date().toISOString() },
      ]);
    },
    onError: (error) => toast.error(error.message),
  });

  const triggerPrd = trpc.feature.triggerPrdGeneration.useMutation({
    onSuccess: refreshFeature,
    onError: (error) => toast.error(error.message),
  });

  const cancelPrd = trpc.feature.cancelPrdGeneration.useMutation({
    onSuccess: () => { toast.info("PRD generation cancelled"); refreshFeature(); },
    onError: (error) => toast.error(error.message),
  });

  const editPrd = trpc.prd.editWithAI.useMutation({
    onSuccess: () => {
      toast.success("PRD updated");
      setEditPrompt("");
      refreshFeature();
    },
    onError: (error) => toast.error(error.message),
  });

  const setDeadline = trpc.prd.setDeadline.useMutation({
    onSuccess: () => { toast.success("Deadline updated"); refreshFeature(); },
    onError: (error) => toast.error(error.message),
  });

  const updateEstimate = trpc.prd.updateEstimate.useMutation({
    onSuccess: () => { toast.success("Estimate updated"); refreshFeature(); },
    onError: (error) => toast.error(error.message),
  });

  const approvePrd = trpc.prd.approve.useMutation({
    onSuccess: () => {
      toast.success("PRD approved — generating engineering tasks…");
      setShouldPoll(true);
      setActiveTab("tasks");
      refreshFeature();
    },
    onError: (error) => toast.error(error.message),
  });

  const cancelTaskGeneration = trpc.feature.cancelTaskGeneration.useMutation({
    onSuccess: () => { toast.info("Task generation cancelled"); setShouldPoll(false); refreshFeature(); },
    onError: (error) => toast.error(error.message),
  });

  const triggerTaskGeneration = trpc.feature.triggerTaskGeneration.useMutation({
    onSuccess: () => {
      toast.success("Generating engineering tasks…");
      setShouldPoll(true);
      setTaskGenDialogOpen(false);
      refreshFeature();
    },
    onError: (error) => toast.error(error.message),
  });

  const [taskGenDialogOpen, setTaskGenDialogOpen] = useState(false);

  const orgMembers = trpc.member.list.useQuery();

  // Only ask for disciplines this feature actually needs (e.g. no AI Developer
  // slot when there's no AI work). Older PRDs without declared disciplines fall
  // back to showing every slot.
  const relevantSlots =
    prd && prd.requiredDisciplines.length > 0
      ? SPECIALTY_SLOTS.filter((s) => prd.requiredDisciplines.includes(s.key))
      : SPECIALTY_SLOTS;

  // specialty → first matching member
  const memberBySpecialty = Object.fromEntries(
    relevantSlots.map((s) => [
      s.key,
      orgMembers.data?.find((m) => m.specialty === s.key || (s.key === "backend" && m.specialty === "fullstack")),
    ]),
  );

  // specialtyKey → userId chosen for missing slots
  const [specialtyOverrides, setSpecialtyOverrides] = useState<Record<string, string>>({});

  const approveRelease = trpc.approval.approve.useMutation({
    onSuccess: () => { toast.success("Release approved"); refreshFeature(); router.refresh(); },
    onError: (error) => toast.error(error.message),
  });

  const shipFeature = trpc.approval.ship.useMutation({
    onSuccess: () => { toast.success("Feature shipped"); refreshFeature(); router.refresh(); },
    onError: (error) => toast.error(error.message),
  });

  function handleSendMessage() {
    const trimmed = inputMessage.trim();
    if (!trimmed) return;
    setMessages((current) => [
      ...current,
      { id: `user-${Date.now()}`, featureId: feature.id, role: "user", content: trimmed, createdAt: new Date().toISOString() },
    ]);
    setInputMessage("");
    sendMessage.mutate({ featureId: feature.id, message: trimmed });
  }

  // ── Derived gating state ──────────────────────────────────────────────
  // Latest clarification timestamp (covers optimistic + server messages).
  const latestMessageAt = useMemo(
    () => messages.reduce((max, m) => Math.max(max, new Date(m.createdAt).getTime()), 0),
    [messages],
  );

  // A PRD can only be regenerated once the user has actually changed the
  // clarification since it was last generated — this stops pointless,
  // bill-burning re-runs. Approved PRDs are locked.
  const prdUpdatedAt = prd ? new Date(prd.updatedAt).getTime() : 0;
  const clarificationChangedSincePrd =
    Boolean(prd) && !prd?.approvedAt && latestMessageAt > prdUpdatedAt;

  // Any in-flight AI/generation work — hard-disables every "spend money" button
  // so a single user can't fan out concurrent generations.
  const aiBusy =
    isGeneratingPrd ||
    isGeneratingTasks ||
    triggerPrd.isPending ||
    triggerTaskGeneration.isPending ||
    approvePrd.isPending ||
    editPrd.isPending ||
    sendMessage.isPending;

  const canGeneratePrd = !aiBusy && (!prd || clarificationChangedSincePrd);
  let prdButtonLabel = `Regenerate PRD → v${(prd?.version ?? 0) + 1}`;
  if (!prd) {
    prdButtonLabel = "Generate PRD now";
  } else if (prd.approvedAt) {
    prdButtonLabel = "PRD approved — locked";
  }

  // Engineering tasks auto-start after PRD approval. Show a short countdown; if
  // auto-generation doesn't kick in within the window, enable a manual fallback.
  const awaitingTasks = Boolean(prd?.approvedAt) && feature.tasks.length === 0;
  useEffect(() => {
    if (!awaitingTasks) {
      setTaskCountdown(10);
      return;
    }
    setTaskCountdown(10);
    const id = setInterval(() => setTaskCountdown((c) => (c <= 1 ? 0 : c - 1)), 1000);
    return () => clearInterval(id);
  }, [awaitingTasks, prd?.id]);

  return (
    <div className="space-y-5">
      {/* Feature summary — persistent header (replaces the old Overview tab) */}
      <div className="space-y-4 border border-border bg-card p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={status} />
            <span className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
              {feature.priority} priority
            </span>
          </div>
          <span className="font-mono text-[11px] text-muted-foreground">Created {formatDate(feature.createdAt)}</span>
        </div>
        <p className="text-sm leading-7 text-muted-foreground">{feature.description}</p>
        <div className="flex flex-wrap gap-x-5 gap-y-1 border-t border-border pt-3 font-mono text-[11px] text-muted-foreground">
          <span>{feature.tasks.length} tasks</span>
          <span>{feature.pullRequests.length} pull requests</span>
          {feature.reviewCycles.length > 0 ? <span>{feature.reviewCycles.length} review cycles</span> : null}
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="gap-5">
        {/* Pipeline stepper stays pinned at the top of <main>'s scrollport
            (just below the top nav) while scrolling the active stage's
            content, so switching stages is always in reach. */}
        <div className="sticky top-0 z-20 -mx-1 bg-background/80 px-1 py-3 backdrop-blur-md">
          <PipelineStepper
            status={status}
            value={activeTab}
            onSelect={setActiveTab}
            isGeneratingPrd={isGeneratingPrd}
            isGeneratingTasks={isGeneratingTasks}
            hasPrd={Boolean(feature.prd)}
            hasTasks={feature.tasks.length > 0}
          />
        </div>

        {/* ── Clarify ──────────────────────────────────────── */}
        <TabsContent value="clarify">
          <ClarifyTabContent
            messages={messages}
            inputMessage={inputMessage}
            onInputChange={setInputMessage}
            onSendMessage={handleSendMessage}
            isSendingPending={sendMessage.isPending}
            canGeneratePrd={canGeneratePrd}
            onGeneratePrd={() => { setActiveTab("prd"); triggerPrd.mutate({ featureId: feature.id }); }}
            isGeneratingPrd={isGeneratingPrd}
            prdButtonLabel={prdButtonLabel}
            prd={prd}
            clarificationChangedSincePrd={clarificationChangedSincePrd}
          />
        </TabsContent>

        {/* ── PRD ──────────────────────────────────────────── */}
        <TabsContent value="prd">
          <PrdTabContent
            featureId={feature.id}
            featureTitle={feature.title}
            prd={prd}
            prdProgress={prdProgress}
            prdView={prdView}
            onPrdViewChange={setPrdView}
            prdDocFields={prdDocFields}
            prdDocMeta={prdDocMeta}
            canGeneratePrd={canGeneratePrd}
            isGeneratingPrd={isGeneratingPrd}
            aiBusy={aiBusy}
            editPrompt={editPrompt}
            onEditPromptChange={setEditPrompt}
            onTriggerPrd={() => triggerPrd.mutate({ featureId: feature.id })}
            isTriggerPrdPending={triggerPrd.isPending}
            onCancelPrd={() => cancelPrd.mutate({ featureId: feature.id })}
            isCancelPrdPending={cancelPrd.isPending}
            onSaveEstimate={(hours) => updateEstimate.mutate({ prdId: prd!.id, estimatedTotalHours: hours })}
            isEstimatePending={updateEstimate.isPending}
            onSaveDeadline={(date) => setDeadline.mutate({ prdId: prd!.id, targetDeadline: date })}
            onEditPrd={() => editPrd.mutate({ prdId: prd!.id, featureId: feature.id, prompt: editPrompt })}
            isEditPending={editPrd.isPending}
            onApprovePrd={() => approvePrd.mutate({
              prdId: prd!.id,
              featureId: feature.id,
              specialtyOverrides: Object.keys(specialtyOverrides).length ? specialtyOverrides : undefined,
            })}
            isApprovePending={approvePrd.isPending}
            relevantSlots={relevantSlots}
            memberBySpecialty={memberBySpecialty}
            specialtyOverrides={specialtyOverrides}
            onOverrideChange={(slotKey, v) => setSpecialtyOverrides((prev) => ({ ...prev, [slotKey]: v }))}
            orgMembers={orgMembers.data ?? []}
            onNavigateToTeam={() => router.push("/settings/team")}
          />
        </TabsContent>

        {/* ── Tasks ────────────────────────────────────────── */}
        <TabsContent value="tasks">
          <TasksTabContent
            featureId={feature.id}
            tasks={feature.tasks}
            hasApprovedPrd={Boolean(feature.prd?.approvedAt)}
            taskCountdown={taskCountdown}
            isGeneratingTasks={isGeneratingTasks}
            aiBusy={aiBusy}
            tasksView={tasksView}
            onTasksViewChange={setTasksView}
            onOpenTaskGenDialog={() => setTaskGenDialogOpen(true)}
            onCancelTaskGen={() => cancelTaskGeneration.mutate({ featureId: feature.id })}
          />
        </TabsContent>

        {/* ── Reviews ──────────────────────────────────────── */}
        <TabsContent value="review-history">
          <ReviewHistoryTabContent
            reviewCycles={feature.reviewCycles}
            prById={prById}
            shownBranch={shownBranch}
            reviewBranch={reviewBranch}
            alreadyLinked={alreadyLinked}
            linkOpen={linkOpen}
            onLinkOpenChange={setLinkOpen}
            linkablePrs={linkablePrs}
            onLinkPr={(prId) => linkPr.mutate({ pullRequestId: prId, featureId: feature.id })}
            isLinkPrPending={linkPr.isPending}
            hasRunningReview={hasRunningReview}
          />
        </TabsContent>

        {/* ── Release ──────────────────────────────────────── */}
        <TabsContent value="release">
          <div className="rounded-lg border border-foreground/10 bg-foreground/4.5 p-5">
            <ReleaseTabContent
              status={status}
              tasks={feature.tasks}
              pullRequests={feature.pullRequests}
              reviewCycles={feature.reviewCycles}
              prd={prd}
              onApproveRelease={() => approveRelease.mutate({ featureId: feature.id })}
              isApproveReleasePending={approveRelease.isPending}
              onShipFeature={() => shipFeature.mutate({ featureId: feature.id })}
              isShipFeaturePending={shipFeature.isPending}
            />
          </div>
        </TabsContent>
      </Tabs>

      {/* ── Generate tasks dialog (triggered from tasks tab) ── */}
      <AlertDialog open={taskGenDialogOpen} onOpenChange={setTaskGenDialogOpen}>
        <AlertDialogContent className="border-foreground/10 bg-popover sm:max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-foreground">Team coverage before task generation</AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground">
              AI will assign tasks based on each developer&apos;s specialty. Fill in missing slots or add team members.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <TeamCoverageForm
            slots={SPECIALTY_SLOTS}
            memberBySpecialty={memberBySpecialty}
            specialtyOverrides={specialtyOverrides}
            onOverrideChange={(slotKey, v) => setSpecialtyOverrides((prev) => ({ ...prev, [slotKey]: v }))}
            orgMembers={orgMembers.data ?? []}
            onNavigateToTeam={() => { setTaskGenDialogOpen(false); router.push("/settings/team"); }}
          />

          <AlertDialogFooter>
            <AlertDialogCancel className="border-foreground/10 bg-foreground/5 text-foreground/80 hover:bg-foreground/10">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-primary text-primary-foreground hover:bg-primary disabled:opacity-50"
              disabled={aiBusy}
              onClick={() => triggerTaskGeneration.mutate({
                featureId: feature.id,
                specialtyOverrides: Object.keys(specialtyOverrides).length ? specialtyOverrides : undefined,
              })}
            >
              {triggerTaskGeneration.isPending ? <Loader2 className="size-4 animate-spin" /> : <Zap className="size-4" />}
              Generate tasks
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

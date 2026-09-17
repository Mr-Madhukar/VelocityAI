"use client";

import { useMemo, useState } from "react";
import type { RouterOutputs } from "@repo/trpc/client";
import { ChevronRight, Loader2, MessageSquareText, SendHorizontal } from "lucide-react";
import { toast } from "sonner";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { Textarea } from "~/components/ui/textarea";
import { authClient } from "@/lib/auth-client";
import { cn } from "~/lib/utils";
import { trpc } from "~/trpc/client";

type Task = RouterOutputs["feature"]["getById"]["tasks"][number];
type Note = RouterOutputs["task"]["listNotes"][number];

const TASK_STATUS_TONE: Record<string, string> = {
  todo: "border-muted-foreground/30 bg-muted text-muted-foreground",
  in_progress: "border-primary/30 bg-primary/10 text-primary",
  done: "border-success/30 bg-success/10 text-success",
  blocked: "border-destructive/30 bg-destructive/10 text-destructive",
};

const TASK_STATUS_LABEL: Record<string, string> = {
  todo: "Todo",
  in_progress: "In progress",
  done: "Done",
  blocked: "Blocked",
};

function timeAgo(value: string | Date) {
  const then = new Date(value).getTime();
  const seconds = Math.max(0, Math.round((Date.now() - then) / 1000));
  if (seconds < 60) return "just now";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(value).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function initials(name: string | null) {
  if (!name) return "?";
  return name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function Avatar({ name, image, mine }: { name: string | null; image: string | null; mine: boolean }) {
  if (image) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={image} alt={name ?? ""} className="size-8 shrink-0 rounded-full object-cover ring-1 ring-foreground/10" />;
  }
  return (
    <div
      className={cn(
        "grid size-8 shrink-0 place-items-center rounded-full text-[11px] font-bold ring-1 ring-foreground/10",
        mine ? "bg-primary/20 text-primary" : "bg-foreground/10 text-muted-foreground",
      )}
    >
      {initials(name)}
    </div>
  );
}

function MiniAvatar({ name, image }: { name: string | null; image: string | null }) {
  if (image) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={image} alt={name ?? ""} className="size-5 rounded-full object-cover ring-2 ring-popover" />;
  }
  return (
    <div className="grid size-5 place-items-center rounded-full bg-foreground/15 text-[8px] font-bold text-muted-foreground ring-2 ring-popover">
      {initials(name)}
    </div>
  );
}

// Slack-style message row: avatar + bold name + time, then plain wrapped text.
// The current user's own messages get a subtle highlight.
function NoteRow({ note, mine }: { note: Note; mine: boolean }) {
  return (
    <div
      className={cn(
        "flex gap-2.5 rounded-md px-2 py-1.5 transition-colors",
        mine ? "bg-primary/[0.06]" : "hover:bg-foreground/[0.03]",
      )}
    >
      <Avatar name={note.authorName} image={note.authorImage} mine={mine} />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <span className={cn("text-sm font-semibold", mine ? "text-primary" : "text-foreground")}>
            {mine ? "You" : note.authorName ?? "Unknown"}
          </span>
          <span className="font-mono text-[10px] text-muted-foreground">{timeAgo(note.createdAt)}</span>
        </div>
        <p className="mt-0.5 whitespace-pre-wrap break-words text-sm leading-6 text-foreground/90">
          {note.content}
        </p>
      </div>
    </div>
  );
}

// Inline composer used inside an expanded thread. Holds its own draft so each
// thread's reply box is independent.
function ThreadComposer({ onSubmit, pending }: { onSubmit: (content: string) => void; pending: boolean }) {
  const [value, setValue] = useState("");
  function submit() {
    const content = value.trim();
    if (!content) return;
    onSubmit(content);
    setValue("");
  }
  return (
    <div className="mt-1.5 flex items-center gap-2">
      <Textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) submit();
        }}
        placeholder="Reply…"
        className="min-h-9 flex-1 border-foreground/10 bg-background text-sm"
      />
      <button
        type="button"
        onClick={submit}
        disabled={!value.trim() || pending}
        className="grid size-9 shrink-0 cursor-pointer place-items-center rounded-md bg-primary text-primary-foreground transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {pending ? <Loader2 className="size-4 animate-spin" /> : <SendHorizontal className="size-4" />}
      </button>
    </div>
  );
}

export function TaskNotesModal({
  task,
  open,
  onOpenChange,
}: {
  task: Task | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const utils = trpc.useUtils();
  const { data: session } = authClient.useSession();
  const currentUserId = session?.user?.id ?? null;

  const taskId = task?.id ?? "";

  const { data: notes = [], isLoading } = trpc.task.listNotes.useQuery(
    { taskId },
    { enabled: open && !!taskId },
  );

  const [draft, setDraft] = useState("");
  // Thread roots whose replies + reply composer are expanded.
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  function toggleThread(rootId: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(rootId)) next.delete(rootId);
      else next.add(rootId);
      return next;
    });
  }

  const addNote = trpc.task.addNote.useMutation({
    onMutate: async (vars) => {
      await utils.task.listNotes.cancel({ taskId });
      const previous = utils.task.listNotes.getData({ taskId });
      const optimistic: Note = {
        id: `optimistic-${Date.now()}`,
        taskId,
        userId: currentUserId ?? "",
        parentId: vars.parentId ?? null,
        content: vars.content,
        createdAt: new Date().toISOString(),
        authorName: session?.user?.name ?? "You",
        authorImage: session?.user?.image ?? null,
      };
      utils.task.listNotes.setData({ taskId }, (old) => [...(old ?? []), optimistic]);
      return { previous };
    },
    onError: (err, _vars, ctx) => {
      if (ctx?.previous) utils.task.listNotes.setData({ taskId }, ctx.previous);
      toast.error(err.message);
    },
    onSettled: () => {
      void utils.task.listNotes.invalidate({ taskId });
      // Keep the card's note count in sync.
      if (task) void utils.feature.getById.invalidate({ featureId: task.featureId });
    },
  });

  // Split into top-level notes and replies keyed by their thread root.
  const { topLevel, repliesByRoot } = useMemo(() => {
    const roots: Note[] = [];
    const replies = new Map<string, Note[]>();
    for (const note of notes) {
      if (note.parentId) {
        const arr = replies.get(note.parentId) ?? [];
        arr.push(note);
        replies.set(note.parentId, arr);
      } else {
        roots.push(note);
      }
    }
    return { topLevel: roots, repliesByRoot: replies };
  }, [notes]);

  function submitNew() {
    const content = draft.trim();
    if (!content || !taskId) return;
    addNote.mutate({ taskId, content });
    setDraft("");
  }

  // Content starts at avatar (2rem) + gap (0.625rem) = 2.625rem — align thread
  // affordances under the message text.
  const threadIndent = "pl-[2.625rem]";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[85vh] flex-col gap-0 overflow-hidden border-border bg-popover p-0 sm:max-w-2xl">
        <DialogHeader className="border-b border-border px-5 py-4 text-left">
          <div className="flex items-center gap-2 pr-8">
            <DialogTitle className="text-base">{task?.title ?? "Task"}</DialogTitle>
            {task ? <StatusPill status={task.status} /> : null}
          </div>
          <DialogDescription className="sr-only">Task details and discussion notes</DialogDescription>
          {task?.description ? (
            <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-muted-foreground">{task.description}</p>
          ) : null}
          {task ? (
            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 font-mono text-[11px] text-muted-foreground">
              <span className="capitalize">{task.type}</span>
              <span className="capitalize">{task.priority} priority</span>
              {task.estimatedHours ? <span>~{task.estimatedHours}h</span> : null}
              {task.assigneeName ? <span>Assigned to {task.assigneeName}</span> : null}
            </div>
          ) : null}
          {task?.status === "blocked" && task.blockedReason ? (
            <p className="mt-2 rounded border border-destructive/20 bg-destructive/5 px-2.5 py-1.5 text-[11px] text-destructive">
              Blocked: {task.blockedReason}
            </p>
          ) : null}
        </DialogHeader>

        {/* Notes thread — data-lenis-prevent lets the wheel scroll this natively
            (Lenis otherwise swallows wheel events even while stopped). */}
        <div
          data-lenis-prevent
          className="min-h-0 flex-1 space-y-1 overflow-y-auto px-3 py-4"
        >
          {isLoading ? (
            <div className="flex h-32 items-center justify-center">
              <Loader2 className="size-5 animate-spin text-muted-foreground" />
            </div>
          ) : topLevel.length === 0 ? (
            <div className="flex h-32 flex-col items-center justify-center gap-2 text-center">
              <MessageSquareText className="size-6 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">No notes yet. Start the discussion below.</p>
            </div>
          ) : (
            topLevel.map((note) => {
              const replies = repliesByRoot.get(note.id) ?? [];
              const isExpanded = expanded.has(note.id);
              const lastReply = replies[replies.length - 1];

              // Unique repliers (for the stacked avatars), most recent first.
              const repliers: Note[] = [];
              const seen = new Set<string>();
              for (let i = replies.length - 1; i >= 0 && repliers.length < 3; i -= 1) {
                const r = replies[i]!;
                if (seen.has(r.userId)) continue;
                seen.add(r.userId);
                repliers.push(r);
              }

              return (
                <div key={note.id} className="py-1">
                  <NoteRow note={note} mine={note.userId === currentUserId} />

                  <div className={threadIndent}>
                    {replies.length > 0 ? (
                      <button
                        type="button"
                        onClick={() => toggleThread(note.id)}
                        className="mt-0.5 inline-flex cursor-pointer items-center gap-2 rounded-md py-1 pl-1 pr-2 transition-colors hover:bg-foreground/[0.05]"
                      >
                        <div className="flex -space-x-1.5">
                          {repliers.map((r) => (
                            <MiniAvatar key={r.id} name={r.authorName} image={r.authorImage} />
                          ))}
                        </div>
                        <span className="text-xs font-semibold text-primary">
                          {replies.length} {replies.length === 1 ? "reply" : "replies"}
                        </span>
                        {lastReply ? (
                          <span className="text-[11px] text-muted-foreground">
                            Last reply {timeAgo(lastReply.createdAt)}
                          </span>
                        ) : null}
                        <ChevronRight
                          className={cn("size-3.5 text-muted-foreground transition-transform", isExpanded && "rotate-90")}
                        />
                      </button>
                    ) : !isExpanded ? (
                      <button
                        type="button"
                        onClick={() => toggleThread(note.id)}
                        className="mt-0.5 inline-flex cursor-pointer items-center gap-1 rounded px-1 py-0.5 text-[11px] text-muted-foreground transition-colors hover:text-foreground"
                      >
                        Reply
                      </button>
                    ) : null}

                    {isExpanded ? (
                      <div className="mt-1 space-y-0.5 border-l-2 border-border pl-2">
                        {replies.map((reply) => (
                          <NoteRow key={reply.id} note={reply} mine={reply.userId === currentUserId} />
                        ))}
                        <ThreadComposer
                          pending={addNote.isPending}
                          onSubmit={(content) => addNote.mutate({ taskId, content, parentId: note.id })}
                        />
                      </div>
                    ) : null}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* New-note composer */}
        <div className="border-t border-border bg-card px-5 py-3">
          <div className="flex items-end gap-2">
            <Textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) submitNew();
              }}
              placeholder="Add a note…  (⌘/Ctrl+Enter to send)"
              className="min-h-11 flex-1 border-foreground/10 bg-background text-sm"
            />
            <button
              type="button"
              onClick={submitNew}
              disabled={!draft.trim() || addNote.isPending}
              className="inline-flex h-11 shrink-0 cursor-pointer items-center gap-1.5 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <SendHorizontal className="size-4" />
              Note
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function StatusPill({ status }: { status: string }) {
  const label = TASK_STATUS_LABEL[status] ?? status.replace("_", " ");
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center border px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider",
        TASK_STATUS_TONE[status] ?? "border-border bg-muted text-muted-foreground",
      )}
    >
      {label}
    </span>
  );
}

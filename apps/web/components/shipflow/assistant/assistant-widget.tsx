"use client";

import { useCallback, useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  GitPullRequestArrow,
  History,
  Loader2,
  MessageSquare,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { eventMatchesShortcut } from "~/components/shipflow/nav-items";
import { cn } from "~/lib/utils";
import { trpc } from "~/trpc/client";

import { AssistantMark, type AgentState } from "./assistant-mark";
import { AssistantChat } from "./assistant-chat";
import { AssistantPanel } from "./assistant-panel";

const TOGGLE_SHORTCUT = "alt+c";

type Tab = "chat" | "pr";

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || target.isContentEditable;
}

function relativeTime(value: string | Date): string {
  const date = value instanceof Date ? value : new Date(value);
  const diff = Date.now() - date.getTime();
  const mins = Math.round(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

// ── History sidebar ──────────────────────────────────────────────────────
function HistoryPanel({
  activeId,
  onSelect,
  onClose,
}: {
  activeId: string | null;
  onSelect: (id: string | null) => void;
  onClose: () => void;
}) {
  const utils = trpc.useUtils();
  const { data: conversations = [], isLoading } = trpc.assistant.listConversations.useQuery();
  const del = trpc.assistant.deleteConversation.useMutation({
    onSuccess: () => void utils.assistant.listConversations.invalidate(),
    onError: (e) => toast.error(e.message),
  });

  return (
    <div className="flex h-full w-64 shrink-0 flex-col border-r border-border/60 bg-background/40">
      <div className="flex items-center justify-between px-3 py-2.5">
        <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
          Chat history
        </span>
        <button
          type="button"
          onClick={onClose}
          aria-label="Hide history"
          className="rounded-md p-1 text-muted-foreground hover:bg-foreground/[0.06] hover:text-foreground"
        >
          <X className="size-3.5" />
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-2">
        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="size-4 animate-spin text-muted-foreground" />
          </div>
        ) : conversations.length === 0 ? (
          <p className="px-2 py-8 text-center text-xs text-muted-foreground">No chats yet.</p>
        ) : (
          <div className="space-y-1">
            {conversations.map((c) => (
              <div
                key={c.id}
                className={cn(
                  "group flex items-center gap-1 rounded-lg px-2 py-1.5 transition-colors",
                  activeId === c.id ? "bg-primary/10" : "hover:bg-foreground/[0.04]",
                )}
              >
                <button
                  type="button"
                  onClick={() => onSelect(c.id)}
                  className="min-w-0 flex-1 text-left"
                >
                  <p className="truncate text-xs font-medium text-foreground">{c.title}</p>
                  <p className="text-[10px] text-muted-foreground">{relativeTime(c.updatedAt)}</p>
                </button>
                <button
                  type="button"
                  aria-label="Delete chat"
                  onClick={() => {
                    if (activeId === c.id) onSelect(null);
                    del.mutate({ conversationId: c.id });
                  }}
                  className="shrink-0 rounded p-1 text-muted-foreground opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100"
                >
                  <Trash2 className="size-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Root widget ──────────────────────────────────────────────────────────
export function VelocityAIAssistant() {
  const [open, setOpen] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [tab, setTab] = useState<Tab>("chat");
  const [chatThinking, setChatThinking] = useState(false);
  const [prGenerating, setPrGenerating] = useState(false);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);

  const onGeneratingChange = useCallback((g: boolean) => setPrGenerating(g), []);
  const onThinkingChange = useCallback((t: boolean) => setChatThinking(t), []);

  const thinking = chatThinking || prGenerating;
  const faceState: AgentState = thinking ? "thinking" : hovered ? "hover" : "idle";
  const launcherState: AgentState = thinking ? "thinking" : hovered ? "hover" : "idle";

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape" && open) {
        if (historyOpen) setHistoryOpen(false);
        else setOpen(false);
        return;
      }
      if (isEditableTarget(event.target)) return;
      if (eventMatchesShortcut(event, TOGGLE_SHORTCUT)) {
        event.preventDefault();
        setOpen((v) => !v);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, historyOpen]);

  // Lock body scroll while the full-screen overlay is open.
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  function startNewChat() {
    setActiveConversationId(null);
    setTab("chat");
  }

  return (
    <>
      {/* Full-screen glassmorphic overlay */}
      <AnimatePresence>
        {open ? (
          <motion.div
            key="assistant-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-0 backdrop-blur-md sm:p-6"
            onMouseDown={(e) => {
              if (e.target === e.currentTarget) setOpen(false);
            }}
          >
            <motion.div
              initial={{ opacity: 0, y: 16, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 16, scale: 0.98 }}
              transition={{ type: "spring", stiffness: 280, damping: 28 }}
              className="flex h-full w-full flex-col overflow-hidden border border-border/60 bg-background/80 shadow-2xl shadow-black/40 backdrop-blur-xl sm:h-[85vh] sm:max-w-4xl sm:rounded-2xl"
            >
              {/* Header */}
              <div className="flex items-center justify-between gap-3 border-b border-border/60 bg-background/50 px-4 py-3">
                <div className="flex min-w-0 items-center gap-3">
                  <AssistantMark state={faceState} size={30} />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-foreground">VelocityAI assistant</p>
                    <p className="truncate text-[11px] text-muted-foreground">
                      {tab === "chat"
                        ? "Ask about your workspace"
                        : "Describe a change — draft a PR against your repo"}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  {/* Tab switch */}
                  <div className="mr-1 hidden items-center gap-0.5 rounded-lg border border-border bg-foreground/[0.03] p-0.5 sm:inline-flex">
                    <button
                      type="button"
                      onClick={() => setTab("chat")}
                      aria-pressed={tab === "chat"}
                      className={cn(
                        "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                        tab === "chat"
                          ? "bg-primary text-primary-foreground shadow-sm"
                          : "text-muted-foreground hover:text-foreground",
                      )}
                    >
                      <MessageSquare className="size-3.5" />
                      Chat
                    </button>
                    <button
                      type="button"
                      onClick={() => setTab("pr")}
                      aria-pressed={tab === "pr"}
                      className={cn(
                        "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                        tab === "pr"
                          ? "bg-primary text-primary-foreground shadow-sm"
                          : "text-muted-foreground hover:text-foreground",
                      )}
                    >
                      <GitPullRequestArrow className="size-3.5" />
                      Draft PR
                    </button>
                  </div>

                  {tab === "chat" ? (
                    <>
                      <button
                        type="button"
                        onClick={startNewChat}
                        title="New chat"
                        className="inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
                      >
                        <Plus className="size-3.5" />
                        <span className="hidden sm:inline">New</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setHistoryOpen((v) => !v)}
                        aria-pressed={historyOpen}
                        title="Chat history"
                        className={cn(
                          "inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs transition-colors",
                          historyOpen
                            ? "border-primary/40 bg-primary/10 text-primary"
                            : "border-border text-muted-foreground hover:text-foreground",
                        )}
                      >
                        <History className="size-3.5" />
                        <span className="hidden sm:inline">History</span>
                      </button>
                    </>
                  ) : null}

                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    aria-label="Close assistant"
                    className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-foreground/[0.06] hover:text-foreground"
                  >
                    <X className="size-4" />
                  </button>
                </div>
              </div>

              {/* Mobile tab switch */}
              <div className="flex items-center gap-0.5 border-b border-border/60 bg-background/40 px-4 py-2 sm:hidden">
                <button
                  type="button"
                  onClick={() => setTab("chat")}
                  className={cn(
                    "inline-flex flex-1 items-center justify-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium",
                    tab === "chat" ? "bg-primary text-primary-foreground" : "text-muted-foreground",
                  )}
                >
                  <MessageSquare className="size-3.5" />
                  Chat
                </button>
                <button
                  type="button"
                  onClick={() => setTab("pr")}
                  className={cn(
                    "inline-flex flex-1 items-center justify-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium",
                    tab === "pr" ? "bg-primary text-primary-foreground" : "text-muted-foreground",
                  )}
                >
                  <GitPullRequestArrow className="size-3.5" />
                  Draft PR
                </button>
              </div>

              {/* Body */}
              <div className="flex min-h-0 flex-1">
                {tab === "chat" ? (
                  <>
                    {historyOpen ? (
                      <HistoryPanel
                        activeId={activeConversationId}
                        onSelect={(id) => {
                          setActiveConversationId(id);
                        }}
                        onClose={() => setHistoryOpen(false)}
                      />
                    ) : null}
                    <div className="min-h-0 flex-1 px-3 py-1 sm:px-5">
                      <AssistantChat
                        activeConversationId={activeConversationId}
                        onConversationChange={setActiveConversationId}
                        onThinkingChange={onThinkingChange}
                      />
                    </div>
                  </>
                ) : (
                  <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5">
                    <div className="mx-auto max-w-2xl">
                      <AssistantPanel onGeneratingChange={onGeneratingChange} />
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      {/* Launcher */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        aria-label={open ? "Close VelocityAI assistant" : "Open VelocityAI assistant"}
        aria-expanded={open}
        title="VelocityAI assistant · Alt C"
        className={cn(
          "fixed bottom-6 right-6 z-40 rounded-[25%] shadow-lg shadow-black/30 transition-shadow hover:shadow-xl",
          open && "ring-2 ring-primary/40 ring-offset-2 ring-offset-background",
        )}
      >
        <AssistantMark state={launcherState} size={56} />
      </button>
    </>
  );
}

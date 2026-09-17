"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowUp, Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";

import { cn } from "~/lib/utils";
import { trpc } from "~/trpc/client";

import { AssistantMark } from "./assistant-mark";
import { Markdown } from "./markdown";

type ChatMsg = { id: string; role: "user" | "assistant"; content: string };

const SUGGESTIONS = [
  "What features are in review right now?",
  "Summarize my projects and their status.",
  "Which features still need a PRD approved?",
  "How does the VelocityAI pipeline work?",
];

let tempId = 0;
const nextId = () => `temp-${tempId++}`;

export function AssistantChat({
  activeConversationId,
  onConversationChange,
  onThinkingChange,
}: {
  activeConversationId: string | null;
  onConversationChange: (id: string | null) => void;
  onThinkingChange: (thinking: boolean) => void;
}) {
  const utils = trpc.useUtils();
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState("");
  const loadedRef = useRef<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const { data: quota } = trpc.assistant.quota.useQuery();

  const convQuery = trpc.assistant.getConversation.useQuery(
    { conversationId: activeConversationId ?? "" },
    { enabled: Boolean(activeConversationId), staleTime: 0 },
  );

  // Load an existing conversation's messages when it's selected from history.
  // Skip when we already show it (including locally-originated new chats).
  useEffect(() => {
    if (!activeConversationId) {
      if (loadedRef.current !== null) {
        loadedRef.current = null;
        setMessages([]);
      }
      return;
    }
    if (loadedRef.current === activeConversationId) return;
    if (convQuery.data && convQuery.data.conversation.id === activeConversationId) {
      setMessages(
        convQuery.data.messages.map((m) => ({
          id: m.id,
          role: m.role === "assistant" ? "assistant" : "user",
          content: m.content,
        })),
      );
      loadedRef.current = activeConversationId;
    }
  }, [activeConversationId, convQuery.data]);

  const send = trpc.assistant.sendMessage.useMutation();
  const sending = send.isPending;

  // Autoscroll to the newest message.
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, sending]);

  const newChatBlocked = Boolean(quota && !quota.canChat && !activeConversationId);

  function submit(text: string) {
    const content = text.trim();
    if (!content || sending) return;
    if (newChatBlocked) {
      toast.error(quota?.reason ?? "Chat limit reached.");
      return;
    }
    setInput("");
    const userMsg: ChatMsg = { id: nextId(), role: "user", content };
    setMessages((prev) => [...prev, userMsg]);
    onThinkingChange(true);

    send.mutate(
      { conversationId: activeConversationId ?? undefined, content },
      {
        onSuccess: (res) => {
          setMessages((prev) => [
            ...prev,
            { id: res.message?.id ?? nextId(), role: "assistant", content: res.reply },
          ]);
          if (!activeConversationId) {
            loadedRef.current = res.conversationId;
            onConversationChange(res.conversationId);
          }
          void utils.assistant.listConversations.invalidate();
          void utils.assistant.quota.invalidate();
          onThinkingChange(false);
        },
        onError: (error) => {
          toast.error(error.message);
          setMessages((prev) => prev.filter((m) => m.id !== userMsg.id));
          onThinkingChange(false);
        },
      },
    );
  }

  const empty = messages.length === 0;

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* Messages */}
      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto px-1 py-2">
        {empty ? (
          <div className="flex h-full flex-col items-center justify-center gap-5 px-4 text-center">
            <AssistantMark state="idle" size={56} />
            <div className="space-y-1">
              <p className="text-base font-semibold text-foreground">Ask about your workspace</p>
              <p className="max-w-sm text-sm text-muted-foreground">
                I can answer questions about your features, PRDs, tasks, reviews, repos, and
                billing — grounded in this organization&apos;s data.
              </p>
            </div>
            <div className="grid w-full max-w-md gap-2 sm:grid-cols-2">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => submit(s)}
                  disabled={newChatBlocked}
                  className="rounded-lg border border-border bg-foreground/[0.03] px-3 py-2 text-left text-xs text-foreground/80 transition-colors hover:border-primary/40 hover:bg-primary/5 disabled:opacity-50"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="mx-auto flex max-w-2xl flex-col gap-4">
            {messages.map((m) =>
              m.role === "user" ? (
                <div key={m.id} className="flex justify-end">
                  <div className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-sm bg-primary px-3.5 py-2 text-sm text-primary-foreground">
                    {m.content}
                  </div>
                </div>
              ) : (
                <div key={m.id} className="flex gap-2.5">
                  <div className="mt-0.5 shrink-0">
                    <AssistantMark state="idle" size={26} />
                  </div>
                  <div className="min-w-0 flex-1 rounded-2xl rounded-tl-sm border border-border bg-foreground/[0.03] px-3.5 py-2.5">
                    <Markdown content={m.content} />
                  </div>
                </div>
              ),
            )}
            {sending ? (
              <div className="flex items-center gap-2.5 text-muted-foreground">
                <AssistantMark state="thinking" size={26} />
                <span className="text-xs">Thinking…</span>
              </div>
            ) : null}
          </div>
        )}
      </div>

      {/* Composer */}
      <div className="border-t border-border/60 px-1 pt-3">
        {newChatBlocked ? (
          <div className="mb-2 flex items-center justify-between gap-3 rounded-lg border border-amber-400/40 bg-amber-400/[0.06] px-3 py-2">
            <p className="text-xs text-amber-600 dark:text-amber-300">{quota?.reason}</p>
            <a
              href="/billing"
              className="shrink-0 font-mono text-[10px] uppercase tracking-wider text-primary underline-offset-2 hover:underline"
            >
              Upgrade →
            </a>
          </div>
        ) : null}
        <div className="flex items-end gap-2 rounded-2xl border border-border bg-background/60 p-2 backdrop-blur">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                submit(input);
              }
            }}
            rows={1}
            disabled={newChatBlocked}
            placeholder={newChatBlocked ? "Monthly chat limit reached" : "Ask about your features, projects, tasks…"}
            className="max-h-32 min-h-[2.25rem] flex-1 resize-none bg-transparent px-2 py-1.5 text-sm text-foreground placeholder:text-muted-foreground/70 focus:outline-none disabled:opacity-60"
          />
          <button
            type="button"
            onClick={() => submit(input)}
            disabled={sending || !input.trim() || newChatBlocked}
            aria-label="Send"
            className={cn(
              "grid size-9 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground transition-opacity",
              (sending || !input.trim() || newChatBlocked) && "opacity-50",
            )}
          >
            {sending ? <Loader2 className="size-4 animate-spin" /> : <ArrowUp className="size-4" />}
          </button>
        </div>
        <p className="mt-1.5 flex items-center justify-center gap-1 text-center text-[10px] text-muted-foreground">
          <Sparkles className="size-3" />
          VelocityAI assistant · answers grounded in your workspace
          {quota && quota.limit !== -1 ? ` · ${quota.used}/${quota.limit} chats this month` : ""}
        </p>
      </div>
    </div>
  );
}

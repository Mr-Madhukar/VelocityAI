"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Keyboard } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { Kbd } from "~/components/ui/kbd";
import { cn } from "~/lib/utils";

import {
  eventMatchesShortcut,
  globalShortcuts,
  navItems,
  shortcutTokens,
} from "./nav-items";

const NEW_FEATURE_SHORTCUT = "alt+n";

const KeyboardShortcutsContext = createContext<{ open: () => void } | null>(null);

export function useKeyboardShortcuts() {
  const ctx = useContext(KeyboardShortcutsContext);
  if (!ctx) throw new Error("useKeyboardShortcuts must be used within KeyboardShortcutsProvider");
  return ctx;
}

/** Renders a shortcut as a row of <kbd> chips, e.g. Alt + D. */
export function ShortcutKeys({
  shortcut,
  className,
}: {
  shortcut: string;
  className?: string;
}) {
  return (
    <span className={cn("inline-flex items-center gap-0.5", className)} aria-hidden>
      {shortcutTokens(shortcut).map((token, i) => (
        <Kbd key={`${token}-${i}`} className="h-4 min-w-4 px-1 text-[10px]">
          {token}
        </Kbd>
      ))}
    </span>
  );
}

// Don't hijack keystrokes while the user is typing in a field.
function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return (
    tag === "INPUT" ||
    tag === "TEXTAREA" ||
    tag === "SELECT" ||
    target.isContentEditable
  );
}

export function KeyboardShortcutsProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  const openHelp = useCallback(() => setOpen(true), []);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (isEditableTarget(event.target)) return;

      // "?" opens this help dialog.
      if (eventMatchesShortcut(event, "shift+?")) {
        event.preventDefault();
        setOpen((v) => !v);
        return;
      }

      // Alt+N → new feature request.
      if (eventMatchesShortcut(event, NEW_FEATURE_SHORTCUT)) {
        event.preventDefault();
        router.push("/features/new");
        return;
      }

      // Alt+<letter> → navigate to the matching section.
      for (const item of navItems) {
        if (eventMatchesShortcut(event, item.shortcut)) {
          event.preventDefault();
          router.push(item.href);
          return;
        }
      }
    }

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [router]);

  return (
    <KeyboardShortcutsContext.Provider value={{ open: openHelp }}>
      {children}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="border-border bg-popover sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Keyboard className="size-4 text-primary" />
              Keyboard shortcuts
            </DialogTitle>
            <DialogDescription>Press the keys anywhere outside a text field.</DialogDescription>
          </DialogHeader>

          <div className="space-y-5">
            <ShortcutSection
              heading="Navigation"
              rows={navItems.map((item) => ({ label: item.label, shortcut: item.shortcut }))}
            />
            <ShortcutSection heading="General" rows={globalShortcuts} />
          </div>
        </DialogContent>
      </Dialog>
    </KeyboardShortcutsContext.Provider>
  );
}

function ShortcutSection({
  heading,
  rows,
}: {
  heading: string;
  rows: { label: string; shortcut: string }[];
}) {
  return (
    <div>
      <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground/70">
        {heading}
      </p>
      <div className="grid gap-1">
        {rows.map((row) => (
          <div
            key={row.label}
            className="flex items-center justify-between rounded-sm px-1 py-1.5 text-sm text-foreground"
          >
            <span>{row.label}</span>
            <ShortcutKeys shortcut={row.shortcut} />
          </div>
        ))}
      </div>
    </div>
  );
}

/** Sidebar footer row that opens the shortcuts help modal. */
export function KeyboardShortcutsButton() {
  const { open } = useKeyboardShortcuts();
  return (
    <button
      type="button"
      onClick={open}
      className="flex w-full items-center gap-2 px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-foreground/[0.06] hover:text-foreground"
    >
      <Keyboard className="size-4 shrink-0" />
      <span className="flex-1 text-left">Keyboard shortcuts</span>
      <Kbd className="h-4 min-w-4 px-1 text-[10px]">?</Kbd>
    </button>
  );
}

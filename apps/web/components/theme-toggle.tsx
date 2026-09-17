"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTheme } from "next-themes";
import { Moon, Sun } from "lucide-react";

type ViewTransitionDocument = Document & {
  startViewTransition?: (callback: () => void) => { ready: Promise<void> };
};

export function ThemeToggle({ className = "" }: { className?: string }) {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => setMounted(true), []);

  const isDark = resolvedTheme === "dark";

  const toggle = useCallback(() => {
    const next = isDark ? "light" : "dark";
    const doc = document as ViewTransitionDocument;

    const prefersReduced =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    // No View Transitions support (or reduced motion) → plain switch.
    if (!doc.startViewTransition || prefersReduced) {
      setTheme(next);
      return;
    }

    // Origin of the circular reveal: the toggle button's centre.
    const rect = btnRef.current?.getBoundingClientRect();
    const x = rect ? rect.left + rect.width / 2 : window.innerWidth / 2;
    const y = rect ? rect.top + rect.height / 2 : window.innerHeight / 2;
    // Radius that reaches the farthest screen corner from the origin.
    const endRadius = Math.hypot(
      Math.max(x, window.innerWidth - x),
      Math.max(y, window.innerHeight - y),
    );

    const transition = doc.startViewTransition(() => {
      setTheme(next);
    });

    void transition.ready.then(() => {
      document.documentElement.animate(
        {
          clipPath: [
            `circle(0px at ${x}px ${y}px)`,
            `circle(${endRadius}px at ${x}px ${y}px)`,
          ],
        },
        {
          duration: 480,
          easing: "cubic-bezier(0.4, 0, 0.2, 1)",
          pseudoElement: "::view-transition-new(root)",
        },
      );
    });
  }, [isDark, setTheme]);

  return (
    <button
      ref={btnRef}
      type="button"
      aria-label={mounted ? `Switch to ${isDark ? "light" : "dark"} mode` : "Toggle theme"}
      onClick={toggle}
      className={`grid size-9 shrink-0 place-items-center border border-border bg-foreground/[0.03] text-muted-foreground transition-colors hover:bg-foreground/[0.06] hover:text-foreground ${className}`}
    >
      {/* Avoid hydration flash: render a placeholder until mounted */}
      {mounted ? (
        isDark ? <Sun className="size-4" /> : <Moon className="size-4" />
      ) : (
        <span className="size-4" aria-hidden />
      )}
    </button>
  );
}

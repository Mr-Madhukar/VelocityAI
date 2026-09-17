"use client";

import Link from "next/link";
import { useEffect } from "react";
import { FileQuestion, ArrowLeft, LayoutDashboard } from "lucide-react";

import { trpc } from "~/trpc/client";

/**
 * Friendly in-app 404 for the authenticated shell. Rendered whenever a detail
 * route calls `notFound()` — most often because a feature/PRD/task card pointed
 * at a record that was deleted or is no longer available.
 *
 * On mount we invalidate the cached lists so the stale card that was just
 * clicked disappears when the user navigates back, instead of lingering and
 * 404ing again.
 */
export default function NotFound() {
  const utils = trpc.useUtils();

  useEffect(() => {
    void utils.feature.list.invalidate();
  }, [utils]);

  return (
    <div className="grid min-h-[60vh] place-items-center px-4">
      <div className="flex max-w-md flex-col items-center text-center">
        <div className="grid size-14 place-items-center rounded-2xl border border-border bg-foreground/[0.03] text-muted-foreground">
          <FileQuestion className="size-7" />
        </div>
        <h1 className="mt-6 text-lg font-semibold text-foreground">
          This record is no longer available
        </h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          The feature, PRD, or task you opened may have been deleted or moved.
          The list has been refreshed, so it won&apos;t show up again.
        </p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/features"
            className="inline-flex h-9 items-center gap-2 border border-border bg-foreground/[0.03] px-4 text-sm font-medium text-foreground transition-colors hover:bg-foreground/[0.06]"
          >
            <ArrowLeft className="size-4" />
            Back to features
          </Link>
          <Link
            href="/dashboard"
            className="inline-flex h-9 items-center gap-2 bg-primary px-4 text-sm font-medium text-primary-foreground transition-transform hover:opacity-95 active:scale-[0.97]"
          >
            <LayoutDashboard className="size-4" />
            Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}

"use client";

import { useLinkStatus } from "next/link";

import { Spinner } from "~/components/ui/spinner";

/**
 * Instant "I heard your click" affordance. Rendered *inside* a <Link>, it reads
 * the App-Router navigation status and shows a spinner on the link being loaded.
 */
export function LinkPending({ className = "size-3.5" }: { className?: string }) {
  const { pending } = useLinkStatus();
  if (!pending) return null;
  return <Spinner className={className} aria-label="Loading page" />;
}

"use client";

import { useEffect, useState } from "react";
import { Github, Loader2 } from "lucide-react";

/**
 * Landing page for the GitHub install/configure popup.
 *
 * After GitHub redirects here (via /api/github/callback) we hand the
 * installation id back to the window that opened the popup and close.
 * Channels (in order of robustness):
 *   1. BroadcastChannel — survives Cross-Origin-Opener-Policy isolation.
 *   2. window.opener.postMessage — explicit same-origin target.
 *   3. Full-page fallback — if not actually in a popup, navigate to /github.
 *
 * No secrets live here: it only forwards a non-sensitive installation id.
 * The authenticated save happens in the first-party main window (with the
 * session cookie), never here.
 */
export default function GithubConnectedPage() {
  const [closing, setClosing] = useState(true);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const installationId = params.get("installation_id") ?? params.get("installationId");
    const state = params.get("state");
    const setupAction = params.get("setup_action");
    const payload = {
      type: "shipflow:github-installed" as const,
      installationId,
      state,
      setupAction,
    };

    try {
      const bc = new BroadcastChannel("shipflow-github");
      bc.postMessage(payload);
      bc.close();
    } catch {
      /* BroadcastChannel unsupported — fall through */
    }

    try {
      if (window.opener && !window.opener.closed) {
        window.opener.postMessage(payload, window.location.origin);
      }
    } catch {
      /* opener severed by COOP — BroadcastChannel already covered it */
    }

    // Try to close the popup; if we're not in a popup (or close is blocked),
    // navigate the main app to /github so the flow still completes.
    const fallbackUrl = `/github${installationId ? `?installationId=${installationId}` : ""}`;
    const closeTimer = setTimeout(() => window.close(), 250);
    const navTimer = setTimeout(() => {
      if (!window.closed) {
        setClosing(false);
        window.location.replace(fallbackUrl);
      }
    }, 900);

    return () => {
      clearTimeout(closeTimer);
      clearTimeout(navTimer);
    };
  }, []);

  return (
    <main className="grid min-h-screen place-items-center bg-[#090b10] text-foreground">
      <div className="flex flex-col items-center gap-4 text-center">
        <div className="grid size-12 place-items-center rounded-xl bg-foreground/5 text-primary">
          <Github className="size-6" />
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          {closing ? "Finishing GitHub connection…" : "Redirecting…"}
        </div>
        <p className="text-xs text-muted-foreground">You can close this window if it doesn&apos;t close automatically.</p>
      </div>
    </main>
  );
}

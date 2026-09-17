import { NextResponse } from "next/server";

import { parseGitHubInstallationCallback } from "@/features/github/server/installation";

export function GET(request: Request) {
  const url = new URL(request.url);
  const callback = parseGitHubInstallationCallback(url.searchParams);
  // Land on the popup handoff page; it messages the opener and closes itself.
  const redirectUrl = new URL("/github-connected", request.url);

  if (callback) {
    redirectUrl.searchParams.set("installation_id", callback.installationId);
    if (callback.setupAction) {
      redirectUrl.searchParams.set("setup_action", callback.setupAction);
    }
  }

  // Forward the CSRF state we passed to GitHub so the opener can verify it.
  const state = url.searchParams.get("state");
  if (state) {
    redirectUrl.searchParams.set("state", state);
  }

  return NextResponse.redirect(redirectUrl);
}

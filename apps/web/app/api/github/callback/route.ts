import { NextResponse } from "next/server";

import { parseGitHubInstallationCallback } from "@/features/github/server/installation";

function getBaseUrl(request: Request): string {
  const forwardedHost = request.headers.get("x-forwarded-host");
  const forwardedProto = request.headers.get("x-forwarded-proto") || "https";
  if (forwardedHost) {
    return `${forwardedProto}://${forwardedHost}`;
  }

  const host = request.headers.get("host");
  if (host && !host.includes("10000")) {
    const isLocal = host.startsWith("localhost") || host.startsWith("127.0.0.1");
    return `${isLocal ? "http" : "https"}://${host}`;
  }

  if (process.env.NEXT_PUBLIC_APP_URL) {
    return process.env.NEXT_PUBLIC_APP_URL;
  }
  if (process.env.BETTER_AUTH_URL) {
    return process.env.BETTER_AUTH_URL;
  }

  return request.url;
}

export function GET(request: Request) {
  const url = new URL(request.url);
  const callback = parseGitHubInstallationCallback(url.searchParams);
  // Land on the popup handoff page; it messages the opener and closes itself.
  const redirectUrl = new URL("/github-connected", getBaseUrl(request));

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

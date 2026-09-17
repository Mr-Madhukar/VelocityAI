import { getSessionCookie } from "better-auth/cookies";
import { NextResponse, type NextRequest } from "next/server";

import { SIGN_IN_PATH } from "@/features/auth/utils";

// Force protected responses to be non-cacheable so the browser never restores
// them from the back/forward cache (bfcache). Without this, hitting "back"
// after sign-out re-renders the authenticated UI from memory without any
// request reaching the server — so no auth check runs.
const NO_STORE = "no-store, no-cache, must-revalidate";

export function middleware(request: NextRequest) {
  // Optimistic cookie check only — the real session validation still happens in
  // the protected layout's requireAuth(). This just gates navigation cheaply at
  // the edge and, crucially, kills bfcache for protected pages.
  const sessionCookie = getSessionCookie(request);

  if (!sessionCookie) {
    const signInUrl = new URL(SIGN_IN_PATH, request.url);
    const { pathname, search } = request.nextUrl;
    signInUrl.searchParams.set("callbackUrl", `${pathname}${search}`);

    const redirectResponse = NextResponse.redirect(signInUrl);
    redirectResponse.headers.set("Cache-Control", NO_STORE);
    return redirectResponse;
  }

  const response = NextResponse.next();
  response.headers.set("Cache-Control", NO_STORE);
  return response;
}

// Run only on authenticated app routes. Public routes (landing `/`, `(auth)`,
// `/invite`, `/github-connected`, api, and static assets) are intentionally
// excluded so they stay cacheable and reachable while signed out.
export const config = {
  matcher: [
    "/dashboard/:path*",
    "/projects/:path*",
    "/features/:path*",
    "/prd/:path*",
    "/tasks/:path*",
    "/reviews/:path*",
    "/github/:path*",
    "/billing/:path*",
    "/settings/:path*",
    "/search/:path*",
    "/profile/:path*",
  ],
};

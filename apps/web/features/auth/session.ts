import "server-only";

import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";

import { DEFAULT_AUTH_CALLBACK, SIGN_IN_PATH } from "./utils";

// Plain server utilities — no "use server" so they can be called during rendering.
export async function getServerSession() {
  return auth.api.getSession({
    headers: await headers(),
  });
}

export async function requireAuth(redirectTo = SIGN_IN_PATH) {
  const session = await getServerSession();
  if (!session) redirect(redirectTo);
  return session;
}

export async function requireUnauth(redirectTo = DEFAULT_AUTH_CALLBACK) {
  const session = await getServerSession();
  if (session) redirect(redirectTo);
}

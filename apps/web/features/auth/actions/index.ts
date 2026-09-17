"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";

import { getSafeCallbackPath, SIGN_IN_PATH } from "../utils";

async function signInSocial(provider: "github" | "google", formData: FormData) {
  const callback = formData.get("callbackUrl");
  const callbackURL = getSafeCallbackPath(
    typeof callback === "string" ? callback : null,
  );
  const result = await auth.api.signInSocial({
    body: { provider, callbackURL },
    headers: await headers(),
  });
  if (result.url) redirect(result.url);
  redirect(callbackURL);
}

export async function signInWithGithub(formData: FormData) {
  return signInSocial("github", formData);
}

export async function signInWithGoogle(formData: FormData) {
  return signInSocial("google", formData);
}

export async function signOut() {
  await auth.api.signOut({ headers: await headers() });
  redirect(SIGN_IN_PATH);
}

export async function signInWithEmail(formData: FormData) {
  const email = (formData.get("email") as string)?.trim().toLowerCase();
  const password = formData.get("password") as string;
  const callback = formData.get("callbackUrl");
  const callbackURL = getSafeCallbackPath(
    typeof callback === "string" ? callback : null,
  );

  const reqHeaders = await headers();
  try {
    await auth.api.signInEmail({
      body: { email, password },
      headers: reqHeaders,
    });
  } catch {
    const name = email.split("@")[0] || "User";
    await auth.api.signUpEmail({
      body: { email, password, name },
      headers: reqHeaders,
    });
  }

  redirect(callbackURL);
}

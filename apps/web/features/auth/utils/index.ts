export const SIGN_IN_PATH = "/sign-in";
export const DEFAULT_AUTH_CALLBACK = "/projects";

export function getSafeCallbackPath(callbackUrl: string | null | undefined) {
  if (callbackUrl?.startsWith("/") && !callbackUrl.startsWith("//")) {
    return callbackUrl;
  }

  return DEFAULT_AUTH_CALLBACK;
}

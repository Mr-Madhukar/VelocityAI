import { createTRPCClient, httpBatchLink } from "@trpc/client";
import type { ServerRouter } from "@repo/trpc/server";

import { DEFAULT_API_URL, loadConfig } from "./config";

export type VelocityAIClient = ReturnType<typeof createClient>;

/** Base URL precedence: --api flag → VELOCITYAI_API_URL → config → default. */
export function resolveApiUrl(flag?: string): string {
  return (
    flag ??
    process.env.VELOCITYAI_API_URL ??
    process.env.VelocityAI_API_URL ??
    loadConfig().apiUrl ??
    DEFAULT_API_URL
  ).replace(/\/$/, "");
}

/** Token precedence: VELOCITYAI_TOKEN env (CI) → stored config token. */
export function resolveToken(): string | undefined {
  return process.env.VELOCITYAI_TOKEN ?? process.env.VelocityAI_TOKEN ?? loadConfig().token;
}

/** A fully type-safe tRPC client bound to the resolved API + bearer token. */
export function createClient(opts: { apiUrl: string; token?: string }) {
  return createTRPCClient<ServerRouter>({
    links: [
      httpBatchLink({
        url: `${opts.apiUrl}/api/trpc`,
        headers() {
          return opts.token ? { authorization: `Bearer ${opts.token}` } : {};
        },
      }),
    ],
  });
}

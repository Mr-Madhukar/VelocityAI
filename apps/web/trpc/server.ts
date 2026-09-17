import "server-only";
import { headers } from "next/headers";
import type { ServerRouter } from "@repo/trpc/client";
import { createTRPCProxyClient, httpLink } from "@repo/trpc/client";

function makeServerLink() {
  const baseUrl =
    process.env.BETTER_AUTH_URL ??
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null) ??
    `http://localhost:${process.env.PORT ?? "3000"}`;

  return httpLink({
    url: `${baseUrl}/api/trpc`,
    headers: async () => {
      // Forward the incoming request's cookies so orgProcedure can read the session.
      const h = await headers();
      return { cookie: h.get("cookie") ?? "" };
    },
  });
}

export const api = createTRPCProxyClient<ServerRouter>({
  links: [makeServerLink()],
});

export const apiStreaming = createTRPCProxyClient<ServerRouter>({
  links: [makeServerLink()],
});

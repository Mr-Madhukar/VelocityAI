import { serve } from "inngest/next";
import { inngest, shipflowFunctions } from "~/lib/inngest";

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: shipflowFunctions,
  // When the Inngest dev server runs in Docker, it must call this app back at a
  // host it can reach. The container can't reach the host's `localhost:3000`, so
  // we advertise `http://host.docker.internal:3000` via INNGEST_SERVE_ORIGIN.
  // Unset in production (Inngest infers the real origin from the request).
  serveOrigin: process.env.INNGEST_SERVE_ORIGIN,
});

import { requireOrg } from "@/features/agent/server/run";
import { getRun, runStoreAvailable } from "@/features/agent/server/run-store";

/**
 * Reports the current state of a run so the client can recover after a reload:
 * it fetches the JSON produced so far and whether the run is still `paused`
 * (needs a /continue), already `done`, or `error`. The run id is an unguessable
 * UUID and the payload holds no secrets, but we still require an authenticated
 * org so this isn't an open read endpoint.
 */
export async function GET(req: Request) {
  const auth = await requireOrg();
  if (!auth.ok) return Response.json({ error: auth.error }, { status: 401 });

  if (!runStoreAvailable()) {
    return Response.json({ error: "The agent run store isn't configured." }, { status: 503 });
  }

  const runId = new URL(req.url).searchParams.get("runId");
  if (!runId) return Response.json({ error: "Missing run id." }, { status: 400 });

  const run = await getRun(runId);
  if (!run) return Response.json({ status: "expired" }, { status: 200 });

  return Response.json(
    { status: run.status, text: run.text, error: run.error, segments: run.segments },
    { headers: { "Cache-Control": "no-store" } },
  );
}

import { streamAgentPlan } from "@/features/agent/server/engine";
import { produceSegment } from "@/features/agent/server/produce";
import {
  prepareAgentRun,
  rememberModel,
  type AgentRunDeps,
  type AgentRunRequest,
} from "@/features/agent/server/run";
import { createRun, runStoreAvailable } from "@/features/agent/server/run-store";
import {
  ERROR_SENTINEL,
  PAUSE_SENTINEL,
  RUN_ID_HEADER,
} from "@/features/agent/stream-protocol";

// The Hobby plan caps serverless maxDuration at 300s. Runs longer than that are
// split into resumable segments (see features/agent/server/produce.ts) — each
// invocation stays under this ceiling and the client continues the run.
export const maxDuration = 300;

/**
 * Starts an agent run and streams the plan JSON as raw text — a flat HTTP
 * stream, deliberately NOT an RSC streamable value (those chain every update
 * and blow the call stack on long runs). The client accumulates the text and
 * re-parses it as partial JSON.
 *
 * The run is also persisted to Redis as it streams, so if this invocation hits
 * the time budget (or the client disconnects) the run is marked `paused` rather
 * than lost: the client resumes it via /api/agent/stream/continue. The run id
 * is returned in the RUN_ID_HEADER. Control sentinels at the end of the stream
 * tell the client how the segment ended — see stream-protocol.ts.
 */
export async function POST(req: Request) {
  let input: AgentRunRequest;
  try {
    input = (await req.json()) as AgentRunRequest;
  } catch {
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }

  const prep = await prepareAgentRun(input);
  if (!prep.ok) return Response.json({ error: prep.error }, { status: 400 });
  const { deps } = prep;

  // Without a run store we can't persist or resume — fall back to a single,
  // non-resumable stream (the pre-resumable behavior). Runs that exceed the
  // serverless limit will still be lost, but the agent stays functional in dev
  // and on deploys that haven't configured Upstash.
  if (!runStoreAvailable()) {
    return streamWithoutStore(deps, input.model, req.signal);
  }

  const runId = crypto.randomUUID();
  await createRun(runId);

  const startedAt = Date.now();
  const internalAbort = new AbortController();
  // Abort the provider call when EITHER the client disconnects or we hit the
  // time budget.
  const providerSignal = AbortSignal.any([req.signal, internalAbort.signal]);
  const result = streamAgentPlan(deps.engineInput, providerSignal);
  const encoder = new TextEncoder();

  const body = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (text: string) => {
        try {
          controller.enqueue(encoder.encode(text));
        } catch {
          /* stream already cancelled */
        }
      };

      const outcome = await produceSegment({
        runId,
        textStream: result.textStream,
        startedAt,
        clientSignal: req.signal,
        internalAbort,
        onDelta: send,
      });

      if (outcome.status === "done") {
        rememberModel(deps.keyId, input.model);
      } else if (outcome.status === "paused") {
        // Only signal a resumable pause to a client that's still listening.
        if (!req.signal.aborted) send(PAUSE_SENTINEL);
      } else if (outcome.status === "error") {
        if (!req.signal.aborted) send(ERROR_SENTINEL + (outcome.error ?? "The agent run failed."));
      }

      try {
        controller.close();
      } catch {
        /* already closed by cancellation */
      }
    },
  });

  return new Response(body, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
      [RUN_ID_HEADER]: runId,
    },
  });
}

/**
 * Non-resumable fallback used when Upstash isn't configured: one flat stream,
 * no run id, no pause/continue. Mirrors the original behavior so the agent keeps
 * working in dev and on deploys without a run store.
 */
function streamWithoutStore(deps: AgentRunDeps, model: string, clientSignal: AbortSignal): Response {
  const result = streamAgentPlan(deps.engineInput, clientSignal);
  const encoder = new TextEncoder();

  const body = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (text: string) => {
        try {
          controller.enqueue(encoder.encode(text));
        } catch {
          /* stream already cancelled */
        }
      };
      try {
        for await (const delta of result.textStream) send(delta);
        await result.object; // rejects if the finished object fails validation
        rememberModel(deps.keyId, model);
      } catch (error) {
        if (!clientSignal.aborted) {
          const message = error instanceof Error ? error.message : "The agent run failed.";
          send(ERROR_SENTINEL + message);
        }
      } finally {
        try {
          controller.close();
        } catch {
          /* already closed by cancellation */
        }
      }
    },
  });

  return new Response(body, {
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
  });
}

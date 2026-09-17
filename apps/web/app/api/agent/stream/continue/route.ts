import { continueAgentPlan } from "@/features/agent/server/engine";
import { produceSegment } from "@/features/agent/server/produce";
import {
  prepareAgentRun,
  rememberModel,
  type AgentRunRequest,
} from "@/features/agent/server/run";
import {
  getRun,
  markRunning,
  MAX_SEGMENTS,
  runStoreAvailable,
} from "@/features/agent/server/run-store";
import {
  ERROR_SENTINEL,
  PAUSE_SENTINEL,
  RUN_ID_HEADER,
} from "@/features/agent/stream-protocol";

// Same 300s ceiling — a continuation is just another bounded producer segment.
export const maxDuration = 300;

type ContinueRequest = AgentRunRequest & { runId: string };

/**
 * Continues a paused agent run (started by /api/agent/stream that hit the time
 * budget or lost its client). Rebuilds the run's server deps from the resent
 * payload, replays the JSON produced so far as an assistant prefill, and streams
 * ONLY the remaining characters — persisting them to the same run and re-pausing
 * if this segment also runs out of budget. Chains until the run is `done`.
 */
export async function POST(req: Request) {
  let input: ContinueRequest;
  try {
    input = (await req.json()) as ContinueRequest;
  } catch {
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }

  if (!runStoreAvailable()) {
    return Response.json({ error: "The agent run store isn't configured." }, { status: 503 });
  }
  if (!input.runId) {
    return Response.json({ error: "Missing run id." }, { status: 400 });
  }

  const run = await getRun(input.runId);
  if (!run) {
    return Response.json({ error: "This run expired — start a new one." }, { status: 410 });
  }
  if (run.status === "done") {
    // Nothing left to generate; tell the client it's already complete.
    return new Response("", {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-store",
        [RUN_ID_HEADER]: input.runId,
      },
    });
  }
  if (run.segments >= MAX_SEGMENTS) {
    return Response.json(
      { error: "This run got too long to finish automatically. Start a new, narrower request." },
      { status: 409 },
    );
  }

  const prep = await prepareAgentRun(input);
  if (!prep.ok) return Response.json({ error: prep.error }, { status: 400 });
  const { deps } = prep;

  await markRunning(input.runId);

  const startedAt = Date.now();
  const internalAbort = new AbortController();
  const providerSignal = AbortSignal.any([req.signal, internalAbort.signal]);
  const result = continueAgentPlan(deps.engineInput, run.text, providerSignal);
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
        runId: input.runId,
        textStream: result.textStream,
        startedAt,
        clientSignal: req.signal,
        internalAbort,
        onDelta: send,
      });

      if (outcome.status === "done") {
        rememberModel(deps.keyId, input.model);
      } else if (outcome.status === "paused") {
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
      [RUN_ID_HEADER]: input.runId,
    },
  });
}

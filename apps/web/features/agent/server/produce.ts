import "server-only";

import { appendText, finalizeSegment, type RunStatus } from "./run-store";

// The Hobby wall is 300s. Stop generating well before it so there's room to
// flush the last Redis write and close the response cleanly.
export const SEGMENT_BUDGET_MS = 270_000;

// Batch Redis appends: model deltas arrive many times per second, but each
// Upstash append is a REST round-trip. Flush at most this often (plus a final
// forced flush), trading a little recovery granularity for far fewer calls.
const REDIS_FLUSH_MS = 750;

export type ProduceResult = { status: Exclude<RunStatus, "running">; error?: string };

/**
 * Drive one producer segment: relay `textStream` to the client via `onDelta`
 * while persisting it to Redis, bounded by a time budget.
 *
 * Ends as:
 *  - "done"   — the stream finished on its own.
 *  - "paused" — the time budget elapsed or the client disconnected mid-stream;
 *               the caller should tell the client to continue the run.
 *  - "error"  — the provider threw (bad key, quota, model access, …).
 *
 * `internalAbort` is aborted when the budget is hit so the provider call stops
 * instead of billing on past the point we can use it.
 */
export async function produceSegment(opts: {
  runId: string;
  textStream: AsyncIterable<string>;
  startedAt: number;
  clientSignal: AbortSignal;
  internalAbort: AbortController;
  onDelta: (text: string) => void;
}): Promise<ProduceResult> {
  const { runId, textStream, startedAt, clientSignal, internalAbort, onDelta } = opts;

  let pending = "";
  let lastFlush = Date.now();
  const flush = async (force: boolean) => {
    if (!pending) return;
    if (!force && Date.now() - lastFlush < REDIS_FLUSH_MS) return;
    const chunk = pending;
    pending = "";
    lastFlush = Date.now();
    await appendText(runId, chunk);
  };

  let paused = false;
  try {
    for await (const delta of textStream) {
      onDelta(delta);
      pending += delta;
      await flush(false);

      if (Date.now() - startedAt >= SEGMENT_BUDGET_MS) {
        paused = true;
        internalAbort.abort();
        break;
      }
      if (clientSignal.aborted) {
        // The client is gone (navigated away / reloaded). Persist what we have
        // and pause — it can be resumed later — rather than treat it as failure.
        paused = true;
        break;
      }
    }
    await flush(true);
  } catch (error) {
    await flush(true).catch(() => {});
    // A budget/client abort surfaces here as an AbortError — that's a pause, not
    // a real failure, and whatever streamed before it stays usable.
    if (paused || internalAbort.signal.aborted || clientSignal.aborted) {
      await finalizeSegment(runId, "paused");
      return { status: "paused" };
    }
    const message = error instanceof Error ? error.message : "The agent run failed.";
    await finalizeSegment(runId, "error", message);
    return { status: "error", error: message };
  }

  const status: Exclude<RunStatus, "running"> = paused ? "paused" : "done";
  await finalizeSegment(runId, status);
  return { status };
}

/**
 * Wire protocol shared by the agent stream routes and the client chat store.
 *
 * The body is the raw JSON text of the plan being generated. Two control bytes
 * (which can never appear inside JSON text) may be appended at the very end to
 * signal how the segment ended:
 *
 *  - ERROR_SENTINEL — everything after it is a human-readable error message.
 *  - PAUSE_SENTINEL — the run hit the serverless time budget and is `paused`;
 *    more output is coming, the client should POST /continue with the run id.
 *
 * A clean end with neither sentinel means the run finished (`done`).
 */
export const ERROR_SENTINEL = String.fromCharCode(0);
export const PAUSE_SENTINEL = String.fromCharCode(1);

/** Header carrying the run id on the initial stream response. */
export const RUN_ID_HEADER = "X-Agent-Run-Id";

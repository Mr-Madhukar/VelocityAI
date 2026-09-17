import "server-only";

import Pusher from "pusher";

import { ORG_EVENT_NAME, orgChannel, type OrgEvent } from "@repo/trpc/server/events";

let cached: Pusher | null = null;

function getPusher(): Pusher | null {
  if (cached) return cached;

  const { PUSHER_APP_ID, PUSHER_KEY, PUSHER_SECRET, PUSHER_CLUSTER } = process.env;

  if (!PUSHER_APP_ID || !PUSHER_KEY || !PUSHER_SECRET || !PUSHER_CLUSTER) {
    // Real-time is optional — if unconfigured, publishing is a silent no-op.
    return null;
  }

  cached = new Pusher({
    appId: PUSHER_APP_ID,
    key: PUSHER_KEY,
    secret: PUSHER_SECRET,
    cluster: PUSHER_CLUSTER,
    useTLS: true,
  });
  return cached;
}

/**
 * Broadcast an event to every member currently subscribed to an org's channel.
 * Never throws — a realtime failure must not break the originating mutation/job.
 */
export async function publishOrgEvent(orgId: string, event: OrgEvent): Promise<void> {
  const pusher = getPusher();
  if (!pusher) return;

  try {
    await pusher.trigger(orgChannel(orgId), ORG_EVENT_NAME, event);
  } catch (err) {
    console.error("[realtime] failed to publish org event", { orgId, type: event.type, err });
  }
}

/** Used by the private-channel auth endpoint to sign subscription requests. */
export function authorizeChannel(socketId: string, channel: string): { auth: string } | null {
  const pusher = getPusher();
  if (!pusher) return null;
  return pusher.authorizeChannel(socketId, channel);
}

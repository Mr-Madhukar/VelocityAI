"use client";

import PusherClient from "pusher-js";

let cached: PusherClient | null = null;

/**
 * Returns the shared browser Pusher instance, or null if realtime is not
 * configured (env vars absent). Authenticates private channels through our
 * membership-checked auth endpoint.
 */
export function getPusherClient(): PusherClient | null {
  if (cached) return cached;

  const key = process.env.NEXT_PUBLIC_PUSHER_KEY;
  const cluster = process.env.NEXT_PUBLIC_PUSHER_CLUSTER;
  if (!key || !cluster) return null;

  cached = new PusherClient(key, {
    cluster,
    authEndpoint: "/api/pusher/auth",
  });
  return cached;
}

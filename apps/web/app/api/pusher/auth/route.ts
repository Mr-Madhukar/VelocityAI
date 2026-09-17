import { db, and, eq } from "@repo/database";
import { members } from "@repo/database/schema";
import { orgChannel } from "@repo/trpc/server/events";

import { auth } from "@/lib/auth";
import { authorizeChannel } from "@/lib/realtime/server";

// Pusher private-channel authorization.
// A client may only subscribe to `private-org-{orgId}` if the signed-in user
// is an actual DB member of that org. This is what isolates orgs from each other.
export async function POST(request: Request) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) {
    return new Response("Unauthorized", { status: 401 });
  }

  const body = await request.text();
  const params = new URLSearchParams(body);
  const socketId = params.get("socket_id");
  const channelName = params.get("channel_name");

  if (!socketId || !channelName) {
    return new Response("Bad Request", { status: 400 });
  }

  // Extract the orgId the client is trying to subscribe to and verify membership.
  const orgId = channelName.replace(/^private-org-/, "");
  if (channelName !== orgChannel(orgId)) {
    return new Response("Forbidden", { status: 403 });
  }

  const [membership] = await db
    .select({ id: members.id })
    .from(members)
    .where(
      and(
        eq(members.organizationId, orgId),
        eq(members.userId, session.user.id),
      ),
    );

  if (!membership) {
    return new Response("Forbidden", { status: 403 });
  }

  const authResponse = authorizeChannel(socketId, channelName);
  if (!authResponse) {
    return new Response("Realtime not configured", { status: 503 });
  }

  return Response.json(authResponse);
}

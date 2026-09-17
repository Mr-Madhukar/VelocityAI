"use client";

import { useEffect } from "react";
import { toast } from "sonner";

import { ORG_EVENT_NAME, orgChannel, type OrgEvent } from "@repo/trpc/server/events";

import { getPusherClient } from "@/lib/realtime/client";
import { trpc } from "@/trpc/client";

/**
 * Subscribes to the active org's private channel and keeps every team member's
 * UI in sync by invalidating the relevant tRPC query caches when events arrive.
 * Also surfaces a lightweight toast so people see what's happening on the team.
 *
 * Mounted once, near the root of the protected tree (ProjectProvider).
 */
export function useOrgRealtime(orgId: string | null | undefined) {
  const utils = trpc.useUtils();

  useEffect(() => {
    if (!orgId) return;

    const pusher = getPusherClient();
    if (!pusher) return;

    const channelName = orgChannel(orgId);
    const channel = pusher.subscribe(channelName);

    const handler = (event: OrgEvent) => {
      switch (event.type) {
        case "member.invited":
          utils.member.listInvitations.invalidate();
          toast.info(`${event.actorName} invited ${event.email}`);
          break;

        case "member.accepted":
          utils.member.list.invalidate();
          utils.member.listInvitations.invalidate();
          toast.success(`${event.name} joined the team`);
          break;

        case "member.removed":
          utils.member.list.invalidate();
          toast.info(`${event.name} was removed from the team`);
          break;

        case "feature.created":
          utils.feature.list.invalidate();
          toast.info(`${event.actorName} created feature “${event.title}”`);
          break;

        case "feature.updated":
          utils.feature.list.invalidate();
          utils.feature.getById.invalidate({ featureId: event.featureId });
          break;

        case "prd.generated":
          utils.feature.getById.invalidate({ featureId: event.featureId });
          utils.feature.list.invalidate();
          toast.success(`PRD ready for “${event.featureTitle}”`);
          break;

        case "tasks.generated":
          utils.feature.getById.invalidate({ featureId: event.featureId });
          utils.task.byFeature.invalidate({ featureId: event.featureId });
          utils.task.listByFeature.invalidate({ featureId: event.featureId });
          utils.feature.list.invalidate();
          toast.success(`${event.count} tasks generated for “${event.featureTitle}”`);
          break;

        case "task.updated":
          utils.task.invalidate();
          break;

        case "review.started":
          utils.feature.getById.invalidate({ featureId: event.featureId });
          toast.info("AI review started");
          break;

        case "review.completed":
          utils.feature.getById.invalidate({ featureId: event.featureId });
          utils.feature.list.invalidate();
          toast.success(`Review complete — ${event.verdict}`);
          break;
      }
    };

    channel.bind(ORG_EVENT_NAME, handler);

    return () => {
      channel.unbind(ORG_EVENT_NAME, handler);
      pusher.unsubscribe(channelName);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgId]);
}

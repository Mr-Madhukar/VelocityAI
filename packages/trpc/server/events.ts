// Shared real-time event definitions for org-scoped channels.
// Pure types only — safe to import from both server and browser bundles.

// Every org broadcasts on a single private channel: `private-org-{orgId}`
// and every payload is bound to one Pusher event name:
export const ORG_EVENT_NAME = "org-event" as const;

export function orgChannel(orgId: string): string {
  return `private-org-${orgId}`;
}

export type OrgEvent =
  | { type: "member.invited"; email: string; role: string; actorName: string }
  | { type: "member.accepted"; userId: string; name: string; role: string }
  | { type: "member.removed"; userId: string; name: string }
  | { type: "feature.created"; featureId: string; title: string; actorName: string }
  | { type: "feature.updated"; featureId: string; title: string; status: string }
  | { type: "prd.generated"; featureId: string; featureTitle: string }
  | { type: "tasks.generated"; featureId: string; featureTitle: string; count: number }
  | { type: "task.updated"; taskId: string; title: string; status: string }
  | { type: "review.started"; featureId: string; prNumber: number | null }
  | { type: "review.completed"; featureId: string; verdict: string; complianceScore: number | null };

export type OrgEventType = OrgEvent["type"];

// Signature for the publisher injected into the tRPC context.
// Decoupled from any transport so packages/trpc stays Pusher-agnostic.
export type PublishOrgEvent = (orgId: string, event: OrgEvent) => Promise<void>;

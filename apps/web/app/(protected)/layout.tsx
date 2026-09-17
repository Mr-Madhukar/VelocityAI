import { db, eq } from "@repo/database";
import { members, organizations, sessionsTable } from "@repo/database/schema";
import { requireAuth } from "@/features/auth/session";
import { ProjectProvider } from "~/components/shipflow/project-context";
import { ShipFlowShell } from "~/components/shipflow/shell";
import { EmailVerificationPrompt } from "~/components/shipflow/verify-email";
import { VelocityAIAssistant } from "~/components/shipflow/assistant/assistant-widget";

export default async function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireAuth();

  // First-time sign-in: if the user has no org memberships, create a personal workspace
  const [existingMembership] = await db
    .select({ organizationId: members.organizationId })
    .from(members)
    .where(eq(members.userId, session.user.id))
    .limit(1);

  if (!existingMembership) {
    const firstName = session.user.name?.split(" ")[0] ?? "My";
    const orgName = `${firstName}'s Workspace`;
    const orgSlug = `workspace-${session.user.id.slice(0, 8)}`;

    const [newOrg] = await db
      .insert(organizations)
      .values({ name: orgName, slug: orgSlug })
      .returning({ id: organizations.id });

    const orgId = newOrg!.id;

    await db.insert(members).values({
      organizationId: orgId,
      userId: session.user.id,
      role: "owner",
    });

    await db
      .update(sessionsTable)
      .set({ activeOrganizationId: orgId })
      .where(eq(sessionsTable.id, session.session.id));
  } else if (!session.session.activeOrganizationId) {
    // User has orgs but session has no active org (e.g. cleared cookie) — restore it
    await db
      .update(sessionsTable)
      .set({ activeOrganizationId: existingMembership.organizationId })
      .where(eq(sessionsTable.id, session.session.id));
  }

  return (
    <ProjectProvider>
      <ShipFlowShell>{children}</ShipFlowShell>
      <EmailVerificationPrompt />
      <VelocityAIAssistant />
    </ProjectProvider>
  );
}

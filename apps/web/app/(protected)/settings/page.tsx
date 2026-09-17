import Image from "next/image";

import { getServerSession } from "@/features/auth/session";
import { CreateOrgForm } from "~/components/shipflow/create-org-form";
import { DeleteAccountSection } from "~/components/shipflow/delete-account-section";
import { OrgSettingsForm } from "~/components/shipflow/org-settings-form";
import { ProjectsSection } from "~/components/shipflow/projects-section";
import { PageHeader } from "~/components/shipflow/ui-kit";
import { api } from "~/trpc/server";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const session = await getServerSession();
  const orgs = await api.org.list.query().catch(() => []);
  const currentOrg = await api.org.current.query().catch(() => null);

  return (
    <div className="space-y-6">
      <PageHeader title="Settings" description="Manage your account, organization, and projects." />
      <div className="max-w-2xl space-y-6">

        {/* Account */}
        <div className="rounded-lg border border-foreground/10 bg-foreground/[0.045] p-5">
          <h2 className="mb-4 text-sm font-semibold text-foreground">Account</h2>
          <div className="flex items-center gap-3">
            {session?.user.image ? (
              <Image src={session.user.image} alt="" width={40} height={40} className="rounded-full" />
            ) : (
              <div className="grid size-10 place-items-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
                {session?.user.name?.slice(0, 1) ?? "S"}
              </div>
            )}
            <div>
              <p className="text-sm font-medium text-foreground">{session?.user.name ?? "VelocityAI user"}</p>
              <p className="text-xs text-muted-foreground">{session?.user.email ?? "No email connected"}</p>
            </div>
          </div>
        </div>

        {/* Active org settings */}
        {currentOrg && (
          <div className="rounded-lg border border-foreground/10 bg-foreground/[0.045] p-5">
            <h2 className="mb-1 text-sm font-semibold text-foreground">Organization settings</h2>
            <p className="mb-4 text-xs text-muted-foreground">
              Edit the name and slug for <span className="text-foreground/80">{currentOrg.name}</span>.
              Only the owner can make changes.
            </p>
            <OrgSettingsForm />
          </div>
        )}

        {/* Projects */}
        <ProjectsSection />

        {/* All orgs + create */}
        <div className="rounded-lg border border-foreground/10 bg-foreground/[0.045] p-5">
          <h2 className="mb-4 text-sm font-semibold text-foreground">Your organizations</h2>
          {orgs.length === 0 ? (
            <p className="mb-4 text-sm text-muted-foreground">No organizations yet.</p>
          ) : (
            <div className="mb-4 divide-y divide-foreground/5">
              {orgs.map((org) => (
                <div key={org.id} className="flex items-center justify-between py-3">
                  <span className="text-sm text-foreground">{org.name}</span>
                  <span className="text-xs text-muted-foreground">/{org.slug}</span>
                </div>
              ))}
            </div>
          )}
          <CreateOrgForm />
        </div>

        {/* Danger zone — permanent account deletion */}
        <DeleteAccountSection email={session?.user.email ?? null} />

      </div>
    </div>
  );
}

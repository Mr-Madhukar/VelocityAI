import { and, db, eq } from "@repo/database";
import {
  featureRequests,
  members,
  organizations,
  prds,
  usersTable,
} from "@repo/database/schema";
import { buildPrdDocumentData, prdDocumentFilename } from "@repo/services/shipflow/prd-document";

import { auth } from "@/lib/auth";
import { renderPrdPdf } from "@/lib/prd-pdf";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ featureId: string }> },
) {
  const { featureId } = await params;

  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) {
    return new Response("Unauthorized", { status: 401 });
  }

  const organizationId = session.session.activeOrganizationId;
  if (!organizationId) {
    return new Response("No active organization", { status: 403 });
  }

  // Confirm the user is a member of their active org.
  const [membership] = await db
    .select({ id: members.id })
    .from(members)
    .where(and(eq(members.organizationId, organizationId), eq(members.userId, session.user.id)));
  if (!membership) {
    return new Response("Forbidden", { status: 403 });
  }

  // Feature must belong to the active org (authorization + scoping).
  const [feature] = await db
    .select()
    .from(featureRequests)
    .where(and(eq(featureRequests.id, featureId), eq(featureRequests.organizationId, organizationId)));
  if (!feature) {
    return new Response("Not found", { status: 404 });
  }

  const [prd] = await db.select().from(prds).where(eq(prds.featureId, featureId));
  if (!prd) {
    return new Response("PRD not found", { status: 404 });
  }

  const [creator] = await db
    .select({ name: usersTable.name })
    .from(usersTable)
    .where(eq(usersTable.id, feature.createdBy));
  const [org] = await db
    .select({ name: organizations.name })
    .from(organizations)
    .where(eq(organizations.id, organizationId));

  const document = buildPrdDocumentData({
    feature,
    prd,
    createdByName: creator?.name,
    orgName: org?.name,
  });

  const pdf = await renderPrdPdf(document);
  const filename = prdDocumentFilename(feature.title);

  return new Response(new Uint8Array(pdf), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}

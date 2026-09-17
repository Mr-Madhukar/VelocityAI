import { notFound } from "next/navigation";

import { FeatureDetailTabs } from "~/components/shipflow/feature-detail-tabs";
import { PageHeader } from "~/components/shipflow/ui-kit";
import { api } from "~/trpc/server";

export const dynamic = "force-dynamic";

// A genuine NOT_FOUND should render the friendly not-found page; any other
// failure (DB/transient) must surface as a real error, not be masked as
// "no longer available".
function isNotFound(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "data" in err &&
    (err as { data?: { code?: string } }).data?.code === "NOT_FOUND"
  );
}

export default async function FeatureDetailPage({
  params,
}: {
  params: Promise<{ featureId: string }>;
}) {
  const { featureId } = await params;

  let feature;
  try {
    feature = await api.feature.getById.query({ featureId });
  } catch (err) {
    if (isNotFound(err)) {
      notFound();
    }
    console.error("Failed to load feature detail:", err);
    throw err;
  }

  if (!feature) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={feature.title}
        description="Feature detail connects the original request to PRD, tasks, GitHub PR, AI review, and release approval."
      />
      <FeatureDetailTabs feature={feature} />
    </div>
  );
}

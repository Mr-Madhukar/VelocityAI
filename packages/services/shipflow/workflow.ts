export const featureStatuses = [
  "intake",
  "clarifying",
  "prd_generating",
  "prd_ready",
  "tasks_ready",
  "in_progress",
  "in_review",
  "approved",
  "shipped",
  "blocked",
] as const;

export type FeatureStatus = (typeof featureStatuses)[number];

export const featurePriorities = ["low", "medium", "high", "urgent"] as const;
export type FeaturePriority = (typeof featurePriorities)[number];

export type FeatureRequestDraft = {
  title: string;
  description: string;
  createdById: string;
  organizationId: string;
  projectId: string;
  priority?: FeaturePriority;
};

export type FeatureRequest = FeatureRequestDraft & {
  status: FeatureStatus;
  priority: FeaturePriority;
};

export type FeatureProgressInput = {
  total: number;
  shipped: number;
  inReview: number;
  blocked: number;
};

export type FeatureProgressSummary = FeatureProgressInput & {
  activeCount: number;
  shippedPercent: number;
  health: "healthy" | "attention" | "empty";
};

const lifecyclePath: FeatureStatus[] = [
  "intake",
  "clarifying",
  "prd_generating",
  "prd_ready",
  "tasks_ready",
  "in_progress",
  "in_review",
  "approved",
  "shipped",
];

function requireText(value: string, fieldName: string) {
  const trimmed = value.trim();

  if (!trimmed) {
    throw new Error(`${fieldName} is required`);
  }

  return trimmed;
}

export function createFeatureRequest(input: FeatureRequestDraft): FeatureRequest {
  return {
    ...input,
    title: requireText(input.title, "title"),
    description: requireText(input.description, "description"),
    createdById: requireText(input.createdById, "createdById"),
    organizationId: requireText(input.organizationId, "organizationId"),
    projectId: requireText(input.projectId, "projectId"),
    priority: input.priority ?? "medium",
    status: "intake",
  };
}

export function getNextFeatureStatus(status: FeatureStatus): FeatureStatus {
  if (status === "blocked") {
    return "clarifying";
  }

  const currentIndex = lifecyclePath.indexOf(status);
  const nextStatus = lifecyclePath[currentIndex + 1];

  return nextStatus ?? "shipped";
}

export function summarizeFeatureProgress(
  input: FeatureProgressInput,
): FeatureProgressSummary {
  const activeCount = Math.max(
    input.total - input.shipped - input.blocked,
    0,
  );
  const shippedPercent =
    input.total === 0 ? 0 : Math.round((input.shipped / input.total) * 100);

  let health: FeatureProgressSummary["health"] = "healthy";

  if (input.total === 0) {
    health = "empty";
  } else if (input.blocked > 0 || input.inReview > Math.max(input.shipped, 0)) {
    health = "attention";
  }

  return {
    ...input,
    activeCount,
    shippedPercent,
    health,
  };
}

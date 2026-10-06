// Shared, dependency-free PRD document contract. The actual document is rendered
// as a PDF in the web app (see apps/web/lib/prd-pdf.tsx); this module only holds
// the data shape and the filename helper so both the tRPC server and the web app
// agree on them without pulling in a renderer.

export type PrdDocumentData = {
  featureTitle: string;
  priority: string;
  status: string;
  version: number;
  problem: string;
  goals: string[];
  nonGoals: string[];
  userStories: string[];
  acceptanceCriteria: string[];
  edgeCases: string[];
  successMetrics: string[];
  technicalRequirements: string[];
  dependencies: string[];
  risks: string[];
  estimatedTotalHours: number | null;
  targetDeadline: string | Date | null;
  approvedAt: string | Date | null;
  createdByName: string | null;
  createdAt: string | Date;
  orgName: string | null;
  generatedAt?: string | Date;
};

function trimHyphens(value: string): string {
  let start = 0;
  let end = value.length;
  while (start < end && value.codePointAt(start) === 45) {
    start++;
  }
  while (end > start && value.codePointAt(end - 1) === 45) {
    end--;
  }
  return value.slice(start, end);
}

// URL/file-safe slug used for the downloaded/attached PDF filename.
export function prdDocumentFilename(title: string): string {
  const normalized = title.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  const slug = trimHyphens(trimHyphens(normalized).slice(0, 60)) || "product-requirements";
  return `PRD-${slug}.pdf`;
}

export function safeParseArray(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as string[]) : [];
  } catch {
    return [];
  }
}

export interface BuildPrdDocumentInput {
  feature: {
    title: string;
    priority: string;
    status: string;
    createdAt: string | Date;
  };
  prd: {
    version: number;
    problem: string;
    goals?: string | null;
    nonGoals?: string | null;
    userStories?: string | null;
    acceptanceCriteria?: string | null;
    edgeCases?: string | null;
    successMetrics?: string | null;
    technicalRequirements?: string | null;
    dependencies?: string | null;
    risks?: string | null;
    estimatedTotalHours?: number | null;
    targetDeadline?: string | Date | null;
    approvedAt?: string | Date | null;
  };
  createdByName?: string | null;
  orgName?: string | null;
  generatedAt?: string | Date;
}

export function buildPrdDocumentData(input: BuildPrdDocumentInput): PrdDocumentData {
  const { feature, prd, createdByName = null, orgName = null, generatedAt } = input;
  return {
    featureTitle: feature.title,
    priority: feature.priority,
    status: feature.status,
    version: prd.version,
    problem: prd.problem,
    goals: safeParseArray(prd.goals),
    nonGoals: safeParseArray(prd.nonGoals),
    userStories: safeParseArray(prd.userStories),
    acceptanceCriteria: safeParseArray(prd.acceptanceCriteria),
    edgeCases: safeParseArray(prd.edgeCases),
    successMetrics: safeParseArray(prd.successMetrics),
    technicalRequirements: safeParseArray(prd.technicalRequirements),
    dependencies: safeParseArray(prd.dependencies),
    risks: safeParseArray(prd.risks),
    estimatedTotalHours: prd.estimatedTotalHours ?? null,
    targetDeadline: prd.targetDeadline ?? null,
    approvedAt: prd.approvedAt ?? null,
    createdByName,
    createdAt: feature.createdAt,
    orgName,
    ...(generatedAt ? { generatedAt } : {}),
  };
}

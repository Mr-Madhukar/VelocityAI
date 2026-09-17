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

// URL/file-safe slug used for the downloaded/attached PDF filename.
export function prdDocumentFilename(title: string): string {
  const slug =
    title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "product-requirements";
  return `PRD-${slug}.pdf`;
}

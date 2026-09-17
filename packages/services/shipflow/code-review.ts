export type PullRequestFilePatch = {
  filePath: string;
  patch: string;
};

export type ReviewPullRequestInput = {
  repoFullName: string;
  pullRequestTitle: string;
  prdTitle: string;
  acceptanceCriteria: string[];
  files: PullRequestFilePatch[];
};

export type PullRequestReviewFinding = {
  severity: "blocking" | "non_blocking" | "positive";
  message: string;
  file: string;
  /** Concrete change the author should make to address the finding. */
  suggestion?: string;
};

export type PullRequestReviewResult = {
  status: "passed" | "changes_requested";
  summary: string;
  reviewMarkdown: string;
  findings: PullRequestReviewFinding[];
  /** 0–100 share of the PRD acceptance criteria the diff satisfies. */
  complianceScore: number;
};

export function formatPullRequestFilesForReview(files: PullRequestFilePatch[]) {
  return files
    .map((file) => `### ${file.filePath}\n\`\`\`diff\n${file.patch}\n\`\`\``)
    .join("\n\n");
}

export type CriterionStatus = "met" | "partial" | "not_met";

// met = full credit, partial = half, not_met = none. Deriving the PRD-compliance
// score from per-criterion verdicts (rather than a single number from the model)
// is what makes it track the PR instead of landing on a constant.
const CRITERION_WEIGHT: Record<CriterionStatus, number> = {
  met: 1,
  partial: 0.5,
  not_met: 0,
};

/**
 * Weighted share (0–100) of acceptance criteria a PR satisfies. Returns `null`
 * when there are no criteria to score against (e.g. a non-PRD review).
 */
export function scoreFromCriteria(
  criteria: ReadonlyArray<{ status: CriterionStatus }>,
): number | null {
  if (criteria.length === 0) return null;
  const earned = criteria.reduce((sum, c) => sum + CRITERION_WEIGHT[c.status], 0);
  return Math.round((earned / criteria.length) * 100);
}

/** Clamp any number into a whole 0–100 score. */
export function clampScore(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, Math.round(n)));
}

export function reviewPullRequestAgainstPrd(
  input: ReviewPullRequestInput,
): PullRequestReviewResult {
  const diffText = normalize(
    input.files.map((file) => `${file.filePath}\n${file.patch}`).join("\n"),
  );

  const blockingFindings = input.acceptanceCriteria
    .filter((criterion) => isCriterionMissing(criterion, diffText))
    .map<PullRequestReviewFinding>((criterion) => ({
      severity: "blocking",
      message: `Missing acceptance criterion: ${criterion}`,
      file: findMostLikelyFile(input.files),
    }));

  const positiveFindings: PullRequestReviewFinding[] =
    blockingFindings.length === 0
      ? [
          {
            severity: "positive",
            message: "PR diff covers the listed PRD acceptance criteria.",
            file: input.files[0]?.filePath ?? "pull request diff",
          },
        ]
      : [];

  const status = blockingFindings.length > 0 ? "changes_requested" : "passed";
  const findings = [...blockingFindings, ...positiveFindings];
  // Score = share of acceptance criteria the diff actually represents.
  const totalCriteria = Math.max(input.acceptanceCriteria.length, 1);
  const metCriteria = totalCriteria - blockingFindings.length;
  const complianceScore = Math.round((metCriteria / totalCriteria) * 100);
  const summary =
    status === "passed"
      ? `${input.pullRequestTitle} satisfies ${input.prdTitle}.`
      : `${input.pullRequestTitle} is missing ${blockingFindings.length} PRD requirement.`;

  return {
    status,
    summary,
    findings,
    complianceScore,
    reviewMarkdown: buildReviewMarkdown(input, summary, findings),
  };
}

function buildReviewMarkdown(
  input: ReviewPullRequestInput,
  summary: string,
  findings: PullRequestReviewFinding[],
) {
  const formattedFindings = findings
    .map((finding) => `- **${finding.severity}** (${finding.file}): ${finding.message}`)
    .join("\n");

  return `## VelocityAI Review

Repository: ${input.repoFullName}
PR: ${input.pullRequestTitle}
PRD: ${input.prdTitle}

${summary}

### Findings
${formattedFindings || "- No findings."}

### Reviewed Diff
${formatPullRequestFilesForReview(input.files)}
`;
}

function isCriterionMissing(criterion: string, diffText: string) {
  const normalizedCriterion = normalize(criterion);

  if (
    normalizedCriterion.includes("prevent approval") ||
    normalizedCriterion.includes("block approval")
  ) {
    return (
      !diffText.includes("block approval") &&
      !diffText.includes("prevent approval") &&
      !diffText.includes("precondition_failed") &&
      !diffText.includes("cannot approve")
    );
  }

  const stopwords = new Set([
    "with",
    "from",
    "that",
    "this",
    "have",
    "must",
    "should",
    "when",
    "into",
    "each",
    "will",
    "been",
    "also",
  ]);

  const keywords = normalizedCriterion
    .split(" ")
    .filter((word) => word.length > 2 && !stopwords.has(word));

  if (keywords.length === 0) return false;

  let matches = 0;
  for (const keyword of keywords) {
    const root = keyword.length > 5 ? keyword.slice(0, -1) : keyword;
    const regex = new RegExp(`\\b${root}`, "i");
    if (regex.test(diffText)) {
      matches++;
    }
  }

  return matches < Math.max(1, Math.ceil(keywords.length / 2));
}

function findMostLikelyFile(files: PullRequestFilePatch[]) {
  return files[0]?.filePath ?? "pull request diff";
}

function normalize(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9 ]/g, " ");
}

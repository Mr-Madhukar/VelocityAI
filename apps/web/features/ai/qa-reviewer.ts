export { reviewImplementationAgainstCriteria } from "@repo/services/shipflow/agents";
import { generateText, Output } from 'ai';
import { openai } from '../../lib/ai';
import { z } from 'zod';
import {
  clampScore,
  scoreFromCriteria,
  type PullRequestReviewResult,
} from '@repo/services/shipflow/code-review';

export type ReviewCommit = { sha: string; message: string };

export type ReviewInput = {
  repoFullName: string;
  pullRequestTitle: string;
  prdTitle?: string | null;
  acceptanceCriteria?: string[] | null;
  files: Array<{ filePath: string; patch: string }>;
  /** Commit messages on the PR branch — extra signal about intent. */
  commits?: ReviewCommit[];
};

const criterionSchema = z.object({
  criterion: z.string().describe('The acceptance criterion, quoted verbatim.'),
  status: z
    .enum(['met', 'partial', 'not_met'])
    .describe('met = fully implemented in the diff; partial = started but incomplete; not_met = absent.'),
  evidence: z
    .string()
    .describe('Cite the code in the diff that satisfies it, or explain precisely what is missing.'),
});

const findingSchema = z.object({
  severity: z.enum(['blocking', 'non_blocking', 'positive']),
  message: z.string().describe('What the issue is.'),
  file: z.string().describe('The file path the finding refers to, or "general".'),
  suggestion: z
    .string()
    .describe('The concrete change to make to fix this. Empty string for positive findings.'),
});

export async function reviewPullRequestAgainstPrd(
  input: ReviewInput,
): Promise<PullRequestReviewResult> {
  const { repoFullName, pullRequestTitle, prdTitle, acceptanceCriteria, files, commits } = input;

  const hasPrd = !!(prdTitle && acceptanceCriteria?.length);
  const diffText = files
    .map((f) => `File: ${f.filePath}\n\`\`\`diff\n${f.patch}\n\`\`\``)
    .join('\n\n');
  const commitText = commits?.length
    ? commits.map((c) => `- ${c.sha.slice(0, 7)} ${c.message.split('\n')[0]}`).join('\n')
    : 'No commit messages available.';

  const system = hasPrd
    ? `You are an exacting senior engineer reviewing a GitHub Pull Request against a Product Requirements Document (PRD).
Work through the diff and every commit message carefully before judging.
For EACH acceptance criterion, decide met / partial / not_met and cite the specific code (or its absence) as evidence — do not assume work that isn't in the diff.
Raise a 'blocking' finding for each not_met or incorrectly implemented criterion, and a 'non_blocking' finding for partial or risky work; every non-positive finding MUST include a concrete, actionable suggestion describing exactly what to change.
Set status to 'passed' only when every criterion is met; otherwise 'changes_requested'.
Be specific and reference real file paths and symbols from the diff.`
    : `You are an exacting senior engineer reviewing a GitHub Pull Request for code quality, correctness, security, and best practices.
Work through the diff and commit messages carefully. Flag serious issues (security, crashes, data loss) as 'blocking', minor ones as 'non_blocking', and always include a concrete suggestion for what to change.
Score overall quality 0–100. Set status to 'changes_requested' if there are blocking issues, otherwise 'passed'.`;

  const prompt = hasPrd
    ? `Repository: ${repoFullName}
PR Title: ${pullRequestTitle}
PRD Feature: ${prdTitle}

Acceptance Criteria:
${acceptanceCriteria!.map((c: string) => `- ${c}`).join('\n')}

Commits on this PR:
${commitText}

Full PR Diff:
${diffText}`
    : `Repository: ${repoFullName}
PR Title: ${pullRequestTitle}

Commits on this PR:
${commitText}

Full PR Diff:
${diffText}`;

  const { output } = await generateText({
    model: openai(process.env.OPENAI_MODEL ?? 'gpt-4o-mini'),
    output: Output.object({
      schema: z.object({
        status: z.enum(['passed', 'changes_requested']),
        complianceScore: z
          .number()
          .min(0)
          .max(100)
          .describe('0–100 overall quality score; used only when there is no PRD to score against.'),
        summary: z.string().describe('A short, specific summary of the review verdict.'),
        criteria: z
          .array(criterionSchema)
          .describe('One entry per PRD acceptance criterion. Empty if there is no PRD.'),
        findings: z.array(findingSchema),
      }),
    }),
    system,
    prompt,
  });

  // For a PRD review the score is the criteria coverage; otherwise the model's
  // overall-quality number. This is the fix for the "always 60/100" behaviour.
  const derived = scoreFromCriteria(output.criteria);
  const complianceScore = clampScore(
    hasPrd && derived !== null ? derived : output.complianceScore,
  );

  const getStatusIcon = (status: string) => {
    if (status === 'met') return '✅';
    if (status === 'partial') return '🟡';
    return '❌';
  };

  const criteriaBlock = output.criteria.length
    ? output.criteria
        .map((c) => `- ${getStatusIcon(c.status)} **${c.criterion}** — ${c.evidence}`)
        .join('\n')
    : '';

  const formattedFindings = output.findings
    .map((f) => {
      const head = `- **${f.severity}** (${f.file}): ${f.message}`;
      return f.suggestion?.trim() ? `${head}\n  - _Suggestion:_ ${f.suggestion.trim()}` : head;
    })
    .join('\n');

  const reviewMarkdown = `## VelocityAI Review

Repository: ${repoFullName}
PR: ${pullRequestTitle}
${hasPrd ? `PRD: ${prdTitle}\n` : ''}**PRD compliance: ${complianceScore}/100**

${output.summary}
${criteriaBlock ? `\n### Acceptance criteria\n${criteriaBlock}\n` : ''}
### Findings
${formattedFindings || '- No findings.'}

### Reviewed Diff
${files.map((f) => `#### ${f.filePath}\n\`\`\`diff\n${f.patch}\n\`\`\``).join('\n\n')}
`;

  return {
    status: output.status,
    summary: output.summary,
    findings: output.findings,
    complianceScore,
    reviewMarkdown,
  };
}

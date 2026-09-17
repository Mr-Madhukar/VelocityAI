export type PrdDraft = {
  title: string;
  problem: string;
  goals: string[];
  nonGoals: string[];
  userStories: string[];
  acceptanceCriteria: string[];
  edgeCases: string[];
  successMetrics: string[];
};

export type ImplementationReviewInput = {
  acceptanceCriteria: string[];
  implementationNotes: string;
};

export type ImplementationReview = {
  status: "passed" | "changes_requested";
  blockingFindings: string[];
  nonBlockingFindings: string[];
  summary: string;
};

export function generateClarificationQuestions(request: string) {
  const normalizedRequest = request.toLowerCase();
  const questions = [
    "Which users are affected by this request?",
    "What success metric proves this feature worked?",
    "What should be explicitly out of scope for version one?",
  ];

  if (!normalizedRequest.includes("github") && !normalizedRequest.includes("repository")) {
    questions.push("Does this feature need to connect with a GitHub repository or pull request?");
  }

  return questions;
}

export function generatePrdMarkdown(draft: PrdDraft) {
  return `# ${draft.title}

## Problem Statement
${draft.problem}

## Goals
${toMarkdownList(draft.goals)}

## Non-goals
${toMarkdownList(draft.nonGoals)}

## User Stories
${toMarkdownList(draft.userStories)}

## Acceptance Criteria
${toMarkdownList(draft.acceptanceCriteria)}

## Edge Cases
${toMarkdownList(draft.edgeCases)}

## Success Metrics
${toMarkdownList(draft.successMetrics)}
`;
}

export function reviewImplementationAgainstCriteria(
  input: ImplementationReviewInput,
): ImplementationReview {
  const implementation = normalize(input.implementationNotes);
  const blockingFindings = input.acceptanceCriteria.filter((criterion) => {
    const normalizedCriterion = normalize(criterion);

    if (
      normalizedCriterion.includes("prevent approval") ||
      normalizedCriterion.includes("block approval")
    ) {
      return (
        !implementation.includes("block") ||
        implementation.includes("not blocked") ||
        implementation.includes("not block")
      );
    }

    const keywords = normalizedCriterion
      .split(" ")
      .filter((word) => word.length > 3);

    const matchedKeywords = keywords.filter((word) => implementation.includes(word));
    return matchedKeywords.length < Math.max(1, Math.ceil(keywords.length / 2));
  });

  const status = blockingFindings.length > 0 ? "changes_requested" : "passed";

  return {
    status,
    blockingFindings,
    nonBlockingFindings: [],
    summary:
      status === "passed"
        ? "Implementation satisfies the listed acceptance criteria."
        : "Implementation is missing required acceptance criteria.",
  };
}

function toMarkdownList(items: string[]) {
  return items.map((item) => `- ${item}`).join("\n");
}

function normalize(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9 ]/g, " ");
}

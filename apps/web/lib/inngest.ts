export { inngest } from "@/features/inngest/client";
export { generatePrdFunction } from "@/features/inngest/functions/generate-prd";
export { generateTasksFunction, generateTasksFailureHandler } from "@/features/inngest/functions/generate-tasks";
export { reviewPullRequestFunction } from "@/features/inngest/functions/run-ai-review";

import { generatePrdFunction } from "@/features/inngest/functions/generate-prd";
import { generateTasksFunction, generateTasksFailureHandler } from "@/features/inngest/functions/generate-tasks";
import { reviewPullRequestFunction } from "@/features/inngest/functions/run-ai-review";

export const shipflowFunctions = [
  generatePrdFunction,
  generateTasksFunction,
  generateTasksFailureHandler,
  reviewPullRequestFunction,
];

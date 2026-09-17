import { router } from "./trpc";

import { approvalRouter } from "./routes/approval/route";
import { assistantRouter } from "./routes/assistant/route";
import { billingRouter } from "./routes/billing/route";
import { featureRouter } from "./routes/feature/route";
import { githubRouter } from "./routes/github/route";
import { healthRouter } from "./routes/health/route";
import { memberRouter } from "./routes/member/route";
import { orgRouter } from "./routes/org/route";
import { prdRouter } from "./routes/prd/route";
import { profileRouter } from "./routes/profile/route";
import { projectRouter } from "./routes/project/route";
import { promptsRouter } from "./routes/prompts/route";
import { reviewRouter } from "./routes/review/route";
import { searchRouter } from "./routes/search/route";
import { shipflowRouter } from "./routes/shipflow/route";
import { taskRouter } from "./routes/task/route";

export const serverRouter = router({
  approval: approvalRouter,
  assistant: assistantRouter,
  billing: billingRouter,
  feature: featureRouter,
  github: githubRouter,
  health: healthRouter,
  member: memberRouter,
  org: orgRouter,
  prd: prdRouter,
  profile: profileRouter,
  project: projectRouter,
  prompts: promptsRouter,
  review: reviewRouter,
  search: searchRouter,
  shipflow: shipflowRouter,
  task: taskRouter,
});

export { createContext } from "./context";
export { ORG_EVENT_NAME, orgChannel } from "./events";
export type { OrgEvent, OrgEventType, PublishOrgEvent } from "./events";
export type ServerRouter = typeof serverRouter;

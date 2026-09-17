import { summarizeFeatureProgress, type FeatureStatus } from "./workflow";

export type DemoFeature = {
  id: string;
  title: string;
  owner: string;
  status: FeatureStatus;
  priority: "low" | "medium" | "high" | "urgent";
  progress: number;
  prdVersion: number;
  linkedPr: string | null;
  acceptanceCriteria: string[];
};

export type DemoPrd = {
  featureId: string;
  problem: string;
  goals: string[];
  nonGoals: string[];
  userStories: string[];
  edgeCases: string[];
  successMetrics: string[];
};

export type DemoTask = {
  id: string;
  featureId: string;
  title: string;
  type: "frontend" | "backend" | "database" | "infra" | "testing" | "docs";
  status: "todo" | "in_progress" | "done" | "blocked";
  priority: "p0" | "p1" | "p2" | "p3";
  assignee: string;
};

export type DemoRepository = {
  id: string;
  name: string;
  fullName: string;
  defaultBranch: string;
  reviewHealth: "passing" | "attention" | "blocked";
  connected: boolean;
};

export type DemoReview = {
  id: string;
  featureId: string;
  pullRequest: string;
  status: "processing" | "passed" | "changes_requested" | "blocked";
  summary: string;
  findings: Array<{
    severity: "blocking" | "non_blocking" | "positive";
    message: string;
    file: string;
  }>;
};

export type DemoActivity = {
  id: string;
  kind: "feature" | "prd" | "task" | "ai_review" | "approval";
  title: string;
  detail: string;
  time: string;
};

export type DemoWorkspace = {
  organization: {
    name: string;
    plan: "Launch" | "Scale" | "Enterprise";
  };
  metrics: {
    features: ReturnType<typeof summarizeFeatureProgress>;
    reviewPassRate: number;
    aiHoursSaved: number;
    openBlockers: number;
  };
  repositories: DemoRepository[];
  features: DemoFeature[];
  prds: DemoPrd[];
  tasks: DemoTask[];
  reviews: DemoReview[];
  activity: DemoActivity[];
  billing: {
    plan: "Free" | "Pro" | "Scale";
    usedCredits: number;
    includedCredits: number;
    repositoryLimit: number;
    renewalDate: string;
  };
  onboarding: Array<{
    label: string;
    complete: boolean;
  }>;
};

const features: DemoFeature[] = [
  {
    id: "feat_ai_qa",
    title: "AI QA gate for pull requests",
    owner: "Kaiser",
    status: "in_review",
    priority: "urgent",
    progress: 82,
    prdVersion: 3,
    linkedPr: "acme/web#148",
    acceptanceCriteria: [
      "Review every PR against the approved PRD",
      "Mark blocking issues separately from suggestions",
      "Post a concise GitHub comment with evidence",
    ],
  },
  {
    id: "feat_billing",
    title: "Usage-based billing with Razorpay",
    owner: "Aarav",
    status: "tasks_ready",
    priority: "high",
    progress: 46,
    prdVersion: 1,
    linkedPr: null,
    acceptanceCriteria: [
      "Free plan gets 5 AI reviews per month",
      "Pro plan unlocks unlimited reviews",
      "Webhook updates subscription state safely",
    ],
  },
  {
    id: "feat_orgs",
    title: "Multi-tenant organizations",
    owner: "Meera",
    status: "approved",
    priority: "high",
    progress: 96,
    prdVersion: 2,
    linkedPr: "acme/api#122",
    acceptanceCriteria: [
      "Members can only access their organization",
      "Owners can invite admins and reviewers",
      "All feature records are scoped by organization",
    ],
  },
  {
    id: "feat_clarifier",
    title: "Feature clarification chat",
    owner: "Kaiser",
    status: "clarifying",
    priority: "medium",
    progress: 18,
    prdVersion: 0,
    linkedPr: null,
    acceptanceCriteria: [
      "Ask missing product questions before PRD generation",
      "Summarize answers as structured requirements",
    ],
  },
  {
    id: "feat_deploy",
    title: "YC demo deployment cockpit",
    owner: "Riya",
    status: "blocked",
    priority: "medium",
    progress: 38,
    prdVersion: 1,
    linkedPr: "acme/infra#77",
    acceptanceCriteria: [
      "Show deployment readiness checklist",
      "Block launch when required reviews are unresolved",
    ],
  },
  {
    id: "feat_landing",
    title: "Founder-ready landing page",
    owner: "Kaiser",
    status: "shipped",
    priority: "medium",
    progress: 100,
    prdVersion: 2,
    linkedPr: "acme/web#101",
    acceptanceCriteria: [
      "Explain VelocityAI in one screen",
      "Convert visitors into waitlist signups",
    ],
  },
];

const repositories: DemoRepository[] = [
  {
    id: "repo_web",
    name: "web",
    fullName: "acme/web",
    defaultBranch: "main",
    reviewHealth: "attention",
    connected: true,
  },
  {
    id: "repo_api",
    name: "api",
    fullName: "acme/api",
    defaultBranch: "main",
    reviewHealth: "passing",
    connected: true,
  },
  {
    id: "repo_infra",
    name: "infra",
    fullName: "acme/infra",
    defaultBranch: "production",
    reviewHealth: "blocked",
    connected: true,
  },
];

const prds: DemoPrd[] = [
  {
    featureId: "feat_ai_qa",
    problem:
      "Teams ship code that looks correct syntactically but misses product acceptance criteria.",
    goals: [
      "Compare PR diffs with approved PRDs",
      "Separate blockers from suggestions",
      "Give humans a clear release decision",
    ],
    nonGoals: [
      "Replace human approval",
      "Auto-merge pull requests",
      "Review unrelated refactors outside the feature scope",
    ],
    userStories: [
      "As a reviewer, I want to see whether a PR satisfies the PRD before approving it.",
      "As a founder, I want blockers surfaced before customers see broken features.",
    ],
    edgeCases: [
      "PR contains no code files",
      "PR includes implementation for multiple feature requests",
      "Acceptance criteria conflict with current codebase behavior",
    ],
    successMetrics: [
      "30% less manual review time",
      "90% of shipped features have an approved review cycle",
      "Zero shipped features with unresolved blocking findings",
    ],
  },
  {
    featureId: "feat_billing",
    problem:
      "AI usage has cost, so the product needs clear plan limits before public launch.",
    goals: [
      "Track monthly AI review credits",
      "Expose plan limits in billing UI",
      "Handle Razorpay subscription webhooks",
    ],
    nonGoals: ["International tax automation", "Invoice PDF generation"],
    userStories: [
      "As an admin, I can see how many AI credits my workspace used.",
      "As a founder, I can upgrade without talking to sales.",
    ],
    edgeCases: [
      "Webhook arrives twice",
      "Payment succeeds after temporary failure",
      "Workspace hits limit during active review",
    ],
    successMetrics: ["Upgrade conversion above 5%", "No review runs after limit is exhausted"],
  },
];

const tasks: DemoTask[] = [
  {
    id: "task_schema",
    featureId: "feat_ai_qa",
    title: "Add review cycle schema",
    type: "database",
    status: "done",
    priority: "p0",
    assignee: "Meera",
  },
  {
    id: "task_prompt",
    featureId: "feat_ai_qa",
    title: "Write PRD-aware QA prompt",
    type: "backend",
    status: "done",
    priority: "p0",
    assignee: "Kaiser",
  },
  {
    id: "task_webhook",
    featureId: "feat_ai_qa",
    title: "Process pull_request webhook",
    type: "backend",
    status: "in_progress",
    priority: "p0",
    assignee: "Aarav",
  },
  {
    id: "task_review_ui",
    featureId: "feat_ai_qa",
    title: "Build review history panel",
    type: "frontend",
    status: "todo",
    priority: "p1",
    assignee: "Riya",
  },
  {
    id: "task_billing_limits",
    featureId: "feat_billing",
    title: "Enforce AI credit limits",
    type: "backend",
    status: "blocked",
    priority: "p0",
    assignee: "Kaiser",
  },
];

const reviews: DemoReview[] = [
  {
    id: "review_148",
    featureId: "feat_ai_qa",
    pullRequest: "acme/web#148",
    status: "changes_requested",
    summary:
      "The UI is strong, but the implementation does not yet block human approval when a blocking AI finding exists.",
    findings: [
      {
        severity: "blocking",
        message: "Approval action ignores unresolved blocking review findings.",
        file: "features/approval/actions.ts",
      },
      {
        severity: "non_blocking",
        message: "Add an empty state for PRs with documentation-only changes.",
        file: "features/reviews/components/review-panel.tsx",
      },
      {
        severity: "positive",
        message: "The review prompt correctly includes PRD acceptance criteria.",
        file: "features/ai/qa-reviewer.ts",
      },
    ],
  },
  {
    id: "review_122",
    featureId: "feat_orgs",
    pullRequest: "acme/api#122",
    status: "passed",
    summary:
      "Organization access checks match the PRD and all routes correctly scope by organization.",
    findings: [
      {
        severity: "positive",
        message: "Protected procedures enforce workspace membership before DB reads.",
        file: "packages/api/routers/organization.ts",
      },
    ],
  },
];

const activity: DemoActivity[] = [
  {
    id: "act_review",
    kind: "ai_review",
    title: "AI review completed",
    detail: "Found 1 blocker and 3 suggestions in acme/web#148.",
    time: "4 min ago",
  },
  {
    id: "act_prd",
    kind: "prd",
    title: "PRD generated",
    detail: "Usage-based billing PRD v1 is ready for task breakdown.",
    time: "18 min ago",
  },
  {
    id: "act_approval",
    kind: "approval",
    title: "Human approval recorded",
    detail: "Multi-tenant organizations approved by Meera.",
    time: "43 min ago",
  },
  {
    id: "act_task",
    kind: "task",
    title: "Tasks created",
    detail: "7 engineering tasks generated for the QA gate.",
    time: "1 hr ago",
  },
];

export function getDemoWorkspace(): DemoWorkspace {
  const shipped = features.filter((feature) => feature.status === "shipped").length;
  const inReview = features.filter((feature) => feature.status === "in_review").length;
  const blocked = features.filter((feature) => feature.status === "blocked").length;

  return {
    organization: {
      name: "Acme Cloud",
      plan: "Launch",
    },
    metrics: {
      features: summarizeFeatureProgress({
        total: features.length,
        shipped,
        inReview,
        blocked,
      }),
      reviewPassRate: 87,
      aiHoursSaved: 42,
      openBlockers: 1,
    },
    repositories,
    features,
    prds,
    tasks,
    reviews,
    activity,
    billing: {
      plan: "Pro",
      usedCredits: 64,
      includedCredits: 100,
      repositoryLimit: 10,
      renewalDate: "July 24, 2026",
    },
    onboarding: [
      { label: "Create workspace", complete: true },
      { label: "Connect GitHub App", complete: true },
      { label: "Generate first PRD", complete: true },
      { label: "Run AI review", complete: true },
      { label: "Approve release", complete: false },
    ],
  };
}

export function getDemoFeature(featureId: string) {
  return features.find((feature) => feature.id === featureId) ?? features[0];
}

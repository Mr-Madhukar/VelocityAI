import {
  Boxes,
  FolderKanban,
  GitBranch,
  ListChecks,
  ScrollText,
  ShieldCheck,
  type LucideIcon,
} from "lucide-react";

import type { SearchResultType } from "@repo/trpc/server/routes/search/route";

export const TYPE_ORDER: SearchResultType[] = [
  "project",
  "feature",
  "task",
  "prd",
  "repository",
  "review",
];

export const TYPE_LABEL: Record<SearchResultType, string> = {
  project: "Projects",
  feature: "Features",
  task: "Tasks",
  prd: "PRDs",
  repository: "Repositories",
  review: "Reviews",
};

/** Shorter labels for the /search filter chips. */
export const TYPE_CHIP_LABEL: Record<SearchResultType, string> = {
  project: "Projects",
  feature: "Features",
  task: "Tasks",
  prd: "PRDs",
  repository: "Repos",
  review: "Reviews",
};

export const TYPE_ICON: Record<SearchResultType, LucideIcon> = {
  project: FolderKanban,
  feature: Boxes,
  task: ListChecks,
  prd: ScrollText,
  repository: GitBranch,
  review: ShieldCheck,
};

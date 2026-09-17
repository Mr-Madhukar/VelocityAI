"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight, Plus, Sparkles } from "lucide-react";

import { ProjectTag, useActiveProject } from "~/components/shipflow/project-context";
import { LinkPending } from "~/components/shipflow/link-pending";
import { CardGridSkeleton } from "~/components/shipflow/page-skeletons";
import {
  ComplianceBadge,
  EffortBadge,
  FADE_UP,
  PageHeader,
  STAGGER,
  StatusBadge,
} from "~/components/shipflow/ui-kit";
import { statusLabel } from "~/components/shipflow/status";
import { trpc } from "~/trpc/client";
import type { RouterOutputs } from "@repo/trpc/client";

type FeatureStatus = keyof typeof statusLabel;

type FeatureItem = RouterOutputs["feature"]["list"][number];

function NewFeatureButton() {
  return (
    <Link
      href="/features/new"
      className="inline-flex h-9 items-center gap-2 bg-primary px-4 text-sm font-medium text-primary-foreground transition-transform hover:opacity-95 active:scale-[0.97]"
    >
      <Plus className="size-4" />
      New feature
      <LinkPending />
    </Link>
  );
}

function FeaturesContent({
  showSkeleton,
  features,
  projectName,
}: Readonly<{
  showSkeleton: boolean;
  features: FeatureItem[];
  projectName?: string;
}>) {
  if (showSkeleton) {
    return <CardGridSkeleton />;
  }

  if (features.length === 0) {
    return (
      <motion.div variants={FADE_UP} className="border border-border bg-card p-12 text-center">
        <p className="text-sm text-muted-foreground">
          {projectName ? `No feature requests in ${projectName} yet.` : "No feature requests yet."}
        </p>
        <div className="mt-4 flex justify-center">
          <NewFeatureButton />
        </div>
      </motion.div>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {features.map((feature) => {
        const status = feature.status as FeatureStatus;
        return (
          <motion.div variants={FADE_UP} key={feature.id}>
            <Link
              href={`/features/${feature.id}`}
              className="group flex h-full flex-col border border-border bg-card p-5 transition-colors hover:border-foreground/20 hover:bg-foreground/3"
            >
              <div className="flex items-start justify-between gap-3">
                <h2 className="text-base font-medium text-foreground">{feature.title}</h2>
                <StatusBadge status={status} />
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <ProjectTag projectId={feature.projectId} />
                <EffortBadge hours={feature.estimatedHours} />
                <ComplianceBadge score={feature.complianceScore} />
              </div>
              <p className="mt-3 line-clamp-3 flex-1 text-sm leading-6 text-muted-foreground">{feature.description}</p>
              <div className="mt-5 flex items-center justify-between text-xs text-muted-foreground">
                <span className="capitalize">{feature.priority} priority</span>
                <span className="inline-flex items-center gap-1.5">
                  {new Date(feature.createdAt).toLocaleDateString("en-IN")}
                  <ArrowRight aria-hidden className="size-3.5 text-foreground/20 transition-colors group-hover:text-primary" />
                </span>
              </div>
            </Link>
          </motion.div>
        );
      })}
    </div>
  );
}

export default function FeaturesPage() {
  const { activeProjectId, activeProject, ready, isLoading: projectsLoading } = useActiveProject();
  const { data: features = [], isLoading } = trpc.feature.list.useQuery(
    { projectId: activeProjectId ?? undefined },
    { enabled: ready && !projectsLoading },
  );

  const showSkeleton = !ready || projectsLoading || isLoading;

  return (
    <motion.div initial="hidden" animate="show" variants={STAGGER} className="space-y-6">
      <motion.div variants={FADE_UP}>
        <PageHeader
          title="Feature requests"
          description="Capture rough product asks, clarify missing context, generate PRDs, and track each feature until it ships."
        />
      </motion.div>

      <motion.div
        variants={FADE_UP}
        className="flex flex-col gap-3 border border-primary/30 bg-primary/6 p-5 sm:flex-row sm:items-center sm:justify-between"
      >
        <div>
          <div className="flex items-center gap-2 text-sm font-medium text-primary">
            <Sparkles className="size-4" />
            AI intake starts here
          </div>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            {activeProject
              ? `Add a request to ${activeProject.name}. VelocityAI will clarify it, produce a PRD, create tasks, and review the final PR.`
              : "Add a client ask, missing requirement, or founder idea. VelocityAI will clarify it, produce a PRD, create tasks, and review the final PR."}
          </p>
        </div>
      </motion.div>

      <FeaturesContent
        showSkeleton={showSkeleton}
        features={features}
        projectName={activeProject?.name}
      />
    </motion.div>
  );
}

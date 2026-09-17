"use client";

import { useMemo, useState } from "react";
import { GitPullRequestArrow, Loader2 } from "lucide-react";

import { trpc } from "~/trpc/client";

export function ReviewLab() {
  const [enabled, setEnabled] = useState(false);
  const input = useMemo(
    () => ({
      repoFullName: "acme/web",
      pullRequestTitle: "Add QA gate",
      prdTitle: "AI QA gate",
      acceptanceCriteria: [
        "Blocking findings prevent approval",
        "Post review comment to GitHub",
      ],
      files: [
        {
          filePath: "features/reviews/post-comment.ts",
          patch: "+export async function postComment() { return 'GitHub comment posted' }",
        },
      ],
    }),
    [],
  );
  const reviewMutation = trpc.shipflow.reviewPullRequest.useMutation();

  return (
    <div className="rounded-lg border border-primary/20 bg-primary/10 p-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-lg font-semibold text-foreground">tRPC PR review lab</p>
          <p className="text-sm text-primary/75">
            Runs the VelocityAI PRD-aware reviewer through `shipflow.reviewPullRequest`.
          </p>
        </div>
        <button
          className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition hover:bg-primary disabled:cursor-not-allowed disabled:opacity-60"
          disabled={reviewMutation.isPending}
          onClick={() => {
            setEnabled(true);
            reviewMutation.mutate(input);
          }}
        >
          {reviewMutation.isPending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <GitPullRequestArrow className="size-4" />
          )}
          Run tRPC review
        </button>
      </div>

      {enabled ? (
        <div className="mt-5 rounded-md border border-foreground/10 bg-muted p-4">
          {reviewMutation.data ? (
            <>
              <p className="text-sm font-medium text-foreground">{reviewMutation.data.summary}</p>
              <div className="mt-3 space-y-2">
                {reviewMutation.data.findings.map((finding) => (
                  <div key={`${finding.file}-${finding.message}`} className="rounded-md bg-foreground/5 p-3 text-sm text-foreground">
                    <span className="text-primary">{finding.severity}</span> · {finding.file}: {finding.message}
                  </div>
                ))}
              </div>
            </>
          ) : reviewMutation.error ? (
            <p className="text-sm text-destructive">{reviewMutation.error.message}</p>
          ) : (
            <p className="text-sm text-foreground/80">Waiting for review result...</p>
          )}
        </div>
      ) : null}
    </div>
  );
}

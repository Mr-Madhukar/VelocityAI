import "server-only";

import { getGithubApp } from "@/lib/github/app";

// Keep the prior-change context bounded so a large PR can't blow the model's
// context window — mirrors the repo-context indexer's per-file/char caps.
const MAX_BRANCH_FILES = 24;
const MAX_FILE_CHARS = 8000;

/**
 * Files a feature's PR branch has changed relative to the default branch — i.e.
 * the work prior agent runs already committed to the SAME pull request. Fed to
 * the agent so follow-up requests build ON TOP of the branch incrementally
 * instead of regenerating everything from the default branch.
 *
 * Best-effort: returns [] when the branch doesn't exist yet (first run), the
 * App lacks read access, or the compare/read fails — the caller then runs as a
 * fresh feature with no prior-change context.
 */
export async function getFeatureBranchFiles(input: {
  installationId: number;
  fullName: string;
  defaultBranch: string;
  branchName: string;
}): Promise<Array<{ path: string; content: string }>> {
  try {
    const app = getGithubApp();
    const octokit = await app.getInstallationOctokit(input.installationId);
    const [owner, name] = input.fullName.split("/") as [string, string];

    const compare = await octokit.rest.repos.compareCommits({
      owner,
      repo: name,
      base: input.defaultBranch,
      head: input.branchName,
    });

    const changed = (compare.data.files ?? [])
      .filter((f) => f.status !== "removed")
      .slice(0, MAX_BRANCH_FILES);

    const files: Array<{ path: string; content: string }> = [];
    for (const file of changed) {
      try {
        const { data } = await octokit.rest.repos.getContent({
          owner,
          repo: name,
          path: file.filename,
          ref: input.branchName,
        });
        if (!Array.isArray(data) && data.type === "file" && data.content) {
          const content = Buffer.from(data.content, "base64")
            .toString("utf8")
            .slice(0, MAX_FILE_CHARS);
          files.push({ path: file.filename, content });
        }
      } catch {
        // Skip files we can't read (renames, submodules, binaries).
      }
    }
    return files;
  } catch {
    return [];
  }
}

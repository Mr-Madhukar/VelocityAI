import "server-only";

import { getGithubApp } from "@/lib/github/app";

/**
 * True when a connected repo has no commits yet (freshly created / empty). Such
 * repos have no default-branch ref, so `getBranch`/`getTree` 404, and there's
 * nothing to base a PR on. We detect it via the commits endpoint, which returns
 * 409 "Git Repository is empty" — the canonical signal. Callers then scaffold
 * from scratch (context) or seed an initial commit (PR).
 */
export async function repoIsEmpty(installationId: number, fullName: string): Promise<boolean> {
  try {
    const octokit = await getGithubApp().getInstallationOctokit(installationId);
    const [owner, name] = fullName.split("/") as [string, string];
    await octokit.rest.repos.listCommits({ owner, repo: name, per_page: 1 });
    return false;
  } catch (error) {
    const status = (error as { status?: number }).status;
    const message = error instanceof Error ? error.message : String(error);
    return status === 409 || /empty/i.test(message);
  }
}

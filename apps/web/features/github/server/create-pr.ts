import "server-only";

import { getGithubApp } from "@/lib/github/app";
import { repoIsEmpty } from "./repo-empty";

export type PrFile = { path: string; content: string };

/**
 * Translate opaque GitHub App failures into something the user can act on.
 * "Resource not accessible by integration" is GitHub's way of saying the App
 * (or this installation) lacks the permission for the endpoint — for the git
 * data + pulls APIs used here that means Contents / Pull requests write.
 */
function friendlyGithubError(error: unknown): Error {
  const message = error instanceof Error ? error.message : String(error);
  if (/resource not accessible by integration/i.test(message)) {
    return new Error(
      "GitHub blocked the write (“Resource not accessible by integration”). " +
        "The GitHub App needs “Contents: Read and write” and “Pull requests: Read and write” permissions. " +
        "Update them under the App’s settings → Permissions & events, then approve the pending permission " +
        "request on the org’s installation (Settings → GitHub Apps → Configure) and retry.",
    );
  }
  return error instanceof Error ? error : new Error(message);
}

/**
 * Commit a set of generated files as one commit on a branch (blob → tree →
 * commit → ref via the git data API) and open a pull request against the
 * repo's default branch. Shared by Copilot's draft PRs and the Agent's
 * "Raise PR" flow.
 *
 * When `branchName` is given (e.g. a feature's canonical `feature/<slug>`
 * branch) and that branch already has an OPEN PR, the flow is incremental: the
 * new commit stacks on the branch's current head so prior agent work is
 * preserved and the SAME pull request accumulates the change (returned instead
 * of opening a new one). When the branch is new — or its PR was merged/closed —
 * it is (re)based on the current default-branch head and a fresh PR is opened.
 */
export async function commitFilesAndOpenPr(input: {
  installationId: number;
  fullName: string;
  defaultBranch: string;
  /** Branch namespace, e.g. "VelocityAI" → VelocityAI/<slug>-<sha>. */
  branchPrefix: string;
  /** Explicit head branch — overrides the generated prefix/slug name. */
  branchName?: string;
  title: string;
  body: string;
  commitMessage: string;
  files: PrFile[];
  draft: boolean;
}): Promise<CommitAndOpenResult> {
  try {
    return await commitAndOpen(input);
  } catch (error) {
    throw friendlyGithubError(error);
  }
}

type CommitAndOpenResult = {
  prUrl: string;
  prNumber: number;
  branchName: string;
  /** True when the commit landed on a branch whose OPEN PR already existed —
   * the returned PR was updated in place rather than newly created. */
  updatedExisting: boolean;
  /** GitHub's numeric PR id (not the number) — the caller caches the PR row
   * keyed on this, so linked-PR detection works without webhook delivery. */
  githubPrId: number;
  /** The commit this call created — the branch's new head. */
  headSha: string;
  baseBranch: string;
  prTitle: string;
  prBody: string | null;
};

async function commitAndOpen(
  input: Parameters<typeof commitFilesAndOpenPr>[0],
): Promise<CommitAndOpenResult> {
  const app = getGithubApp();
  const octokit = await app.getInstallationOctokit(input.installationId);
  const [owner, name] = input.fullName.split("/") as [string, string];

  // Current default-branch head — the base for a new (or reset) branch. An empty
  // repo (no commits) has no default-branch ref to base a PR on, so seed one
  // initial commit and PR the generated files against it.
  let baseSha: string;
  let baseTreeSha: string;
  try {
    const { data: branch } = await octokit.rest.repos.getBranch({
      owner,
      repo: name,
      branch: input.defaultBranch,
    });
    baseSha = branch.commit.sha;
    baseTreeSha = branch.commit.commit.tree.sha;
  } catch (error) {
    if (!(await repoIsEmpty(input.installationId, input.fullName))) throw error;
    // Seed the empty repo's default branch with one README commit so the agent's
    // feature branch has a base to PR against. The Git Data API (blob→tree→
    // commit→ref) can't bootstrap the FIRST commit on a repo with no objects
    // ("empty blob"/404 errors), so use the Contents API, which creates the
    // default branch and initial commit in a single call. Then read its head.
    await octokit.rest.repos.createOrUpdateFileContents({
      owner,
      repo: name,
      path: "README.md",
      message: "chore: initialize repository",
      content: Buffer.from("# Repository\n\nInitialized by VelocityAI Agent.\n", "utf8").toString(
        "base64",
      ),
    });
    const { data: seeded } = await octokit.rest.repos.getBranch({
      owner,
      repo: name,
      branch: input.defaultBranch,
    });
    baseSha = seeded.commit.sha;
    baseTreeSha = seeded.commit.commit.tree.sha;
  }

  const slug =
    input.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "change";
  const branchName = input.branchName ?? `${input.branchPrefix}/${slug}-${baseSha.slice(0, 6)}`;

  // Decide what this commit stacks on. For an explicit (feature) branch that
  // already exists AND still has an open PR, we build INCREMENTALLY: the commit
  // parents off the branch's current head so prior agent work is preserved and
  // the same PR accumulates the new change. Otherwise we commit off the default
  // branch head (fresh branch, or a branch whose PR was merged/closed — reset).
  let parentSha = baseSha;
  let parentTreeSha = baseTreeSha;
  let existingOpenPr: {
    html_url: string;
    number: number;
    id: number;
    base: string;
    title: string;
    body: string | null;
  } | null = null;
  let branchExists = false;

  if (input.branchName) {
    try {
      const { data: head } = await octokit.rest.repos.getBranch({
        owner,
        repo: name,
        branch: branchName,
      });
      branchExists = true;

      // No base filter: a linked PR may target a non-default base branch, and
      // missing it here would force-reset the branch and destroy its commits.
      const { data: openPrs } = await octokit.rest.pulls.list({
        owner,
        repo: name,
        head: `${owner}:${branchName}`,
        state: "open",
        per_page: 1,
      });
      if (openPrs[0]) {
        existingOpenPr = {
          html_url: openPrs[0].html_url,
          number: openPrs[0].number,
          id: openPrs[0].id,
          base: openPrs[0].base.ref,
          title: openPrs[0].title,
          body: openPrs[0].body,
        };
        parentSha = head.commit.sha;
        parentTreeSha = head.commit.commit.tree.sha;
      }
      // Branch exists but no open PR (merged/closed): parent stays the default
      // head — the ref is force-reset onto it by the updateRef below.
    } catch {
      branchExists = false; // 404 — branch doesn't exist yet.
    }
  }

  if (!branchExists) {
    try {
      await octokit.rest.git.createRef({
        owner,
        repo: name,
        ref: `refs/heads/${branchName}`,
        sha: baseSha,
      });
    } catch (error) {
      // Generated names carry a sha suffix and shouldn't collide; only tolerate
      // a racy "already exists" for explicit branches.
      const message = error instanceof Error ? error.message : String(error);
      if (!input.branchName || !/already exists/i.test(message)) throw error;
    }
  }

  // One commit containing all generated files (blob -> tree -> commit -> ref),
  // layered onto the chosen parent tree so unchanged files are preserved.
  const tree = await Promise.all(
    input.files.map(async (file) => {
      const { data: blob } = await octokit.rest.git.createBlob({
        owner,
        repo: name,
        content: Buffer.from(file.content, "utf8").toString("base64"),
        encoding: "base64",
      });
      return {
        path: file.path.replace(/^\/+/, ""),
        mode: "100644" as const,
        type: "blob" as const,
        sha: blob.sha,
      };
    }),
  );

  const { data: newTree } = await octokit.rest.git.createTree({
    owner,
    repo: name,
    base_tree: parentTreeSha,
    tree,
  });

  const { data: commit } = await octokit.rest.git.createCommit({
    owner,
    repo: name,
    message: input.commitMessage,
    tree: newTree.sha,
    parents: [parentSha],
  });

  // Point the branch at the new commit. force covers the reset case (branch
  // existed without an open PR); an incremental commit is a fast-forward.
  await octokit.rest.git.updateRef({
    owner,
    repo: name,
    ref: `heads/${branchName}`,
    sha: commit.sha,
    force: true,
  });

  // The branch already had an open PR — it now points at the new commit, so
  // return that same PR (updated in place) rather than opening another.
  if (existingOpenPr) {
    return {
      prUrl: existingOpenPr.html_url,
      prNumber: existingOpenPr.number,
      branchName,
      updatedExisting: true,
      githubPrId: existingOpenPr.id,
      headSha: commit.sha,
      baseBranch: existingOpenPr.base,
      prTitle: existingOpenPr.title,
      prBody: existingOpenPr.body,
    };
  }

  try {
    const { data: pr } = await octokit.rest.pulls.create({
      owner,
      repo: name,
      title: input.title,
      head: branchName,
      base: input.defaultBranch,
      body: input.body,
      draft: input.draft,
    });
    return {
      prUrl: pr.html_url,
      prNumber: pr.number,
      branchName,
      updatedExisting: false,
      githubPrId: pr.id,
      headSha: commit.sha,
      baseBranch: pr.base.ref,
      prTitle: pr.title,
      prBody: pr.body,
    };
  } catch (error) {
    // Raced with another open PR on this branch — return the existing one.
    const message = error instanceof Error ? error.message : String(error);
    if (!input.branchName || !/pull request already exists/i.test(message)) throw error;
    const { data: existing } = await octokit.rest.pulls.list({
      owner,
      repo: name,
      head: `${owner}:${branchName}`,
      state: "open",
      per_page: 1,
    });
    const pr = existing[0];
    if (!pr) throw error;
    return {
      prUrl: pr.html_url,
      prNumber: pr.number,
      branchName,
      updatedExisting: true,
      githubPrId: pr.id,
      headSha: commit.sha,
      baseBranch: pr.base.ref,
      prTitle: pr.title,
      prBody: pr.body,
    };
  }
}

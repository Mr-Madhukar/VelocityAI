import "server-only";

import type { Octokit } from "octokit";

import { getGithubApp } from "@/lib/github/app";
import { repoIsEmpty } from "./repo-empty";

export type PrFile = { path: string; content: string };

/**
 * Translate opaque GitHub App failures into something the user can act on.
 * "Resource not accessible by integration" is GitHub's way of saying the App
 * (or this installation) lacks the permission for the endpoint — for the git
 * data + pulls APIs used here that means Contents / Pull requests write.
 */
function formatErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  return JSON.stringify(error);
}

function friendlyGithubError(error: unknown): Error {
  const message = formatErrorMessage(error);
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

type OctokitClient = Octokit;

type ExistingOpenPr = {
  html_url: string;
  number: number;
  id: number;
  base: string;
  title: string;
  body: string | null;
};

function trimHyphens(value: string): string {
  let start = 0;
  let end = value.length;
  while (start < end && value.codePointAt(start) === 45) {
    start++;
  }
  while (end > start && value.codePointAt(end - 1) === 45) {
    end--;
  }
  return value.slice(start, end);
}

function deriveBranchSlug(title: string): string {
  const normalized = title.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  const trimmed = trimHyphens(trimHyphens(normalized).slice(0, 40));
  return trimmed || "change";
}

async function resolveBaseBranch(
  octokit: OctokitClient,
  owner: string,
  name: string,
  defaultBranch: string,
  installationId: number,
  fullName: string,
): Promise<{ baseSha: string; baseTreeSha: string }> {
  try {
    const { data: branch } = await octokit.rest.repos.getBranch({
      owner,
      repo: name,
      branch: defaultBranch,
    });
    return {
      baseSha: branch.commit.sha,
      baseTreeSha: branch.commit.commit.tree.sha,
    };
  } catch (error) {
    if (!(await repoIsEmpty(installationId, fullName))) throw error;
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
      branch: defaultBranch,
    });
    return {
      baseSha: seeded.commit.sha,
      baseTreeSha: seeded.commit.commit.tree.sha,
    };
  }
}

async function inspectExistingBranch(
  octokit: OctokitClient,
  owner: string,
  name: string,
  branchName: string,
): Promise<{
  branchExists: boolean;
  existingOpenPr: ExistingOpenPr | null;
  parentSha?: string;
  parentTreeSha?: string;
}> {
  try {
    const { data: head } = await octokit.rest.repos.getBranch({
      owner,
      repo: name,
      branch: branchName,
    });
    const { data: openPrs } = await octokit.rest.pulls.list({
      owner,
      repo: name,
      head: `${owner}:${branchName}`,
      state: "open",
      per_page: 1,
    });
    const firstPr = openPrs[0];
    if (firstPr) {
      return {
        branchExists: true,
        existingOpenPr: {
          html_url: firstPr.html_url,
          number: firstPr.number,
          id: firstPr.id,
          base: firstPr.base.ref,
          title: firstPr.title,
          body: firstPr.body,
        },
        parentSha: head.commit.sha,
        parentTreeSha: head.commit.commit.tree.sha,
      };
    }
    return { branchExists: true, existingOpenPr: null };
  } catch {
    return { branchExists: false, existingOpenPr: null };
  }
}

async function ensureBranchRef(
  octokit: OctokitClient,
  owner: string,
  name: string,
  branchName: string,
  sha: string,
  isExplicitBranch: boolean,
): Promise<void> {
  try {
    await octokit.rest.git.createRef({
      owner,
      repo: name,
      ref: `refs/heads/${branchName}`,
      sha,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!isExplicitBranch || !/already exists/i.test(message)) throw error;
  }
}

async function createCommitOnBranch(params: {
  octokit: OctokitClient;
  owner: string;
  name: string;
  branchName: string;
  parentSha: string;
  parentTreeSha: string;
  files: PrFile[];
  commitMessage: string;
}): Promise<string> {
  const {
    octokit,
    owner,
    name,
    branchName,
    parentSha,
    parentTreeSha,
    files,
    commitMessage,
  } = params;

  const tree = await Promise.all(
    files.map(async (file) => {
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
    message: commitMessage,
    tree: newTree.sha,
    parents: [parentSha],
  });

  await octokit.rest.git.updateRef({
    owner,
    repo: name,
    ref: `heads/${branchName}`,
    sha: commit.sha,
    force: true,
  });

  return commit.sha;
}

async function createOrReusePullRequest(
  octokit: OctokitClient,
  owner: string,
  name: string,
  branchName: string,
  commitSha: string,
  input: Parameters<typeof commitFilesAndOpenPr>[0],
): Promise<CommitAndOpenResult> {
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
      headSha: commitSha,
      baseBranch: pr.base.ref,
      prTitle: pr.title,
      prBody: pr.body,
    };
  } catch (error) {
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
      headSha: commitSha,
      baseBranch: pr.base.ref,
      prTitle: pr.title,
      prBody: pr.body,
    };
  }
}

async function commitAndOpen(
  input: Parameters<typeof commitFilesAndOpenPr>[0],
): Promise<CommitAndOpenResult> {
  const app = getGithubApp();
  const octokit = (await app.getInstallationOctokit(input.installationId)) as unknown as OctokitClient;
  const [owner, name] = input.fullName.split("/") as [string, string];

  const { baseSha, baseTreeSha } = await resolveBaseBranch(
    octokit,
    owner,
    name,
    input.defaultBranch,
    input.installationId,
    input.fullName,
  );

  const slug = deriveBranchSlug(input.title);
  const branchName = input.branchName ?? `${input.branchPrefix}/${slug}-${baseSha.slice(0, 6)}`;

  let parentSha = baseSha;
  let parentTreeSha = baseTreeSha;
  let branchExists = false;
  let existingOpenPr: ExistingOpenPr | null = null;

  if (input.branchName) {
    const inspected = await inspectExistingBranch(octokit, owner, name, branchName);
    branchExists = inspected.branchExists;
    existingOpenPr = inspected.existingOpenPr;
    if (inspected.parentSha && inspected.parentTreeSha) {
      parentSha = inspected.parentSha;
      parentTreeSha = inspected.parentTreeSha;
    }
  }

  if (!branchExists) {
    await ensureBranchRef(octokit, owner, name, branchName, baseSha, Boolean(input.branchName));
  }

  const commitSha = await createCommitOnBranch({
    octokit,
    owner,
    name,
    branchName,
    parentSha,
    parentTreeSha,
    files: input.files,
    commitMessage: input.commitMessage,
  });

  if (existingOpenPr) {
    return {
      prUrl: existingOpenPr.html_url,
      prNumber: existingOpenPr.number,
      branchName,
      updatedExisting: true,
      githubPrId: existingOpenPr.id,
      headSha: commitSha,
      baseBranch: existingOpenPr.base,
      prTitle: existingOpenPr.title,
      prBody: existingOpenPr.body,
    };
  }

  return createOrReusePullRequest(octokit, owner, name, branchName, commitSha, input);
}

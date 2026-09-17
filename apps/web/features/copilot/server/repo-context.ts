import "server-only";

import { openai } from "../../../lib/ai";
import { generateText, Output } from "ai";
import { z } from "zod";

import { db, eq } from "@repo/database";
import { repoContexts, repositories } from "@repo/database/schema";
import { filePriority, isIndexableSourcePath } from "@repo/services/shipflow/repo-index";

import { getGithubApp } from "@/lib/github/app";
import { repoIsEmpty } from "@/features/github/server/repo-empty";

const MAX_TREE_PATHS = 1500;
const MAX_FILES_TO_SUMMARIZE = 24;
const MAX_FILE_CHARS = 4000;

export type RepoContext = {
  overview: string;
  stack: string;
  tree: string[];
  summaries: Record<string, string>;
  fileCount: number;
  lastSha: string | null;
  updatedAt: Date;
};

const summarySchema = z.object({
  overview: z
    .string()
    .describe("2-4 sentences: what this repo is, its architecture, and how code is organized."),
  stack: z
    .string()
    .describe('Tech stack in one line, e.g. "Next.js 15 (App Router) + tRPC + Drizzle + PostgreSQL".'),
  summaries: z
    .array(
      z.object({
        path: z.string(),
        summary: z.string().describe("One line: what this file does / exports."),
      }),
    )
    .describe("One entry per provided file."),
});

/**
 * Read a connected repo from GitHub, summarize it with one AI call, and upsert a
 * compact snapshot into repo_context. This is the repo-wide context the Copilot
 * agent reasons over. Refreshed on connect and after each PR.
 */
export async function buildRepoContext(repositoryId: string): Promise<RepoContext> {
  const [repo] = await db
    .select()
    .from(repositories)
    .where(eq(repositories.id, repositoryId));
  if (!repo) throw new Error(`Repository ${repositoryId} not found`);
  if (!repo.installationId) throw new Error("Repository has no GitHub installation");

  const app = getGithubApp();
  const octokit = await app.getInstallationOctokit(repo.installationId);
  const [owner, name] = repo.fullName.split("/") as [string, string];

  // Resolve the head commit + its tree for the default branch. An empty repo has
  // no default-branch ref, so this 404s — persist an "empty" context so the
  // agent scaffolds the project from scratch instead of the run failing.
  let branch;
  try {
    const res = await octokit.rest.repos.getBranch({
      owner,
      repo: name,
      branch: repo.defaultBranch,
    });
    branch = res.data;
  } catch (error) {
    if (await repoIsEmpty(repo.installationId, repo.fullName)) {
      return persistEmptyRepoContext(repositoryId, repo.organizationId);
    }
    throw error;
  }
  const headSha = branch.commit.sha;
  const treeSha = branch.commit.commit.tree.sha;

  const { data: treeData } = await octokit.rest.git.getTree({
    owner,
    repo: name,
    tree_sha: treeSha,
    recursive: "true",
  });

  const sourceBlobs = treeData.tree.filter(
    (node): node is typeof node & { path: string } =>
      node.type === "blob" &&
      typeof node.path === "string" &&
      isIndexableSourcePath(node.path, node.size),
  );
  const allPaths = sourceBlobs.map((b) => b.path);
  const tree = allPaths.slice(0, MAX_TREE_PATHS);

  // Fetch contents of the highest-priority files for real summaries.
  const filesToRead = [...sourceBlobs]
    .sort((a, b) => filePriority(b.path) - filePriority(a.path))
    .slice(0, MAX_FILES_TO_SUMMARIZE);

  const fileContents = await Promise.all(
    filesToRead.map(async (blob) => {
      try {
        const { data } = await octokit.rest.repos.getContent({
          owner,
          repo: name,
          path: blob.path,
          ref: headSha,
        });
        if (Array.isArray(data) || data.type !== "file" || !("content" in data)) return null;
        const decoded = Buffer.from(data.content, "base64").toString("utf8");
        return { path: blob.path, content: decoded.slice(0, MAX_FILE_CHARS) };
      } catch {
        return null;
      }
    }),
  );
  const readFiles = fileContents.filter((f): f is { path: string; content: string } => f !== null);

  const filesBlock = readFiles
    .map((f) => `### ${f.path}\n\`\`\`\n${f.content}\n\`\`\``)
    .join("\n\n");

  const { output } = await generateText({
    model: openai(process.env.OPENAI_MODEL ?? "gpt-4o-mini"),
    output: Output.object({
      schema: summarySchema,
    }),
    system:
      "You are a senior engineer onboarding to a codebase. Produce a concise, accurate map of the repo from its file tree and the contents of its key files. Be specific about the stack and architecture. Summarize every file you are given.",
    prompt: `Repository: ${repo.fullName}
Default branch: ${repo.defaultBranch}

File tree (${allPaths.length} source files, truncated to ${tree.length}):
${tree.join("\n")}

Key file contents:
${filesBlock}`,
  });

  const summaries: Record<string, string> = {};
  for (const s of output.summaries) summaries[s.path] = s.summary;

  const now = new Date();
  const values = {
    organizationId: repo.organizationId,
    overview: output.overview,
    stack: output.stack,
    tree: JSON.stringify(tree),
    summaries: JSON.stringify(summaries),
    fileCount: allPaths.length,
    lastSha: headSha,
    status: "ready",
    updatedAt: now,
  };

  await db
    .insert(repoContexts)
    .values({ id: crypto.randomUUID(), repositoryId, ...values })
    .onConflictDoUpdate({ target: repoContexts.repositoryId, set: values });

  return {
    overview: output.overview,
    stack: output.stack,
    tree,
    summaries,
    fileCount: allPaths.length,
    lastSha: headSha,
    updatedAt: now,
  };
}

/**
 * Snapshot for an empty repo (no commits): the agent gets a clear "scaffold from
 * scratch" overview and an empty tree, so it creates the project's files itself.
 */
async function persistEmptyRepoContext(
  repositoryId: string,
  organizationId: string,
): Promise<RepoContext> {
  const now = new Date();
  const overview =
    "This repository is EMPTY — it has no code yet. Scaffold the requested change from scratch: create the project structure, config, and all files needed, following standard conventions for the requested stack.";
  const values = {
    organizationId,
    overview,
    stack: "",
    tree: JSON.stringify([]),
    summaries: JSON.stringify({}),
    fileCount: 0,
    lastSha: null,
    status: "ready",
    updatedAt: now,
  };
  await db
    .insert(repoContexts)
    .values({ id: crypto.randomUUID(), repositoryId, ...values })
    .onConflictDoUpdate({ target: repoContexts.repositoryId, set: values });

  return {
    overview,
    stack: "",
    tree: [],
    summaries: {},
    fileCount: 0,
    lastSha: null,
    updatedAt: now,
  };
}

/** Read the stored snapshot (parsed), or null if the repo hasn't been indexed yet. */
export async function getRepoContext(repositoryId: string): Promise<RepoContext | null> {
  const [row] = await db
    .select()
    .from(repoContexts)
    .where(eq(repoContexts.repositoryId, repositoryId));
  if (!row) return null;

  return {
    overview: row.overview,
    stack: row.stack,
    tree: JSON.parse(row.tree) as string[],
    summaries: JSON.parse(row.summaries) as Record<string, string>,
    fileCount: row.fileCount,
    lastSha: row.lastSha,
    updatedAt: row.updatedAt,
  };
}

/** Rebuild context only if the repo's head commit changed since last snapshot. */
export async function refreshRepoContextIfStale(repositoryId: string): Promise<void> {
  try {
    const existing = await getRepoContext(repositoryId);
    const [repo] = await db
      .select()
      .from(repositories)
      .where(eq(repositories.id, repositoryId));
    if (!repo?.installationId) return;

    const app = getGithubApp();
    const octokit = await app.getInstallationOctokit(repo.installationId);
    const [owner, name] = repo.fullName.split("/") as [string, string];
    const { data: branch } = await octokit.rest.repos.getBranch({
      owner,
      repo: name,
      branch: repo.defaultBranch,
    });

    if (existing && existing.lastSha === branch.commit.sha) return; // up to date
    await buildRepoContext(repositoryId);
  } catch {
    // Context refresh is best-effort — never block the caller (e.g. a webhook).
  }
}

/** Render the stored context into a compact prompt block for the Copilot agent. */
export function formatContextForPrompt(context: RepoContext): string {
  const summaryLines = Object.entries(context.summaries)
    .map(([path, summary]) => `- ${path}: ${summary}`)
    .join("\n");
  return `Repo overview: ${context.overview}
Stack: ${context.stack}
File count: ${context.fileCount}

Key files:
${summaryLines}

File tree:
${context.tree.join("\n")}`;
}

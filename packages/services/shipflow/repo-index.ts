// Pure heuristics for deciding which repository files are worth indexing for the
// Copilot's repo-context snapshot, and in what order to read them. Kept free of
// any I/O so the rules are unit-testable in isolation.

// Directories/extensions that carry no useful context for an LLM.
export const SKIP_DIR_SEGMENTS = new Set([
  "node_modules",
  ".next",
  ".turbo",
  "dist",
  "build",
  "out",
  "coverage",
  ".git",
  ".vercel",
]);

export const SKIP_EXTENSIONS = [
  ".png", ".jpg", ".jpeg", ".gif", ".svg", ".ico", ".webp", ".avif",
  ".woff", ".woff2", ".ttf", ".eot", ".map", ".lock", ".mp4", ".pdf",
  ".lockb", ".bin", ".wasm",
];

/** Largest file we'll bother reading for a summary (bytes). */
export const MAX_INDEXABLE_FILE_BYTES = 200_000;

/** True when a repo file is source worth summarizing (not vendored/binary/huge). */
export function isIndexableSourcePath(path: string, size?: number): boolean {
  if (!path) return false;
  if (path.split("/").some((seg) => SKIP_DIR_SEGMENTS.has(seg))) return false;
  const lower = path.toLowerCase();
  if (SKIP_EXTENSIONS.some((ext) => lower.endsWith(ext))) return false;
  if (typeof size === "number" && size > MAX_INDEXABLE_FILE_BYTES) return false;
  return true;
}

/**
 * Higher score = more worth reading for context. Config/entrypoints/docs and
 * shallower files rank first; tests and type-decls rank lower.
 */
export function filePriority(path: string): number {
  const lower = path.toLowerCase();
  const depth = path.split("/").length;
  let score = 100 - depth * 5; // shallower files first
  if (/(^|\/)(package\.json|readme\.md|tsconfig\.json|schema\.(ts|prisma)|drizzle\.config\.ts)$/.test(lower)) score += 80;
  if (/(^|\/)(index|main|app|route|layout)\.[tj]sx?$/.test(lower)) score += 30;
  if (/\.(ts|tsx|js|jsx)$/.test(lower)) score += 15;
  if (/(^|\/)(README|\.env\.example)/i.test(path)) score += 20;
  if (/(test|spec|\.d\.ts)/.test(lower)) score -= 30;
  return score;
}

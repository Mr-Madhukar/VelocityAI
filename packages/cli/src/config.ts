import { chmodSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

export const DEFAULT_API_URL = "https://VelocityAI.in";

const CONFIG_DIR = join(homedir(), ".velocityai");
const CONFIG_FILE = join(CONFIG_DIR, "config.json");

export interface CliConfig {
  /** Base URL of the VelocityAI deployment (no trailing /api). */
  apiUrl?: string;
  /** Bearer token from the device-authorization login. */
  token?: string;
  /** Human-facing slug of the active org (for display + `org use`). */
  orgSlug?: string;
  /** Id of the active org — the session's active org is the server source of truth. */
  orgId?: string;
}

export function loadConfig(): CliConfig {
  try {
    return JSON.parse(readFileSync(CONFIG_FILE, "utf8")) as CliConfig;
  } catch {
    // Missing or unreadable config is a fresh, unauthenticated state.
    return {};
  }
}

/** Overwrite the whole config file (0600 so the token isn't world-readable). */
export function writeConfig(config: CliConfig): void {
  mkdirSync(CONFIG_DIR, { recursive: true });
  writeFileSync(CONFIG_FILE, `${JSON.stringify(config, null, 2)}\n`, { mode: 0o600 });
  // writeFileSync's mode is ignored on an existing file (and on Windows); make
  // the permission explicit and never fatal.
  try {
    chmodSync(CONFIG_FILE, 0o600);
  } catch {
    /* best effort — Windows / restricted FS */
  }
}

/** Shallow-merge a patch into the existing config and persist it. */
export function saveConfig(patch: Partial<CliConfig>): CliConfig {
  const next = { ...loadConfig(), ...patch };
  writeConfig(next);
  return next;
}

/** Drop all auth/org state — used by `VelocityAI logout`. */
export function clearAuth(): void {
  const { apiUrl } = loadConfig();
  writeConfig(apiUrl ? { apiUrl } : {});
}

export { CONFIG_FILE };

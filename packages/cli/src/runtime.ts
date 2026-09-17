import type { Command } from "commander";

import { setActiveOrg } from "./auth-flow";
import { createClient, type VelocityAIClient, resolveApiUrl, resolveToken } from "./client";
import { CliError } from "./output";

export interface Runtime {
  json: boolean;
  apiUrl: string;
  token?: string;
  orgOverride?: string;
  client: VelocityAIClient;
}

/** Build per-invocation runtime from the root program's global options. */
export function runtime(program: Command): Runtime {
  const opts = program.opts<{ json?: boolean; api?: string; org?: string }>();
  const apiUrl = resolveApiUrl(opts.api);
  const token = resolveToken();
  return {
    json: Boolean(opts.json),
    apiUrl,
    token,
    orgOverride: opts.org,
    client: createClient({ apiUrl, token }),
  };
}

export function requireToken(rt: Runtime): string {
  if (!rt.token) {
    throw new CliError("You're not signed in. Run `velocityai login` first.");
  }
  return rt.token;
}

/**
 * Ensure org-scoped calls target the right org. If `--org` was passed, resolve
 * it against the user's memberships and make it the session's active org.
 * Without the flag we rely on the org persisted by `VelocityAI org use`.
 */
export async function ensureOrg(rt: Runtime): Promise<void> {
  if (!rt.orgOverride) return;
  const token = requireToken(rt);
  const orgs = await rt.client.org.list.query();
  const match = orgs.find((o) => o.slug === rt.orgOverride || o.id === rt.orgOverride);
  if (!match) {
    throw new CliError(`You're not a member of an organization matching "${rt.orgOverride}".`);
  }
  await setActiveOrg(rt.apiUrl, token, match.id);
}

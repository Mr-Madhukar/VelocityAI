import { spawn } from "node:child_process";

import { CliError } from "./output";

// Must match the server's `validateClient` in apps/web/lib/auth.ts.
export const CLI_CLIENT_ID = "VelocityAI-cli";

const DEVICE_GRANT = "urn:ietf:params:oauth:grant-type:device_code";

export interface DeviceCodeResponse {
  device_code: string;
  user_code: string;
  verification_uri: string;
  verification_uri_complete?: string;
  expires_in: number;
  interval: number;
}

function validateApiUrl(apiUrl: string): URL {
  let parsed: URL;
  try {
    parsed = new URL(apiUrl);
  } catch {
    throw new CliError(`Invalid API URL: "${apiUrl}".`);
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new CliError(`Invalid API URL protocol "${parsed.protocol}". Only HTTP and HTTPS are allowed.`);
  }
  return parsed;
}

function authEndpoint(apiUrl: string, path: string): string {
  const parsed = validateApiUrl(apiUrl);
  const base = `${parsed.origin}${parsed.pathname.replace(/\/$/, "")}/api/auth/`;
  return new URL(path.replace(/^\/+/, ""), base).toString();
}

/** Step 1 — ask the server for a device + user code (RFC 8628). */
export async function requestDeviceCode(apiUrl: string): Promise<DeviceCodeResponse> {
  const res = await fetch(authEndpoint(apiUrl, "device/code"), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ client_id: CLI_CLIENT_ID, scope: "cli" }),
  });

  if (!res.ok) {
    throw new CliError(`Couldn't start login (HTTP ${res.status}). Is ${apiUrl} reachable?`);
  }
  return (await res.json()) as DeviceCodeResponse;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Step 2 — poll `/device/token` until the user approves in the browser.
 * Returns the bearer token (the approved session token, via the bearer plugin).
 */
export async function pollForToken(
  apiUrl: string,
  deviceCode: string,
  intervalSeconds: number,
  expiresInSeconds: number,
): Promise<string> {
  const deadline = Date.now() + expiresInSeconds * 1000;
  let interval = Math.max(1, intervalSeconds);

  while (Date.now() < deadline) {
    await sleep(interval * 1000);

    const res = await fetch(authEndpoint(apiUrl, "device/token"), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        grant_type: DEVICE_GRANT,
        device_code: deviceCode,
        client_id: CLI_CLIENT_ID,
      }),
    });

    const data = (await res.json().catch(() => ({}))) as {
      access_token?: string;
      error?: string;
      error_description?: string;
    };

    if (res.ok) {
      const token = data.access_token ?? res.headers.get("set-auth-token") ?? undefined;
      if (token) return token;
    }

    switch (data.error) {
      case "authorization_pending":
        break; // keep waiting at the current interval
      case "slow_down":
        interval += 5;
        break;
      case "access_denied":
        throw new CliError("Login request was denied in the browser.");
      case "expired_token":
        throw new CliError("The login request expired. Run `VelocityAI login` again.");
      default:
        if (!res.ok) {
          throw new CliError(data.error_description ?? `Login failed (HTTP ${res.status}).`);
        }
    }
  }

  throw new CliError("Login timed out before it was approved.");
}

/** Persist the active org on the bearer session (BetterAuth organization plugin). */
export async function setActiveOrg(
  apiUrl: string,
  token: string,
  organizationId: string,
): Promise<void> {
  const res = await fetch(authEndpoint(apiUrl, "organization/set-active"), {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
    body: JSON.stringify({ organizationId }),
  });

  if (!res.ok) {
    throw new CliError(`Couldn't set the active organization (HTTP ${res.status}).`);
  }
}

export interface SessionInfo {
  user?: { id?: string; email?: string | null; name?: string | null } | null;
}

/** Fetch the signed-in user for `whoami`. Returns null if the token is invalid. */
export async function fetchSession(apiUrl: string, token: string): Promise<SessionInfo | null> {
  const res = await fetch(authEndpoint(apiUrl, "get-session"), {
    headers: { authorization: `Bearer ${token}` },
  });
  if (!res.ok) return null;
  return (await res.json().catch(() => null)) as SessionInfo | null;
}

/** Best-effort open of the system browser. Never throws — prints the URL instead. */
export function openBrowser(url: string): void {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return;
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return;
  }

  const safeUrl = parsed.toString();
  if (/[^a-zA-Z0-9-._~:/?#[\]@!$&'()*+,;=%]/.test(safeUrl)) {
    return;
  }

  let cmd = "xdg-open";
  let args = [safeUrl];

  if (process.platform === "win32") {
    cmd = "cmd.exe";
    args = ["/c", "start", '""', safeUrl.replaceAll("&", "^&")];
  } else if (process.platform === "darwin") {
    cmd = "open";
    args = ["--", safeUrl];
  }

  try {
    const child = spawn(cmd, args, { stdio: "ignore", detached: true, shell: false });
    child.on("error", () => {});
    child.unref();
  } catch {
    /* headless / no browser — the caller already printed the URL */
  }
}

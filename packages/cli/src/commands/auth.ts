import type { Command } from "commander";

import { fetchSession, openBrowser, pollForToken, requestDeviceCode, setActiveOrg } from "../auth-flow";
import { createClient } from "../client";
import { clearAuth, DEFAULT_API_URL, saveConfig } from "../config";
import { CliError, dim, info, printJson, success } from "../output";
import { requireToken, type Runtime } from "../runtime";

export function registerAuthCommands(program: Command, getRuntime: () => Runtime): void {
  program
    .command("login")
    .description("Sign in to VelocityAI from this terminal (device authorization).")
    .action(async () => {
      const rt = getRuntime();

      // Persist the API base only when it was chosen explicitly for this call
      // (--api flag or VelocityAI_API_URL). A previously stored URL must never be
      // re-persisted silently — that's how logins end up stuck on an old dev
      // deployment.
      const explicitApi = Boolean(program.opts<{ api?: string }>().api ?? process.env.VelocityAI_API_URL);
      if (explicitApi) saveConfig({ apiUrl: rt.apiUrl });

      const device = await requestDeviceCode(rt.apiUrl);
      const url = device.verification_uri_complete ?? device.verification_uri;

      if (rt.json) {
        printJson({ user_code: device.user_code, verification_uri: url, api: rt.apiUrl });
      } else {
        info("");
        info(`  Signing in to ${rt.apiUrl}`);
        if (rt.apiUrl !== DEFAULT_API_URL) {
          dim(`  (non-default deployment — reset with \`VelocityAI config unset-api\`)`);
        }
        info("");
        info(`  Open this URL to approve the login:\n    ${url}`);
        info(`  Your device code: ${device.user_code}`);
        info("");
        dim("  Waiting for approval in the browser…");
      }

      openBrowser(url);

      const token = await pollForToken(
        rt.apiUrl,
        device.device_code,
        device.interval,
        device.expires_in,
      );
      saveConfig({ token });

      // Convenience: if the user belongs to exactly one org, make it active now.
      // Rebuild the client so this call carries the freshly-issued token
      // (rt.client was created before login, with no token).
      const client = createClient({ apiUrl: rt.apiUrl, token });
      let activeOrg: string | null = null;
      try {
        const orgs = await client.org.list.query();
        if (orgs.length === 1) {
          await setActiveOrg(rt.apiUrl, token, orgs[0]!.id);
          saveConfig({ orgSlug: orgs[0]!.slug, orgId: orgs[0]!.id });
          activeOrg = orgs[0]!.slug;
        }
      } catch {
        // Non-fatal — the user can pick an org later with `VelocityAI org use`.
      }

      const session = await fetchSession(rt.apiUrl, token);
      const email = session?.user?.email ?? null;

      if (rt.json) {
        printJson({ ok: true, email, activeOrg });
      } else {
        success(`Signed in${email ? ` as ${email}` : ""}.`);
        if (activeOrg) {
          info(`  Active organization: ${activeOrg}`);
        } else {
          dim("  Select an organization with `VelocityAI org use <slug>`.");
        }
      }
    });

  program
    .command("logout")
    .description("Remove the stored credentials from this machine.")
    .action(() => {
      const rt = getRuntime();
      clearAuth();
      if (rt.json) printJson({ ok: true });
      else success("Signed out.");
    });

  program
    .command("whoami")
    .description("Show the currently signed-in user and active organization.")
    .action(async () => {
      const rt = getRuntime();
      const token = requireToken(rt);
      const session = await fetchSession(rt.apiUrl, token);
      if (!session?.user) {
        clearAuth();
        throw new CliError("Your session is no longer valid. Run `VelocityAI login` again.");
      }
      const current = await rt.client.org.current.query().catch(() => null);
      if (rt.json) {
        printJson({ user: session.user, org: current });
      } else {
        info(`User: ${session.user.email ?? session.user.name ?? "unknown"}`);
        info(`Org:  ${current ? `${current.name} (${current.slug})` : "— none selected"}`);
        info(`API:  ${rt.apiUrl}`);
      }
    });
}

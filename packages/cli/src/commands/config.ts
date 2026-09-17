import type { Command } from "commander";

import { CONFIG_FILE, DEFAULT_API_URL, loadConfig, saveConfig, writeConfig } from "../config";
import { CliError, dim, info, printJson, success } from "../output";
import type { Runtime } from "../runtime";

/** Where the effective API URL came from, for `config list`. */
function apiSource(): string {
  if (process.env.VelocityAI_API_URL) return "VelocityAI_API_URL env";
  if (loadConfig().apiUrl) return CONFIG_FILE;
  return "default";
}

export function registerConfigCommands(program: Command, getRuntime: () => Runtime): void {
  const config = program
    .command("config")
    .description("Inspect or change the CLI configuration (~/.VelocityAI/config.json).");

  config
    .command("list")
    .description("Show the stored configuration (token redacted).")
    .action(() => {
      const rt = getRuntime();
      const stored = loadConfig();
      const view = {
        apiUrl: rt.apiUrl,
        apiSource: apiSource(),
        org: stored.orgSlug ?? null,
        loggedIn: Boolean(stored.token ?? process.env.VelocityAI_TOKEN),
        file: CONFIG_FILE,
      };

      if (rt.json) return printJson(view);
      info(`API URL:   ${view.apiUrl}${view.apiUrl === DEFAULT_API_URL ? "" : "  (non-default)"}`);
      dim(`  source:  ${view.apiSource}`);
      info(`Org:       ${view.org ?? "— none selected"}`);
      info(`Signed in: ${view.loggedIn ? "yes" : "no"}`);
      dim(`File:      ${view.file}`);
    });

  config
    .command("set-api <url>")
    .description(`Pin the CLI to a deployment (default is ${DEFAULT_API_URL}).`)
    .action((url: string) => {
      const rt = getRuntime();
      let parsed: URL;
      try {
        parsed = new URL(url);
      } catch {
        throw new CliError(`"${url}" is not a valid URL. Example: https://VelocityAI.in`);
      }
      if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
        throw new CliError("The API URL must start with http:// or https://.");
      }

      const apiUrl = url.replace(/\/$/, "");
      saveConfig({ apiUrl });
      if (rt.json) return printJson({ ok: true, apiUrl });
      success(`API URL set to ${apiUrl}.`);
      dim("  Run `VelocityAI login` again if this points at a different deployment.");
    });

  config
    .command("unset-api")
    .description(`Remove the pinned API URL and go back to ${DEFAULT_API_URL}.`)
    .action(() => {
      const rt = getRuntime();
      const { apiUrl: _dropped, ...rest } = loadConfig();
      writeConfig(rest);
      if (rt.json) return printJson({ ok: true, apiUrl: DEFAULT_API_URL });
      success(`API URL reset to the default (${DEFAULT_API_URL}).`);
      dim("  Run `VelocityAI login` again if you were signed in to another deployment.");
    });

  config
    .command("path")
    .description("Print the location of the config file.")
    .action(() => {
      const rt = getRuntime();
      if (rt.json) return printJson({ file: CONFIG_FILE });
      info(CONFIG_FILE);
    });
}

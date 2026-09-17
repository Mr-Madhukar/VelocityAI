import type { Command } from "commander";

import { setActiveOrg } from "../auth-flow";
import { saveConfig } from "../config";
import { CliError, info, printJson, success, table } from "../output";
import { requireToken, type Runtime } from "../runtime";

export function registerOrgCommands(program: Command, getRuntime: () => Runtime): void {
  const org = program.command("org").description("Manage the active organization.");

  org
    .command("list")
    .description("List organizations you belong to.")
    .action(async () => {
      const rt = getRuntime();
      requireToken(rt);
      const [orgs, current] = await Promise.all([
        rt.client.org.list.query(),
        rt.client.org.current.query().catch(() => null),
      ]);

      if (rt.json) {
        printJson({ organizations: orgs, activeOrgId: current?.id ?? null });
        return;
      }
      if (orgs.length === 0) {
        info("You're not a member of any organization yet. Create one at the web app.");
        return;
      }
      info(
        table(
          ["", "NAME", "SLUG"],
          orgs.map((o) => [current?.id === o.id ? "*" : " ", o.name, o.slug]),
        ),
      );
    });

  org
    .command("use <slug>")
    .description("Set the active organization for subsequent commands.")
    .action(async (slug: string) => {
      const rt = getRuntime();
      const token = requireToken(rt);
      const orgs = await rt.client.org.list.query();
      const match = orgs.find((o) => o.slug === slug || o.id === slug);
      if (!match) {
        throw new CliError(`You're not a member of an organization matching "${slug}".`);
      }
      await setActiveOrg(rt.apiUrl, token, match.id);
      saveConfig({ orgSlug: match.slug, orgId: match.id });

      if (rt.json) printJson({ ok: true, org: match });
      else success(`Active organization set to ${match.name} (${match.slug}).`);
    });
}

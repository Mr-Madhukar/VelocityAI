import { writeFileSync } from "node:fs";
import { resolve } from "node:path";

import type { Command } from "commander";

import { CliError, dim, info, printJson, success } from "../output";
import { ensureOrg, requireToken, type Runtime } from "../runtime";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function prep(getRuntime: () => Runtime): Promise<Runtime> {
  const rt = getRuntime();
  requireToken(rt);
  await ensureOrg(rt);
  return rt;
}

export function registerPrdCommands(program: Command, getRuntime: () => Runtime): void {
  const prd = program.command("prd").description("Work with product requirement documents.");

  prd
    .command("show <featureId>")
    .description("Print the PRD for a feature.")
    .action(async (featureId: string) => {
      const rt = await prep(getRuntime);
      const doc = await rt.client.prd.byFeature.query({ featureId });
      if (!doc) throw new CliError("No PRD has been generated for this feature yet.");

      if (rt.json) return printJson(doc);
      if (doc.rawMarkdown) {
        info(doc.rawMarkdown);
        return;
      }
      info(`# ${doc.problem}\n`);
      info(`Goals:\n${doc.goals.map((g) => `  - ${g}`).join("\n")}`);
      info(`\nAcceptance criteria:\n${doc.acceptanceCriteria.map((c) => `  - ${c}`).join("\n")}`);
    });

  prd
    .command("generate <featureId>")
    .description("Trigger PRD generation (or regeneration) for a feature.")
    .action(async (featureId: string) => {
      const rt = await prep(getRuntime);
      const result = await rt.client.feature.triggerPrdGeneration.mutate({ featureId });
      if (rt.json) return printJson(result);
      success(result.regenerated ? "PRD regeneration triggered." : "PRD generation triggered.");
      dim("  Track progress with `VelocityAI feature show <id>`.");
    });

  prd
    .command("approve <featureId>")
    .description("Approve a feature's PRD (kicks off task generation).")
    .action(async (featureId: string) => {
      const rt = await prep(getRuntime);
      const doc = await rt.client.prd.byFeature.query({ featureId });
      if (!doc) throw new CliError("No PRD exists for this feature yet.");

      const result = await rt.client.prd.approve.mutate({ prdId: doc.id, featureId });
      if (rt.json) return printJson(result);
      success("PRD approved — engineering task generation was triggered.");
    });

  prd
    .command("download <featureId>")
    .description("Download the PRD as a PDF.")
    .option("-o, --output <file>", "Where to save the PDF (defaults to the server's filename).")
    .action(async (featureId: string, opts: { output?: string }) => {
      const rt = await prep(getRuntime);
      const token = requireToken(rt);

      const res = await fetch(`${rt.apiUrl}/api/features/${featureId}/prd-pdf`, {
        headers: { authorization: `Bearer ${token}` },
      });
      if (res.status === 404) throw new CliError("No PRD (or feature) found with that id.");
      if (!res.ok) throw new CliError(`Download failed (HTTP ${res.status}).`);

      const disposition = res.headers.get("content-disposition") ?? "";
      const serverName = disposition.match(/filename="?([^";]+)"?/)?.[1];
      const file = resolve(opts.output ?? serverName ?? `PRD-${featureId.slice(0, 8)}.pdf`);

      const bytes = Buffer.from(await res.arrayBuffer());
      writeFileSync(file, bytes);

      if (rt.json) return printJson({ ok: true, file, bytes: bytes.length });
      success(`Saved ${file} (${(bytes.length / 1024).toFixed(1)} kB).`);
    });

  prd
    .command("share <featureId>")
    .description("Email the PRD (with the PDF attached) to teammates or any email address.")
    .option("--to <email...>", "Recipient email address (repeatable).")
    .option("--message <message>", "A short note included in the email.")
    .action(async (featureId: string, opts: { to?: string[]; message?: string }) => {
      const rt = await prep(getRuntime);

      const emails = (opts.to ?? []).map((e) => e.trim().toLowerCase());
      if (emails.length === 0) {
        throw new CliError("Pass at least one recipient: VelocityAI prd share <id> --to name@company.com");
      }
      const invalid = emails.find((e) => !EMAIL_RE.test(e));
      if (invalid) throw new CliError(`"${invalid}" is not a valid email address.`);

      const doc = await rt.client.prd.byFeature.query({ featureId });
      if (!doc) throw new CliError("No PRD has been generated for this feature yet.");

      // Teammates get an in-app deep link; anyone else gets the PDF by email.
      const members = await rt.client.member.list.query().catch(() => []);
      const memberByEmail = new Map(members.map((m) => [m.email.toLowerCase(), m]));
      const recipientUserIds: string[] = [];
      const externalEmails: string[] = [];
      for (const email of new Set(emails)) {
        const member = memberByEmail.get(email);
        if (member?.emailVerified) recipientUserIds.push(member.userId);
        else externalEmails.push(email);
      }

      const result = await rt.client.prd.share.mutate({
        prdId: doc.id,
        featureId,
        recipientUserIds,
        externalEmails,
        message: opts.message,
      });

      if (rt.json) return printJson(result);
      success(`PRD sent to ${result.sent} recipient(s)${result.failed ? ` · ${result.failed} failed` : ""}.`);
    });
}

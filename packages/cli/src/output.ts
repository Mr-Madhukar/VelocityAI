import pc from "picocolors";

/** A user-facing error: its message is printed cleanly, no stack trace. */
export class CliError extends Error {}

export function printJson(data: unknown): void {
  process.stdout.write(`${JSON.stringify(data, null, 2)}\n`);
}

export function success(message: string): void {
  console.log(pc.green(`✔ ${message}`));
}

export function info(message: string): void {
  console.log(message);
}

export function dim(message: string): void {
  console.log(pc.dim(message));
}

/** Print an error (respecting --json) and exit non-zero. */
export function fail(err: unknown, json: boolean): never {
  const message = err instanceof Error ? err.message : String(err);
  if (json) {
    printJson({ ok: false, error: message });
  } else {
    console.error(pc.red(`✖ ${message}`));
  }
  process.exit(1);
}

const STATUS_COLORS: Record<string, (s: string) => string> = {
  passed: pc.green,
  approved: pc.green,
  shipped: pc.green,
  failed: pc.red,
  blocked: pc.red,
  running: pc.yellow,
  in_review: pc.yellow,
  prd_generating: pc.yellow,
  in_progress: pc.cyan,
};

export function colorStatus(status: string | null | undefined): string {
  if (!status) return pc.dim("—");
  const color = STATUS_COLORS[status] ?? ((s: string) => s);
  return color(status);
}

// Matches ANSI SGR color sequences (ESC [ ... m) so width math ignores them.
const ANSI = new RegExp(`${String.fromCharCode(27)}\\[[0-9;]*m`, "g");

export function stripAnsi(value: string): string {
  return value.replace(ANSI, "");
}

/** Render a left-aligned text table from rows of strings. */
export function table(headers: string[], rows: string[][]): string {
  const widths = headers.map((h, i) =>
    Math.max(stripAnsi(h).length, ...rows.map((r) => stripAnsi(r[i] ?? "").length)),
  );
  const line = (cells: string[]) =>
    cells
      .map((cell, i) => cell + " ".repeat(Math.max(0, widths[i]! - stripAnsi(cell).length)))
      .join("  ")
      .trimEnd();

  return [pc.bold(line(headers)), ...rows.map(line)].join("\n");
}

/** First 8 chars of a UUID — enough to eyeball / copy in a terminal list. */
export function shortId(id: string): string {
  return id.slice(0, 8);
}

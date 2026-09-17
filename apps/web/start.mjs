import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import path from "node:path";

const require = createRequire(import.meta.url);
const nextBin = path.join(path.dirname(require.resolve("next/package.json")), "dist/bin/next");

// Filter out stray "--" so Next.js doesn't treat "-p" as a directory name
const args = process.argv.slice(2).filter((arg) => arg !== "--");

const child = spawn(process.execPath, [nextBin, "start", ...args], {
  stdio: "inherit",
  env: process.env,
});

child.on("exit", (code) => {
  process.exit(code ?? 0);
});

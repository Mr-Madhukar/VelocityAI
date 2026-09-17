import { Command } from "commander";

import { registerAuthCommands } from "./commands/auth";
import { registerConfigCommands } from "./commands/config";
import { registerFeatureCommands } from "./commands/feature";
import { registerOrgCommands } from "./commands/org";
import { registerPrdCommands } from "./commands/prd";
import { registerPromptCommands } from "./commands/prompt";
import { registerReviewCommands } from "./commands/review";
import { registerTaskCommands } from "./commands/task";
import { registerWorkspaceCommands } from "./commands/workspace";
import { fail } from "./output";
import { runtime } from "./runtime";

// Bump in lockstep with package.json "version".
const VERSION = "0.3.0";

const program = new Command();

program
  .name("velocityai")
  .description("Drive your VelocityAI AI product delivery pipeline from the terminal.")
  .version(VERSION, "-v, --version")
  .showHelpAfterError()
  // Global options — place them before the subcommand, e.g. `VelocityAI --json feature list`.
  .option("--json", "Output machine-readable JSON instead of formatted text.")
  .option("--api <url>", "Override the VelocityAI API base URL (default https://VelocityAI.in).")
  .option("--org <slug>", "Run this command against a specific organization (slug or id).");

const getRuntime = () => runtime(program);

registerAuthCommands(program, getRuntime);
registerConfigCommands(program, getRuntime);
registerOrgCommands(program, getRuntime);
registerFeatureCommands(program, getRuntime);
registerPrdCommands(program, getRuntime);
registerPromptCommands(program, getRuntime);
registerTaskCommands(program, getRuntime);
registerReviewCommands(program, getRuntime);
registerWorkspaceCommands(program, getRuntime);

try {
  await program.parseAsync(process.argv);
} catch (err) {
  fail(err, Boolean(program.opts().json));
}

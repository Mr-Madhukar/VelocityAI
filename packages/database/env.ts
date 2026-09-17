import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().describe("DB URL"),
});

function createEnv(env: NodeJS.ProcessEnv) {
  const isBuildOrCi = Boolean(
    env.SKIP_ENV_VALIDATION ||
    env.CI ||
    process.env.NODE_ENV === "test" ||
    env.NEXT_PHASE === "phase-production-build" ||
    process.env.npm_lifecycle_event === "build"
  );
  if (isBuildOrCi && !env.DATABASE_URL) {
    return { DATABASE_URL: "postgresql://postgres:postgres@localhost:5432/velocityai_ci" };
  }
  const safeParseResult = envSchema.safeParse(env);
  if (!safeParseResult.success) throw new Error(safeParseResult.error.message);
  return safeParseResult.data;
}

export const env = createEnv(process.env);

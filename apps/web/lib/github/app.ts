import { App } from "octokit";

let app: App | null = null;

export function getGithubApp(): App {
  if (app) return app;
  
  const appId = process.env.GITHUB_APP_ID;
  // Normalize escaped \n (from .env file) to real newlines (from Vercel env vars)
  const privateKey = (process.env.GITHUB_APP_PRIVATE_KEY ?? "").replace(/\\n/g, "\n");
  const webhookSecret = process.env.GITHUB_WEBHOOK_SECRET;

  if (!appId || !privateKey) {
    throw new Error("Missing GitHub App configuration in environment variables");
  }

  app = new App({
    appId,
    privateKey,
    webhooks: {
      secret: webhookSecret || "development",
    },
  });

  return app;
}

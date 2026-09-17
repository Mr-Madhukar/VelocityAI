import { App } from "octokit";

export function getGitHubApp() {
  const appId = process.env.GITHUB_APP_ID;
  const privateKey = process.env.GITHUB_APP_PRIVATE_KEY?.replace(/\\n/g, "\n");
  const webhookSecret = process.env.GITHUB_WEBHOOK_SECRET;

  if (!appId || !privateKey || !webhookSecret) {
    throw new Error("GitHub App env vars are not configured");
  }

  return new App({
    appId,
    privateKey,
    webhooks: {
      secret: webhookSecret,
    },
  });
}

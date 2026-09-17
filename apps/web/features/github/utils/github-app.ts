import { App } from "octokit";

let githubApp: App | null = null;

export function getGithubApp() {
  if (!githubApp) {
    const appId = process.env.GITHUB_APP_ID;
    const privateKey = process.env.GITHUB_APP_PRIVATE_KEY?.replace(/\\n/g, "\n");
    const webhookSecret = process.env.GITHUB_WEBHOOK_SECRET;

    if (!appId || !privateKey || !webhookSecret) {
      throw new Error("GitHub App env vars are not configured");
    }

    githubApp = new App({
      appId,
      privateKey,
      webhooks: {
        secret: webhookSecret,
      },
    });
  }

  return githubApp;
}

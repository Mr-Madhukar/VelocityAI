import { App } from "octokit";

let app: App | null = null;

export function normalizePrivateKey(raw: string | undefined): string {
  if (!raw) return "";
  let key = raw.trim();

  // Strip wrapping quotes if passed as a quoted string in env
  if ((key.startsWith('"') && key.endsWith('"')) || (key.startsWith("'") && key.endsWith("'"))) {
    key = key.slice(1, -1);
  }

  // Convert literal escaped newlines to real newlines and strip carriage returns
  key = key.replace(/\\n/g, "\n").replace(/\r/g, "");

  const match = key.match(/(-----BEGIN[^-]+PRIVATE KEY-----[\s\S]+?-----END[^-]+PRIVATE KEY-----)/);
  if (match?.[1]) {
    key = match[1];
  }

  return key.trim() + "\n";
}

export function getGithubApp(): App {
  if (app) return app;
  
  const appId = process.env.GITHUB_APP_ID;
  const privateKey = normalizePrivateKey(process.env.GITHUB_APP_PRIVATE_KEY);
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

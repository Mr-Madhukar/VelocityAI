import { db } from "@repo/database";
import {
  accountsTable as accounts,
  deviceCodesTable as deviceCodes,
  invitations,
  members,
  organizations,
  sessionsTable as sessions,
  usersTable as users,
  verificationsTable as verifications,
} from "@repo/database/schema";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { bearer, deviceAuthorization, organization } from "better-auth/plugins";

const isDev = process.env["NODE_ENV"] === "development";
if (isDev) {
  process.env.BETTER_AUTH_URL = "http://localhost:3000";
}
const appUrl = isDev
  ? "http://localhost:3000"
  : (process.env.BETTER_AUTH_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000");

// Only the VelocityAI CLI may drive the device-authorization flow.
export const CLI_CLIENT_ID = "VelocityAI-cli";

const authSchema = {
  user: users,
  session: sessions,
  account: accounts,
  verification: verifications,
  organization: organizations,
  member: members,
  invitation: invitations,
  deviceCode: deviceCodes,
};

export const auth = betterAuth({
  appName: "VelocityAI",
  baseURL: appUrl,
  secret: process.env.BETTER_AUTH_SECRET,
  trustedOrigins: [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "https://my-ai-code-reviewer.onrender.com",
    process.env.BETTER_AUTH_URL,
    process.env.NEXT_PUBLIC_APP_URL,
  ].filter(Boolean) as string[],
  emailAndPassword: {
    enabled: true,
    autoSignIn: true,
  },
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: authSchema,
  }),
  socialProviders: {
    github: {
      clientId: process.env.GITHUB_CLIENT_ID ?? "",
      clientSecret: process.env.GITHUB_CLIENT_SECRET ?? "",
      mapProfileToUser: async (profile) => ({
        email: profile.email ?? `${profile.id}@users.noreply.github.com`,
        name: profile.name ?? profile.login,
        image: profile.avatar_url,
      }),
    },
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID ?? "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
    },
  },
  account: {
    accountLinking: {
      enabled: true,
      trustedProviders: ["github", "google"],
      // Local email/password sign-ups are never email-verified (there is no
      // verification flow), so without this the gate blocks linking when a user
      // who signed up with email/password later signs in with GitHub/Google on
      // the same email. We trust the IdP's verified email instead.
      requireLocalEmailVerified: false,
    },
  },
  plugins: [
    organization(),
    // Terminal CLI auth: OAuth 2.0 Device Authorization Grant (RFC 8628).
    // The CLI opens the browser to `verificationUri` where a signed-in user
    // approves the shown code; the CLI then polls `/device/token` for a token.
    deviceAuthorization({
      expiresIn: "30m",
      interval: "5s",
      verificationUri: `${appUrl}/device`,
      validateClient: (clientId) => clientId === CLI_CLIENT_ID,
      // The plugin's option validator marks `schema` as required (a Zod v4
      // quirk: a bare z.custom() rejects `undefined`), so pass an empty schema
      // override to keep the default model/field mapping.
      schema: {},
    }),
    // Lets the device-token session be sent as `Authorization: Bearer <token>`,
    // so `auth.api.getSession({ headers })` authenticates CLI requests with no
    // changes to the tRPC context.
    bearer(),
    nextCookies(),
  ],
});

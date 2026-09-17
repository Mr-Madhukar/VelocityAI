import { boolean, integer, text, timestamp } from "drizzle-orm/pg-core";
import { pgTable } from "drizzle-orm/pg-core";

export const usersTable = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  plan: text("plan").notNull().default("free"),
  razorpayCustomerId: text("razorpay_customer_id"),
  razorpaySubscriptionId: text("razorpay_subscription_id"),
  subscriptionStatus: text("subscription_status").notNull().default("inactive"),
  subscriptionRenewsAt: timestamp("subscription_renews_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const sessionsTable = pgTable("session", {
  id: text("id").primaryKey(),
  expiresAt: timestamp("expires_at").notNull(),
  token: text("token").notNull().unique(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  userId: text("user_id")
    .notNull()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  activeOrganizationId: text("active_organization_id"),
});

export const accountsTable = pgTable("account", {
  id: text("id").primaryKey(),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  userId: text("user_id")
    .notNull()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  accessTokenExpiresAt: timestamp("access_token_expires_at"),
  refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
  scope: text("scope"),
  password: text("password"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const verificationsTable = pgTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// BetterAuth `device-authorization` plugin model (RFC 8628 device grant).
// Backs the terminal CLI login flow. Field set must match the plugin's schema.
export const deviceCodesTable = pgTable("device_code", {
  id: text("id").primaryKey(),
  deviceCode: text("device_code").notNull(),
  userCode: text("user_code").notNull(),
  userId: text("user_id").references(() => usersTable.id, { onDelete: "cascade" }),
  expiresAt: timestamp("expires_at").notNull(),
  status: text("status").notNull(),
  lastPolledAt: timestamp("last_polled_at"),
  pollingInterval: integer("polling_interval"),
  clientId: text("client_id"),
  scope: text("scope"),
});

export type SelectUser = typeof usersTable.$inferSelect;
export type InsertUser = typeof usersTable.$inferInsert;

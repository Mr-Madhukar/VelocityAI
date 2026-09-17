import "dotenv/config";
import { drizzle } from "drizzle-orm/node-postgres";
import { env } from "./env";
import * as schema from "./schema";

let connectionString = env.DATABASE_URL;
if (connectionString.startsWith('DATABASE_URL=')) {
  connectionString = connectionString.replace('DATABASE_URL=', '').replace(/^["']|["']$/g, '');
}

export const db = drizzle(connectionString, { schema });
export * from "drizzle-orm";
export default db;
export type Database = typeof db;

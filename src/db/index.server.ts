import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

const databaseUrl = process.env["DATABASE_URL"];

if (!databaseUrl) {
  throw new Error("DATABASE_URL is not configured.");
}

const globalDatabase = globalThis as typeof globalThis & { arremataflowPool?: Pool };

export const pool = globalDatabase.arremataflowPool ?? new Pool({
  connectionString: databaseUrl,
  max: 10,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 10_000,
  ssl: process.env["DATABASE_SSL"] === "true" ? { rejectUnauthorized: true } : undefined,
});

if (process.env["NODE_ENV"] !== "production") globalDatabase.arremataflowPool = pool;

export const db = drizzle(pool, { schema });

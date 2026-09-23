import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

const databaseUrl = process.env["DATABASE_URL"];

if (!databaseUrl) {
  throw new Error("DATABASE_URL is not configured.");
}

const globalDatabase = globalThis as typeof globalThis & { arremataflowPool?: Pool };

export const pool =
  globalDatabase.arremataflowPool ??
  new Pool({
    connectionString: databaseUrl,
    max: 10,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
    ssl: process.env["DATABASE_SSL"] === "true" ? { rejectUnauthorized: true } : undefined,
  });

if (process.env["NODE_ENV"] !== "production") globalDatabase.arremataflowPool = pool;

if (process.env["NODE_ENV"] === "production") {
  let closing = false;
  const closePool = async () => {
    if (closing) return;
    closing = true;
    try {
      await pool.end();
    } catch (error) {
      console.error("Falha ao encerrar as conexões com o banco.", error);
    }
  };
  process.once("SIGTERM", () => void closePool());
  process.once("SIGINT", () => void closePool());
}

export const db = drizzle(pool, { schema });

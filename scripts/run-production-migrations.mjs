import { resolve } from "node:path";

import { migrate } from "drizzle-orm/node-postgres/migrator";
import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";

const { Pool } = pg;
const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is required before starting the application.");
}

const pool = new Pool({
  connectionString: databaseUrl,
  max: 2,
  connectionTimeoutMillis: 10_000,
  ssl: process.env.DATABASE_SSL === "true" ? { rejectUnauthorized: true } : undefined,
});

const lockName = "arremataflow:database-migrations";
const migrationsFolder = resolve(process.cwd(), "drizzle");
const maxAttempts = 30;

async function waitForDatabase() {
  let lastError;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      await pool.query("select 1");
      return;
    } catch (error) {
      lastError = error;
      if (attempt === maxAttempts) break;
      console.info(`Banco indisponível; nova tentativa ${attempt}/${maxAttempts}.`);
      await new Promise((resolveDelay) => setTimeout(resolveDelay, 2_000));
    }
  }
  throw lastError;
}

async function main() {
  await waitForDatabase();
  const lockClient = await pool.connect();
  try {
    await lockClient.query("set statement_timeout = '120s'");
    await lockClient.query("select pg_advisory_lock(hashtext($1))", [lockName]);
    console.info("Aplicando migrações pendentes do banco de dados.");
    await migrate(drizzle(pool), { migrationsFolder });
    console.info("Migrações do banco de dados concluídas.");
  } finally {
    try {
      await lockClient.query("select pg_advisory_unlock(hashtext($1))", [lockName]);
    } finally {
      lockClient.release();
      await pool.end();
    }
  }
}

main().catch((error) => {
  console.error("Não foi possível preparar o banco de dados.", error);
  process.exitCode = 1;
});

import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import pg from "pg";

const sql = await readFile(new URL("../drizzle/0013_active_organization.sql", import.meta.url), "utf8");
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const client = await pool.connect();
try {
  await client.query("begin");
  const exists = await client.query(`select 1 from information_schema.columns where table_schema='public' and table_name='users' and column_name='active_organization_id'`);
  if (!exists.rowCount) await client.query(sql);
  await client.query(`create schema if not exists drizzle`);
  await client.query(`create table if not exists drizzle.__drizzle_migrations (id serial primary key, hash text not null, created_at bigint)`);
  const hash = createHash("sha256").update(sql).digest("hex");
  await client.query(`insert into drizzle.__drizzle_migrations(hash, created_at) select $1, $2 where not exists (select 1 from drizzle.__drizzle_migrations where created_at=$2)`, [hash, 1789776000000]);
  await client.query("commit");
  console.log("Migração de empresa ativa aplicada com sucesso.");
} catch (error) {
  await client.query("rollback");
  throw error;
} finally {
  client.release();
  await pool.end();
}

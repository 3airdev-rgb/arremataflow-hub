import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
import { hashPassword } from "better-auth/crypto";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const env = await readFile(join(root, ".env"), "utf8");
for (const line of env.split(/\r?\n/)) {
  const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
  if (match && process.env[match[1]] === undefined) process.env[match[1]] = match[2];
}
if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL não configurada.");

async function readSecret() {
  if (!process.stdin.isTTY || !process.stdin.setRawMode)
    throw new Error("Execute em terminal interativo para informar a senha sem eco.");
  process.stdout.write("Senha inicial do Desenvolvedor: ");
  process.stdin.setRawMode(true);
  process.stdin.resume();
  try {
    return await new Promise((resolveSecret, reject) => {
      let value = "";
      function onData(chunk) {
        for (const character of chunk.toString("utf8")) {
          if (character === "\r" || character === "\n") {
            process.stdin.off("data", onData);
            process.stdout.write("\n");
            resolveSecret(value);
            return;
          }
          if (character === "\u0003") {
            process.stdin.off("data", onData);
            reject(new Error("Cancelado."));
            return;
          }
          if (character === "\u007f" || character === "\b") value = value.slice(0, -1);
          else value += character;
        }
      }
      process.stdin.on("data", onData);
    });
  } finally {
    process.stdin.setRawMode(false);
    process.stdin.pause();
  }
}

const password = await readSecret();
if (password.length < 12) throw new Error("A senha deve ter ao menos 12 caracteres.");
if (process.argv.includes("--verify-login")) {
  const baseURL = process.env.BETTER_AUTH_URL || "http://localhost:3000";
  const response = await fetch(new URL("/api/auth/sign-in/email", baseURL), {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: baseURL },
    body: JSON.stringify({ email: "master@arremataflow.com.br", password }),
  });
  if (!response.ok || !response.headers.get("set-cookie"))
    throw new Error(`Falha no login da conta master (HTTP ${response.status}).`);
  const cookie = response.headers
    .getSetCookie()
    .map((entry) => entry.split(";")[0])
    .join("; ");
  const sessionResponse = await fetch(new URL("/api/auth/get-session", baseURL), {
    headers: { Cookie: cookie },
  });
  const sessionData = await sessionResponse.json();
  if (sessionData?.user?.email !== "master@arremataflow.com.br")
    throw new Error("Login aceito, mas a sessão da conta master não persistiu.");
  const page = await fetch(new URL("/desenvolvedor", baseURL), {
    headers: { Cookie: cookie },
    redirect: "manual",
  });
  const pageHtml = await page.text();
  if (!page.ok || pageHtml.includes("Página não encontrada"))
    throw new Error(`Login aceito, mas o painel não abriu (HTTP ${page.status}).`);
  process.stdout.write("Login e acesso ao painel da conta master validados.\n");
  process.exit(0);
}
const hash = await hashPassword(password);
const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_SSL === "true" ? { rejectUnauthorized: true } : undefined,
});
const client = await pool.connect();
try {
  await client.query("begin");
  const email = "master@arremataflow.com.br";
  const existing = await client.query(
    "select id, system_role from users where lower(email) = $1 for update",
    [email],
  );
  if (existing.rowCount && existing.rows[0].system_role !== "developer")
    throw new Error("O e-mail já pertence a outro perfil; provisão recusada.");
  const id = existing.rows[0]?.id ?? randomUUID();
  if (!existing.rowCount)
    await client.query(
      "insert into users (id, name, email, email_verified, system_role) values ($1, $2, $3, true, 'developer')",
      [id, "Desenvolvedor ArremataFlow", email],
    );
  const account = await client.query(
    "select id from accounts where provider_id = 'credential' and user_id = $1",
    [id],
  );
  if (account.rowCount)
    throw new Error("Conta já provisionada; alteração de senha deve usar o fluxo de recuperação.");
  await client.query(
    "insert into accounts (id, account_id, provider_id, user_id, password) values ($1, $2, 'credential', $2, $3)",
    [randomUUID(), id, hash],
  );
  await client.query("commit");
  process.stdout.write("Conta do Desenvolvedor provisionada.\n");
} catch (error) {
  await client.query("rollback");
  throw error;
} finally {
  client.release();
  await pool.end();
}

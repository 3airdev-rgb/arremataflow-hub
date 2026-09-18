import { randomBytes, randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const projectDirectory = resolve(dirname(fileURLToPath(import.meta.url)), "..");

async function loadEnvironment() {
  const contents = await readFile(join(projectDirectory, ".env"), "utf8");
  for (const line of contents.split(/\r?\n/)) {
    const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (match && process.env[match[1]] === undefined) process.env[match[1]] = match[2];
  }
}

function argument(name) {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function requiredArgument(name) {
  const value = argument(name)?.trim();
  if (!value) throw new Error(`Informe --${name}.`);
  return value;
}

function escapeHtml(value) {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  })[character]);
}

async function deliverInvitation({ email, name, url }) {
  const subject = "Convite de administrador — ArremataFlow";
  const html = `<p>Olá, ${escapeHtml(name)}.</p><p>Você foi convidado para administrar o ArremataFlow.</p><p><a href="${escapeHtml(url)}">Criar minha senha</a></p><p>Este link é de uso único e expira em 30 minutos.</p>`;
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.AUTH_EMAIL_FROM;

  if (apiKey && from) {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to: email, subject, html }),
    });
    if (!response.ok) throw new Error(`Falha no envio do convite: HTTP ${response.status}.`);
    return { mode: "email" };
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error("RESEND_API_KEY e AUTH_EMAIL_FROM são obrigatórios em produção.");
  }

  const outboxDirectory = join(projectDirectory, ".local", "outbox");
  await mkdir(outboxDirectory, { recursive: true });
  const path = join(outboxDirectory, `convite-administrador-${Date.now()}.html`);
  await writeFile(path, `<!doctype html><meta charset="utf-8"><title>${subject}</title>${html}`, {
    encoding: "utf8",
    flag: "wx",
  });
  return { mode: "local", path };
}

await loadEnvironment();

const email = requiredArgument("email").toLowerCase();
const name = requiredArgument("name");
const organizationName = requiredArgument("organization");
const organizationSlug = requiredArgument("slug").toLowerCase();
const reissue = process.argv.includes("--reissue");

if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("E-mail inválido.");
if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(organizationSlug)) throw new Error("Slug inválido.");
if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL não configurada.");
if (!process.env.BETTER_AUTH_URL) throw new Error("BETTER_AUTH_URL não configurada.");

let userId = randomUUID();
let invitedName = name;
const token = randomBytes(32).toString("base64url");
const verificationId = randomUUID();
const expiresAt = new Date(Date.now() + 30 * 60 * 1000);
const resetCallback = new URL("/redefinir-senha", process.env.BETTER_AUTH_URL).toString();
const inviteUrl = new URL(`/api/auth/reset-password/${token}`, process.env.BETTER_AUTH_URL);
inviteUrl.searchParams.set("callbackURL", resetCallback);

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_SSL === "true" ? { rejectUnauthorized: true } : undefined,
});

const client = await pool.connect();
try {
  await client.query("begin");
  const existingUsers = await client.query("select count(*)::int as count from users");
  if (existingUsers.rows[0].count === 0) {
    if (reissue) throw new Error("Não há convite pendente para reemitir.");
    await client.query(
      "insert into users (id, name, email, email_verified) values ($1, $2, $3, false)",
      [userId, name, email],
    );
    const organization = await client.query(
      "insert into organizations (name, slug, created_by) values ($1, $2, $3) returning id",
      [organizationName, organizationSlug, userId],
    );
    await client.query(
      "insert into organization_members (organization_id, user_id, role, status) values ($1, $2, 'owner', 'invited')",
      [organization.rows[0].id, userId],
    );
  } else {
    if (!reissue || existingUsers.rows[0].count !== 1) {
      throw new Error("O bootstrap foi recusado porque o banco já possui usuário.");
    }
    const pendingAdmin = await client.query(
      `select u.id, u.name, u.email_verified, m.role, m.status, o.slug,
        (select count(*)::int from accounts a where a.user_id = u.id) as accounts
       from users u
       join organization_members m on m.user_id = u.id
       join organizations o on o.id = m.organization_id
       where lower(u.email) = lower($1)`,
      [email],
    );
    const current = pendingAdmin.rows[0];
    if (
      pendingAdmin.rowCount !== 1 ||
      current.email_verified ||
      current.role !== "owner" ||
      current.status !== "invited" ||
      current.slug !== organizationSlug ||
      current.accounts !== 0
    ) {
      throw new Error("A reemissão foi recusada porque o convite não está pendente ou não corresponde ao proprietário original.");
    }
    userId = current.id;
    invitedName = current.name;
    await client.query(
      "delete from verifications where value = $1 and identifier like $2",
      [userId, "reset-password:%"],
    );
  }
  await client.query(
    "insert into verifications (id, identifier, value, expires_at) values ($1, $2, $3, $4)",
    [verificationId, `reset-password:${token}`, userId, expiresAt],
  );
  await client.query("commit");
} catch (error) {
  await client.query("rollback");
  throw error;
} finally {
  client.release();
  await pool.end();
}

const delivery = await deliverInvitation({ email, name: invitedName, url: inviteUrl.toString() });
console.log(`Administrador convidado: ${email}`);
console.log(delivery.mode === "email" ? "Convite enviado por e-mail." : `Convite local salvo em: ${delivery.path}`);

import { randomBytes, randomUUID } from "node:crypto";
import pg from "pg";

const apply = process.argv.includes("--apply");
const organizationName = process.argv
  .find((value) => value.startsWith("--organization="))
  ?.slice(15);
if (!organizationName) throw new Error("Informe --organization=nome-da-empresa.");
const baseUrl = process.env.BETTER_AUTH_URL;
if (apply && !baseUrl) throw new Error("BETTER_AUTH_URL não configurado.");
if (apply && process.env.NODE_ENV === "production")
  throw new Error("Esta conciliação local não deve ser executada em produção.");

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const client = await pool.connect();
try {
  await client.query("begin");
  const [organization] = (
    await client.query("select id, name from organizations where name = $1 limit 1", [
      organizationName,
    ])
  ).rows;
  if (!organization) throw new Error("Empresa não encontrada.");
  await client.query("select pg_advisory_xact_lock(hashtext($1))", [organization.id]);
  const [administrator] = (
    await client.query(
      "select user_id from organization_members where organization_id = $1 and role in ('owner', 'admin') and status = 'active' order by case role when 'owner' then 0 else 1 end limit 1",
      [organization.id],
    )
  ).rows;
  if (!administrator) throw new Error("Administrador ativo não encontrado para auditoria.");
  const contacts = (
    await client.query(
      `select lower(trim(c.email)) as email, min(c.name) as name,
      bool_or(c.type = 'Assessor') as advisor,
      count(distinct c.id)::int as contacts,
      count(distinct pp.project_id)::int as projects
    from contacts c
    join project_participants pp on pp.contact_id = c.id
    join projects p on p.id = pp.project_id and p.organization_id = c.organization_id
    where c.organization_id = $1 and c.status = 'active'
      and c.type in ('Investidor', 'Assessor', 'Responsável')
      and pp.role in ('investor', 'advisor', 'responsible')
      and nullif(trim(c.email), '') is not null
    group by lower(trim(c.email)) order by lower(trim(c.email))`,
      [organization.id],
    )
  ).rows;
  const summary = [];
  for (const contact of contacts) {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact.email)) {
      summary.push({ email: contact.email, result: "invalid_email" });
      continue;
    }
    const [existingUser] = (
      await client.query("select id from users where lower(email) = $1 limit 1", [contact.email])
    ).rows;
    const [existingMembership] = existingUser
      ? (
          await client.query(
            "select id, role, status from organization_members where organization_id = $1 and user_id = $2 limit 1",
            [organization.id, existingUser.id],
          )
        ).rows
      : [];
    if (existingMembership) {
      summary.push({
        email: contact.email,
        result: "already_linked",
        role: existingMembership.role,
      });
      continue;
    }
    const role = contact.advisor ? "advisor" : "investor";
    if (!apply) {
      summary.push({
        email: contact.email,
        result: existingUser ? "link_existing" : "invite_new",
        role,
        contacts: contact.contacts,
        projects: contact.projects,
      });
      continue;
    }
    const userId = existingUser?.id ?? randomUUID();
    if (!existingUser)
      await client.query(
        "insert into users(id, name, email, email_verified) values($1, $2, $3, false)",
        [userId, contact.name, contact.email],
      );
    await client.query(
      "insert into organization_members(organization_id, user_id, role, status) values($1, $2, $3, $4)",
      [organization.id, userId, role, existingUser ? "active" : "invited"],
    );
    await client.query(
      "insert into audit_logs(organization_id, actor_id, action, entity_type, metadata) values($1, $2, $3, 'user', $4)",
      [
        organization.id,
        administrator.user_id,
        existingUser ? "user.linked" : "user.invited",
        { targetUserId: userId, role, source: "legacy_contact_backfill" },
      ],
    );
    if (existingUser) {
      summary.push({ email: contact.email, result: "linked_existing", role });
      continue;
    }
    const token = randomBytes(32).toString("base64url");
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000);
    await client.query(
      "insert into verifications(id, identifier, value, expires_at) values($1, $2, $3, $4)",
      [randomUUID(), `reset-password:${token}`, userId, expiresAt],
    );
    const invitationUrl = new URL(`/api/auth/reset-password/${token}`, baseUrl);
    invitationUrl.searchParams.set("callbackURL", new URL("/redefinir-senha", baseUrl).toString());
    summary.push({
      email: contact.email,
      result: "invited_new",
      role,
      invitationUrl: invitationUrl.toString(),
      expiresAt: expiresAt.toISOString(),
    });
  }
  if (apply) await client.query("commit");
  else await client.query("rollback");
  console.log(
    JSON.stringify({ organization: organization.name, applied: apply, summary }, null, 2),
  );
} catch (error) {
  await client.query("rollback");
  throw error;
} finally {
  client.release();
  await pool.end();
}

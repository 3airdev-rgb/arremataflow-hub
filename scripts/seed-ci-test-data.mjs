import pg from "pg";

const userId = "ci-test-user";
const organizationId = "00000000-0000-4000-8000-000000000001";
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const client = await pool.connect();

try {
  await client.query("begin");
  await client.query(
    `insert into users(id, name, email, email_verified, active_organization_id)
     values($1, 'Usuário de teste', 'ci-test@arremataflow.local', true, null)
     on conflict (id) do nothing`,
    [userId],
  );
  await client.query(
    `insert into organizations(id, name, slug, created_by)
     values($1, 'Empresa de teste', 'empresa-ci', $2)
     on conflict (id) do nothing`,
    [organizationId, userId],
  );
  await client.query(
    `insert into organization_members(organization_id, user_id, role, status)
     values($1, $2, 'owner', 'active')
     on conflict (organization_id, user_id) do update set role='owner', status='active'`,
    [organizationId, userId],
  );
  await client.query("update users set active_organization_id=$1 where id=$2", [organizationId, userId]);
  await client.query("commit");
  console.log("Dados mínimos de teste preparados.");
} catch (error) {
  await client.query("rollback");
  throw error;
} finally {
  client.release();
  await pool.end();
}

import pg from "pg";
import { randomUUID } from "node:crypto";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const client = await pool.connect();
try {
  await client.query("begin");
  const user = (await client.query("select id, active_organization_id from users limit 1")).rows[0];
  if (!user) throw new Error("Base de teste sem usuário.");
  const organizationId = randomUUID();
  await client.query("insert into organizations(id,name,slug,created_by) values($1,$2,$3,$4)", [
    organizationId,
    "Empresa de teste",
    `empresa-teste-${randomUUID()}`,
    user.id,
  ]);
  await client.query(
    "insert into organization_members(organization_id,user_id,role,status) values($1,$2,'admin','active')",
    [organizationId, user.id],
  );
  await client.query("update users set active_organization_id=$1 where id=$2", [
    organizationId,
    user.id,
  ]);
  const active = (
    await client.query(
      "select om.organization_id, om.role from users u join organization_members om on om.user_id=u.id and om.organization_id=u.active_organization_id and om.status='active' where u.id=$1",
      [user.id],
    )
  ).rows;
  if (
    active.length !== 1 ||
    active[0].organization_id !== organizationId ||
    active[0].role !== "admin"
  )
    throw new Error("A empresa ativa não foi isolada corretamente.");
  await client.query("rollback");
  console.log("Teste concluído: seleção e isolamento da empresa ativa íntegros.");
} catch (error) {
  await client.query("rollback");
  throw error;
} finally {
  client.release();
  await pool.end();
}

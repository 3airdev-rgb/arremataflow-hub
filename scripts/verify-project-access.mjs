import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import pg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "../src/db/schema.ts";
import {
  getProjectRole,
  requireProjectRole,
  highestProjectRole,
} from "../src/lib/project-access.server.ts";

assert.equal(highestProjectRole(["investor", "advisor", "project_manager"]), "project_manager");
assert.equal(highestProjectRole(["investor", "admin", "owner"]), "admin");
assert.equal(highestProjectRole([]), null);

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const client = await pool.connect();
try {
  await client.query("begin");
  const [organization] = (await client.query("select id from organizations limit 1")).rows;
  const [user] = (await client.query("select id from users limit 1")).rows;
  if (!organization || !user) throw new Error("Usuário ou empresa de teste ausente.");
  const email = `project-access-${randomUUID()}@example.test`;
  const project = async () =>
    (
      await client.query(
        "insert into projects(organization_id, code, name, address, created_by) values($1, $2, 'Teste acesso', 'Local', $3) returning id",
        [organization.id, `TEST-${randomUUID()}`, user.id],
      )
    ).rows[0].id;
  const contact = async (type) =>
    (
      await client.query(
        "insert into contacts(organization_id, type, name, document, email, created_by) values($1, $2, 'Pessoa teste', $3, $4, $5) returning id",
        [organization.id, type, randomUUID(), email, user.id],
      )
    ).rows[0].id;
  const first = await project();
  const second = await project();
  const investor = await contact("Investidor");
  const advisor = await contact("Assessor");
  const manager = await contact("Responsável");
  const link = async (projectId, contactId, role) =>
    client.query(
      "insert into project_participants(project_id, contact_id, role) values($1, $2, $3)",
      [projectId, contactId, role],
    );
  await link(first, investor, "investor");
  await link(first, advisor, "advisor");
  await link(first, manager, "responsible");
  await link(second, investor, "investor");
  const database = drizzle(client, { schema });
  const membership = { organizationId: organization.id, role: "project_manager" };
  assert.equal(await getProjectRole(database, schema, membership, email, first), "project_manager");
  assert.equal(await getProjectRole(database, schema, membership, email, second), "investor");
  assert.equal(
    await getProjectRole(
      database,
      schema,
      { ...membership, organizationId: randomUUID() },
      email,
      first,
    ),
    null,
  );
  await assert.rejects(
    requireProjectRole(database, schema, membership, email, second, "project_manager"),
  );
  await client.query(
    "delete from project_participants where project_id = $1 and role = 'responsible'",
    [first],
  );
  assert.equal(await getProjectRole(database, schema, membership, email, first), "advisor");
  await client.query("delete from project_participants where project_id = $1", [first]);
  assert.equal(await getProjectRole(database, schema, membership, email, first), null);
  assert.equal(
    await getProjectRole(database, schema, { ...membership, role: "admin" }, email, first),
    "admin",
  );
  await client.query("rollback");
  console.log(
    "Teste transacional concluído: prioridade, isolamento por projeto e revogação de vínculos íntegros.",
  );
} catch (error) {
  await client.query("rollback");
  throw error;
} finally {
  client.release();
  await pool.end();
}

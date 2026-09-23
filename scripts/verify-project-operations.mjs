import pg from "pg";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const client = await pool.connect();

try {
  await client.query("begin");
  const user = (await client.query("select id from users limit 1")).rows[0];
  const organization = (await client.query("select id from organizations limit 1")).rows[0];
  if (!user || !organization) throw new Error("Usuário ou empresa de teste ausente.");

  const project = (
    await client.query(
      "insert into projects(organization_id, code, name, address, created_by) values($1, 'TEST-OPS', 'Teste operações', 'Local', $2) returning id",
      [organization.id, user.id],
    )
  ).rows[0];
  await client.query(
    "insert into project_operational_data(organization_id, project_id, regularization, possession, updated_by) values($1, $2, $3, $4, $5)",
    [
      organization.id,
      project.id,
      { iptu_status: "Quitado", iptu_valor: 100 },
      { occupancy_status: "Desocupada" },
      user.id,
    ],
  );
  await client.query(
    "insert into judicial_actions(organization_id, project_id, scope, action_type, process_number, court, created_by) values($1, $2, 'regularization', 'Ação de Cobrança', '123', '1ª Vara', $3)",
    [organization.id, project.id, user.id],
  );
  const result = await client.query(
    "select count(*)::int as total from project_operational_data d join judicial_actions j on j.project_id = d.project_id where d.project_id = $1",
    [project.id],
  );
  if (result.rows[0].total !== 1) throw new Error("Falha de integridade entre os registros.");
  console.log("Teste transacional concluído: persistência e vínculos íntegros.");
  await client.query("rollback");
} catch (error) {
  await client.query("rollback");
  throw error;
} finally {
  client.release();
  await pool.end();
}

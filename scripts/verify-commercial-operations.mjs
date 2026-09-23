import pg from "pg";
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const client = await pool.connect();
try {
  await client.query("begin");
  const user = (await client.query("select id from users limit 1")).rows[0];
  const org = (await client.query("select id from organizations limit 1")).rows[0];
  if (!user || !org) throw new Error("Base de teste sem usuário ou empresa.");
  const project = (
    await client.query(
      "insert into projects(organization_id,code,name,address,created_by,data) values($1,'TEST-COM','Teste comercial','Local',$2,$3) returning id",
      [
        org.id,
        user.id,
        {
          valor_aquisicao: 100000,
          participantes: [{ nome: "Investidor", percentual: 100 }],
          assessores: [{ nome: "Assessor", percentual: 100 }],
        },
      ],
    )
  ).rows[0];
  const origin = (
    await client.query(
      "insert into sales_portfolio(organization_id,project_id,type,name,data,created_by) values($1,$2,'Corretor','Corretor Teste',$3,$4) returning id",
      [org.id, project.id, { commissionValue: 5000 }, user.id],
    )
  ).rows[0];
  await client.query(
    "insert into sales_proposals(organization_id,project_id,number,origin_id,status,data,created_by) values($1,$2,1,$3,'Aceita',$4,$5)",
    [org.id, project.id, origin.id, { finalSaleValue: 150000, taxValue: 5000 }, user.id],
  );
  await client.query("savepoint accepted_unique");
  let protectedAccepted = false;
  try {
    await client.query(
      "insert into sales_proposals(organization_id,project_id,number,status,data,created_by) values($1,$2,2,'Aceita',$3,$4)",
      [org.id, project.id, { finalSaleValue: 160000 }, user.id],
    );
  } catch {
    protectedAccepted = true;
    await client.query("rollback to savepoint accepted_unique");
  }
  if (!protectedAccepted) throw new Error("Mais de uma proposta aceita foi permitida.");
  const provider = (
    await client.query(
      "insert into service_providers(organization_id,document,name,data,created_by) values($1,'52998224725','Prestador Teste',$2,$3) returning id",
      [org.id, { specialty: "Pintura" }, user.id],
    )
  ).rows[0];
  await client.query(
    "insert into project_provider_assignments(organization_id,project_id,provider_id,data,created_by) values($1,$2,$3,$4,$5)",
    [
      org.id,
      project.id,
      provider.id,
      { responsibilities: ["Pintura"], approvedBudget: 1000 },
      user.id,
    ],
  );
  await client.query(
    "insert into distribution_snapshots(organization_id,project_id,data,calculated_by) values($1,$2,$3,$4)",
    [org.id, project.id, { result: 40000, advisoryShare: 20000, investorShare: 20000 }, user.id],
  );
  const result = await client.query(
    "select count(*)::int total from sales_portfolio p join sales_proposals s on s.origin_id=p.id join project_provider_assignments a on a.project_id=p.project_id join distribution_snapshots d on d.project_id=p.project_id where p.project_id=$1",
    [project.id],
  );
  if (result.rows[0].total !== 1) throw new Error("Vínculos comerciais inconsistentes.");
  console.log(
    "Teste transacional concluído: proposta, portfólio, prestador e distribuição íntegros.",
  );
  await client.query("rollback");
} catch (error) {
  await client.query("rollback");
  throw error;
} finally {
  client.release();
  await pool.end();
}

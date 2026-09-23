import { randomUUID } from "node:crypto";
import pg from "pg";

if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL não configurada.");
const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_SSL === "true" ? { rejectUnauthorized: true } : undefined,
});
const client = await pool.connect();
const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};
try {
  await client.query("begin");
  const developer = await client.query(
    "select u.id, a.password from users u join accounts a on a.user_id = u.id and a.provider_id = 'credential' where u.email = $1 and u.system_role = 'developer'",
    ["master@arremataflow.com.br"],
  );
  assert(
    developer.rowCount === 1 && developer.rows[0].password?.includes(":"),
    "Conta master sem credencial segura.",
  );
  const plans = await client.query("select id from plans order by id");
  assert(
    plans.rows.map((row) => row.id).join(",") === "custom,professional,starter",
    "Planos incompletos.",
  );
  const displayOrder = ["starter", "professional", "custom"];
  assert(
    [...plans.rows]
      .sort((a, b) => displayOrder.indexOf(a.id) - displayOrder.indexOf(b.id))
      .map((row) => row.id)
      .join(",") === "starter,professional,custom",
    "Ordem dos cards incorreta.",
  );
  await client.query(
    "update plans set monthly_price = 89.90, annual_price = 899.00 where id = 'starter'",
  );
  const savedPrices = await client.query(
    "select monthly_price, annual_price from plans where id = 'starter'",
  );
  assert(
    Number(savedPrices.rows[0].monthly_price) === 89.9 &&
      Number(savedPrices.rows[0].annual_price) === 899,
    "Preços mensal e anual não persistiram.",
  );
  const company = await client.query("select o.id, o.created_by from organizations o limit 1");
  assert(company.rowCount === 1, "Empresa de teste não encontrada.");
  const organizationId = company.rows[0].id;
  const currentProjectCount = await client.query(
    "select count(*)::int as total from projects where organization_id = $1 and status <> 'concluido'",
    [organizationId],
  );
  await client.query("update plans set max_active_projects = 0 where id = 'starter'");
  assert(currentProjectCount.rows[0].total >= 0, "Contagem de projetos inválida.");
  const before = await client.query(
    "select count(*)::int as total from projects where organization_id = $1",
    [organizationId],
  );
  await client.query(
    "update organization_plans set plan_id = 'starter' where organization_id = $1",
    [organizationId],
  );
  const after = await client.query(
    "select count(*)::int as total from projects where organization_id = $1",
    [organizationId],
  );
  assert(
    before.rows[0].total === after.rows[0].total,
    "Troca de plano alterou projetos existentes.",
  );
  await client.query(
    "insert into developer_audit_logs (actor_id, action, target_id, before, after) values ($1, 'organization.plan_assigned', $2, $3, $4)",
    [developer.rows[0].id, organizationId, { planId: "custom" }, { planId: "starter" }],
  );
  const audit = await client.query(
    "select count(*)::int as total from developer_audit_logs where target_id = $1 and action = 'organization.plan_assigned'",
    [organizationId],
  );
  assert(audit.rows[0].total > 0, "Auditoria do plano ausente.");

  const otherOrganization = await client.query(
    "insert into organizations (name, slug, created_by) values ('Empresa de teste', $1, $2) returning id",
    [`developer-test-${randomUUID()}`, company.rows[0].created_by],
  );
  const ticketId = randomUUID();
  const controlNumber = `AF-SUP-TEST-${randomUUID()}`;
  await client.query(
    `insert into support_tickets
    (id, organization_id, control_number, opened_by, subject, category, description, priority,
     first_response_due_at, resolution_due_at)
    values ($1,$2,$3,$4,'Teste de suporte','Geral','Descrição de teste para o chamado','normal',now()+interval '24 hours',now()+interval '72 hours')`,
    [ticketId, organizationId, controlNumber, company.rows[0].created_by],
  );
  const protocol = await client.query(
    "select count(*)::int as total from support_tickets where control_number = $1",
    [controlNumber],
  );
  assert(protocol.rows[0].total === 1, "Protocolo não é único.");
  await client.query(
    "insert into support_status_history (ticket_id, actor_id, to_status) values ($1,$2,'open')",
    [ticketId, company.rows[0].created_by],
  );
  await client.query(
    "insert into support_messages (ticket_id, author_id, body) values ($1,$2,'Abertura')",
    [ticketId, company.rows[0].created_by],
  );
  await client.query(
    "insert into support_messages (ticket_id, author_id, body) values ($1,$2,'Resposta do suporte')",
    [ticketId, developer.rows[0].id],
  );
  await client.query(
    "update support_tickets set status = 'resolved', assigned_to = $2, first_responded_at = now(), resolved_at = now() where id = $1",
    [ticketId, developer.rows[0].id],
  );
  await client.query(
    "insert into support_status_history (ticket_id, actor_id, from_status, to_status) values ($1,$2,'open','resolved')",
    [ticketId, developer.rows[0].id],
  );
  await client.query(
    "insert into support_attachments (ticket_id, storage_key, original_name, mime_type, size_bytes, uploaded_by) values ($1,$2,'teste.pdf','application/pdf',1024,$3)",
    [ticketId, `${organizationId}/support/${ticketId}/${randomUUID()}`, company.rows[0].created_by],
  );
  await client.query(
    "insert into notifications (organization_id, recipient_user_id, type, title, message, link) values ($1,$2,'support','Chamado atualizado','Resposta do suporte',$3)",
    [organizationId, company.rows[0].created_by, `/suporte?ticket=${ticketId}`],
  );
  const thread = await client.query(
    "select t.status, t.first_responded_at, t.resolved_at, count(m.id)::int as messages from support_tickets t join support_messages m on m.ticket_id = t.id where t.id = $1 group by t.id",
    [ticketId],
  );
  assert(
    thread.rows[0].status === "resolved" &&
      thread.rows[0].messages === 2 &&
      thread.rows[0].first_responded_at &&
      thread.rows[0].resolved_at,
    "Ciclo do chamado incompleto.",
  );
  const isolated = await client.query(
    "select count(*)::int as total from support_tickets where id = $1 and organization_id = $2",
    [ticketId, otherOrganization.rows[0].id],
  );
  assert(isolated.rows[0].total === 0, "Chamado visível para outra empresa.");
  const details = await client.query(
    "select (select count(*)::int from support_status_history where ticket_id=$1) as statuses, (select coalesce(sum(size_bytes),0)::int from support_attachments where ticket_id=$1) as attachment_bytes, (select count(*)::int from notifications where link=$2 and organization_id=$3 and recipient_user_id=$4) as notifications",
    [ticketId, `/suporte?ticket=${ticketId}`, organizationId, company.rows[0].created_by],
  );
  assert(
    details.rows[0].statuses === 2 &&
      details.rows[0].attachment_bytes === 1024 &&
      details.rows[0].notifications === 1,
    "Histórico, anexo ou notificação incompletos.",
  );
  const isolatedAttachments = await client.query(
    "select count(*)::int as total from support_attachments a join support_tickets t on t.id=a.ticket_id where a.ticket_id=$1 and t.organization_id=$2",
    [ticketId, otherOrganization.rows[0].id],
  );
  assert(isolatedAttachments.rows[0].total === 0, "Anexo visível para outra empresa.");
  await client.query(
    "update organization_plans set billing_cycle='monthly', subscription_amount=120 where organization_id=$1",
    [organizationId],
  );
  const revenue = await client.query(
    "select sum(case when billing_cycle='monthly' then subscription_amount else subscription_amount / 12 end)::numeric as mrr from organization_plans where organization_id=$1 and status='active'",
    [organizationId],
  );
  assert(
    Number(revenue.rows[0].mrr) === 120 && Number(revenue.rows[0].mrr) * 12 === 1440,
    "MRR ou ARR incorretos.",
  );
  await client.query(
    "update organization_plans set billing_cycle='annual', subscription_amount=1200 where organization_id=$1",
    [organizationId],
  );
  const annual = await client.query(
    "select subscription_amount / 12 as mrr from organization_plans where organization_id=$1",
    [organizationId],
  );
  assert(Number(annual.rows[0].mrr) === 100, "Rateio anual incorreto.");
  await client.query("rollback");
  process.stdout.write(
    "Teste transacional concluído: conta, planos, preservação de dados, auditoria, chamado e isolamento íntegros.\n",
  );
} catch (error) {
  await client.query("rollback");
  throw error;
} finally {
  client.release();
  await pool.end();
}

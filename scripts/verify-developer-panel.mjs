import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import pg from "pg";
import { createServer } from "vite";
import { signStripePayload } from "../src/lib/stripe-billing.ts";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL é obrigatório.");
process.env.STRIPE_WEBHOOK_SECRET = "whsec_verificacao";
delete process.env.STRIPE_SECRET_KEY;

const client = new pg.Client({ connectionString: databaseUrl });
await client.connect();
const { rows: developers } = await client.query(
  "select id from users where system_role = 'developer' limit 1",
);
if (!developers[0]) throw new Error("Nenhum usuário desenvolvedor encontrado.");
const developerId = developers[0].id;

const tempDir = await mkdtemp(path.join(tmpdir(), "developer-panel-verify-"));
const stubPath = path.join(tempDir, "developer-guard.ts").replaceAll("\\", "/");
await writeFile(
  stubPath,
  `export async function developer() { return { id: ${JSON.stringify(developerId)}, systemRole: "developer" }; }\n`,
);

const vite = await createServer({
  configFile: false,
  root: process.cwd(),
  logLevel: "error",
  appType: "custom",
  server: { middlewareMode: true, hmr: false, watch: null },
  resolve: {
    alias: [
      { find: "@/lib/developer.server", replacement: stubPath },
      { find: /^@\//, replacement: `${path.resolve("src").replaceAll("\\", "/")}/` },
    ],
  },
});

let checks = 0;
const ok = (message) => {
  checks += 1;
  console.log(`  ok ${checks}. ${message}`);
};

const suffix = randomBytes(3).toString("hex");
let organizationId = "";
const planIds = [];
try {
  const panel = await vite.ssrLoadModule("/src/lib/developer-panel.server.ts");
  const stripe = await vite.ssrLoadModule("/src/lib/stripe.server.ts");

  const created = await client.query(
    "insert into organizations (name, slug, created_by) values ($1, $2, $3) returning id",
    [`Empresa Teste Painel ${suffix}`, `teste-painel-${suffix}`, developerId],
  );
  organizationId = created.rows[0].id;

  // Dashboard
  const overview = await panel.getOverviewImpl({ rangeDays: 30 });
  assert.ok(overview.kpis.companies.total >= 1);
  assert.equal(overview.series.months.length, 6);
  assert.equal(overview.series.days.length, 30);
  assert.ok(overview.alerts.some((alert) => alert.id === `no-plan-${organizationId}`));
  ok("dashboard carrega indicadores, séries e o alerta de empresa sem plano");
  for (const range of [7, 90]) {
    const other = await panel.getOverviewImpl({ rangeDays: range });
    assert.equal(other.series.days.length, range);
  }
  ok("dashboard aceita os períodos de 7 e 90 dias");

  // Planos
  const overviewPlans = await panel.getPlansOverviewImpl();
  assert.deepEqual(
    overviewPlans.plans.slice(0, 3).map((plan) => plan.id),
    ["starter", "professional", "custom"],
  );
  const planInput = {
    name: `Plano Cliente ${suffix}`,
    description: "Condições combinadas",
    kind: "custom",
    ownerOrganizationId: organizationId,
    monthlyPrice: 199.9,
    annualPrice: 1999,
    maxActiveProjects: 3,
    maxInvestors: 4,
    maxAdvisors: 2,
    maxProjectManagers: 1,
    firstResponseHours: 12,
    resolutionHours: 48,
    menuItems: ["Projetos"],
    advisoryModalities: ["completa"],
    projectTabs: ["Visão Geral"],
    stripeMonthlyPriceId: "price_verifica_mensal",
    stripeAnnualPriceId: null,
  };
  const { id: planId } = await panel.createPlanImpl(planInput);
  planIds.push(planId);
  assert.match(planId, /^cliente-plano-cliente-/);
  await assert.rejects(
    () => panel.createPlanImpl({ ...planInput, kind: "standard" }),
    /exclusivos de uma empresa|personalizados/,
  );
  await panel.updatePlanImpl({
    ...planInput,
    id: planId,
    name: `Plano Cliente ${suffix} v2`,
    maxAdvisors: 3,
  });
  const afterUpdate = (await panel.getPlansOverviewImpl()).plans.find((plan) => plan.id === planId);
  assert.equal(afterUpdate.name, `Plano Cliente ${suffix} v2`);
  assert.equal(afterUpdate.maxAdvisors, 3);
  assert.equal(afterUpdate.ownerName, `Empresa Teste Painel ${suffix}`);
  assert.equal(afterUpdate.companyCount, 0);
  ok("plano personalizado é criado exclusivo de uma empresa, editado e listado");
  await assert.rejects(() => panel.setPlanActiveImpl({ id: "starter", active: false }), /padrão/);
  await assert.rejects(() => panel.deletePlanImpl({ id: "starter" }), /padrão/);
  ok("planos padrão não podem ser desativados nem excluídos");

  // Assinatura
  const subscription = {
    organizationId,
    planId,
    status: "trialing",
    billingCycle: "monthly",
    subscriptionAmount: 199.9,
    startsAt: "2026-09-01",
    endsAt: "2027-09-01",
    trialEndsAt: "2099-01-01",
    cancelAtPeriodEnd: false,
    stripeCustomerId: null,
    stripeSubscriptionId: null,
  };
  await panel.saveSubscriptionImpl(subscription);
  let finance = await panel.getFinanceImpl();
  let row = finance.subscriptions.find((item) => item.organizationId === organizationId);
  assert.equal(row.effectiveStatus, "trialing");
  assert.equal(row.planKind, "custom");
  assert.ok(finance.kpis.trialing >= 1);
  ok("assinatura em teste é salva e aparece no financeiro");
  await assert.rejects(
    () =>
      panel.saveSubscriptionImpl({ ...subscription, startsAt: "2027-01-01", endsAt: "2026-01-01" }),
    /posterior ao início/,
  );
  await assert.rejects(
    () => panel.saveSubscriptionImpl({ ...subscription, startsAt: "2026-02-30" }),
    /data válida/,
  );
  ok("datas inválidas ou incoerentes são recusadas");
  const foreign = await panel.createPlanImpl({
    ...planInput,
    name: `Outro Cliente ${suffix}`,
    ownerOrganizationId: null,
  });
  planIds.push(foreign.id);
  await client.query(
    "update plans set owner_organization_id = (select id from organizations where id <> $1 limit 1) where id = $2",
    [organizationId, foreign.id],
  );
  await assert.rejects(
    () => panel.saveSubscriptionImpl({ ...subscription, planId: foreign.id }),
    /exclusivo de outra empresa/,
  );
  ok("plano exclusivo de outra empresa não pode ser atribuído");
  await assert.rejects(
    () => panel.setPlanActiveImpl({ id: planId, active: false }),
    /empresas neste plano/,
  );
  await assert.rejects(() => panel.deletePlanImpl({ id: planId }), /empresas neste plano/);
  ok("plano em uso não pode ser desativado nem excluído");

  // Pagamentos manuais
  await panel.saveSubscriptionImpl({
    ...subscription,
    status: "active",
    trialEndsAt: null,
    endsAt: "2026-10-15",
  });
  await panel.recordPaymentImpl({
    organizationId,
    amount: 199.9,
    method: "pix",
    status: "paid",
    description: "PIX de teste",
    paidAt: "2026-10-10",
    renewSubscription: true,
  });
  finance = await panel.getFinanceImpl();
  row = finance.subscriptions.find((item) => item.organizationId === organizationId);
  assert.equal(row.endsAt.slice(0, 10), "2026-11-15");
  assert.equal(row.effectiveStatus, "active");
  assert.equal(row.totalPaid, 199.9);
  ok("pagamento manual renova a vigência em um ciclo a partir do vencimento");
  await panel.recordPaymentImpl({
    organizationId,
    amount: 50,
    method: "boleto",
    status: "pending",
    description: null,
    paidAt: null,
    renewSubscription: false,
  });
  const pending = (await panel.getFinanceImpl()).payments.find(
    (payment) => payment.organizationId === organizationId && payment.status === "pending",
  );
  await panel.setPaymentStatusImpl({ id: pending.id, status: "paid" });
  await panel.setPaymentStatusImpl({ id: pending.id, status: "refunded" });
  await assert.rejects(
    () => panel.setPaymentStatusImpl({ id: pending.id, status: "paid" }),
    /não é permitida/,
  );
  await assert.rejects(
    () =>
      panel.recordPaymentImpl({
        organizationId,
        amount: 10,
        method: "pix",
        status: "pending",
        description: null,
        paidAt: null,
        renewSubscription: true,
      }),
    /pagamento confirmado/,
  );
  ok("status de pagamento segue as transições permitidas");

  // Stripe
  const send = async (event, { sign = true } = {}) => {
    const payload = JSON.stringify(event);
    const headers = { "content-type": "application/json" };
    if (sign)
      headers["stripe-signature"] = signStripePayload(
        payload,
        "whsec_verificacao",
        Math.floor(Date.now() / 1000),
      );
    return stripe.handleStripeWebhook(
      new Request("http://localhost/api/stripe/webhook", {
        method: "POST",
        headers,
        body: payload,
      }),
    );
  };
  const state = async () =>
    (
      await client.query(
        "select status, ends_at, stripe_customer_id, stripe_subscription_id, cancel_at_period_end from organization_plans where organization_id = $1",
        [organizationId],
      )
    ).rows[0];
  const eventId = () => `evt_verify_${randomBytes(4).toString("hex")}`;
  const subId = `sub_verify_${suffix}`;
  const customerId = `cus_verify_${suffix}`;

  assert.equal(
    (await send({ id: eventId(), type: "invoice.paid", data: { object: {} } }, { sign: false }))
      .status,
    400,
  );
  const tampered = await stripe.handleStripeWebhook(
    new Request("http://localhost/api/stripe/webhook", {
      method: "POST",
      headers: { "stripe-signature": `t=${Math.floor(Date.now() / 1000)},v1=${"0".repeat(64)}` },
      body: "{}",
    }),
  );
  assert.equal(tampered.status, 400);
  ok("webhook recusa requisições sem assinatura ou com assinatura inválida");

  let response = await send({
    id: eventId(),
    type: "checkout.session.completed",
    data: {
      object: { client_reference_id: organizationId, customer: customerId, subscription: subId },
    },
  });
  assert.equal((await response.json()).outcome, "checkout-vinculado");
  assert.equal((await state()).stripe_subscription_id, subId);
  ok("checkout concluído vincula a empresa ao cliente e à assinatura da Stripe");

  const periodEnd = Math.floor(new Date("2027-01-10T00:00:00Z").getTime() / 1000);
  const paidEvent = {
    id: eventId(),
    type: "invoice.paid",
    data: {
      object: {
        id: `in_verify_${suffix}`,
        customer: customerId,
        subscription: subId,
        amount_paid: 19990,
        currency: "brl",
        payment_intent: "pi_verify",
        status_transitions: { paid_at: periodEnd - 86400 },
        lines: { data: [{ period: { start: periodEnd - 2592000, end: periodEnd } }] },
      },
    },
  };
  response = await send(paidEvent);
  assert.equal((await response.json()).outcome, "fatura-paga");
  assert.equal((await state()).ends_at.toISOString().slice(0, 10), "2027-01-10");
  let ledger = (
    await client.query(
      "select amount, source, status from billing_payments where stripe_invoice_id = $1",
      [`in_verify_${suffix}`],
    )
  ).rows;
  assert.deepEqual(
    ledger.map((entry) => [Number(entry.amount), entry.source, entry.status]),
    [[199.9, "stripe", "paid"]],
  );
  ok("fatura paga registra o pagamento e estende a vigência");

  response = await send(paidEvent);
  assert.equal((await response.json()).outcome, "duplicado");
  ledger = (
    await client.query("select 1 from billing_payments where stripe_invoice_id = $1", [
      `in_verify_${suffix}`,
    ])
  ).rows;
  assert.equal(ledger.length, 1);
  ok("reenvio do mesmo evento é ignorado (idempotência)");

  await send({
    id: eventId(),
    type: "invoice.payment_failed",
    data: {
      object: {
        id: `in_verify_fail_${suffix}`,
        customer: customerId,
        subscription: subId,
        amount_due: 19990,
        attempt_count: 1,
      },
    },
  });
  assert.equal((await state()).status, "past_due");
  ok("cobrança recusada coloca a assinatura em atraso e registra a falha");

  await send({
    id: eventId(),
    type: "customer.subscription.updated",
    data: {
      object: {
        id: subId,
        customer: customerId,
        status: "active",
        cancel_at_period_end: true,
        current_period_end: periodEnd,
        trial_end: null,
        items: {
          data: [
            {
              price: {
                id: "price_verifica_mensal",
                unit_amount: 19990,
                recurring: { interval: "month" },
              },
            },
          ],
        },
      },
    },
  });
  const afterUpdateState = await state();
  assert.equal(afterUpdateState.status, "active");
  assert.equal(afterUpdateState.cancel_at_period_end, true);
  const linkedPlan = (
    await client.query("select plan_id from organization_plans where organization_id = $1", [
      organizationId,
    ])
  ).rows[0].plan_id;
  assert.equal(linkedPlan, planId);
  ok("assinatura atualizada reativa, agenda o cancelamento e mantém o plano pelo ID de preço");

  await send({
    id: eventId(),
    type: "customer.subscription.deleted",
    data: { object: { id: subId, customer: customerId, status: "canceled" } },
  });
  assert.equal((await state()).status, "canceled");
  await send({
    id: eventId(),
    type: "invoice.paid",
    data: {
      object: {
        id: `in_verify_late_${suffix}`,
        customer: customerId,
        subscription: subId,
        amount_paid: 100,
      },
    },
  });
  assert.equal((await state()).status, "canceled");
  ok("assinatura cancelada não é reativada por fatura tardia");

  response = await send({
    id: eventId(),
    type: "invoice.paid",
    data: {
      object: {
        id: "in_desconhecida",
        customer: "cus_inexistente",
        subscription: "sub_inexistente",
        amount_paid: 100,
      },
    },
  });
  assert.equal(response.status, 200);
  assert.equal((await response.json()).outcome, "empresa-nao-encontrada");
  response = await send({
    id: eventId(),
    type: "charge.refunded",
    data: { object: { id: "ch_1" } },
  });
  assert.equal((await response.json()).outcome, "ignorado:charge.refunded");
  ok("eventos de empresas desconhecidas e de tipos não tratados respondem 200 sem efeito");

  await assert.rejects(
    () => stripe.createCheckoutLinkImpl({ organizationId, cycle: "annual" }),
    /preço da Stripe/,
  );
  const setup = stripe.stripeSetup();
  assert.equal(setup.secretKeyConfigured, false);
  assert.equal(setup.webhookSecretConfigured, true);
  ok(
    "link de pagamento exige o ID de preço da Stripe no plano e o status da integração é reportado",
  );

  // Help Desk
  const helpDesk = await panel.getHelpDeskImpl();
  assert.ok(Array.isArray(helpDesk.tickets));
  assert.ok(typeof helpDesk.kpis.open === "number");
  ok("help desk lista chamados com prazos e indicadores");

  // Interface: renderiza as quatro abas no servidor com os dados reais do banco
  await panel.saveSubscriptionImpl({
    ...subscription,
    planId: "starter",
    status: "past_due",
    trialEndsAt: null,
  });
  const { createElement } = await import("react");
  const { renderToString } = await import("react-dom/server");
  const { QueryClient, QueryClientProvider } = await import("@tanstack/react-query");
  const render = async (modulePath, exportName, props, seed) => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    for (const [key, value] of seed) queryClient.setQueryData(key, value);
    const module = await vite.ssrLoadModule(modulePath);
    return renderToString(
      createElement(
        QueryClientProvider,
        { client: queryClient },
        createElement(module[exportName], props),
      ),
    );
  };
  const finalOverview = await panel.getOverviewImpl({ rangeDays: 30 });
  const finalFinance = await panel.getFinanceImpl();
  const finalPlans = await panel.getPlansOverviewImpl();
  const finalHelpDesk = await panel.getHelpDeskImpl();
  const dashboardHtml = await render(
    "/src/components/developer/dashboard-tab.tsx",
    "DashboardTab",
    { onNavigate: () => {} },
    [[["developer-overview", 30], finalOverview]],
  );
  for (const text of [
    "Receita recorrente (MRR)",
    "Alertas e pendências",
    `Pagamento em atraso: Empresa Teste Painel ${suffix}`,
    "Uso dos limites dos planos",
    "Ao vivo",
  ])
    assert.ok(dashboardHtml.includes(text), `dashboard sem "${text}"`);
  const plansHtml = await render("/src/components/developer/plans-tab.tsx", "PlansTab", {}, [
    [["developer-plans"], finalPlans],
  ]);
  for (const text of [
    "Novo plano",
    "Starter",
    "Profissional",
    "Personalizado",
    `Plano Cliente ${suffix} v2`,
  ])
    assert.ok(plansHtml.includes(text), `planos sem "${text}"`);
  const financeHtml = await render(
    "/src/components/developer/finance-tab.tsx",
    "FinanceTab",
    { focus: organizationId },
    [[["developer-finance"], finalFinance]],
  );
  for (const text of [
    "Integração com a Stripe",
    "Clientes e assinaturas",
    `Empresa Teste Painel ${suffix}`,
    "Em atraso",
    "PIX de teste",
    "STRIPE_WEBHOOK_SECRET",
  ])
    assert.ok(financeHtml.includes(text), `financeiro sem "${text}"`);
  const helpDeskHtml = await render(
    "/src/components/developer/helpdesk-tab.tsx",
    "HelpDeskTab",
    {},
    [[["developer-helpdesk"], finalHelpDesk]],
  );
  for (const text of ["Chamados", "Prazos vencidos", "Selecione um chamado"])
    assert.ok(helpDeskHtml.includes(text), `help desk sem "${text}"`);
  ok("as quatro abas renderizam com os dados reais, sem erros de execução");

  // Remoção do plano depois de liberar a empresa
  await panel.saveSubscriptionImpl({
    ...subscription,
    planId: "starter",
    status: "active",
    trialEndsAt: null,
  });
  await panel.setPlanActiveImpl({ id: planId, active: false });
  await panel.setPlanActiveImpl({ id: planId, active: true });
  await panel.deletePlanImpl({ id: planId });
  planIds.splice(planIds.indexOf(planId), 1);
  ok("plano sem empresas pode ser desativado, reativado e excluído");
} finally {
  if (organizationId) {
    await client.query("delete from stripe_events where id like 'evt_verify_%'");
    await client.query(
      "delete from developer_audit_logs where target_id = $1 or target_id = any($2)",
      [organizationId, planIds],
    );
    await client.query("delete from organizations where id = $1", [organizationId]);
  }
  if (planIds.length) {
    await client.query("delete from developer_audit_logs where target_id = any($1)", [planIds]);
    await client.query("delete from plans where id = any($1)", [planIds]);
  }
  await client.query(
    "delete from developer_audit_logs where target_id like 'cliente-plano-cliente-%' or target_id like 'cliente-outro-cliente-%'",
  );
  const { pool } = await vite.ssrLoadModule("/src/db/index.server.ts");
  await pool.end();
  await vite.close();
  await rm(tempDir, { recursive: true, force: true });
  await client.end();
}
console.log(`\n${checks} verificações do painel do desenvolvedor concluídas.`);

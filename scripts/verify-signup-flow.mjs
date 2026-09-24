import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import pg from "pg";
import { createServer } from "vite";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL é obrigatório.");
delete process.env.STRIPE_SECRET_KEY;

const client = new pg.Client({ connectionString: databaseUrl });
await client.connect();

const tempDir = await mkdtemp(path.join(tmpdir(), "signup-flow-verify-"));
const posix = (file) => path.join(tempDir, file).replaceAll("\\", "/");
// Sessão e e-mail simulados: o teste controla quem está logado e registra os envios.
await writeFile(
  posix("auth-stub.ts"),
  `const state = (globalThis as any).__signupVerify ??= { userId: null, verifications: [], failMail: false };
export const auth = {
  api: {
    getSession: async () => (state.userId ? { user: { id: state.userId, email: state.email } } : null),
    sendVerificationEmail: async ({ body }: any) => {
      if (state.failMail) throw new Error("smtp indisponível");
      state.verifications.push(body);
    },
  },
  $context: Promise.resolve({ password: { hash: async (value: string) => "hash:" + value.length } }),
};
`,
);
await writeFile(
  posix("headers-stub.ts"),
  `export const getRequestHeaders = () => new Headers();\n`,
);

const vite = await createServer({
  configFile: false,
  root: process.cwd(),
  logLevel: "error",
  appType: "custom",
  server: { middlewareMode: true, hmr: false, watch: null },
  resolve: {
    alias: [
      { find: "@/lib/auth.server", replacement: posix("auth-stub.ts") },
      { find: "@tanstack/react-start/server", replacement: posix("headers-stub.ts") },
      { find: /^@\//, replacement: `${path.resolve("src").replaceAll("\\", "/")}/` },
    ],
  },
});

let checks = 0;
const ok = (message) => {
  checks += 1;
  console.log(`  ok ${checks}. ${message}`);
};

const state = (globalThis.__signupVerify = {
  userId: null,
  email: "",
  verifications: [],
  failMail: false,
});
const suffix = randomBytes(3).toString("hex");
const email = `novo-${suffix}@teste.arremataflow.invalid`;
let userId = null;
let organizationId = null;

const signup = (body, origin) =>
  new Request("http://localhost/api/signup", {
    method: "POST",
    headers: { "content-type": "application/json", ...(origin ? { origin } : {}) },
    body: JSON.stringify(body),
  });

try {
  const signupModule = await vite.ssrLoadModule("/src/lib/signup.server.ts");
  const onboarding = await vite.ssrLoadModule("/src/lib/onboarding.server.ts");
  const developer = await vite.ssrLoadModule("/src/lib/developer.server.ts");

  // Cadastro
  const invalid = await signupModule.registerAccount(
    signup({ name: "A", email: "x", password: "curta" }),
  );
  assert.equal(invalid.status, 400);
  const foreign = await signupModule.registerAccount(
    signup({ name: "Fulano", email, password: "senha-bem-longa-123" }, "https://outro.site"),
  );
  assert.equal(foreign.status, 403);
  ok("cadastro recusa dados inválidos e origem diferente");

  state.failMail = true;
  const failed = await signupModule.registerAccount(
    signup({ name: "Fulano de Tal", email, password: "senha-bem-longa-123" }),
  );
  assert.equal(failed.status, 503);
  const afterFailure = await client.query("select id from users where email = $1", [email]);
  assert.equal(afterFailure.rowCount, 0);
  ok("falha no envio do e-mail desfaz a criação da conta");

  state.failMail = false;
  const created = await signupModule.registerAccount(
    signup({ name: "Fulano de Tal", email: email.toUpperCase(), password: "senha-bem-longa-123" }),
  );
  assert.equal(created.status, 200);
  const user = (
    await client.query("select id, email_verified from users where email = $1", [email])
  ).rows[0];
  assert.ok(user, "usuário criado com e-mail em minúsculas");
  userId = user.id;
  assert.equal(user.email_verified, false);
  const account = (
    await client.query(
      "select provider_id, account_id, password from accounts where user_id = $1",
      [userId],
    )
  ).rows[0];
  assert.equal(account.provider_id, "credential");
  assert.equal(account.account_id, userId);
  assert.ok(account.password.startsWith("hash:"));
  assert.deepEqual(state.verifications.at(-1), {
    email,
    callbackURL: "/cadastro/empresa",
  });
  const members = await client.query("select 1 from organization_members where user_id = $1", [
    userId,
  ]);
  assert.equal(members.rowCount, 0);
  ok("cadastro cria usuário não confirmado, senha em hash e envia o link de confirmação");

  const before = state.verifications.length;
  const again = await signupModule.registerAccount(
    signup({ name: "Outro Nome", email, password: "outra-senha-longa-1" }),
  );
  assert.equal(again.status, 200);
  const count = await client.query("select count(*)::int as n from users where email = $1", [
    email,
  ]);
  assert.equal(count.rows[0].n, 1);
  assert.equal(state.verifications.length, before + 1);
  ok("e-mail repetido devolve a mesma resposta e reenvia a confirmação sem duplicar a conta");

  // Após confirmar o e-mail: empresa
  await client.query("update users set email_verified = true where id = $1", [userId]);
  state.userId = userId;
  state.email = email;
  assert.deepEqual(await onboarding.getAccessGateImpl(), { kind: "no_organization" });
  await assert.rejects(
    onboarding.createCompanyImpl({ name: "Empresa Nova", legalDocument: "11111111111" }),
    /CPF ou CNPJ/,
  );
  const company = await onboarding.createCompanyImpl({
    name: `Empresa Nova ${suffix}`,
    legalDocument: "",
  });
  organizationId = company.organizationId;
  const membership = (
    await client.query("select role, status from organization_members where user_id = $1", [userId])
  ).rows[0];
  assert.deepEqual(membership, { role: "owner", status: "active" });
  const subscription = (
    await client.query(
      "select plan_id, status, starts_at, ends_at, trial_ends_at from organization_plans where organization_id = $1",
      [organizationId],
    )
  ).rows[0];
  assert.equal(subscription.plan_id, "professional");
  assert.equal(subscription.status, "trialing");
  const days = Math.round((subscription.ends_at - subscription.starts_at) / 86_400_000);
  assert.equal(days, 14);
  assert.equal(subscription.trial_ends_at.getTime(), subscription.ends_at.getTime());
  await assert.rejects(
    onboarding.createCompanyImpl({ name: "Outra", legalDocument: "" }),
    /já está vinculada/,
  );
  ok("empresa criada com o usuário como administrador e teste de 14 dias do Profissional");

  let gate = await onboarding.getAccessGateImpl();
  assert.equal(gate.kind, "ok");
  assert.equal(gate.canManage, true);
  assert.equal(gate.status, "trialing");
  assert.ok(gate.daysLeft >= 13 && gate.daysLeft <= 14);
  await developer.enforcePlanLimit(organizationId, "maxActiveProjects", 0);
  ok("durante o teste o acesso é liberado e os limites do Profissional se aplicam");

  const catalog = await onboarding.getPlansCatalogImpl();
  assert.deepEqual(catalog.plans.map((plan) => plan.id).sort(), [
    "custom",
    "professional",
    "starter",
  ]);
  assert.equal(catalog.canManage, true);
  assert.equal(catalog.current.planId, "professional");
  await assert.rejects(
    onboarding.startCheckoutImpl({ planId: "starter", cycle: "monthly" }),
    /pagamento online ainda não está disponível/,
  );
  ok("página de planos lista os planos padrão e o checkout falha com mensagem clara sem a Stripe");

  // Vencimento e carência de 3 dias
  const setEnds = (interval) =>
    client.query(
      `update organization_plans set ends_at = now() - $2::interval, trial_ends_at = now() - $2::interval
       where organization_id = $1`,
      [organizationId, interval],
    );
  await setEnds("2 days");
  gate = await onboarding.getAccessGateImpl();
  assert.equal(gate.kind, "ok");
  assert.equal(gate.inGrace, true);
  await developer.enforcePlanLimit(organizationId, "maxActiveProjects", 0);
  ok("vencido há 2 dias: acesso mantido em carência");

  await setEnds("4 days");
  gate = await onboarding.getAccessGateImpl();
  assert.equal(gate.kind, "blocked");
  await assert.rejects(
    developer.enforcePlanLimit(organizationId, "maxActiveProjects", 0),
    /assinatura da empresa está inativa/,
  );
  await assert.rejects(
    developer.enforcePlanFeature(organizationId, "projectTabs", "Tarefas"),
    /assinatura da empresa está inativa/,
  );
  assert.equal(await developer.activePlanForOrganization(organizationId), null);
  const blockedCatalog = await onboarding.getPlansCatalogImpl();
  assert.equal(blockedCatalog.current.allowed, false);
  ok("vencido há 4 dias: acesso bloqueado no servidor e a página de planos continua acessível");

  await client.query(
    "update organization_plans set status = 'active', ends_at = now() + interval '30 days', trial_ends_at = null where organization_id = $1",
    [organizationId],
  );
  gate = await onboarding.getAccessGateImpl();
  assert.equal(gate.kind, "ok");
  await client.query(
    "update organization_plans set status = 'canceled' where organization_id = $1",
    [organizationId],
  );
  assert.equal((await onboarding.getAccessGateImpl()).kind, "blocked");
  ok("assinatura ativa libera o acesso; cancelada bloqueia na hora");

  // Convidado (não administrador) numa empresa bloqueada
  await client.query("update organization_members set role = 'investor' where user_id = $1", [
    userId,
  ]);
  gate = await onboarding.getAccessGateImpl();
  assert.equal(gate.kind, "blocked");
  assert.equal(gate.canManage, false);
  await assert.rejects(
    onboarding.startCheckoutImpl({ planId: "starter", cycle: "monthly" }),
    /Somente o administrador/,
  );
  ok("usuário convidado não administra a assinatura e não consegue contratar");

  console.log(`\n${checks} verificações concluídas.`);
} finally {
  if (organizationId)
    await client.query("delete from organizations where id = $1", [organizationId]);
  if (userId) await client.query("delete from users where id = $1", [userId]);
  await vite.close();
  await rm(tempDir, { recursive: true, force: true });
  const leftovers = await client.query(
    "select (select count(*) from users where email = $1)::int as users, (select count(*) from organizations where name like $2)::int as orgs",
    [email, `Empresa Nova ${suffix}%`],
  );
  console.log(`Resíduos após a limpeza: ${JSON.stringify(leftovers.rows[0])}`);
  await client.end();
}

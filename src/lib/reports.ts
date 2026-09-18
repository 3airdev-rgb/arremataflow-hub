import { createServerFn } from "@tanstack/react-start";
import { and, desc, eq, gte, inArray, lte, sql } from "drizzle-orm";
import { z } from "zod";

export const reportKeys = [
  "revenues", "expenses", "cash_flow", "invested_capital", "tasks", "active_projects",
  "completed_projects", "projects_by_status", "projects_by_modality", "audit", "financial_changes",
  "contracts", "documents", "users", "investors", "advisors", "projects",
] as const;

const input = z.object({
  reportKey: z.enum(reportKeys),
  projectId: z.string().uuid().nullable().default(null),
  status: z.enum(["active", "completed", "all"]).default("active"),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  format: z.enum(["view", "pdf", "csv"]),
}).refine((value) => value.startDate <= value.endDate, { message: "Período inválido." });

async function reportContext() {
  const [{ getRequestHeaders }, { auth }, { db }, schema] = await Promise.all([
    import("@tanstack/react-start/server"), import("@/lib/auth.server"), import("@/db/index.server"), import("@/db/schema"),
  ]);
  const session = await auth.api.getSession({ headers: getRequestHeaders() });
  if (!session) throw new Error("Não autenticado.");
  const { resolveActiveMembership } = await import("@/lib/active-organization.server");
  const membership = await resolveActiveMembership(db, schema, session.user.id);
  if (!membership) throw new Error("Empresa ativa não encontrada.");
  let projectIds: string[] | null = null;
  if (!["owner", "admin"].includes(membership.role)) {
    const role = membership.role === "advisor" ? "advisor" : "investor";
    const linked = await db.select({ projectId: schema.projectParticipants.projectId })
      .from(schema.projectParticipants)
      .innerJoin(schema.contacts, eq(schema.contacts.id, schema.projectParticipants.contactId))
      .innerJoin(schema.projects, eq(schema.projects.id, schema.projectParticipants.projectId))
      .where(and(eq(schema.projects.organizationId, membership.organizationId), eq(schema.projectParticipants.role, role), eq(schema.contacts.status, "active"), sql`lower(${schema.contacts.email}) = lower(${session.user.email})`));
    projectIds = [...new Set(linked.map((row) => row.projectId))];
  }
  return { db, schema, session, membership, projectIds };
}

const isCompleted = (status: string) => status === "concluido";
const matchesSituation = (project: { status: string }, status: "active" | "completed" | "all") => status === "all" || (status === "completed" ? isCompleted(project.status) : !isCompleted(project.status));
const money = (value: unknown) => Number(value || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const date = (value: Date | string | null) => value ? new Date(value).toLocaleDateString("pt-BR", { timeZone: "UTC" }) : "—";

export const listReportProjects = createServerFn({ method: "GET" }).handler(async () => {
  const ctx = await reportContext();
  if (ctx.projectIds?.length === 0) return [];
  return ctx.db.select({ id: ctx.schema.projects.id, code: ctx.schema.projects.code, name: ctx.schema.projects.name, status: ctx.schema.projects.status })
    .from(ctx.schema.projects).where(and(eq(ctx.schema.projects.organizationId, ctx.membership.organizationId), ctx.projectIds ? inArray(ctx.schema.projects.id, ctx.projectIds) : undefined)).orderBy(ctx.schema.projects.name);
});

export const generateReport = createServerFn({ method: "POST" }).validator(input).handler(async ({ data }) => {
  const ctx = await reportContext();
  if (ctx.projectIds?.length === 0) throw new Error("Nenhum projeto autorizado para este usuário.");
  if (data.projectId && ctx.projectIds && !ctx.projectIds.includes(data.projectId)) throw new Error("Projeto não autorizado.");
  const projects = await ctx.db.select().from(ctx.schema.projects).where(and(
    eq(ctx.schema.projects.organizationId, ctx.membership.organizationId),
    ctx.projectIds ? inArray(ctx.schema.projects.id, ctx.projectIds) : undefined,
    data.projectId ? eq(ctx.schema.projects.id, data.projectId) : undefined,
  ));
  const selected = projects.filter((project) => matchesSituation(project, data.status));
  const ids = selected.map((project) => project.id);
  const projectMap = new Map(selected.map((project) => [project.id, project]));
  const start = new Date(`${data.startDate}T00:00:00.000Z`), end = new Date(`${data.endDate}T23:59:59.999Z`);
  let columns: string[] = [], rows: Record<string, string | number>[] = [];
  const financialKeys = ["revenues", "expenses", "cash_flow"];

  if (financialKeys.includes(data.reportKey)) {
    const movements = ids.length ? await ctx.db.select().from(ctx.schema.financialMovements).where(and(inArray(ctx.schema.financialMovements.projectId, ids), gte(ctx.schema.financialMovements.movementDate, start), lte(ctx.schema.financialMovements.movementDate, end))) : [];
    const filtered = data.reportKey === "revenues" ? movements.filter((item) => item.type === "receita") : data.reportKey === "expenses" ? movements.filter((item) => item.type === "despesa") : movements;
    columns = ["Data", "Projeto", "Código", "Tipo", "Categoria", "Descrição", "Status", "Valor"];
    rows = filtered.map((item) => ({ Data: date(item.movementDate), Projeto: projectMap.get(item.projectId)?.name || "", Código: projectMap.get(item.projectId)?.code || "", Tipo: item.type, Categoria: item.category, Descrição: item.description, Status: item.status, Valor: money(item.amount) }));
  } else if (data.reportKey === "tasks") {
    const tasks = ids.length ? await ctx.db.select().from(ctx.schema.tasks).where(and(inArray(ctx.schema.tasks.projectId, ids), gte(ctx.schema.tasks.createdAt, start), lte(ctx.schema.tasks.createdAt, end))) : [];
    columns = ["Projeto", "Código", "Tarefa", "Categoria", "Prazo", "Status", "Reunião online"];
    rows = tasks.map((item) => ({ Projeto: projectMap.get(item.projectId)?.name || "", Código: projectMap.get(item.projectId)?.code || "", Tarefa: item.title, Categoria: item.category, Prazo: item.dueDate ? item.dueDate.split("-").reverse().join("/") : "—", Status: item.status, "Reunião online": item.isOnlineMeeting ? "Sim" : "Não" }));
  } else if (["audit", "financial_changes"].includes(data.reportKey)) {
    const logs = ids.length ? await ctx.db.select({ log: ctx.schema.auditLogs, userName: ctx.schema.users.name }).from(ctx.schema.auditLogs).innerJoin(ctx.schema.users, eq(ctx.schema.users.id, ctx.schema.auditLogs.actorId)).where(and(inArray(ctx.schema.auditLogs.projectId, ids), gte(ctx.schema.auditLogs.createdAt, start), lte(ctx.schema.auditLogs.createdAt, end), data.reportKey === "financial_changes" ? eq(ctx.schema.auditLogs.entityType, "financial_movement") : undefined)).orderBy(desc(ctx.schema.auditLogs.createdAt)) : [];
    columns = ["Data", "Projeto", "Código", "Usuário", "Ação", "Entidade"];
    rows = logs.map(({ log, userName }) => ({ Data: new Date(log.createdAt).toLocaleString("pt-BR"), Projeto: projectMap.get(log.projectId || "")?.name || "", Código: projectMap.get(log.projectId || "")?.code || "", Usuário: userName, Ação: log.action, Entidade: log.entityType }));
  } else if (["documents", "contracts"].includes(data.reportKey)) {
    const documents = ids.length ? await ctx.db.select().from(ctx.schema.documents).where(and(inArray(ctx.schema.documents.projectId, ids), gte(ctx.schema.documents.createdAt, start), lte(ctx.schema.documents.createdAt, end))) : [];
    const filtered = data.reportKey === "contracts" ? documents.filter((item) => /contrat|termo/i.test(`${item.category} ${item.displayName}`)) : documents;
    columns = ["Data", "Projeto", "Código", "Documento", "Categoria", "Versão", "Tamanho"];
    rows = filtered.map((item) => ({ Data: date(item.createdAt), Projeto: projectMap.get(item.projectId)?.name || "", Código: projectMap.get(item.projectId)?.code || "", Documento: item.displayName, Categoria: item.category, Versão: item.version, Tamanho: `${(item.sizeBytes / 1024).toFixed(1)} KB` }));
  } else if (["users", "investors", "advisors"].includes(data.reportKey)) {
    if (data.reportKey === "users") {
      const users = await ctx.db.select({ name: ctx.schema.users.name, email: ctx.schema.users.email, role: ctx.schema.organizationMembers.role, status: ctx.schema.organizationMembers.status }).from(ctx.schema.organizationMembers).innerJoin(ctx.schema.users, eq(ctx.schema.users.id, ctx.schema.organizationMembers.userId)).where(eq(ctx.schema.organizationMembers.organizationId, ctx.membership.organizationId));
      columns = ["Nome", "E-mail", "Perfil", "Status"]; rows = users.map((item) => ({ Nome: item.name, "E-mail": item.email, Perfil: item.role, Status: item.status }));
    } else {
      const type = data.reportKey === "investors" ? "investor" : "advisor";
      const contacts = await ctx.db.select().from(ctx.schema.contacts).where(and(eq(ctx.schema.contacts.organizationId, ctx.membership.organizationId), eq(ctx.schema.contacts.type, type)));
      columns = ["Nome", "Documento", "E-mail", "Status"]; rows = contacts.map((item) => ({ Nome: item.name, Documento: item.document, "E-mail": item.email, Status: item.status }));
    }
  } else if (data.reportKey === "invested_capital") {
    columns = ["Projeto", "Código", "Status", "Capital investido"];
    rows = selected.map((project) => ({ Projeto: project.name, Código: project.code, Status: project.status, "Capital investido": money((project.data as Record<string, unknown>)?.["capital_investido"] ?? (project.data as Record<string, unknown>)?.["valor_aquisicao"]) }));
  } else {
    const projectRows = data.reportKey === "active_projects" ? selected.filter((p) => !isCompleted(p.status)) : data.reportKey === "completed_projects" ? selected.filter((p) => isCompleted(p.status)) : selected;
    columns = ["Código", "Projeto", "Endereço", "Cidade", "Etapa", "Status", "Modalidade"];
    rows = projectRows.map((project) => ({ Código: project.code, Projeto: project.name, Endereço: project.address, Cidade: project.city, Etapa: project.stage, Status: project.status, Modalidade: String((project.data as Record<string, unknown>)?.["modalidade"] || project.stage) }));
  }

  await ctx.db.transaction(async (tx) => {
    await tx.insert(ctx.schema.reportRuns).values({ organizationId: ctx.membership.organizationId, generatedBy: ctx.session.user.id, reportKey: data.reportKey, format: data.format, filters: { projectId: data.projectId, status: data.status, startDate: data.startDate, endDate: data.endDate }, rowCount: rows.length });
    await tx.insert(ctx.schema.auditLogs).values({ organizationId: ctx.membership.organizationId, projectId: data.projectId, actorId: ctx.session.user.id, action: "report.generated", entityType: "report", metadata: { reportKey: data.reportKey, format: data.format, rowCount: rows.length } });
  });
  return { columns, rows, generatedAt: new Date().toISOString() };
});

export const listReportHistory = createServerFn({ method: "GET" }).handler(async () => {
  const ctx = await reportContext();
  return ctx.db.select({ id: ctx.schema.reportRuns.id, reportKey: ctx.schema.reportRuns.reportKey, format: ctx.schema.reportRuns.format, rowCount: ctx.schema.reportRuns.rowCount, generatedAt: ctx.schema.reportRuns.generatedAt, userName: ctx.schema.users.name })
    .from(ctx.schema.reportRuns).innerJoin(ctx.schema.users, eq(ctx.schema.users.id, ctx.schema.reportRuns.generatedBy))
    .where(eq(ctx.schema.reportRuns.organizationId, ctx.membership.organizationId)).orderBy(desc(ctx.schema.reportRuns.generatedAt)).limit(20);
});

import { createServerFn } from "@tanstack/react-start";
import { and, asc, desc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { validateDocument } from "@/lib/utils-validation";

export const COMMERCIAL_DATA_UPDATED = "arremataflow:commercial-data-updated";

const money = z.number().finite().min(0).max(999_999_999_999_999.99);
const optionalText = (max = 300) => z.string().trim().max(max).default("");
const dateText = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).or(z.literal(""));
const priceHistory = z.array(z.object({ changedAt: z.string().datetime(), previousValue: money, currentValue: money, percentageChange: z.number().finite() })).max(100);

const portfolioInput = z.object({
  id: z.string().uuid().optional(), projectId: z.string().uuid(), type: z.enum(["Corretor", "Imobiliária", "Site"]), name: z.string().trim().min(2).max(180),
  document: optionalText(18), creci: optionalText(60), address: optionalText(300), city: optionalText(120), state: optionalText(2), email: z.string().trim().email().or(z.literal("")), phone: optionalText(30),
  website: z.string().url().max(500).or(z.literal("")), advertisedValue: money, commissionPercentage: z.number().finite().min(0).max(100), commissionValue: money,
  advertisementDate: dateText, advertisementCost: money, priceHistory, isPropertyAvailable: z.boolean(),
});
const proposalInput = z.object({
  id: z.string().uuid().optional(), projectId: z.string().uuid(), originId: z.string().uuid().or(z.literal("outros")), originName: z.string().trim().min(2).max(180),
  otherName: optionalText(180), otherPhone: optionalText(30), value: money, counterofferValue: money.nullable(), taxValue: money,
  finalSaleValue: money.nullable(), condition: z.string().trim().min(2).max(100), observations: optionalText(3000), status: z.enum(["Em análise", "Contraproposta", "Recusada", "Aceita"]),
}).superRefine((value, ctx) => {
  if (value.status === "Contraproposta" && value.counterofferValue === null) ctx.addIssue({ code: "custom", message: "Informe o valor da contraproposta." });
  if (value.status === "Aceita" && (!value.finalSaleValue || value.finalSaleValue <= 0)) ctx.addIssue({ code: "custom", message: "Informe o valor final da venda." });
  if (value.originId === "outros" && (!value.otherName || !value.otherPhone)) ctx.addIssue({ code: "custom", message: "Informe nome e telefone da origem." });
});
const providerInput = z.object({
  projectId: z.string().uuid(), id: z.string().uuid().optional(), personType: z.enum(["PF", "PJ"]), name: z.string().trim().min(2).max(180), tradeName: optionalText(180), document: z.string().trim().min(11).max(18),
  phone: optionalText(30), email: z.string().trim().email().or(z.literal("")), address: optionalText(300), specialty: z.string().trim().min(2).max(180), professionalRegistry: optionalText(100), references: optionalText(2000),
  bank: optionalText(100), agency: optionalText(30), account: optionalText(40), pix: optionalText(180), issuesInvoice: z.boolean(),
});
const assignmentInput = z.object({
  id: z.string().uuid().optional(), projectId: z.string().uuid(), providerId: z.string().uuid(), responsibilities: z.array(z.string().trim().min(2).max(100)).min(1).max(30),
  startDate: dateText, expectedDelivery: dateText, approvedBudget: money, status: z.enum(["nao-iniciado", "iniciado", "em-andamento", "concluido", "atrasado"]),
}).refine((value) => !value.startDate || !value.expectedDelivery || value.expectedDelivery >= value.startDate, { message: "A entrega não pode ser anterior ao início." });

async function context(projectId: string, manager = false) {
  const [{ getRequestHeaders }, { auth }, { db }, schema] = await Promise.all([import("@tanstack/react-start/server"), import("@/lib/auth.server"), import("@/db/index.server"), import("@/db/schema")]);
  const session = await auth.api.getSession({ headers: getRequestHeaders() }); if (!session) throw new Error("Não autenticado.");
  const { resolveActiveMembership } = await import("@/lib/active-organization.server");
  const membership = await resolveActiveMembership(db, schema, session.user.id);
  if (!membership) throw new Error("Empresa ativa não encontrada.");
  if (manager && !["owner", "admin"].includes(membership.role)) throw new Error("Sem permissão para alterar este módulo.");
  const [project] = await db.select().from(schema.projects).where(and(eq(schema.projects.id, projectId), eq(schema.projects.organizationId, membership.organizationId))).limit(1);
  if (!project) throw new Error("Projeto não encontrado nesta empresa.");
  if (!["owner", "admin"].includes(membership.role)) {
    const role = membership.role === "advisor" ? "advisor" : "investor";
    const [access] = await db.select({ id: schema.projectParticipants.id }).from(schema.projectParticipants).innerJoin(schema.contacts, eq(schema.contacts.id, schema.projectParticipants.contactId)).where(and(eq(schema.projectParticipants.projectId, projectId), eq(schema.projectParticipants.role, role), eq(schema.contacts.organizationId, membership.organizationId), eq(schema.contacts.status, "active"), sql`lower(${schema.contacts.email})=lower(${session.user.email})`)).limit(1);
    if (!access) throw new Error("Projeto não vinculado ao usuário.");
  }
  return { db, schema, session, membership, project };
}

const portfolioRow = (row: any) => ({ id: row.id, type: row.type, name: row.name, ...row.data });
const proposalRow = (row: any) => { const details = row.data || {}; return ({ id: row.id, number: row.number, originId: details.originKey || row.originId || "outros", status: row.status, createdAt: row.createdAt.toISOString(), ...details, counterofferValue: details.counterofferValue ?? undefined, finalSaleValue: details.finalSaleValue ?? undefined }); };

export const getCommercialData = createServerFn({ method: "GET" }).validator(z.object({ projectId: z.string().uuid() })).handler(async ({ data }) => {
  const { db, schema, membership } = await context(data.projectId);
  const [portfolio, proposals, providers, assignments, distributions] = await Promise.all([
    db.select().from(schema.salesPortfolio).where(and(eq(schema.salesPortfolio.projectId, data.projectId), eq(schema.salesPortfolio.organizationId, membership.organizationId))).orderBy(desc(schema.salesPortfolio.updatedAt)),
    db.select().from(schema.salesProposals).where(and(eq(schema.salesProposals.projectId, data.projectId), eq(schema.salesProposals.organizationId, membership.organizationId))).orderBy(asc(schema.salesProposals.number)),
    db.select().from(schema.serviceProviders).where(and(eq(schema.serviceProviders.organizationId, membership.organizationId), eq(schema.serviceProviders.status, "active"))).orderBy(asc(schema.serviceProviders.name)),
    db.select().from(schema.projectProviderAssignments).where(and(eq(schema.projectProviderAssignments.projectId, data.projectId), eq(schema.projectProviderAssignments.organizationId, membership.organizationId))),
    db.select().from(schema.distributionSnapshots).where(and(eq(schema.distributionSnapshots.projectId, data.projectId), eq(schema.distributionSnapshots.organizationId, membership.organizationId))).orderBy(desc(schema.distributionSnapshots.calculatedAt)).limit(20),
  ]);
  return { portfolio: portfolio.map(portfolioRow), proposals: proposals.map(proposalRow), providers: providers.map((row) => ({ id: row.id, ...row.data })), assignments: assignments.map((row) => ({ id: row.id, providerId: row.providerId, ...row.data })), distributions: distributions.map((row) => ({ id: row.id, ...row.data, calculatedAt: row.calculatedAt.toISOString() })) };
});

export const savePortfolioEntry = createServerFn({ method: "POST" }).validator(portfolioInput).handler(async ({ data }) => {
  const { db, schema, session, membership } = await context(data.projectId, true);
  const { id, projectId, type, name, ...details } = data;
  if (data.document && !validateDocument(data.document)) throw new Error("CPF ou CNPJ inválido.");
  return db.transaction(async (tx) => {
    const [row] = id ? await tx.update(schema.salesPortfolio).set({ type, name, data: details, updatedAt: new Date() }).where(and(eq(schema.salesPortfolio.id, id), eq(schema.salesPortfolio.projectId, projectId), eq(schema.salesPortfolio.organizationId, membership.organizationId))).returning()
      : await tx.insert(schema.salesPortfolio).values({ organizationId: membership.organizationId, projectId, type, name, data: details, createdBy: session.user.id }).returning();
    if (!row) throw new Error("Cadastro do portfólio não encontrado.");
    await tx.insert(schema.auditLogs).values({ organizationId: membership.organizationId, projectId, actorId: session.user.id, action: id ? "sales_portfolio.updated" : "sales_portfolio.created", entityType: "sales_portfolio", entityId: row.id, metadata: { type, name } });
    return portfolioRow(row);
  });
});

export const deletePortfolioEntry = createServerFn({ method: "POST" }).validator(z.object({ projectId: z.string().uuid(), id: z.string().uuid() })).handler(async ({ data }) => {
  const { db, schema, session, membership } = await context(data.projectId, true);
  const [used] = await db.select({ id: schema.salesProposals.id }).from(schema.salesProposals).where(and(eq(schema.salesProposals.projectId, data.projectId), eq(schema.salesProposals.originId, data.id))).limit(1); if (used) throw new Error("Este cadastro é origem de uma proposta e não pode ser excluído.");
  return db.transaction(async (tx) => { const [row] = await tx.delete(schema.salesPortfolio).where(and(eq(schema.salesPortfolio.id, data.id), eq(schema.salesPortfolio.projectId, data.projectId), eq(schema.salesPortfolio.organizationId, membership.organizationId))).returning(); if (!row) throw new Error("Cadastro não encontrado."); await tx.insert(schema.auditLogs).values({ organizationId: membership.organizationId, projectId: data.projectId, actorId: session.user.id, action: "sales_portfolio.deleted", entityType: "sales_portfolio", entityId: row.id, metadata: { name: row.name } }); return { ok: true }; });
});

export const saveProposal = createServerFn({ method: "POST" }).validator(proposalInput).handler(async ({ data }) => {
  const { db, schema, session, membership } = await context(data.projectId, true); const { id, projectId, status, originId, ...details } = data;
  if (originId !== "outros") { const [origin] = await db.select({ id: schema.salesPortfolio.id }).from(schema.salesPortfolio).where(and(eq(schema.salesPortfolio.id, originId), eq(schema.salesPortfolio.projectId, projectId), eq(schema.salesPortfolio.organizationId, membership.organizationId))).limit(1); if (!origin) throw new Error("Origem da proposta inválida."); }
  return db.transaction(async (tx) => {
    if (status === "Aceita") await tx.update(schema.salesProposals).set({ status: "Recusada", updatedAt: new Date() }).where(and(eq(schema.salesProposals.projectId, projectId), eq(schema.salesProposals.status, "Aceita"), id ? sql`${schema.salesProposals.id} <> ${id}` : undefined));
    let row;
    if (id) [row] = await tx.update(schema.salesProposals).set({ originId: originId === "outros" ? null : originId, status, data: { ...details, originKey: originId }, updatedAt: new Date() }).where(and(eq(schema.salesProposals.id, id), eq(schema.salesProposals.projectId, projectId), eq(schema.salesProposals.organizationId, membership.organizationId))).returning();
    else { await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${projectId}))`); const [seq] = await tx.select({ next: sql<number>`coalesce(max(${schema.salesProposals.number}),0)+1` }).from(schema.salesProposals).where(eq(schema.salesProposals.projectId, projectId)); [row] = await tx.insert(schema.salesProposals).values({ organizationId: membership.organizationId, projectId, number: Number(seq?.next || 1), originId: originId === "outros" ? null : originId, status, data: { ...details, originKey: originId }, createdBy: session.user.id }).returning(); }
    if (!row) throw new Error("Proposta não encontrada."); await tx.insert(schema.auditLogs).values({ organizationId: membership.organizationId, projectId, actorId: session.user.id, action: id ? "sales_proposal.updated" : "sales_proposal.created", entityType: "sales_proposal", entityId: row.id, metadata: { number: row.number, status } }); return proposalRow(row);
  });
});

export const saveProvider = createServerFn({ method: "POST" }).validator(providerInput).handler(async ({ data }) => {
  const { db, schema, session, membership } = await context(data.projectId, true); const document = data.document.replace(/\D/g, ""); if (!validateDocument(document)) throw new Error("CPF ou CNPJ inválido."); const { projectId, id, ...details } = data;
  return db.transaction(async (tx) => {
    const [row] = id ? await tx.update(schema.serviceProviders).set({ name: data.name, document, data: { ...details, document }, updatedAt: new Date() }).where(and(eq(schema.serviceProviders.id, id), eq(schema.serviceProviders.organizationId, membership.organizationId))).returning()
      : await tx.insert(schema.serviceProviders).values({ organizationId: membership.organizationId, name: data.name, document, data: { ...details, document }, createdBy: session.user.id }).returning();
    if (!row) throw new Error("Prestador não encontrado."); await tx.insert(schema.auditLogs).values({ organizationId: membership.organizationId, projectId, actorId: session.user.id, action: id ? "service_provider.updated" : "service_provider.created", entityType: "service_provider", entityId: row.id, metadata: { name: row.name, specialty: data.specialty } }); return { id: row.id, ...row.data };
  });
});

export const saveProviderAssignment = createServerFn({ method: "POST" }).validator(assignmentInput).handler(async ({ data }) => {
  const { db, schema, session, membership } = await context(data.projectId, true); const [provider] = await db.select({ id: schema.serviceProviders.id }).from(schema.serviceProviders).where(and(eq(schema.serviceProviders.id, data.providerId), eq(schema.serviceProviders.organizationId, membership.organizationId), eq(schema.serviceProviders.status, "active"))).limit(1); if (!provider) throw new Error("Prestador inválido."); const { id, projectId, providerId, ...details } = data;
  return db.transaction(async (tx) => { const [row] = id ? await tx.update(schema.projectProviderAssignments).set({ data: details, updatedAt: new Date() }).where(and(eq(schema.projectProviderAssignments.id, id), eq(schema.projectProviderAssignments.projectId, projectId), eq(schema.projectProviderAssignments.organizationId, membership.organizationId))).returning() : await tx.insert(schema.projectProviderAssignments).values({ organizationId: membership.organizationId, projectId, providerId, data: details, createdBy: session.user.id }).returning(); if (!row) throw new Error("Vínculo não encontrado."); await tx.insert(schema.auditLogs).values({ organizationId: membership.organizationId, projectId, actorId: session.user.id, action: id ? "provider_assignment.updated" : "provider_assignment.created", entityType: "provider_assignment", entityId: row.id, metadata: { providerId, status: data.status } }); return { id: row.id, providerId: row.providerId, ...row.data }; });
});

const participant = (item: any) => ({ nome: String(item?.nome || ""), percentual: Number(item?.percentual) || 0 });
export const calculateDistribution = createServerFn({ method: "POST" }).validator(z.object({ projectId: z.string().uuid() })).handler(async ({ data }) => {
  const { db, schema, session, membership, project } = await context(data.projectId, true);
  const [accepted] = await db.select().from(schema.salesProposals).where(and(eq(schema.salesProposals.projectId, data.projectId), eq(schema.salesProposals.status, "Aceita"), eq(schema.salesProposals.organizationId, membership.organizationId))).limit(1); if (!accepted) throw new Error("É necessário possuir uma proposta aceita.");
  const proposal: any = accepted.data; const [origin] = accepted.originId ? await db.select().from(schema.salesPortfolio).where(eq(schema.salesPortfolio.id, accepted.originId)).limit(1) : [];
  const movements = await db.select().from(schema.financialMovements).where(and(eq(schema.financialMovements.projectId, data.projectId), eq(schema.financialMovements.organizationId, membership.organizationId)));
  const projectData: any = project.data || {}; const acquisition = Number(projectData.valor_aquisicao) || 0; const expenses = movements.filter((m) => m.type === "despesa").reduce((sum, m) => sum + Number(m.amount), 0); const investedCapital = acquisition + expenses;
  const result = Number(proposal.finalSaleValue) - Number(proposal.taxValue || 0) - Number((origin?.data as any)?.commissionValue || 0) - investedCapital; const advisoryShare = result * 0.5, investorShare = result * 0.5;
  const investors = (Array.isArray(projectData.participantes) ? projectData.participantes : []).map(participant).filter((p: any) => p.nome).map((p: any) => ({ ...p, valor: investorShare * p.percentual / 100 }));
  const assessors = (Array.isArray(projectData.assessores) ? projectData.assessores : []).map(participant).filter((p: any) => p.nome).map((p: any) => ({ ...p, valor: advisoryShare * p.percentual / 100 }));
  const snapshot = { result, advisoryShare, investorShare, investors, assessors, finalSaleValue: Number(proposal.finalSaleValue), taxValue: Number(proposal.taxValue || 0), commissionValue: Number((origin?.data as any)?.commissionValue || 0), investedCapital };
  const [created] = await db.transaction(async (tx) => { const rows = await tx.insert(schema.distributionSnapshots).values({ organizationId: membership.organizationId, projectId: data.projectId, data: snapshot, calculatedBy: session.user.id }).returning(); const row = rows[0]; if (!row) throw new Error("Não foi possível registrar a apuração."); await tx.insert(schema.auditLogs).values({ organizationId: membership.organizationId, projectId: data.projectId, actorId: session.user.id, action: "distribution.calculated", entityType: "distribution_snapshot", entityId: row.id, metadata: { result, acceptedProposalId: accepted.id } }); return rows; });
  if (!created) throw new Error("Não foi possível registrar a apuração.");
  return { id: created.id, ...snapshot, calculatedAt: created.calculatedAt.toISOString() };
});

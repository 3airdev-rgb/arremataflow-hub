import { createServerFn } from "@tanstack/react-start";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { z } from "zod";

const projectStatuses = ["atrasado", "pendente", "aguardando", "andamento", "nao_iniciado", "concluido"] as const;
const safeProjectData = z.record(z.unknown()).superRefine((value, ctx) => {
  const serialized = JSON.stringify(value);
  if (serialized.length > 1_000_000) ctx.addIssue({ code: "custom", message: "Os dados complementares do projeto excedem o limite permitido." });
  const inspect = (item: unknown, path: string[], depth: number) => {
    if (depth > 8) { ctx.addIssue({ code: "custom", message: "Estrutura de dados muito profunda.", path }); return; }
    if (Array.isArray(item)) { if (item.length > 500) ctx.addIssue({ code: "custom", message: "Lista muito extensa.", path }); item.forEach((child, index) => inspect(child, [...path, String(index)], depth + 1)); return; }
    if (!item || typeof item !== "object") return;
    for (const [key, child] of Object.entries(item as Record<string, unknown>)) {
      if (["__proto__", "prototype", "constructor"].includes(key)) ctx.addIssue({ code: "custom", message: "Campo inválido.", path: [...path, key] });
      if (typeof child === "number" && (!Number.isFinite(child) || (/valor|custo|preco|capital|honorario|comissao|percentual/i.test(key) && child < 0))) ctx.addIssue({ code: "custom", message: "Valor financeiro inválido.", path: [...path, key] });
      inspect(child, [...path, key], depth + 1);
    }
  };
  inspect(value, [], 0);
});

const projectInput = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(2).max(200),
  address: z.string().trim().min(2).max(300),
  city: z.string().trim().max(150).default(""),
  stage: z.string().trim().min(1).max(80),
  status: z.enum(projectStatuses),
  responsible: z.string().trim().max(160).default("Não atribuído"),
  mainImage: z.string().regex(/^\/api\/project-images\/[0-9a-f-]{36}$/i).nullable().optional(),
  data: safeProjectData,
  links: z.array(z.object({
    contactId: z.string().uuid(),
    role: z.enum(["investor", "advisor", "responsible", "auctioneer", "broker", "agency", "supplier"]),
    percentage: z.string().trim().regex(/^\d{1,3}([.,]\d{1,4})?$/, "Percentual inválido.").refine((value) => Number(value.replace(",", ".")) >= 0 && Number(value.replace(",", ".")) <= 100, "O percentual deve estar entre 0 e 100.").optional(),
  })).max(200).default([]),
});

async function context(requireManager = false) {
  const [{ getRequestHeaders }, { auth }, { db }, schema] = await Promise.all([
    import("@tanstack/react-start/server"), import("@/lib/auth.server"),
    import("@/db/index.server"), import("@/db/schema"),
  ]);
  const session = await auth.api.getSession({ headers: getRequestHeaders() });
  if (!session) throw new Error("Não autenticado.");
  const { resolveActiveMembership } = await import("@/lib/active-organization.server");
  const membership = await resolveActiveMembership(db, schema, session.user.id);
  if (!membership) throw new Error("Empresa ativa não encontrada.");
  if (requireManager && !["owner", "admin"].includes(membership.role)) {
    throw new Error("Sem permissão para alterar projetos.");
  }
  return { db, schema, session, membership };
}

const normalize = (project: any) => {
  const data = project.data || {};
  const assessors = Array.isArray(data.assessores)
    ? data.assessores.map((item: any) => typeof item === "string" ? item : item?.nome).filter(Boolean)
    : [];
  return ({
  ...data,
  id: project.id,
  codigo: project.code,
  nome: project.name,
  endereco: project.address,
  cidade: project.city,
  etapa: project.stage,
  status: project.status,
  responsavel: project.responsible,
  foto: project.mainImage,
  modalidade: data.modalidade || project.stage,
  valorAquisicao: Number(data.valor_aquisicao) || 0,
  honorarios: Number(data.valor_honorarios) || 0,
  capitalInvestido: Number(data.capital_investido ?? data.capitalInvestido ?? data.valor_aquisicao) || 0,
  resultadoProjetado: Number(data.resultado_projetado ?? data.resultadoProjetado) || 0,
  progresso: Number(data.progresso) || 0,
  investidores: Array.isArray(data.investidores) ? data.investidores : [],
  assessores: assessors,
  updated_at: project.updatedAt.toISOString(),
  });
};

async function linkedProjectIds(ctx: Awaited<ReturnType<typeof context>>, participantRole?: "investor" | "advisor") {
  if (["owner", "admin"].includes(ctx.membership.role)) return null;
  const role = participantRole || (ctx.membership.role === "advisor" ? "advisor" : "investor");
  const rows = await ctx.db.select({ projectId: ctx.schema.projectParticipants.projectId })
    .from(ctx.schema.projectParticipants)
    .innerJoin(ctx.schema.contacts, eq(ctx.schema.contacts.id, ctx.schema.projectParticipants.contactId))
    .innerJoin(ctx.schema.projects, eq(ctx.schema.projects.id, ctx.schema.projectParticipants.projectId))
    .where(and(
      eq(ctx.schema.projects.organizationId, ctx.membership.organizationId),
      eq(ctx.schema.projectParticipants.role, role),
      sql`lower(${ctx.schema.contacts.email}) = lower(${ctx.session.user.email})`,
      eq(ctx.schema.contacts.status, "active"),
    ));
  return rows.map((row) => row.projectId);
}

export const listProjects = createServerFn({ method: "GET" }).handler(async () => {
  const ctx = await context();
  const { db, schema, membership } = ctx;
  const allowedIds = await linkedProjectIds(ctx);
  if (allowedIds?.length === 0) return [];
  const rows = await db.select().from(schema.projects)
    .where(and(
      eq(schema.projects.organizationId, membership.organizationId),
      allowedIds ? inArray(schema.projects.id, allowedIds) : undefined,
    ))
    .orderBy(desc(schema.projects.updatedAt));
  return rows.map(normalize);
});

export const getProject = createServerFn({ method: "GET" })
  .validator(z.object({ id: z.string().uuid() }))
  .handler(async ({ data }) => {
    const ctx = await context();
    const { db, schema, membership } = ctx;
    const allowedIds = await linkedProjectIds(ctx);
    if (allowedIds && !allowedIds.includes(data.id)) return null;
    const [row] = await db.select().from(schema.projects).where(and(
      eq(schema.projects.id, data.id),
      eq(schema.projects.organizationId, membership.organizationId),
    )).limit(1);
    if (!row) return null;
    const images = await db.select().from(schema.projectImages).where(and(
      eq(schema.projectImages.projectId, row.id), eq(schema.projectImages.organizationId, membership.organizationId),
    )).orderBy(schema.projectImages.displayOrder);
    const projectImages = images.map((image) => ({ id: image.id, url: `/api/project-images/${image.id}`, file_path: image.storageKey, file_name: image.originalName, is_main: image.isMain, display_order: image.displayOrder }));
    return { ...normalize(row), fotos: projectImages.map((image) => image.url), projectImages };
  });

export const listParticipantProjects = createServerFn({ method: "GET" })
  .validator(z.object({ role: z.enum(["investor", "advisor"]) }))
  .handler(async ({ data }) => {
    const ctx = await context();
    const { db, schema, membership, session } = ctx;
    const isManager = ["owner", "admin"].includes(membership.role);
    const base = await db.select({
      project: schema.projects,
      percentage: schema.projectParticipants.percentage,
      contactName: schema.contacts.name,
      contactEmail: schema.contacts.email,
    }).from(schema.projects)
      .leftJoin(schema.projectParticipants, and(
        eq(schema.projectParticipants.projectId, schema.projects.id),
        eq(schema.projectParticipants.role, data.role),
      ))
      .leftJoin(schema.contacts, eq(schema.contacts.id, schema.projectParticipants.contactId))
      .where(and(
        eq(schema.projects.organizationId, membership.organizationId),
        isManager ? undefined : sql`lower(${schema.contacts.email}) = lower(${session.user.email})`,
      ))
      .orderBy(desc(schema.projects.updatedAt));

    const seen = new Set<string>();
    return base.filter((row) => {
      if (seen.has(row.project.id)) return false;
      seen.add(row.project.id);
      return true;
    }).map((row) => ({
      ...normalize(row.project),
      participationPercentage: row.percentage ? Number(row.percentage) : null,
      participantName: row.contactName || session.user.name,
    }));
  });

export const saveProject = createServerFn({ method: "POST" })
  .validator(projectInput)
  .handler(async ({ data }) => {
    const { db, schema, session, membership } = await context(true);
    const { foto: _legacyPhoto, fotos: _legacyPhotos, projectImages: _legacyImages, ...cleanProjectData } = data.data;
    const uniqueContactIds = [...new Set(data.links.map((link) => link.contactId))];
    for (const role of ["investor", "advisor"] as const) {
      const total = data.links.filter((link) => link.role === role).reduce((sum, link) => sum + Number((link.percentage || "0").replace(",", ".")), 0);
      if (total > 100.0001) throw new Error(`A soma dos percentuais de ${role === "investor" ? "investidores" : "assessores"} não pode ultrapassar 100%.`);
    }
    if (uniqueContactIds.length) {
      const allowedContacts = await db.select({ id: schema.contacts.id }).from(schema.contacts).where(and(
        eq(schema.contacts.organizationId, membership.organizationId),
        inArray(schema.contacts.id, uniqueContactIds),
      ));
      if (allowedContacts.length !== uniqueContactIds.length) throw new Error("Há participantes inválidos para esta empresa.");
    }
    const syncLinks = async (database: any, projectId: string) => {
      await database.delete(schema.projectParticipants).where(eq(schema.projectParticipants.projectId, projectId));
      if (data.links.length) await database.insert(schema.projectParticipants).values(data.links.map((link) => ({
        projectId, contactId: link.contactId, role: link.role, percentage: link.percentage || null,
      })));
    };
    if (data.id) {
      const projectId = data.id;
      return db.transaction(async (tx) => {
        const [updated] = await tx.update(schema.projects).set({
          name: data.name, address: data.address, city: data.city, stage: data.stage,
          status: data.status, responsible: data.responsible, mainImage: data.mainImage ?? null,
          data: cleanProjectData, updatedAt: new Date(),
        }).where(and(eq(schema.projects.id, projectId), eq(schema.projects.organizationId, membership.organizationId))).returning();
        if (!updated) throw new Error("Projeto não encontrado nesta empresa.");
        await syncLinks(tx, updated.id);
        await tx.insert(schema.auditLogs).values({ organizationId: membership.organizationId, projectId: updated.id, actorId: session.user.id, action: "project.updated", entityType: "project", entityId: updated.id, metadata: { status: updated.status } });
        return normalize(updated);
      });
    }
    return db.transaction(async (tx) => {
      await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${membership.organizationId}))`);
      const [sequence] = await tx.select({ next: sql<number>`coalesce(max(cast(substring(${schema.projects.code} from '[0-9]+$') as integer)), 0) + 1` }).from(schema.projects).where(eq(schema.projects.organizationId, membership.organizationId));
      if (!sequence) throw new Error("Não foi possível gerar o código do projeto.");
      const code = `AF-${new Date().getFullYear()}-${String(Number(sequence.next)).padStart(3, "0")}`;
      const [created] = await tx.insert(schema.projects).values({ organizationId: membership.organizationId, code, name: data.name, address: data.address, city: data.city, stage: data.stage, status: data.status, responsible: data.responsible, mainImage: data.mainImage ?? null, data: cleanProjectData, createdBy: session.user.id }).returning();
      if (!created) throw new Error("Não foi possível criar o projeto.");
      await syncLinks(tx, created.id);
      await tx.insert(schema.auditLogs).values({ organizationId: membership.organizationId, projectId: created.id, actorId: session.user.id, action: "project.created", entityType: "project", entityId: created.id, metadata: { code: created.code, status: created.status } });
      return normalize(created);
    });
  });

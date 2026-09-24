import { createServerFn } from "@tanstack/react-start";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { z } from "zod";
import type { Schema } from "@/db/types";
import {
  buildProjectAssignmentEmail,
  newlyAddedParticipants,
  type AddedParticipant,
} from "@/lib/project-assignment-notice";

const projectStatuses = [
  "atrasado",
  "pendente",
  "aguardando",
  "andamento",
  "nao_iniciado",
  "concluido",
] as const;
const safeProjectData = z.record(z.unknown()).superRefine((value, ctx) => {
  const serialized = JSON.stringify(value);
  if (serialized.length > 1_000_000)
    ctx.addIssue({
      code: "custom",
      message: "Os dados complementares do projeto excedem o limite permitido.",
    });
  const inspect = (item: unknown, path: string[], depth: number) => {
    if (depth > 8) {
      ctx.addIssue({ code: "custom", message: "Estrutura de dados muito profunda.", path });
      return;
    }
    if (Array.isArray(item)) {
      if (item.length > 500)
        ctx.addIssue({ code: "custom", message: "Lista muito extensa.", path });
      item.forEach((child, index) => inspect(child, [...path, String(index)], depth + 1));
      return;
    }
    if (!item || typeof item !== "object") return;
    for (const [key, child] of Object.entries(item as Record<string, unknown>)) {
      if (["__proto__", "prototype", "constructor"].includes(key))
        ctx.addIssue({ code: "custom", message: "Campo inválido.", path: [...path, key] });
      if (
        typeof child === "number" &&
        (!Number.isFinite(child) ||
          (/valor|custo|preco|capital|honorario|comissao|percentual/i.test(key) && child < 0))
      )
        ctx.addIssue({
          code: "custom",
          message: "Valor financeiro inválido.",
          path: [...path, key],
        });
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
  mainImage: z
    .string()
    .regex(/^\/api\/project-images\/[0-9a-f-]{36}$/i)
    .nullable()
    .optional(),
  data: safeProjectData,
  links: z
    .array(
      z.object({
        contactId: z.string().uuid(),
        role: z.enum([
          "investor",
          "advisor",
          "responsible",
          "auctioneer",
          "broker",
          "agency",
          "supplier",
        ]),
        percentage: z.preprocess(
          (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
          z
            .string()
            .trim()
            .regex(/^\d{1,3}([.,]\d{1,4})?$/, "Percentual inválido.")
            .refine(
              (value) =>
                Number(value.replace(",", ".")) >= 0 && Number(value.replace(",", ".")) <= 100,
              "O percentual deve estar entre 0 e 100.",
            )
            .optional(),
        ),
      }),
    )
    .max(200)
    .default([]),
});

async function context(requireManager = false) {
  const [{ getRequestHeaders }, { auth }, { db }, schema] = await Promise.all([
    import("@tanstack/react-start/server"),
    import("@/lib/auth.server"),
    import("@/db/index.server"),
    import("@/db/schema"),
  ]);
  const session = await auth.api.getSession({ headers: getRequestHeaders() });
  if (!session) throw new Error("Não autenticado.");
  const { resolveActiveMembership } = await import("@/lib/active-organization.server");
  const membership = await resolveActiveMembership(db, schema, session.user.id);
  if (!membership) throw new Error("Empresa ativa não encontrada.");
  if (
    requireManager &&
    !["owner", "admin", "project_manager", "advisor", "investor"].includes(membership.role)
  )
    throw new Error("Sem permissão para alterar projetos.");
  return { db, schema, session, membership };
}

type ProjectTransaction = Parameters<
  Parameters<typeof import("@/db/index.server").db.transaction>[0]
>[0];

// The legacy project payload is an open JSON object consumed by existing screens.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const normalize = (project: any) => {
  const data = project.data || {};
  const assessors = Array.isArray(data.assessores)
    ? data.assessores
        .map((item: unknown) =>
          typeof item === "string"
            ? item
            : item && typeof item === "object" && "nome" in item
              ? String(item.nome)
              : "",
        )
        .filter(Boolean)
    : [];
  return {
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
    capitalInvestido:
      Number(data.capital_investido ?? data.capitalInvestido ?? data.valor_aquisicao) || 0,
    resultadoProjetado: Number(data.resultado_projetado ?? data.resultadoProjetado) || 0,
    progresso: Number(data.progresso) || 0,
    investidores: Array.isArray(data.investidores) ? data.investidores : [],
    assessores: assessors,
    updated_at: project.updatedAt.toISOString(),
  };
};

async function linkedProjectIds(
  ctx: Awaited<ReturnType<typeof context>>,
  participantRole?: "investor" | "advisor",
) {
  if (["owner", "admin"].includes(ctx.membership.role)) return null;
  const rows = await ctx.db
    .select({ projectId: ctx.schema.projectParticipants.projectId })
    .from(ctx.schema.projectParticipants)
    .innerJoin(
      ctx.schema.contacts,
      eq(ctx.schema.contacts.id, ctx.schema.projectParticipants.contactId),
    )
    .innerJoin(
      ctx.schema.projects,
      eq(ctx.schema.projects.id, ctx.schema.projectParticipants.projectId),
    )
    .where(
      and(
        eq(ctx.schema.projects.organizationId, ctx.membership.organizationId),
        eq(ctx.schema.contacts.organizationId, ctx.membership.organizationId),
        participantRole
          ? eq(ctx.schema.projectParticipants.role, participantRole)
          : inArray(ctx.schema.projectParticipants.role, ["responsible", "advisor", "investor"]),
        sql`lower(${ctx.schema.contacts.email}) = lower(${ctx.session.user.email})`,
        eq(ctx.schema.contacts.status, "active"),
      ),
    );
  return rows.map((row) => row.projectId);
}

export const listProjects = createServerFn({ method: "GET" }).handler(async () => {
  const ctx = await context();
  const { db, schema, membership } = ctx;
  const allowedIds = await linkedProjectIds(ctx);
  if (allowedIds?.length === 0) return [];
  const rows = await db
    .select()
    .from(schema.projects)
    .where(
      and(
        eq(schema.projects.organizationId, membership.organizationId),
        allowedIds ? inArray(schema.projects.id, allowedIds) : undefined,
      ),
    )
    .orderBy(desc(schema.projects.updatedAt));
  const { getProjectRole } = await import("@/lib/project-access.server");
  return Promise.all(
    rows.map(async (row) => ({
      ...normalize(row),
      currentUserRole: await getProjectRole(db, schema, membership, ctx.session.user.email, row.id),
    })),
  );
});

export const countCompletedRegularizations = createServerFn({ method: "GET" }).handler(async () => {
  const ctx = await context();
  const { db, schema, membership } = ctx;
  const allowedIds = await linkedProjectIds(ctx);
  if (allowedIds && !allowedIds.length) return 0;
  const rows = await db
    .select({
      projectId: schema.projectOperationalData.projectId,
      regularization: schema.projectOperationalData.regularization,
    })
    .from(schema.projectOperationalData)
    .where(
      and(
        eq(schema.projectOperationalData.organizationId, membership.organizationId),
        allowedIds ? inArray(schema.projectOperationalData.projectId, allowedIds) : undefined,
      ),
    );
  const normalized = (value: unknown) =>
    String(value || "")
      .trim()
      .toLocaleLowerCase("pt-BR");
  return rows.filter(({ regularization }) => {
    const data = regularization || {};
    const condominiumReady =
      data["tem_condominio"] !== true ||
      normalized(data["condominio_debitos_status"]) === "quitado";
    return (
      normalized(data["carta_arrematacao_status"]) === "registrada" &&
      normalized(data["averbacao_status"]) === "finalizada" &&
      normalized(data["iptu_status"]) === "quitado" &&
      normalized(data["transferencia_cadastral_status"]) === "finalizada" &&
      condominiumReady
    );
  }).length;
});

export const countProjectWorks = createServerFn({ method: "GET" }).handler(async () => {
  const ctx = await context();
  const { db, schema, membership } = ctx;
  const allowedIds = await linkedProjectIds(ctx);
  if (allowedIds && !allowedIds.length) return { completed: 0, inProgress: 0 };
  const rows = await db
    .select({ data: schema.projectProviderAssignments.data })
    .from(schema.projectProviderAssignments)
    .where(
      and(
        eq(schema.projectProviderAssignments.organizationId, membership.organizationId),
        allowedIds ? inArray(schema.projectProviderAssignments.projectId, allowedIds) : undefined,
      ),
    );
  const completed = rows.filter((assignment) => assignment.data?.["status"] === "concluido").length;
  return { completed, inProgress: rows.length - completed };
});

export const countProjectPossessions = createServerFn({ method: "GET" }).handler(async () => {
  const ctx = await context();
  const { db, schema, membership } = ctx;
  const allowedIds = await linkedProjectIds(ctx);
  if (allowedIds && !allowedIds.length) return { completed: 0, inProgress: 0 };
  const projects = await db
    .select({ id: schema.projects.id })
    .from(schema.projects)
    .where(
      and(
        eq(schema.projects.organizationId, membership.organizationId),
        allowedIds ? inArray(schema.projects.id, allowedIds) : undefined,
      ),
    );
  const projectIds = projects.map((project) => project.id);
  if (!projectIds.length) return { completed: 0, inProgress: 0 };
  const operationalRows = await db
    .select({
      projectId: schema.projectOperationalData.projectId,
      possession: schema.projectOperationalData.possession,
    })
    .from(schema.projectOperationalData)
    .where(
      and(
        eq(schema.projectOperationalData.organizationId, membership.organizationId),
        inArray(schema.projectOperationalData.projectId, projectIds),
      ),
    );
  const completedIds = new Set(
    operationalRows
      .filter(({ possession }) =>
        Boolean(String(possession?.["possession_completed_date"] || "").trim()),
      )
      .map(({ projectId }) => projectId),
  );
  return { completed: completedIds.size, inProgress: projectIds.length - completedIds.size };
});

export const countProjectsWithPendingIndicators = createServerFn({ method: "GET" }).handler(
  async () => {
    const ctx = await context();
    const { db, schema, membership } = ctx;
    const allowedIds = await linkedProjectIds(ctx);
    if (allowedIds && !allowedIds.length) return 0;
    const projects = await db
      .select()
      .from(schema.projects)
      .where(
        and(
          eq(schema.projects.organizationId, membership.organizationId),
          allowedIds ? inArray(schema.projects.id, allowedIds) : undefined,
        ),
      );
    const projectIds = projects.map((project) => project.id);
    if (!projectIds.length) return 0;
    const [operational, tasks, finances, judicialActions, assignments, inspections] =
      await Promise.all([
        db
          .select()
          .from(schema.projectOperationalData)
          .where(
            and(
              eq(schema.projectOperationalData.organizationId, membership.organizationId),
              inArray(schema.projectOperationalData.projectId, projectIds),
            ),
          ),
        db
          .select()
          .from(schema.tasks)
          .where(
            and(
              eq(schema.tasks.organizationId, membership.organizationId),
              inArray(schema.tasks.projectId, projectIds),
            ),
          ),
        db
          .select()
          .from(schema.financialMovements)
          .where(
            and(
              eq(schema.financialMovements.organizationId, membership.organizationId),
              inArray(schema.financialMovements.projectId, projectIds),
            ),
          ),
        db
          .select()
          .from(schema.judicialActions)
          .where(
            and(
              eq(schema.judicialActions.organizationId, membership.organizationId),
              inArray(schema.judicialActions.projectId, projectIds),
            ),
          ),
        db
          .select()
          .from(schema.projectProviderAssignments)
          .where(
            and(
              eq(schema.projectProviderAssignments.organizationId, membership.organizationId),
              inArray(schema.projectProviderAssignments.projectId, projectIds),
            ),
          ),
        db
          .select()
          .from(schema.propertyInspections)
          .where(
            and(
              eq(schema.propertyInspections.organizationId, membership.organizationId),
              inArray(schema.propertyInspections.projectId, projectIds),
            ),
          ),
      ]);
    const hasPendingText = (value: unknown): boolean => {
      if (typeof value === "string") {
        const normalized = value
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .toLocaleLowerCase("pt-BR");
        return /pendenc|pendente/.test(normalized);
      }
      if (Array.isArray(value)) return value.some(hasPendingText);
      if (value && typeof value === "object")
        return Object.values(value as Record<string, unknown>).some(hasPendingText);
      return false;
    };
    const pendingProjectIds = new Set<string>();
    projects.forEach((project) => {
      if (hasPendingText(project)) pendingProjectIds.add(project.id);
    });
    for (const rows of [operational, tasks, finances, judicialActions, assignments, inspections]) {
      rows.forEach((row) => {
        if (hasPendingText(row)) pendingProjectIds.add(row.projectId);
      });
    }
    return pendingProjectIds.size;
  },
);

const dashboardProjectFilter = z.enum([
  "regularizacoes-finalizadas",
  "regularizacoes-nao-finalizadas",
  "obras-finalizadas",
  "obras-em-andamento",
]);

export const listDashboardProjectIds = createServerFn({ method: "GET" })
  .validator(z.object({ filter: dashboardProjectFilter }))
  .handler(async ({ data }) => {
    const ctx = await context();
    const { db, schema, membership } = ctx;
    const allowedIds = await linkedProjectIds(ctx);
    if (allowedIds && !allowedIds.length) return [];
    const projectRows = await db
      .select({ id: schema.projects.id })
      .from(schema.projects)
      .where(
        and(
          eq(schema.projects.organizationId, membership.organizationId),
          allowedIds ? inArray(schema.projects.id, allowedIds) : undefined,
        ),
      );
    const projectIds = projectRows.map((project) => project.id);
    if (!projectIds.length) return [];

    if (data.filter.startsWith("regularizacoes-")) {
      const rows = await db
        .select({
          projectId: schema.projectOperationalData.projectId,
          regularization: schema.projectOperationalData.regularization,
        })
        .from(schema.projectOperationalData)
        .where(
          and(
            eq(schema.projectOperationalData.organizationId, membership.organizationId),
            inArray(schema.projectOperationalData.projectId, projectIds),
          ),
        );
      const normalized = (value: unknown) =>
        String(value || "")
          .trim()
          .toLocaleLowerCase("pt-BR");
      const completedIds = new Set(
        rows
          .filter(({ regularization }) => {
            const details = regularization || {};
            return (
              normalized(details["carta_arrematacao_status"]) === "registrada" &&
              normalized(details["averbacao_status"]) === "finalizada" &&
              normalized(details["iptu_status"]) === "quitado" &&
              normalized(details["transferencia_cadastral_status"]) === "finalizada" &&
              (details["tem_condominio"] !== true ||
                normalized(details["condominio_debitos_status"]) === "quitado")
            );
          })
          .map((row) => row.projectId),
      );
      return data.filter === "regularizacoes-finalizadas"
        ? projectIds.filter((id) => completedIds.has(id))
        : projectIds.filter((id) => !completedIds.has(id));
    }

    const assignments = await db
      .select({
        projectId: schema.projectProviderAssignments.projectId,
        data: schema.projectProviderAssignments.data,
      })
      .from(schema.projectProviderAssignments)
      .where(
        and(
          eq(schema.projectProviderAssignments.organizationId, membership.organizationId),
          inArray(schema.projectProviderAssignments.projectId, projectIds),
        ),
      );
    const matchingIds = new Set(
      assignments
        .filter((assignment) =>
          data.filter === "obras-finalizadas"
            ? assignment.data?.["status"] === "concluido"
            : assignment.data?.["status"] !== "concluido",
        )
        .map((assignment) => assignment.projectId),
    );
    return projectIds.filter((id) => matchingIds.has(id));
  });

export const getProject = createServerFn({ method: "GET" })
  .validator(z.object({ id: z.string().uuid() }))
  .handler(async ({ data }) => {
    const ctx = await context();
    const { db, schema, membership } = ctx;
    const allowedIds = await linkedProjectIds(ctx);
    if (allowedIds && !allowedIds.includes(data.id)) return null;
    const [row] = await db
      .select()
      .from(schema.projects)
      .where(
        and(
          eq(schema.projects.id, data.id),
          eq(schema.projects.organizationId, membership.organizationId),
        ),
      )
      .limit(1);
    if (!row) return null;
    const images = await db
      .select()
      .from(schema.projectImages)
      .where(
        and(
          eq(schema.projectImages.projectId, row.id),
          eq(schema.projectImages.organizationId, membership.organizationId),
        ),
      )
      .orderBy(schema.projectImages.displayOrder);
    const links = await db
      .select({
        contactId: schema.projectParticipants.contactId,
        role: schema.projectParticipants.role,
        percentage: schema.projectParticipants.percentage,
        contactName: schema.contacts.name,
      })
      .from(schema.projectParticipants)
      .innerJoin(schema.contacts, eq(schema.contacts.id, schema.projectParticipants.contactId))
      .where(
        and(
          eq(schema.projectParticipants.projectId, row.id),
          eq(schema.contacts.organizationId, membership.organizationId),
        ),
      );
    const projectImages = images.map((image) => ({
      id: image.id,
      url: `/api/project-images/${image.id}`,
      file_path: image.storageKey,
      file_name: image.originalName,
      is_main: image.isMain,
      display_order: image.displayOrder,
    }));
    const normalized = normalize(row);
    const linked = (role: string) =>
      links
        .filter((link) => link.role === role)
        .map((link) => ({
          id: link.contactId,
          nome: link.contactName,
          percentual: link.percentage || "",
        }));
    const investors = linked("investor");
    const advisors = linked("advisor");
    const responsibles = linked("responsible");
    const auctioneer = linked("auctioneer")[0];
    const rawData = row.data || {};
    return {
      ...normalized,
      participantes: investors.length
        ? investors
        : Array.isArray(rawData["participantes"])
          ? rawData["participantes"]
          : [],
      assessores: advisors.length
        ? advisors
        : Array.isArray(rawData["assessores"])
          ? rawData["assessores"]
          : [],
      responsaveis: responsibles.length
        ? responsibles
        : Array.isArray(rawData["responsaveis"])
          ? rawData["responsaveis"]
          : [],
      leiloeiro_id: auctioneer?.id || null,
      leiloeiro_nome: auctioneer?.nome || (rawData["leiloeiro_nome"] as string | undefined) || null,
      fotos: projectImages.map((image) => image.url),
      projectImages,
    };
  });

export const getCurrentProjectRole = createServerFn({ method: "GET" })
  .validator(z.object({ projectId: z.string().uuid() }))
  .handler(async ({ data }) => {
    const { db, schema, membership, session } = await context();
    const { getProjectRole } = await import("@/lib/project-access.server");
    return getProjectRole(db, schema, membership, session.user.email, data.projectId);
  });

export const getProjectMilestoneProgress = createServerFn({ method: "GET" })
  .validator(z.object({ projectId: z.string().uuid() }))
  .handler(async ({ data }) => {
    const ctx = await context();
    const { db, schema, membership } = ctx;
    const allowedIds = await linkedProjectIds(ctx);
    if (allowedIds && !allowedIds.includes(data.projectId))
      throw new Error("Projeto não vinculado ao usuário.");
    const [project] = await db
      .select()
      .from(schema.projects)
      .where(
        and(
          eq(schema.projects.id, data.projectId),
          eq(schema.projects.organizationId, membership.organizationId),
        ),
      )
      .limit(1);
    if (!project) throw new Error("Projeto não encontrado.");
    return milestoneProgressFor(ctx, project);
  });

async function milestoneProgressFor(
  ctx: Awaited<ReturnType<typeof context>>,
  project: Schema["projects"]["$inferSelect"],
) {
  const { db, schema, membership } = ctx;
  const [
    operationalRows,
    taskRows,
    documentRows,
    financialRows,
    inspectionRows,
    portfolioRows,
    proposalRows,
    assignmentRows,
    possessionActions,
  ] = await Promise.all([
    db
      .select({
        regularization: schema.projectOperationalData.regularization,
        possession: schema.projectOperationalData.possession,
      })
      .from(schema.projectOperationalData)
      .where(
        and(
          eq(schema.projectOperationalData.projectId, project.id),
          eq(schema.projectOperationalData.organizationId, membership.organizationId),
        ),
      )
      .limit(1),
    db
      .select({ status: schema.tasks.status })
      .from(schema.tasks)
      .where(
        and(
          eq(schema.tasks.projectId, project.id),
          eq(schema.tasks.organizationId, membership.organizationId),
        ),
      ),
    db
      .select({ id: schema.documents.id })
      .from(schema.documents)
      .where(
        and(
          eq(schema.documents.projectId, project.id),
          eq(schema.documents.organizationId, membership.organizationId),
        ),
      )
      .limit(1),
    db
      .select({ id: schema.financialMovements.id })
      .from(schema.financialMovements)
      .where(
        and(
          eq(schema.financialMovements.projectId, project.id),
          eq(schema.financialMovements.organizationId, membership.organizationId),
        ),
      )
      .limit(1),
    db
      .select({ status: schema.propertyInspections.status })
      .from(schema.propertyInspections)
      .where(
        and(
          eq(schema.propertyInspections.projectId, project.id),
          eq(schema.propertyInspections.organizationId, membership.organizationId),
        ),
      ),
    db
      .select({ id: schema.salesPortfolio.id })
      .from(schema.salesPortfolio)
      .where(
        and(
          eq(schema.salesPortfolio.projectId, project.id),
          eq(schema.salesPortfolio.organizationId, membership.organizationId),
        ),
      )
      .limit(1),
    db
      .select({ status: schema.salesProposals.status })
      .from(schema.salesProposals)
      .where(
        and(
          eq(schema.salesProposals.projectId, project.id),
          eq(schema.salesProposals.organizationId, membership.organizationId),
        ),
      ),
    db
      .select({ data: schema.projectProviderAssignments.data })
      .from(schema.projectProviderAssignments)
      .where(
        and(
          eq(schema.projectProviderAssignments.projectId, project.id),
          eq(schema.projectProviderAssignments.organizationId, membership.organizationId),
        ),
      ),
    db
      .select({ id: schema.judicialActions.id })
      .from(schema.judicialActions)
      .where(
        and(
          eq(schema.judicialActions.projectId, project.id),
          eq(schema.judicialActions.organizationId, membership.organizationId),
          eq(schema.judicialActions.scope, "possession"),
        ),
      )
      .limit(1),
  ]);

  const projectData = project.data || {};
  const regularization = operationalRows[0]?.regularization || {};
  const possession = operationalRows[0]?.possession || {};
  const milestones: Array<{ label: string; completed: boolean }> = [
    {
      label: "Aquisição cadastrada",
      completed:
        Number(projectData["valor_aquisicao"]) > 0 &&
        Boolean(projectData["origem"]) &&
        Boolean(projectData["forma_pagamento"]),
    },
    {
      label: "Carta de arrematação emitida",
      completed: ["Emitida", "Registrada"].includes(
        String(regularization["carta_arrematacao_status"] || ""),
      ),
    },
    {
      label: "Averbação finalizada",
      completed: regularization["averbacao_status"] === "Finalizada",
    },
    {
      label: "Protocolo de cartório registrado",
      completed: Boolean(String(regularization["protocolo_cartorio"] || "").trim()),
    },
    { label: "IPTU quitado", completed: regularization["iptu_status"] === "Quitado" },
    {
      label: "Transferência na Prefeitura finalizada",
      completed: regularization["transferencia_cadastral_status"] === "Finalizada",
    },
    { label: "Posse realizada", completed: Boolean(possession["possession_completed_date"]) },
    { label: "Movimentação financeira registrada", completed: financialRows.length > 0 },
    { label: "Documento anexado", completed: documentRows.length > 0 },
    { label: "Imóvel anunciado para venda", completed: portfolioRows.length > 0 },
    {
      label: "Venda concluída",
      completed: proposalRows.some((proposal) => proposal.status === "Aceita"),
    },
  ];

  if (possession["possession_action_required"] === true)
    milestones.push({
      label: "Ação de imissão cadastrada",
      completed: possessionActions.length > 0,
    });
  if (possession["property_inspection_required"] === true)
    milestones.push({
      label: "Vistoria concluída",
      completed: inspectionRows.some((inspection) => inspection.status === "completed"),
    });
  taskRows.forEach((task, index) =>
    milestones.push({
      label: `Tarefa ${index + 1} concluída`,
      completed: task.status === "concluido",
    }),
  );
  assignmentRows.forEach((assignment, index) =>
    milestones.push({
      label: `Etapa de obra ${index + 1} concluída`,
      completed: assignment.data?.["status"] === "concluido",
    }),
  );

  const completed = milestones.filter((milestone) => milestone.completed).length;
  const total = milestones.length;
  return {
    percentage: total ? Math.round((completed / total) * 100) : 0,
    completed,
    total,
    milestones,
  };
}

export const listParticipantProjects = createServerFn({ method: "GET" })
  .validator(z.object({ role: z.enum(["investor", "advisor"]) }))
  .handler(async ({ data }) => {
    const ctx = await context();
    const { db, schema, membership, session } = ctx;
    const base = await db
      .select({
        project: schema.projects,
        percentage: schema.projectParticipants.percentage,
        contactName: schema.contacts.name,
        contactEmail: schema.contacts.email,
      })
      .from(schema.projects)
      .innerJoin(
        schema.projectParticipants,
        and(
          eq(schema.projectParticipants.projectId, schema.projects.id),
          eq(schema.projectParticipants.role, data.role),
        ),
      )
      .innerJoin(schema.contacts, eq(schema.contacts.id, schema.projectParticipants.contactId))
      .where(
        and(
          eq(schema.projects.organizationId, membership.organizationId),
          sql`lower(${schema.contacts.email}) = lower(${session.user.email})`,
        ),
      )
      .orderBy(desc(schema.projects.updatedAt));

    const seen = new Set<string>();
    const unique = base.filter((row) => {
      if (seen.has(row.project.id)) return false;
      seen.add(row.project.id);
      return true;
    });
    return Promise.all(
      unique.map(async (row) => ({
        ...normalize(row.project),
        progresso: (await milestoneProgressFor(ctx, row.project)).percentage,
        participationPercentage: row.percentage ? Number(row.percentage) : null,
        participantName: row.contactName || session.user.name,
      })),
    );
  });

export const saveProject = createServerFn({ method: "POST" })
  .validator(projectInput)
  .handler(async ({ data }) => {
    const { db, schema, session, membership } = await context(true);
    const { enforcePlanFeature } = await import("@/lib/developer.server");
    await enforcePlanFeature(membership.organizationId, "menuItems", "Projetos");
    const { activePlanForOrganization } = await import("@/lib/developer.server");
    const activePlan = await activePlanForOrganization(membership.organizationId);
    const requestedModality =
      typeof data.data["modalidade"] === "string" ? data.data["modalidade"] : null;
    if (
      requestedModality &&
      activePlan &&
      !activePlan.advisoryModalities.includes(requestedModality)
    ) {
      if (!data.id) throw new Error("Modalidade não disponível no plano.");
      const [existing] = await db
        .select({ data: schema.projects.data })
        .from(schema.projects)
        .where(
          and(
            eq(schema.projects.id, data.id),
            eq(schema.projects.organizationId, membership.organizationId),
          ),
        );
      if (!existing || existing.data["modalidade"] !== requestedModality)
        throw new Error("Modalidade não disponível no plano.");
    }
    const {
      foto: _legacyPhoto,
      fotos: _legacyPhotos,
      projectImages: _legacyImages,
      ...cleanProjectData
    } = data.data;
    const uniqueContactIds = [...new Set(data.links.map((link) => link.contactId))];
    for (const role of ["investor", "advisor"] as const) {
      const total = data.links
        .filter((link) => link.role === role)
        .reduce((sum, link) => sum + Number((link.percentage || "0").replace(",", ".")), 0);
      if (total > 100.0001)
        throw new Error(
          `A soma dos percentuais de ${role === "investor" ? "investidores" : "assessores"} não pode ultrapassar 100%.`,
        );
    }
    if (uniqueContactIds.length) {
      const allowedContacts = await db
        .select({ id: schema.contacts.id })
        .from(schema.contacts)
        .where(
          and(
            eq(schema.contacts.organizationId, membership.organizationId),
            inArray(schema.contacts.id, uniqueContactIds),
          ),
        );
      if (allowedContacts.length !== uniqueContactIds.length)
        throw new Error("Há participantes inválidos para esta empresa.");
    }
    let addedParticipants: AddedParticipant[] = [];
    const notifyAddedParticipants = async (project: {
      id: string;
      codigo: string;
      nome: string;
    }) => {
      if (!addedParticipants.length) return;
      try {
        const baseUrl = process.env["APP_PUBLIC_URL"] || process.env["BETTER_AUTH_URL"];
        if (!baseUrl) return;
        const [recipients, { sendTransactionalEmail }] = await Promise.all([
          db
            .select({
              id: schema.contacts.id,
              name: schema.contacts.name,
              email: schema.contacts.email,
            })
            .from(schema.contacts)
            .where(
              and(
                eq(schema.contacts.organizationId, membership.organizationId),
                inArray(
                  schema.contacts.id,
                  addedParticipants.map((added) => added.contactId),
                ),
              ),
            ),
          import("@/lib/email.server"),
        ]);
        const projectUrl = `${baseUrl.replace(/\/$/, "")}/projetos/${project.id}`;
        await Promise.all(
          addedParticipants.map(async (added) => {
            const recipient = recipients.find((contact) => contact.id === added.contactId);
            if (!recipient?.email) return;
            try {
              await sendTransactionalEmail({
                to: recipient.email,
                ...buildProjectAssignmentEmail({
                  recipientName: recipient.name,
                  projectCode: project.codigo,
                  projectName: project.nome,
                  roles: added.roles,
                  projectUrl,
                }),
              });
            } catch (error) {
              console.error(
                "Não foi possível enviar o aviso de inclusão no projeto.",
                error instanceof Error ? error.message : error,
              );
            }
          }),
        );
      } catch (error) {
        console.error(
          "Não foi possível preparar os avisos de inclusão no projeto.",
          error instanceof Error ? error.message : error,
        );
      }
    };
    const syncLinks = async (database: ProjectTransaction, projectId: string) => {
      const previousLinks = await database
        .select({
          contactId: schema.projectParticipants.contactId,
          role: schema.projectParticipants.role,
        })
        .from(schema.projectParticipants)
        .where(eq(schema.projectParticipants.projectId, projectId));
      addedParticipants = newlyAddedParticipants(previousLinks, data.links);
      const requestedManagerIds = [
        ...new Set(
          data.links.filter((link) => link.role === "responsible").map((link) => link.contactId),
        ),
      ];
      if (requestedManagerIds.length && activePlan?.maxProjectManagers != null) {
        const currentManagers = await database
          .select({ contactId: schema.projectParticipants.contactId })
          .from(schema.projectParticipants)
          .innerJoin(schema.projects, eq(schema.projects.id, schema.projectParticipants.projectId))
          .where(
            and(
              eq(schema.projects.organizationId, membership.organizationId),
              eq(schema.projectParticipants.role, "responsible"),
            ),
          );
        const existingManagerIds = new Set(currentManagers.map((row) => row.contactId));
        const additions = requestedManagerIds.filter((id) => !existingManagerIds.has(id));
        if (
          additions.length &&
          existingManagerIds.size + additions.length > activePlan.maxProjectManagers
        )
          throw new Error("Limite de gestores de projeto do plano atingido.");
      }
      await database
        .delete(schema.projectParticipants)
        .where(eq(schema.projectParticipants.projectId, projectId));
      if (data.links.length)
        await database.insert(schema.projectParticipants).values(
          data.links.map((link) => ({
            projectId,
            contactId: link.contactId,
            role: link.role,
            percentage: link.percentage || null,
          })),
        );
    };
    if (data.id) {
      const projectId = data.id;
      const { requireProjectRole } = await import("@/lib/project-access.server");
      await requireProjectRole(
        db,
        schema,
        membership,
        session.user.email,
        projectId,
        "project_manager",
      );
      const savedProject = await db.transaction(async (tx) => {
        await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${membership.organizationId}))`);
        const [previous] = await tx
          .select({ status: schema.projects.status })
          .from(schema.projects)
          .where(
            and(
              eq(schema.projects.id, projectId),
              eq(schema.projects.organizationId, membership.organizationId),
            ),
          );
        if (previous?.status === "concluido" && data.status !== "concluido") {
          const [{ enforcePlanLimit }, activeCount] = await Promise.all([
            import("@/lib/developer.server"),
            tx
              .select({ value: sql<number>`count(*)::int` })
              .from(schema.projects)
              .where(
                and(
                  eq(schema.projects.organizationId, membership.organizationId),
                  sql`${schema.projects.status} <> 'concluido'`,
                ),
              ),
          ]);
          await enforcePlanLimit(
            membership.organizationId,
            "maxActiveProjects",
            Number(activeCount[0]?.value ?? 0),
          );
        }
        const [updated] = await tx
          .update(schema.projects)
          .set({
            name: data.name,
            address: data.address,
            city: data.city,
            stage: data.stage,
            status: data.status,
            responsible: data.responsible,
            mainImage: data.mainImage ?? null,
            data: cleanProjectData,
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(schema.projects.id, projectId),
              eq(schema.projects.organizationId, membership.organizationId),
            ),
          )
          .returning();
        if (!updated) throw new Error("Projeto não encontrado nesta empresa.");
        await syncLinks(tx, updated.id);
        await tx.insert(schema.auditLogs).values({
          organizationId: membership.organizationId,
          projectId: updated.id,
          actorId: session.user.id,
          action: "project.updated",
          entityType: "project",
          entityId: updated.id,
          metadata: { status: updated.status },
        });
        return normalize(updated);
      });
      await notifyAddedParticipants(savedProject);
      return savedProject;
    }
    if (!["owner", "admin"].includes(membership.role)) {
      const { effectiveOrganizationRole } = await import("@/lib/organization-users");
      const role = await effectiveOrganizationRole(
        db,
        schema,
        membership.organizationId,
        session.user.email,
        membership.role,
      );
      if (role !== "project_manager") throw new Error("Sem permissão para criar projetos.");
      const ownManagerIds = data.links
        .filter((link) => link.role === "responsible")
        .map((link) => link.contactId);
      const [ownManager] = ownManagerIds.length
        ? await db
            .select({ id: schema.contacts.id })
            .from(schema.contacts)
            .where(
              and(
                eq(schema.contacts.organizationId, membership.organizationId),
                inArray(schema.contacts.id, ownManagerIds),
                sql`lower(${schema.contacts.email}) = lower(${session.user.email})`,
              ),
            )
            .limit(1)
        : [];
      if (!ownManager)
        throw new Error("Vincule-se como gestor do novo projeto para manter o acesso.");
    }
    const createdProject = await db.transaction(async (tx) => {
      await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${membership.organizationId}))`);
      const [{ enforcePlanLimit }, activeCount] = await Promise.all([
        import("@/lib/developer.server"),
        tx
          .select({ value: sql<number>`count(*)::int` })
          .from(schema.projects)
          .where(
            and(
              eq(schema.projects.organizationId, membership.organizationId),
              sql`${schema.projects.status} <> 'concluido'`,
            ),
          ),
      ]);
      await enforcePlanLimit(
        membership.organizationId,
        "maxActiveProjects",
        Number(activeCount[0]?.value ?? 0),
      );
      const [sequence] = await tx
        .select({
          next: sql<number>`coalesce(max(cast(substring(${schema.projects.code} from '[0-9]+$') as integer)), 0) + 1`,
        })
        .from(schema.projects)
        .where(eq(schema.projects.organizationId, membership.organizationId));
      if (!sequence) throw new Error("Não foi possível gerar o código do projeto.");
      const code = `AF-${new Date().getFullYear()}-${String(Number(sequence.next)).padStart(3, "0")}`;
      const [created] = await tx
        .insert(schema.projects)
        .values({
          organizationId: membership.organizationId,
          code,
          name: data.name,
          address: data.address,
          city: data.city,
          stage: data.stage,
          status: data.status,
          responsible: data.responsible,
          mainImage: data.mainImage ?? null,
          data: cleanProjectData,
          createdBy: session.user.id,
        })
        .returning();
      if (!created) throw new Error("Não foi possível criar o projeto.");
      await syncLinks(tx, created.id);
      await tx.insert(schema.auditLogs).values({
        organizationId: membership.organizationId,
        projectId: created.id,
        actorId: session.user.id,
        action: "project.created",
        entityType: "project",
        entityId: created.id,
        metadata: { code: created.code, status: created.status },
      });
      return normalize(created);
    });
    await notifyAddedParticipants(createdProject);
    return createdProject;
  });

export const deleteProject = createServerFn({ method: "POST" })
  .validator(z.object({ id: z.string().uuid() }))
  .handler(async ({ data }) => {
    const { db, schema, session, membership } = await context(true);
    const { enforcePlanFeature } = await import("@/lib/developer.server");
    await enforcePlanFeature(membership.organizationId, "menuItems", "Projetos");
    const { requireProjectRole } = await import("@/lib/project-access.server");
    await requireProjectRole(
      db,
      schema,
      membership,
      session.user.email,
      data.id,
      "project_manager",
    );
    const [project] = await db
      .select({ id: schema.projects.id, name: schema.projects.name, code: schema.projects.code })
      .from(schema.projects)
      .where(
        and(
          eq(schema.projects.id, data.id),
          eq(schema.projects.organizationId, membership.organizationId),
        ),
      )
      .limit(1);
    if (!project) throw new Error("Projeto não encontrado nesta empresa.");

    await db.transaction(async (tx) => {
      await tx
        .delete(schema.projects)
        .where(
          and(
            eq(schema.projects.id, project.id),
            eq(schema.projects.organizationId, membership.organizationId),
          ),
        );
      await tx.insert(schema.auditLogs).values({
        organizationId: membership.organizationId,
        projectId: null,
        actorId: session.user.id,
        action: "project.deleted",
        entityType: "project",
        entityId: project.id,
        metadata: { code: project.code, name: project.name },
      });
    });

    const [{ rm }, path] = await Promise.all([import("node:fs/promises"), import("node:path")]);
    const storageRoot = path.resolve(
      process.env["DOCUMENT_STORAGE_PATH"] || path.join(process.cwd(), ".data", "documents"),
    );
    const projectStorage = path.resolve(storageRoot, membership.organizationId, project.id);
    if (projectStorage.startsWith(`${storageRoot}${path.sep}`)) {
      await rm(projectStorage, { recursive: true, force: true }).catch(() => undefined);
    }
    return { id: project.id };
  });

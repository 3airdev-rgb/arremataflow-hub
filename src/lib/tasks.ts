import { createHash, randomBytes } from "node:crypto";
import { createServerFn } from "@tanstack/react-start";
import { and, asc, desc, eq, gte, inArray, lte, ne, sql } from "drizzle-orm";
import { z } from "zod";
import { formatBRL } from "@/lib/format-currency";
import { mergeTaskPeople } from "@/lib/task-people";

const statuses = ["nao_iniciado", "andamento", "aguardando", "pendente", "concluido"] as const;
const targetSchema = z.string().regex(/^(contact:[0-9a-f-]{36}|user:.+)$/i);
const participantSchema = z
  .string()
  .regex(/^(contact:[0-9a-f-]{36}|user:.+|provider:[0-9a-f-]{36}|portfolio:[0-9a-f-]{36})$/i);
const taskInput = z
  .object({
    id: z.string().uuid().optional(),
    projectId: z.string().uuid(),
    title: z.string().trim().min(2).max(180),
    description: z.string().trim().max(3000).default(""),
    category: z.string().trim().min(2).max(80),
    dueDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .nullable(),
    status: z.enum(statuses).default("nao_iniciado"),
    assignees: z.array(targetSchema).min(1).max(30),
    isOnlineMeeting: z.boolean().default(false),
    meetingUrl: z.string().url().max(500).nullable(),
    meetingTime: z
      .string()
      .regex(/^([01]\d|2[0-3]):[0-5]\d$/)
      .nullable(),
    participants: z.array(participantSchema).max(50).default([]),
  })
  .superRefine((data, ctx) => {
    if (
      data.isOnlineMeeting &&
      (!data.meetingUrl || !data.meetingTime || !data.participants.length)
    )
      ctx.addIssue({
        code: "custom",
        message: "Informe link, horário e participantes da reunião.",
      });
    if (data.meetingUrl && new URL(data.meetingUrl).protocol !== "https:")
      ctx.addIssue({ code: "custom", message: "O link da reunião deve usar HTTPS." });
  });

async function context(projectId?: string, requireManager = false, tab?: "Tarefas" | "Histórico") {
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
  if (tab) {
    const { enforcePlanFeature } = await import("@/lib/developer.server");
    await enforcePlanFeature(membership.organizationId, "projectTabs", tab);
  }
  if (requireManager && !projectId && !["owner", "admin"].includes(membership.role))
    throw new Error("Sem permissão para alterar tarefas.");
  if (projectId) {
    const [project] = await db
      .select({ id: schema.projects.id })
      .from(schema.projects)
      .where(
        and(
          eq(schema.projects.id, projectId),
          eq(schema.projects.organizationId, membership.organizationId),
        ),
      )
      .limit(1);
    if (!project) throw new Error("Projeto não encontrado nesta empresa.");
    const { requireProjectRole } = await import("@/lib/project-access.server");
    await requireProjectRole(
      db,
      schema,
      membership,
      session.user.email,
      projectId,
      requireManager ? "project_manager" : "investor",
    );
  }
  return { db, schema, session, membership };
}

const splitTarget = (value: string) =>
  value.startsWith("contact:")
    ? { contactId: value.slice(8), userId: null }
    : { contactId: null, userId: value.slice(5) };
const splitParticipant = (value: string) => ({
  contactId: value.startsWith("contact:") ? value.slice(8) : null,
  userId: value.startsWith("user:") ? value.slice(5) : null,
  providerId: value.startsWith("provider:") ? value.slice(9) : null,
  portfolioId: value.startsWith("portfolio:") ? value.slice(10) : null,
});
const participantValue = (row: {
  contactId: string | null;
  userId: string | null;
  providerId: string | null;
  portfolioId: string | null;
}) =>
  row.contactId
    ? `contact:${row.contactId}`
    : row.providerId
      ? `provider:${row.providerId}`
      : row.portfolioId
        ? `portfolio:${row.portfolioId}`
        : `user:${row.userId}`;
const formatDate = (value: string | null) =>
  value ? value.split("-").reverse().join("/") : "Sem prazo";
const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");
const actionLabels: Record<string, string> = {
  "project.created": "criou o projeto",
  "project.updated": "atualizou o projeto",
  "task.created": "criou uma tarefa",
  "task.updated": "atualizou uma tarefa",
  "document.created": "enviou um documento",
  "document.deleted": "excluiu um documento",
  "financial.created": "registrou uma movimentação financeira",
  "financial.updated": "atualizou uma movimentação financeira",
  "financial_movement.deleted": "excluiu uma movimentação financeira",
  "regularization.updated": "atualizou os dados de regularização",
  "possession.updated": "atualizou os dados de posse",
  "project_image.uploaded": "adicionou uma foto ao projeto",
  "project_image.deleted": "excluiu uma foto do projeto",
  "project_images.reordered": "alterou a ordem das fotos do projeto",
  "sales_portfolio.created": "incluiu um canal no portfólio de venda",
  "sales_portfolio.updated": "atualizou o portfólio de venda",
  "sales_portfolio.deleted": "removeu um canal do portfólio de venda",
  "sales_proposal.created": "cadastrou uma proposta",
  "sales_proposal.updated": "atualizou uma proposta",
  "provider_assignment.created": "vinculou um prestador ao projeto",
  "provider_assignment.updated": "atualizou um prestador do projeto",
  "service_provider.created": "cadastrou um prestador de serviço",
  "service_provider.updated": "atualizou um prestador de serviço",
  "distribution.calculated": "apurou a distribuição de resultados",
  "contract.created": "iniciou um contrato",
  "contract.updated": "atualizou um contrato",
};

const auditActionDescription = (action: string, metadataValue: unknown) => {
  const metadata =
    metadataValue && typeof metadataValue === "object"
      ? (metadataValue as Record<string, unknown>)
      : {};
  const text = (key: string) => String(metadata[key] ?? "").trim();
  const money = (value: unknown) => formatBRL(Number(value || 0));
  if (action === "possession.updated") {
    const details = [
      metadata["inspectionRequired"] === undefined
        ? ""
        : metadata["inspectionRequired"] === true
          ? "indicando a necessidade de vistoria do imóvel"
          : "sem necessidade de vistoria",
      metadata["actionRequired"] === undefined
        ? ""
        : metadata["actionRequired"] === true
          ? "com ação de imissão na posse"
          : "sem ação de imissão na posse",
      metadata["possessionCompleted"] === true ? "e registrando a posse como realizada" : "",
    ]
      .filter(Boolean)
      .join(", ");
    return details ? `atualizou os dados da posse, ${details}` : actionLabels[action];
  }
  if (action === "regularization.updated")
    return `atualizou os dados de regularização${metadata["judicialActions"] !== undefined ? ` e registrou ${Number(metadata["judicialActions"])} ação(ões) judicial(is)` : ""}`;
  if (["task.created", "task.updated"].includes(action))
    return `${action === "task.created" ? "criou" : "atualizou"} a tarefa “${text("title") || "Sem título"}”${text("status") ? ` com status ${text("status").replaceAll("_", " ")}` : ""}`;
  if (
    [
      "financial_movement.created",
      "financial_movement.updated",
      "financial_movement.deleted",
    ].includes(action)
  )
    return `${action.endsWith("created") ? "registrou" : action.endsWith("updated") ? "atualizou" : "excluiu"} uma movimentação de ${text("category") || "categoria não informada"} no valor de ${money(metadata["amount"])}`;
  if (["document.uploaded", "document.created"].includes(action))
    return `enviou um documento${text("category") ? ` na categoria ${text("category")}` : ""}`;
  if (action === "document.deleted") return "excluiu um documento do projeto";
  if (action.startsWith("sales_portfolio."))
    return `${action.endsWith("created") ? "incluiu" : action.endsWith("updated") ? "atualizou" : "removeu"} ${text("name") || "um cadastro"} no portfólio de venda${text("type") ? ` como ${text("type")}` : ""}`;
  if (action.startsWith("sales_proposal."))
    return `${action.endsWith("created") ? "cadastrou" : "atualizou"} a proposta nº ${String(metadata["number"] || "").padStart(3, "0")}${text("status") ? ` com status ${text("status")}` : ""}`;
  if (action.startsWith("service_provider."))
    return `${action.endsWith("created") ? "cadastrou" : "atualizou"} o prestador ${text("name") || "não identificado"}${text("specialty") ? `, especialidade ${text("specialty")}` : ""}`;
  if (action.startsWith("provider_assignment."))
    return `${action.endsWith("created") ? "vinculou" : "atualizou o vínculo de"} um prestador ao projeto${text("status") ? ` com status ${text("status").replaceAll("-", " ")}` : ""}`;
  if (action.startsWith("contract."))
    return `${action.endsWith("created") ? "iniciou" : "atualizou"} o contrato “${text("title") || text("type") || "Sem título"}”${text("status") ? ` com status ${text("status")}` : ""}`;
  if (action === "project.created")
    return `criou o projeto ${text("code")}${text("status") ? ` com status ${text("status").replaceAll("_", " ")}` : ""}`.trim();
  if (action === "project.updated")
    return `atualizou o projeto${text("status") ? `, definindo o status como ${text("status").replaceAll("_", " ")}` : ""}`;
  if (action === "distribution.calculated")
    return `apurou a distribuição de resultados no valor de ${money(metadata["result"])}`;
  return actionLabels[action] || action;
};

const auditCategory = (entityType: string) =>
  entityType === "task"
    ? "Tarefa"
    : entityType === "document"
      ? "Documento"
      : entityType === "financial_movement"
        ? "Financeiro"
        : entityType === "contract"
          ? "Contrato"
          : entityType === "sales_proposal"
            ? "Proposta"
            : entityType === "sales_portfolio"
              ? "Portfólio"
              : entityType.includes("provider")
                ? "Prestador"
                : "Projeto";

const responsibleRoleLabels: Record<string, string> = {
  responsible: "Gestor de Projetos",
  advisor: "Assessor",
  investor: "Investidor",
};

const jsonText = (data: Record<string, unknown>, key: string) => {
  const value = data[key];
  return typeof value === "string" ? value.trim() : "";
};

export const listProjectTaskContacts = createServerFn({ method: "GET" })
  .validator(z.object({ projectId: z.string().uuid() }))
  .handler(async ({ data }) => {
    const { db, schema, membership } = await context(data.projectId, false, "Tarefas");
    const [linked, admins, providers, portfolio] = await Promise.all([
      db
        .select({
          id: schema.contacts.id,
          name: schema.contacts.name,
          email: schema.contacts.email,
          role: schema.projectParticipants.role,
        })
        .from(schema.projectParticipants)
        .innerJoin(schema.contacts, eq(schema.contacts.id, schema.projectParticipants.contactId))
        .where(
          and(
            eq(schema.projectParticipants.projectId, data.projectId),
            eq(schema.contacts.status, "active"),
          ),
        )
        .orderBy(asc(schema.contacts.name)),
      db
        .select({ id: schema.users.id, name: schema.users.name, email: schema.users.email })
        .from(schema.organizationMembers)
        .innerJoin(schema.users, eq(schema.users.id, schema.organizationMembers.userId))
        .where(
          and(
            eq(schema.organizationMembers.organizationId, membership.organizationId),
            eq(schema.organizationMembers.status, "active"),
            inArray(schema.organizationMembers.role, ["owner", "admin"]),
          ),
        )
        .orderBy(asc(schema.users.name)),
      db
        .select({
          id: schema.serviceProviders.id,
          name: schema.serviceProviders.name,
          specialty: sql<string>`${schema.serviceProviders.data}->>'specialty'`,
          email: sql<string>`coalesce(${schema.serviceProviders.data}->>'email', '')`,
        })
        .from(schema.projectProviderAssignments)
        .innerJoin(
          schema.serviceProviders,
          eq(schema.serviceProviders.id, schema.projectProviderAssignments.providerId),
        )
        .where(
          and(
            eq(schema.projectProviderAssignments.projectId, data.projectId),
            eq(schema.projectProviderAssignments.organizationId, membership.organizationId),
          ),
        )
        .orderBy(asc(schema.serviceProviders.name)),
      db
        .select({
          id: schema.salesPortfolio.id,
          name: schema.salesPortfolio.name,
          type: schema.salesPortfolio.type,
          data: schema.salesPortfolio.data,
        })
        .from(schema.salesPortfolio)
        .where(
          and(
            eq(schema.salesPortfolio.projectId, data.projectId),
            eq(schema.salesPortfolio.organizationId, membership.organizationId),
          ),
        )
        .orderBy(asc(schema.salesPortfolio.name)),
    ]);
    // Ordem de prioridade: quem tem conta (admin) define o valor usado quando a pessoa aparece em mais de um cadastro.
    return mergeTaskPeople([
      ...admins.map((u) => ({
        value: `user:${u.id}`,
        label: u.name,
        email: u.email,
        type: "Administrador",
        participantOnly: false,
      })),
      ...linked
        .filter((c) => c.role in responsibleRoleLabels)
        .map((c) => ({
          value: `contact:${c.id}`,
          label: c.name,
          email: c.email,
          type: responsibleRoleLabels[c.role] ?? c.role,
          participantOnly: false,
        })),
      ...linked
        .filter((c) => !(c.role in responsibleRoleLabels))
        .map((c) => ({
          value: `contact:${c.id}`,
          label: c.name,
          email: c.email,
          type: c.role === "auctioneer" ? "Leiloeiro" : c.role,
          participantOnly: true,
        })),
      ...providers.map((p) => ({
        value: `provider:${p.id}`,
        label: p.name,
        email: p.email,
        type: p.specialty ? `Prestador de serviço · ${p.specialty}` : "Prestador de serviço",
        participantOnly: true,
      })),
      ...portfolio.map((p) => ({
        value: `portfolio:${p.id}`,
        label: p.name,
        email: jsonText(p.data, "email"),
        type: p.type,
        participantOnly: true,
      })),
    ]);
  });

export const listProjectTasks = createServerFn({ method: "GET" })
  .validator(z.object({ projectId: z.string().uuid() }))
  .handler(async ({ data }) => {
    const { db, schema } = await context(data.projectId, false, "Tarefas");
    const rows = await db
      .select()
      .from(schema.tasks)
      .where(eq(schema.tasks.projectId, data.projectId))
      .orderBy(desc(schema.tasks.createdAt));
    if (!rows.length) return [];
    const ids = rows.map((r) => r.id);
    const assignees = await db
      .select({
        taskId: schema.taskAssignees.taskId,
        contactId: schema.taskAssignees.contactId,
        userId: schema.taskAssignees.userId,
        contactName: schema.contacts.name,
        userName: schema.users.name,
      })
      .from(schema.taskAssignees)
      .leftJoin(schema.contacts, eq(schema.contacts.id, schema.taskAssignees.contactId))
      .leftJoin(schema.users, eq(schema.users.id, schema.taskAssignees.userId))
      .where(inArray(schema.taskAssignees.taskId, ids));
    const participants = await db
      .select({
        taskId: schema.taskMeetingParticipants.taskId,
        contactId: schema.taskMeetingParticipants.contactId,
        userId: schema.taskMeetingParticipants.userId,
        providerId: schema.taskMeetingParticipants.providerId,
        portfolioId: schema.taskMeetingParticipants.portfolioId,
        contactName: schema.contacts.name,
        userName: schema.users.name,
      })
      .from(schema.taskMeetingParticipants)
      .leftJoin(schema.contacts, eq(schema.contacts.id, schema.taskMeetingParticipants.contactId))
      .leftJoin(schema.users, eq(schema.users.id, schema.taskMeetingParticipants.userId))
      .where(inArray(schema.taskMeetingParticipants.taskId, ids));
    const meetingResponses = await db
      .select({
        taskId: schema.taskMeetingInvitations.taskId,
        recipientName: schema.taskMeetingInvitations.recipientName,
        recipientEmail: schema.taskMeetingInvitations.recipientEmail,
        response: schema.taskMeetingInvitations.response,
        respondedAt: schema.taskMeetingInvitations.respondedAt,
      })
      .from(schema.taskMeetingInvitations)
      .where(inArray(schema.taskMeetingInvitations.taskId, ids));
    const transcriptIds = rows.flatMap((r) =>
      r.transcriptDocumentId ? [r.transcriptDocumentId] : [],
    );
    const transcripts = transcriptIds.length
      ? await db
          .select({
            id: schema.documents.id,
            name: schema.documents.displayName,
            version: schema.documents.version,
            originalName: schema.documents.originalName,
          })
          .from(schema.documents)
          .where(inArray(schema.documents.id, transcriptIds))
      : [];
    return rows.map((task) => ({
      ...task,
      transcript: (() => {
        const found = transcripts.find((t) => t.id === task.transcriptDocumentId);
        return found
          ? {
              name: found.name,
              version: found.version,
              fileName: found.originalName,
              url: `/api/documents/${found.id}`,
            }
          : null;
      })(),
      titulo: task.title,
      descricao: task.description,
      category: task.category,
      prazo: formatDate(task.dueDate),
      responsavel: assignees
        .filter((a) => a.taskId === task.id)
        .map((a) => a.contactName || a.userName)
        .filter(Boolean)
        .join(", "),
      assignees: assignees
        .filter((a) => a.taskId === task.id)
        .map((a) => (a.contactId ? `contact:${a.contactId}` : `user:${a.userId}`)),
      participants: participants.filter((a) => a.taskId === task.id).map(participantValue),
      meetingResponses: meetingResponses.filter((response) => response.taskId === task.id),
      is_online_meeting: task.isOnlineMeeting,
      meeting_url: task.meetingUrl,
      meeting_time: task.meetingTime,
    }));
  });

export const listUpcomingTasks = createServerFn({ method: "GET" }).handler(async () => {
  const { db, schema, session, membership } = await context();
  let allowedProjectIds: string[] | null = null;
  if (!["owner", "admin"].includes(membership.role)) {
    const linked = await db
      .select({ projectId: schema.projectParticipants.projectId })
      .from(schema.projectParticipants)
      .innerJoin(schema.contacts, eq(schema.contacts.id, schema.projectParticipants.contactId))
      .innerJoin(schema.projects, eq(schema.projects.id, schema.projectParticipants.projectId))
      .where(
        and(
          eq(schema.projects.organizationId, membership.organizationId),
          inArray(schema.projectParticipants.role, ["responsible", "advisor", "investor"]),
          eq(schema.contacts.organizationId, membership.organizationId),
          eq(schema.contacts.status, "active"),
          sql`lower(${schema.contacts.email}) = lower(${session.user.email})`,
        ),
      );
    allowedProjectIds = [...new Set(linked.map((item) => item.projectId))];
    if (!allowedProjectIds.length) return [];
  }
  const todayParts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    todayParts.find((item) => item.type === type)?.value || "";
  const today = `${part("year")}-${part("month")}-${part("day")}`;
  return db
    .select({
      id: schema.tasks.id,
      projectId: schema.tasks.projectId,
      title: schema.tasks.title,
      category: schema.tasks.category,
      dueDate: schema.tasks.dueDate,
      status: schema.tasks.status,
      projectName: schema.projects.name,
      projectCode: schema.projects.code,
    })
    .from(schema.tasks)
    .innerJoin(schema.projects, eq(schema.projects.id, schema.tasks.projectId))
    .where(
      and(
        eq(schema.tasks.organizationId, membership.organizationId),
        gte(schema.tasks.dueDate, today),
        ne(schema.tasks.status, "concluido"),
        allowedProjectIds ? inArray(schema.tasks.projectId, allowedProjectIds) : undefined,
      ),
    )
    .orderBy(asc(schema.tasks.dueDate), asc(schema.tasks.createdAt));
});

export const getDashboardDailySummary = createServerFn({ method: "GET" }).handler(async () => {
  const { db, schema, session, membership } = await context();
  let allowedProjectIds: string[] | null = null;
  if (!["owner", "admin"].includes(membership.role)) {
    const linked = await db
      .select({ projectId: schema.projectParticipants.projectId })
      .from(schema.projectParticipants)
      .innerJoin(schema.contacts, eq(schema.contacts.id, schema.projectParticipants.contactId))
      .innerJoin(schema.projects, eq(schema.projects.id, schema.projectParticipants.projectId))
      .where(
        and(
          eq(schema.projects.organizationId, membership.organizationId),
          inArray(schema.projectParticipants.role, ["responsible", "advisor", "investor"]),
          eq(schema.contacts.organizationId, membership.organizationId),
          eq(schema.contacts.status, "active"),
          sql`lower(${schema.contacts.email}) = lower(${session.user.email})`,
        ),
      );
    allowedProjectIds = [...new Set(linked.map((item) => item.projectId))];
    if (!allowedProjectIds.length)
      return {
        tasksDueToday: 0,
        tasksCompletedLast7Days: 0,
        documentsLast3Days: 0,
        financialMovementsLast7Days: 0,
      };
  }

  const now = new Date();
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
  const shiftDate = (days: number) => {
    const value = new Date(`${today}T12:00:00.000Z`);
    value.setUTCDate(value.getUTCDate() + days);
    return value.toISOString().slice(0, 10);
  };
  const last7Days = new Date(`${shiftDate(-6)}T00:00:00-03:00`);
  const last3Days = new Date(`${shiftDate(-2)}T00:00:00-03:00`);
  const projectFilter = allowedProjectIds
    ? inArray(schema.tasks.projectId, allowedProjectIds)
    : undefined;
  const documentProjectFilter = allowedProjectIds
    ? inArray(schema.documents.projectId, allowedProjectIds)
    : undefined;
  const movementProjectFilter = allowedProjectIds
    ? inArray(schema.financialMovements.projectId, allowedProjectIds)
    : undefined;

  const [dueToday, completed, documents, movements] = await Promise.all([
    db
      .select({ id: schema.tasks.id })
      .from(schema.tasks)
      .where(
        and(
          eq(schema.tasks.organizationId, membership.organizationId),
          eq(schema.tasks.dueDate, today),
          ne(schema.tasks.status, "concluido"),
          projectFilter,
        ),
      ),
    db
      .select({ id: schema.tasks.id })
      .from(schema.tasks)
      .where(
        and(
          eq(schema.tasks.organizationId, membership.organizationId),
          eq(schema.tasks.status, "concluido"),
          gte(schema.tasks.updatedAt, last7Days),
          lte(schema.tasks.updatedAt, now),
          projectFilter,
        ),
      ),
    db
      .select({ id: schema.documents.id })
      .from(schema.documents)
      .where(
        and(
          eq(schema.documents.organizationId, membership.organizationId),
          gte(schema.documents.createdAt, last3Days),
          lte(schema.documents.createdAt, now),
          documentProjectFilter,
        ),
      ),
    db
      .select({ amount: schema.financialMovements.amount })
      .from(schema.financialMovements)
      .where(
        and(
          eq(schema.financialMovements.organizationId, membership.organizationId),
          gte(schema.financialMovements.movementDate, last7Days),
          lte(schema.financialMovements.movementDate, now),
          movementProjectFilter,
        ),
      ),
  ]);

  return {
    tasksDueToday: dueToday.length,
    tasksCompletedLast7Days: completed.length,
    documentsLast3Days: documents.length,
    financialMovementsLast7Days: movements.reduce(
      (total, movement) => total + Number(movement.amount || 0),
      0,
    ),
  };
});

export const saveTask = createServerFn({ method: "POST" })
  .validator(taskInput)
  .handler(async ({ data }) => {
    const { db, schema, session, membership } = await context(data.projectId, true, "Tarefas");
    const externalPrefix = /^(provider|portfolio):/;
    const providerIds = data.participants
      .filter((v) => v.startsWith("provider:"))
      .map((v) => v.slice(9));
    const portfolioIds = data.participants
      .filter((v) => v.startsWith("portfolio:"))
      .map((v) => v.slice(10));
    const allTargets = [
      ...new Set([...data.assignees, ...data.participants.filter((v) => !externalPrefix.test(v))]),
    ].map(splitTarget);
    const contactIds = allTargets.flatMap((t) => (t.contactId ? [t.contactId] : [])),
      userIds = allTargets.flatMap((t) => (t.userId ? [t.userId] : []));
    if (contactIds.length) {
      const valid = await db
        .select({ id: schema.contacts.id })
        .from(schema.projectParticipants)
        .innerJoin(schema.contacts, eq(schema.contacts.id, schema.projectParticipants.contactId))
        .where(
          and(
            eq(schema.projectParticipants.projectId, data.projectId),
            inArray(schema.contacts.id, contactIds),
            eq(schema.contacts.organizationId, membership.organizationId),
          ),
        );
      if (new Set(valid.map((v) => v.id)).size !== new Set(contactIds).size)
        throw new Error("Há contatos não vinculados ao projeto.");
    }
    if (providerIds.length) {
      const valid = await db
        .select({ id: schema.projectProviderAssignments.providerId })
        .from(schema.projectProviderAssignments)
        .where(
          and(
            eq(schema.projectProviderAssignments.projectId, data.projectId),
            eq(schema.projectProviderAssignments.organizationId, membership.organizationId),
            inArray(schema.projectProviderAssignments.providerId, providerIds),
          ),
        );
      if (valid.length !== new Set(providerIds).size)
        throw new Error("Há prestadores não vinculados ao projeto.");
    }
    if (portfolioIds.length) {
      const valid = await db
        .select({ id: schema.salesPortfolio.id })
        .from(schema.salesPortfolio)
        .where(
          and(
            eq(schema.salesPortfolio.projectId, data.projectId),
            eq(schema.salesPortfolio.organizationId, membership.organizationId),
            inArray(schema.salesPortfolio.id, portfolioIds),
          ),
        );
      if (valid.length !== new Set(portfolioIds).size)
        throw new Error("Há cadastros de comercialização não vinculados ao projeto.");
    }
    if (userIds.length) {
      const valid = await db
        .select({ id: schema.organizationMembers.userId })
        .from(schema.organizationMembers)
        .where(
          and(
            eq(schema.organizationMembers.organizationId, membership.organizationId),
            eq(schema.organizationMembers.status, "active"),
            inArray(schema.organizationMembers.userId, userIds),
          ),
        );
      if (valid.length !== new Set(userIds).size)
        throw new Error("Há usuários inválidos para esta empresa.");
    }
    const savedTask = await db.transaction(async (tx) => {
      let task;
      if (data.id) {
        [task] = await tx
          .update(schema.tasks)
          .set({
            title: data.title,
            description: data.description,
            category: data.category,
            dueDate: data.dueDate,
            status: data.status,
            isOnlineMeeting: data.isOnlineMeeting,
            meetingUrl: data.isOnlineMeeting ? data.meetingUrl : null,
            meetingTime: data.isOnlineMeeting ? data.meetingTime : null,
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(schema.tasks.id, data.id),
              eq(schema.tasks.projectId, data.projectId),
              eq(schema.tasks.organizationId, membership.organizationId),
            ),
          )
          .returning();
        if (!task) throw new Error("Tarefa não encontrada.");
        await tx.delete(schema.taskAssignees).where(eq(schema.taskAssignees.taskId, task.id));
        await tx
          .delete(schema.taskMeetingParticipants)
          .where(eq(schema.taskMeetingParticipants.taskId, task.id));
      } else {
        [task] = await tx
          .insert(schema.tasks)
          .values({
            organizationId: membership.organizationId,
            projectId: data.projectId,
            title: data.title,
            description: data.description,
            category: data.category,
            dueDate: data.dueDate,
            status: data.status,
            isOnlineMeeting: data.isOnlineMeeting,
            meetingUrl: data.isOnlineMeeting ? data.meetingUrl : null,
            meetingTime: data.isOnlineMeeting ? data.meetingTime : null,
            createdBy: session.user.id,
          })
          .returning();
      }
      if (!task) throw new Error("Não foi possível salvar a tarefa.");
      await tx
        .insert(schema.taskAssignees)
        .values(data.assignees.map((v) => ({ taskId: task.id, ...splitTarget(v) })));
      if (data.isOnlineMeeting)
        await tx
          .insert(schema.taskMeetingParticipants)
          .values(data.participants.map((v) => ({ taskId: task.id, ...splitParticipant(v) })));
      const recipientIds = new Set(userIds);
      if (contactIds.length) {
        const users = await tx
          .select({ id: schema.users.id })
          .from(schema.contacts)
          .innerJoin(
            schema.users,
            sql`lower(${schema.users.email}) = lower(${schema.contacts.email})`,
          )
          .innerJoin(
            schema.organizationMembers,
            and(
              eq(schema.organizationMembers.userId, schema.users.id),
              eq(schema.organizationMembers.organizationId, membership.organizationId),
              eq(schema.organizationMembers.status, "active"),
            ),
          )
          .where(inArray(schema.contacts.id, contactIds));
        users.forEach((u) => recipientIds.add(u.id));
      }
      if (recipientIds.size)
        await tx.insert(schema.notifications).values(
          [...recipientIds].map((recipientUserId) => ({
            organizationId: membership.organizationId,
            projectId: data.projectId,
            recipientUserId,
            type: "task",
            title: data.id ? "Tarefa atualizada" : "Nova tarefa",
            message: `${data.title}${data.dueDate ? ` · vence ${formatDate(data.dueDate)}` : ""}`,
            link: `/projetos/${data.projectId}/tarefas`,
          })),
        );
      await tx.insert(schema.auditLogs).values({
        organizationId: membership.organizationId,
        projectId: data.projectId,
        actorId: session.user.id,
        action: data.id ? "task.updated" : "task.created",
        entityType: "task",
        entityId: task.id,
        metadata: { title: task.title, status: task.status },
      });
      return { id: task.id };
    });

    if (data.id) return { ...savedTask, emailDelivery: { sent: 0, failed: 0 } };

    const emailTargets = [
      ...new Set(data.isOnlineMeeting ? data.participants : data.assignees),
    ].map(splitParticipant);
    const assigneeContactIds = emailTargets.flatMap((target) =>
      target.contactId ? [target.contactId] : [],
    );
    const assigneeUserIds = emailTargets.flatMap((target) =>
      target.userId ? [target.userId] : [],
    );
    const emailProviderIds = emailTargets.flatMap((t) => (t.providerId ? [t.providerId] : []));
    const emailPortfolioIds = emailTargets.flatMap((t) => (t.portfolioId ? [t.portfolioId] : []));
    const [projectRows, contactRecipients, userRecipients, externalRecipients] = await Promise.all([
      db
        .select({ code: schema.projects.code, name: schema.projects.name })
        .from(schema.projects)
        .where(
          and(
            eq(schema.projects.id, data.projectId),
            eq(schema.projects.organizationId, membership.organizationId),
          ),
        )
        .limit(1),
      assigneeContactIds.length
        ? db
            .select({ name: schema.contacts.name, email: schema.contacts.email })
            .from(schema.contacts)
            .where(
              and(
                eq(schema.contacts.organizationId, membership.organizationId),
                inArray(schema.contacts.id, assigneeContactIds),
              ),
            )
        : Promise.resolve([]),
      assigneeUserIds.length
        ? db
            .select({ name: schema.users.name, email: schema.users.email })
            .from(schema.users)
            .innerJoin(
              schema.organizationMembers,
              and(
                eq(schema.organizationMembers.userId, schema.users.id),
                eq(schema.organizationMembers.organizationId, membership.organizationId),
                eq(schema.organizationMembers.status, "active"),
              ),
            )
            .where(inArray(schema.users.id, assigneeUserIds))
        : Promise.resolve([]),
      (async () => {
        const [providerRows, portfolioRows] = await Promise.all([
          emailProviderIds.length
            ? db
                .select({
                  name: schema.serviceProviders.name,
                  email: sql<string>`coalesce(${schema.serviceProviders.data}->>'email', '')`,
                })
                .from(schema.serviceProviders)
                .where(
                  and(
                    eq(schema.serviceProviders.organizationId, membership.organizationId),
                    inArray(schema.serviceProviders.id, emailProviderIds),
                  ),
                )
            : Promise.resolve([]),
          emailPortfolioIds.length
            ? db
                .select({
                  name: schema.salesPortfolio.name,
                  email: sql<string>`coalesce(${schema.salesPortfolio.data}->>'email', '')`,
                })
                .from(schema.salesPortfolio)
                .where(
                  and(
                    eq(schema.salesPortfolio.organizationId, membership.organizationId),
                    inArray(schema.salesPortfolio.id, emailPortfolioIds),
                  ),
                )
            : Promise.resolve([]),
        ]);
        return [...providerRows, ...portfolioRows];
      })(),
    ]);
    const project = projectRows[0];
    const recipients = [...contactRecipients, ...userRecipients, ...externalRecipients]
      .filter((recipient) => Boolean(recipient.email))
      .filter(
        (recipient, index, all) =>
          all.findIndex(
            (item) => item.email.toLocaleLowerCase() === recipient.email.toLocaleLowerCase(),
          ) === index,
      );
    const baseUrl =
      process.env["APP_PUBLIC_URL"] || process.env["BETTER_AUTH_URL"] || "http://127.0.0.1:8081";
    const projectLink = `${baseUrl.replace(/\/$/, "")}/projetos/${data.projectId}/tarefas`;
    const { sendTransactionalEmail, escapeHtml } = await import("@/lib/email.server");
    const projectIdentification = project ? `${project.code} - ${project.name}` : data.projectId;
    const invitations = recipients.map((recipient) => ({
      recipient,
      token: randomBytes(32).toString("base64url"),
    }));
    if (data.isOnlineMeeting && invitations.length)
      await db.insert(schema.taskMeetingInvitations).values(
        invitations.map(({ recipient, token }) => ({
          taskId: savedTask.id,
          recipientName: recipient.name,
          recipientEmail: recipient.email,
          tokenHash: hashToken(token),
        })),
      );
    const deliveries = await Promise.allSettled(
      invitations.map(({ recipient, token }) => {
        const meetingDetails = data.isOnlineMeeting
          ? `<p><strong>Esta tarefa será uma reunião online.</strong><br><strong>Data:</strong> ${escapeHtml(formatDate(data.dueDate))}<br><strong>Horário:</strong> ${escapeHtml(data.meetingTime || "Não informado")}<br><strong>Link da reunião:</strong> <a href="${escapeHtml(data.meetingUrl || "")}">${escapeHtml(data.meetingUrl || "")}</a></p><p><a href="${baseUrl.replace(/\/$/, "")}/confirmar-participacao/${token}?resposta=confirmado" style="display:inline-block;margin:4px;padding:10px 16px;border-radius:6px;background:#0f3d56;color:#fff;text-decoration:none">Confirmo participação</a><a href="${baseUrl.replace(/\/$/, "")}/confirmar-participacao/${token}?resposta=recusado" style="display:inline-block;margin:4px;padding:10px 16px;border-radius:6px;background:#b91c1c;color:#fff;text-decoration:none">Não poderei participar</a></p>`
          : "";
        return sendTransactionalEmail({
          to: recipient.email,
          subject: `ArremataFlow - Uma nova tarefa no projeto ${projectIdentification} foi atribuída a você.`,
          html: `<p>Olá ${escapeHtml(recipient.name)}, uma nova tarefa foi atribuída a você por ${escapeHtml(session.user.name)}.</p><p><strong>Categoria:</strong> ${escapeHtml(data.category)}<br><strong>Título:</strong> ${escapeHtml(data.title)}<br><strong>Descrição:</strong> ${escapeHtml(data.description || "Não informada")}<br><strong>Prazo:</strong> ${escapeHtml(formatDate(data.dueDate))}</p><p><a href="${projectLink}">Acessar o projeto no ArremataFlow</a></p>${meetingDetails}`,
        });
      }),
    );
    const failed = deliveries.filter((delivery) => delivery.status === "rejected").length;
    return { ...savedTask, emailDelivery: { sent: deliveries.length - failed, failed } };
  });

export const respondToTaskMeetingInvitation = createServerFn({ method: "POST" })
  .validator(
    z.object({ token: z.string().min(40).max(200), response: z.enum(["confirmado", "recusado"]) }),
  )
  .handler(async ({ data }) => {
    const { db } = await import("@/db/index.server");
    const schema = await import("@/db/schema");
    const [invitation] = await db
      .select({
        id: schema.taskMeetingInvitations.id,
        recipientName: schema.taskMeetingInvitations.recipientName,
        response: schema.taskMeetingInvitations.response,
        taskTitle: schema.tasks.title,
        projectName: schema.projects.name,
      })
      .from(schema.taskMeetingInvitations)
      .innerJoin(schema.tasks, eq(schema.tasks.id, schema.taskMeetingInvitations.taskId))
      .innerJoin(schema.projects, eq(schema.projects.id, schema.tasks.projectId))
      .where(eq(schema.taskMeetingInvitations.tokenHash, hashToken(data.token)))
      .limit(1);
    if (!invitation) throw new Error("Convite de reunião inválido.");
    const respondedAt = new Date();
    await db
      .update(schema.taskMeetingInvitations)
      .set({ response: data.response, respondedAt })
      .where(eq(schema.taskMeetingInvitations.id, invitation.id));
    return {
      recipientName: invitation.recipientName,
      response: data.response,
      respondedAt: respondedAt.toISOString(),
      taskTitle: invitation.taskTitle,
      projectName: invitation.projectName,
    };
  });

export const listNotifications = createServerFn({ method: "GET" }).handler(async () => {
  const { db, schema, session, membership } = await context();
  const rows = await db
    .select({
      notification: schema.notifications,
      projectName: schema.projects.name,
      projectCode: schema.projects.code,
    })
    .from(schema.notifications)
    .leftJoin(schema.projects, eq(schema.projects.id, schema.notifications.projectId))
    .where(
      and(
        eq(schema.notifications.organizationId, membership.organizationId),
        eq(schema.notifications.recipientUserId, session.user.id),
      ),
    )
    .orderBy(sql`${schema.notifications.readAt} nulls first`, desc(schema.notifications.createdAt))
    .limit(100);
  return rows.map(({ notification, projectName, projectCode }) => ({
    ...notification,
    read: Boolean(notification.readAt),
    projectName,
    projectCode,
  }));
});
export const listProjectAudit = createServerFn({ method: "GET" })
  .validator(z.object({ projectId: z.string().uuid() }))
  .handler(async ({ data }) => {
    const { db, schema } = await context(data.projectId, false, "Histórico");
    const rows = await db
      .select({ event: schema.auditLogs, actorName: schema.users.name })
      .from(schema.auditLogs)
      .innerJoin(schema.users, eq(schema.users.id, schema.auditLogs.actorId))
      .where(eq(schema.auditLogs.projectId, data.projectId))
      .orderBy(desc(schema.auditLogs.createdAt))
      .limit(200);
    return rows.map(({ event, actorName }) => ({
      id: event.id,
      category: auditCategory(event.entityType),
      userName: actorName,
      action: auditActionDescription(event.action, event.metadata),
      createdAt: event.createdAt.toISOString(),
    }));
  });

export const listRecentProjectAudit = createServerFn({ method: "GET" }).handler(async () => {
  const { db, schema, session, membership } = await context();
  let allowedProjectIds: string[] | null = null;
  if (!["owner", "admin"].includes(membership.role)) {
    const linked = await db
      .select({ projectId: schema.projectParticipants.projectId })
      .from(schema.projectParticipants)
      .innerJoin(schema.contacts, eq(schema.contacts.id, schema.projectParticipants.contactId))
      .where(
        and(
          inArray(schema.projectParticipants.role, ["responsible", "advisor", "investor"]),
          eq(schema.contacts.organizationId, membership.organizationId),
          eq(schema.contacts.status, "active"),
          sql`lower(${schema.contacts.email}) = lower(${session.user.email})`,
        ),
      );
    allowedProjectIds = [...new Set(linked.map((item) => item.projectId))];
    if (!allowedProjectIds.length) return [];
  }
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const rows = await db
    .select({
      event: schema.auditLogs,
      actorName: schema.users.name,
      projectName: schema.projects.name,
      projectCode: schema.projects.code,
    })
    .from(schema.auditLogs)
    .innerJoin(schema.users, eq(schema.users.id, schema.auditLogs.actorId))
    .innerJoin(schema.projects, eq(schema.projects.id, schema.auditLogs.projectId))
    .where(
      and(
        eq(schema.auditLogs.organizationId, membership.organizationId),
        gte(schema.auditLogs.createdAt, cutoff),
        allowedProjectIds ? inArray(schema.auditLogs.projectId, allowedProjectIds) : undefined,
      ),
    )
    .orderBy(desc(schema.auditLogs.createdAt));
  return rows.map(({ event, actorName, projectName, projectCode }) => ({
    id: event.id,
    projectId: event.projectId!,
    projectName,
    projectCode,
    category: auditCategory(event.entityType),
    userName: actorName,
    action: auditActionDescription(event.action, event.metadata),
    createdAt: event.createdAt.toISOString(),
  }));
});
export const unreadNotificationCount = createServerFn({ method: "GET" }).handler(async () => {
  const { db, schema, session, membership } = await context();
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(schema.notifications)
    .where(
      and(
        eq(schema.notifications.organizationId, membership.organizationId),
        eq(schema.notifications.recipientUserId, session.user.id),
        sql`${schema.notifications.readAt} is null`,
      ),
    );
  return Number(row?.count || 0);
});
export const markNotificationRead = createServerFn({ method: "POST" })
  .validator(z.object({ id: z.string().uuid() }))
  .handler(async ({ data }) => {
    const { db, schema, session, membership } = await context();
    await db
      .update(schema.notifications)
      .set({ readAt: new Date() })
      .where(
        and(
          eq(schema.notifications.id, data.id),
          eq(schema.notifications.organizationId, membership.organizationId),
          eq(schema.notifications.recipientUserId, session.user.id),
        ),
      );
    return { ok: true };
  });

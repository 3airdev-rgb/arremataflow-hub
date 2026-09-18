import { createServerFn } from "@tanstack/react-start";
import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import { z } from "zod";

const statuses = ["nao_iniciado", "andamento", "aguardando", "pendente", "concluido"] as const;
const targetSchema = z.string().regex(/^(contact:[0-9a-f-]{36}|user:.+)$/i);
const taskInput = z.object({
  id: z.string().uuid().optional(), projectId: z.string().uuid(),
  title: z.string().trim().min(2).max(180), description: z.string().trim().max(3000).default(""),
  category: z.string().trim().min(2).max(80), dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
  status: z.enum(statuses).default("nao_iniciado"), assignees: z.array(targetSchema).min(1).max(30),
  isOnlineMeeting: z.boolean().default(false), meetingUrl: z.string().url().max(500).nullable(),
  meetingTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).nullable(), participants: z.array(targetSchema).max(50).default([]),
}).superRefine((data, ctx) => {
  if (data.isOnlineMeeting && (!data.meetingUrl || !data.meetingTime || !data.participants.length)) ctx.addIssue({ code: "custom", message: "Informe link, horário e participantes da reunião." });
  if (data.meetingUrl && new URL(data.meetingUrl).protocol !== "https:") ctx.addIssue({ code: "custom", message: "O link da reunião deve usar HTTPS." });
});

async function context(projectId?: string, requireManager = false) {
  const [{ getRequestHeaders }, { auth }, { db }, schema] = await Promise.all([
    import("@tanstack/react-start/server"), import("@/lib/auth.server"), import("@/db/index.server"), import("@/db/schema"),
  ]);
  const session = await auth.api.getSession({ headers: getRequestHeaders() });
  if (!session) throw new Error("Não autenticado.");
  const { resolveActiveMembership } = await import("@/lib/active-organization.server");
  const membership = await resolveActiveMembership(db, schema, session.user.id);
  if (!membership) throw new Error("Empresa ativa não encontrada.");
  if (requireManager && !["owner", "admin"].includes(membership.role)) throw new Error("Sem permissão para alterar tarefas.");
  if (projectId) {
    const [project] = await db.select({ id: schema.projects.id }).from(schema.projects).where(and(eq(schema.projects.id, projectId), eq(schema.projects.organizationId, membership.organizationId))).limit(1);
    if (!project) throw new Error("Projeto não encontrado nesta empresa.");
    if (!["owner", "admin"].includes(membership.role)) {
      const expectedRole = membership.role === "advisor" ? "advisor" : "investor";
      const [access] = await db.select({ id: schema.projectParticipants.id }).from(schema.projectParticipants)
        .innerJoin(schema.contacts, eq(schema.contacts.id, schema.projectParticipants.contactId))
        .where(and(eq(schema.projectParticipants.projectId, projectId), eq(schema.projectParticipants.role, expectedRole), eq(schema.contacts.organizationId, membership.organizationId), sql`lower(${schema.contacts.email}) = lower(${session.user.email})`)).limit(1);
      if (!access) throw new Error("Projeto não vinculado ao usuário.");
    }
  }
  return { db, schema, session, membership };
}

const splitTarget = (value: string) => value.startsWith("contact:") ? { contactId: value.slice(8), userId: null } : { contactId: null, userId: value.slice(5) };
const formatDate = (value: string | null) => value ? value.split("-").reverse().join("/") : "Sem prazo";

export const listProjectTaskContacts = createServerFn({ method: "GET" }).validator(z.object({ projectId: z.string().uuid() })).handler(async ({ data }) => {
  const { db, schema, membership } = await context(data.projectId);
  const linked = await db.select({ id: schema.contacts.id, name: schema.contacts.name, email: schema.contacts.email, type: schema.contacts.type })
    .from(schema.projectParticipants).innerJoin(schema.contacts, eq(schema.contacts.id, schema.projectParticipants.contactId))
    .where(and(eq(schema.projectParticipants.projectId, data.projectId), eq(schema.contacts.status, "active"))).orderBy(asc(schema.contacts.name));
  const members = await db.select({ id: schema.users.id, name: schema.users.name, email: schema.users.email, role: schema.organizationMembers.role })
    .from(schema.organizationMembers).innerJoin(schema.users, eq(schema.users.id, schema.organizationMembers.userId))
    .where(and(eq(schema.organizationMembers.organizationId, membership.organizationId), eq(schema.organizationMembers.status, "active"))).orderBy(asc(schema.users.name));
  return [...members.map((m) => ({ label: m.name, value: `user:${m.id}`, type: ["owner", "admin"].includes(m.role) ? "Administrador" : m.role === "advisor" ? "Assessor" : "Investidor", email: m.email })),
    ...linked.map((c) => ({ label: c.name, value: `contact:${c.id}`, type: c.type, email: c.email }))]
    .filter((item, index, all) => all.findIndex((other) => other.value === item.value) === index);
});

export const listProjectTasks = createServerFn({ method: "GET" }).validator(z.object({ projectId: z.string().uuid() })).handler(async ({ data }) => {
  const { db, schema } = await context(data.projectId);
  const rows = await db.select().from(schema.tasks).where(eq(schema.tasks.projectId, data.projectId)).orderBy(desc(schema.tasks.createdAt));
  if (!rows.length) return [];
  const ids = rows.map((r) => r.id);
  const assignees = await db.select({ taskId: schema.taskAssignees.taskId, contactId: schema.taskAssignees.contactId, userId: schema.taskAssignees.userId, contactName: schema.contacts.name, userName: schema.users.name })
    .from(schema.taskAssignees).leftJoin(schema.contacts, eq(schema.contacts.id, schema.taskAssignees.contactId)).leftJoin(schema.users, eq(schema.users.id, schema.taskAssignees.userId)).where(inArray(schema.taskAssignees.taskId, ids));
  const participants = await db.select({ taskId: schema.taskMeetingParticipants.taskId, contactId: schema.taskMeetingParticipants.contactId, userId: schema.taskMeetingParticipants.userId, contactName: schema.contacts.name, userName: schema.users.name })
    .from(schema.taskMeetingParticipants).leftJoin(schema.contacts, eq(schema.contacts.id, schema.taskMeetingParticipants.contactId)).leftJoin(schema.users, eq(schema.users.id, schema.taskMeetingParticipants.userId)).where(inArray(schema.taskMeetingParticipants.taskId, ids));
  return rows.map((task) => ({ ...task, titulo: task.title, descricao: task.description, category: task.category, prazo: formatDate(task.dueDate),
    responsavel: assignees.filter((a) => a.taskId === task.id).map((a) => a.contactName || a.userName).filter(Boolean).join(", "),
    assignees: assignees.filter((a) => a.taskId === task.id).map((a) => a.contactId ? `contact:${a.contactId}` : `user:${a.userId}`),
    participants: participants.filter((a) => a.taskId === task.id).map((a) => a.contactId ? `contact:${a.contactId}` : `user:${a.userId}`),
    is_online_meeting: task.isOnlineMeeting, meeting_url: task.meetingUrl, meeting_time: task.meetingTime,
  }));
});

export const saveTask = createServerFn({ method: "POST" }).validator(taskInput).handler(async ({ data }) => {
  const { db, schema, session, membership } = await context(data.projectId, true);
  const allTargets = [...new Set([...data.assignees, ...data.participants])].map(splitTarget);
  const contactIds = allTargets.flatMap((t) => t.contactId ? [t.contactId] : []), userIds = allTargets.flatMap((t) => t.userId ? [t.userId] : []);
  if (contactIds.length) {
    const valid = await db.select({ id: schema.contacts.id }).from(schema.projectParticipants).innerJoin(schema.contacts, eq(schema.contacts.id, schema.projectParticipants.contactId)).where(and(eq(schema.projectParticipants.projectId, data.projectId), inArray(schema.contacts.id, contactIds), eq(schema.contacts.organizationId, membership.organizationId)));
    if (new Set(valid.map((v) => v.id)).size !== new Set(contactIds).size) throw new Error("Há contatos não vinculados ao projeto.");
  }
  if (userIds.length) {
    const valid = await db.select({ id: schema.organizationMembers.userId }).from(schema.organizationMembers).where(and(eq(schema.organizationMembers.organizationId, membership.organizationId), eq(schema.organizationMembers.status, "active"), inArray(schema.organizationMembers.userId, userIds)));
    if (valid.length !== new Set(userIds).size) throw new Error("Há usuários inválidos para esta empresa.");
  }
  return db.transaction(async (tx) => {
    let task;
    if (data.id) {
      [task] = await tx.update(schema.tasks).set({ title: data.title, description: data.description, category: data.category, dueDate: data.dueDate, status: data.status, isOnlineMeeting: data.isOnlineMeeting, meetingUrl: data.isOnlineMeeting ? data.meetingUrl : null, meetingTime: data.isOnlineMeeting ? data.meetingTime : null, updatedAt: new Date() }).where(and(eq(schema.tasks.id, data.id), eq(schema.tasks.projectId, data.projectId), eq(schema.tasks.organizationId, membership.organizationId))).returning();
      if (!task) throw new Error("Tarefa não encontrada.");
      await tx.delete(schema.taskAssignees).where(eq(schema.taskAssignees.taskId, task.id)); await tx.delete(schema.taskMeetingParticipants).where(eq(schema.taskMeetingParticipants.taskId, task.id));
    } else {
      [task] = await tx.insert(schema.tasks).values({ organizationId: membership.organizationId, projectId: data.projectId, title: data.title, description: data.description, category: data.category, dueDate: data.dueDate, status: data.status, isOnlineMeeting: data.isOnlineMeeting, meetingUrl: data.isOnlineMeeting ? data.meetingUrl : null, meetingTime: data.isOnlineMeeting ? data.meetingTime : null, createdBy: session.user.id }).returning();
    }
    if (!task) throw new Error("Não foi possível salvar a tarefa.");
    await tx.insert(schema.taskAssignees).values(data.assignees.map((v) => ({ taskId: task.id, ...splitTarget(v) })));
    if (data.isOnlineMeeting) await tx.insert(schema.taskMeetingParticipants).values(data.participants.map((v) => ({ taskId: task.id, ...splitTarget(v) })));
    const recipientIds = new Set(userIds);
    if (contactIds.length) {
      const users = await tx.select({ id: schema.users.id }).from(schema.contacts).innerJoin(schema.users, sql`lower(${schema.users.email}) = lower(${schema.contacts.email})`).innerJoin(schema.organizationMembers, and(eq(schema.organizationMembers.userId, schema.users.id), eq(schema.organizationMembers.organizationId, membership.organizationId), eq(schema.organizationMembers.status, "active"))).where(inArray(schema.contacts.id, contactIds));
      users.forEach((u) => recipientIds.add(u.id));
    }
    if (recipientIds.size) await tx.insert(schema.notifications).values([...recipientIds].map((recipientUserId) => ({ organizationId: membership.organizationId, projectId: data.projectId, recipientUserId, type: "task", title: data.id ? "Tarefa atualizada" : "Nova tarefa", message: `${data.title}${data.dueDate ? ` · vence ${formatDate(data.dueDate)}` : ""}`, link: `/projetos/${data.projectId}/tarefas` })));
    await tx.insert(schema.auditLogs).values({ organizationId: membership.organizationId, projectId: data.projectId, actorId: session.user.id, action: data.id ? "task.updated" : "task.created", entityType: "task", entityId: task.id, metadata: { title: task.title, status: task.status } });
    return { id: task.id };
  });
});

export const listNotifications = createServerFn({ method: "GET" }).handler(async () => {
  const { db, schema, session, membership } = await context();
  const rows = await db.select({ notification: schema.notifications, projectName: schema.projects.name, projectCode: schema.projects.code }).from(schema.notifications).leftJoin(schema.projects, eq(schema.projects.id, schema.notifications.projectId)).where(and(eq(schema.notifications.organizationId, membership.organizationId), eq(schema.notifications.recipientUserId, session.user.id))).orderBy(sql`${schema.notifications.readAt} nulls first`, desc(schema.notifications.createdAt)).limit(100);
  return rows.map(({ notification, projectName, projectCode }) => ({ ...notification, read: Boolean(notification.readAt), projectName, projectCode }));
});
export const listProjectAudit = createServerFn({ method: "GET" }).validator(z.object({ projectId: z.string().uuid() })).handler(async ({ data }) => {
  const { db, schema } = await context(data.projectId);
  const rows = await db.select({ event: schema.auditLogs, actorName: schema.users.name })
    .from(schema.auditLogs)
    .innerJoin(schema.users, eq(schema.users.id, schema.auditLogs.actorId))
    .where(eq(schema.auditLogs.projectId, data.projectId))
    .orderBy(desc(schema.auditLogs.createdAt))
    .limit(200);
  const actionLabels: Record<string, string> = {
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
  };
  return rows.map(({ event, actorName }) => ({
    id: event.id,
    category: event.entityType === "task" ? "Tarefa" : event.entityType === "document" ? "Documento" : event.entityType === "financial_movement" ? "Financeiro" : "Projeto",
    userName: actorName,
    action: actionLabels[event.action] || event.action,
    createdAt: event.createdAt.toISOString(),
  }));
});
export const unreadNotificationCount = createServerFn({ method: "GET" }).handler(async () => {
  const { db, schema, session, membership } = await context();
  const [row] = await db.select({ count: sql<number>`count(*)::int` }).from(schema.notifications).where(and(eq(schema.notifications.organizationId, membership.organizationId), eq(schema.notifications.recipientUserId, session.user.id), sql`${schema.notifications.readAt} is null`)); return Number(row?.count || 0);
});
export const markNotificationRead = createServerFn({ method: "POST" }).validator(z.object({ id: z.string().uuid() })).handler(async ({ data }) => {
  const { db, schema, session, membership } = await context(); await db.update(schema.notifications).set({ readAt: new Date() }).where(and(eq(schema.notifications.id, data.id), eq(schema.notifications.organizationId, membership.organizationId), eq(schema.notifications.recipientUserId, session.user.id))); return { ok: true };
});

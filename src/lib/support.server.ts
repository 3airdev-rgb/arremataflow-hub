import { getRequestHeaders } from "@tanstack/react-start/server";
import { and, asc, desc, eq } from "drizzle-orm";
import { db } from "@/db/index.server";
import * as schema from "@/db/schema";
import { auth } from "@/lib/auth.server";
import { resolveActiveMembership } from "@/lib/active-organization.server";
import { activePlanForOrganization } from "@/lib/developer.server";
import { requireProjectRole } from "@/lib/project-access.server";

async function context() {
  const session = await auth.api.getSession({ headers: getRequestHeaders() });
  if (!session) throw new Error("Não autenticado.");
  const [user] = await db
    .select({ systemRole: schema.users.systemRole })
    .from(schema.users)
    .where(eq(schema.users.id, session.user.id));
  const isDeveloper = user?.systemRole === "developer";
  const membership = isDeveloper
    ? null
    : await resolveActiveMembership(db, schema, session.user.id);
  if (!isDeveloper && !membership) throw new Error("Empresa ativa não encontrada.");
  return { userId: session.user.id, userEmail: session.user.email, isDeveloper, membership };
}

export async function listSupportTicketsImpl() {
  const ctx = await context();
  return db
    .select()
    .from(schema.supportTickets)
    .where(
      ctx.isDeveloper
        ? undefined
        : and(
            eq(schema.supportTickets.organizationId, ctx.membership!.organizationId),
            eq(schema.supportTickets.openedBy, ctx.userId),
          ),
    )
    .orderBy(desc(schema.supportTickets.createdAt));
}

export async function getSupportThreadImpl(data: { ticketId: string }) {
  const ctx = await context();
  const [ticket] = await db
    .select()
    .from(schema.supportTickets)
    .where(eq(schema.supportTickets.id, data.ticketId));
  if (
    !ticket ||
    (!ctx.isDeveloper &&
      (ticket.organizationId !== ctx.membership!.organizationId || ticket.openedBy !== ctx.userId))
  )
    throw new Error("Chamado não encontrado.");
  const messages = await db
    .select({
      id: schema.supportMessages.id,
      body: schema.supportMessages.body,
      authorId: schema.supportMessages.authorId,
      createdAt: schema.supportMessages.createdAt,
      authorName: schema.users.name,
    })
    .from(schema.supportMessages)
    .innerJoin(schema.users, eq(schema.users.id, schema.supportMessages.authorId))
    .where(eq(schema.supportMessages.ticketId, ticket.id))
    .orderBy(schema.supportMessages.createdAt);
  const [assignee] = ticket.assignedTo
    ? await db
        .select({ name: schema.users.name })
        .from(schema.users)
        .where(eq(schema.users.id, ticket.assignedTo))
    : [];
  const [history, attachments] = await Promise.all([
    db
      .select({
        id: schema.supportStatusHistory.id,
        fromStatus: schema.supportStatusHistory.fromStatus,
        toStatus: schema.supportStatusHistory.toStatus,
        createdAt: schema.supportStatusHistory.createdAt,
        actorName: schema.users.name,
      })
      .from(schema.supportStatusHistory)
      .innerJoin(schema.users, eq(schema.users.id, schema.supportStatusHistory.actorId))
      .where(eq(schema.supportStatusHistory.ticketId, ticket.id))
      .orderBy(asc(schema.supportStatusHistory.createdAt)),
    db
      .select()
      .from(schema.supportAttachments)
      .where(eq(schema.supportAttachments.ticketId, ticket.id))
      .orderBy(asc(schema.supportAttachments.createdAt)),
  ]);
  return { ticket, messages, history, attachments, assigneeName: assignee?.name ?? null };
}

export async function createSupportTicketImpl(data: {
  subject: string;
  category: string;
  description: string;
  priority: "low" | "normal" | "high" | "urgent";
  projectId?: string | undefined;
}) {
  const ctx = await context();
  if (!ctx.membership) throw new Error("Selecione uma empresa para abrir chamado.");
  if (data.projectId) {
    const [project] = await db
      .select({ id: schema.projects.id })
      .from(schema.projects)
      .where(
        and(
          eq(schema.projects.id, data.projectId),
          eq(schema.projects.organizationId, ctx.membership.organizationId),
        ),
      );
    if (!project) throw new Error("Projeto não encontrado nesta empresa.");
    await requireProjectRole(db, schema, ctx.membership, ctx.userEmail, data.projectId, "investor");
  }
  const now = new Date();
  const plan = await activePlanForOrganization(ctx.membership.organizationId);
  const factor = data.priority === "urgent" ? 0.25 : data.priority === "high" ? 0.5 : 1;
  const firstHours = Math.max(1, Math.ceil((plan?.firstResponseHours ?? 24) * factor));
  const resolutionHours = Math.max(1, Math.ceil((plan?.resolutionHours ?? 72) * factor));
  return db.transaction(async (tx) => {
    const controlNumber = `AF-SUP-${Date.now()}-${crypto.randomUUID().slice(0, 6).toUpperCase()}`;
    const [ticket] = await tx
      .insert(schema.supportTickets)
      .values({
        organizationId: ctx.membership!.organizationId,
        controlNumber,
        openedBy: ctx.userId,
        ...data,
        firstResponseDueAt: new Date(now.getTime() + firstHours * 3600000),
        resolutionDueAt: new Date(now.getTime() + resolutionHours * 3600000),
      })
      .returning();
    if (!ticket) throw new Error("Não foi possível abrir o chamado.");
    await tx
      .insert(schema.supportMessages)
      .values({ ticketId: ticket.id, authorId: ctx.userId, body: data.description });
    await tx
      .insert(schema.supportStatusHistory)
      .values({ ticketId: ticket.id, actorId: ctx.userId, toStatus: "open" });
    await tx.insert(schema.auditLogs).values({
      organizationId: ctx.membership!.organizationId,
      actorId: ctx.userId,
      action: "support.ticket_created",
      entityType: "support_ticket",
      entityId: ticket.id,
      metadata: { controlNumber: ticket.controlNumber, priority: ticket.priority },
    });
    return ticket;
  });
}

export async function replySupportTicketImpl(data: {
  ticketId: string;
  body: string;
  status?: "open" | "in_progress" | "waiting" | "resolved" | "closed" | undefined;
}) {
  const ctx = await context();
  const [ticket] = await db
    .select()
    .from(schema.supportTickets)
    .where(eq(schema.supportTickets.id, data.ticketId));
  if (
    !ticket ||
    (!ctx.isDeveloper &&
      (ticket.organizationId !== ctx.membership!.organizationId || ticket.openedBy !== ctx.userId))
  )
    throw new Error("Chamado não encontrado.");
  if (!ctx.isDeveloper && data.status && data.status !== "closed")
    throw new Error("Somente o suporte pode alterar este status.");
  await db.transaction(async (tx) => {
    if (data.body)
      await tx
        .insert(schema.supportMessages)
        .values({ ticketId: ticket.id, authorId: ctx.userId, body: data.body });
    await tx
      .update(schema.supportTickets)
      .set({
        status: data.status ?? ticket.status,
        assignedTo: ctx.isDeveloper ? ctx.userId : ticket.assignedTo,
        firstRespondedAt:
          ctx.isDeveloper && data.body && !ticket.firstRespondedAt
            ? new Date()
            : ticket.firstRespondedAt,
        resolvedAt:
          data.status === "resolved"
            ? new Date()
            : data.status && data.status !== "closed"
              ? null
              : ticket.resolvedAt,
        updatedAt: new Date(),
      })
      .where(eq(schema.supportTickets.id, ticket.id));
    if (data.status && data.status !== ticket.status)
      await tx.insert(schema.supportStatusHistory).values({
        ticketId: ticket.id,
        actorId: ctx.userId,
        fromStatus: ticket.status,
        toStatus: data.status,
      });
    if (ctx.isDeveloper)
      await tx.insert(schema.notifications).values({
        organizationId: ticket.organizationId,
        projectId: ticket.projectId,
        recipientUserId: ticket.openedBy,
        type: "support",
        title: `Chamado ${ticket.controlNumber} atualizado`,
        message: data.body || `Status alterado para ${data.status}.`,
        link: `/suporte?ticket=${ticket.id}`,
      });
    if (ctx.isDeveloper)
      await tx.insert(schema.developerAuditLogs).values({
        actorId: ctx.userId,
        action: "support.ticket_replied",
        targetId: ticket.id,
        before: { status: ticket.status },
        after: { status: data.status ?? ticket.status },
      });
    else
      await tx.insert(schema.auditLogs).values({
        organizationId: ticket.organizationId,
        actorId: ctx.userId,
        action: "support.ticket_replied",
        entityType: "support_ticket",
        entityId: ticket.id,
        metadata: { status: data.status ?? ticket.status },
      });
  });
  return { ok: true };
}

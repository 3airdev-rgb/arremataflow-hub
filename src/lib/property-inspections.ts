import { createHash, randomBytes } from "node:crypto";
import { createServerFn } from "@tanstack/react-start";
import { and, desc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { phoneSchema } from "@/lib/phone";

const email = z.string().trim().email("Informe um e-mail válido.").max(254);
const tokenSchema = z.string().min(40).max(200);
const answerSchema = z.object({
  inspectionType: z.enum(["posse", "venda"]),
  dateTime: z.string().min(1),
  propertyType: z.string().min(1).max(80),
  inspectorPhone: phoneSchema,
  bailiffPresent: z.boolean(),
  bailiffName: z.string().max(180),
  bailiffPhone: phoneSchema,
  keys: z.record(z.object({ has: z.boolean(), quantity: z.number().int().min(0).max(100) })),
  otherAccess: z.string().max(1000),
  utilities: z.record(z.union([z.string().max(300), z.boolean()])),
  rooms: z
    .array(
      z.object({
        name: z.string().min(1).max(80),
        conditions: z.record(z.string().max(30)),
        furniture: z.string().max(3000),
        notes: z.string().max(5000),
      }),
    )
    .max(50),
  installations: z.record(z.union([z.string().max(1000), z.boolean()])),
  inventory: z
    .array(
      z.object({
        item: z.string().max(180),
        model: z.string().max(180),
        condition: z.string().max(80),
      }),
    )
    .max(200),
  generalNotes: z.string().max(10000),
  photos: z
    .array(
      z.object({
        name: z.string().max(240),
        type: z.enum(["image/jpeg", "image/png", "image/webp"]),
        data: z.string().max(2_900_000),
      }),
    )
    .max(10),
});

export type InspectionAnswers = z.infer<typeof answerSchema>;

const hash = (token: string) => createHash("sha256").update(token).digest("hex");

async function authenticatedContext(projectId: string) {
  const [{ getRequestHeaders }, { auth }, { db }, schema, { resolveActiveMembership }] =
    await Promise.all([
      import("@tanstack/react-start/server"),
      import("@/lib/auth.server"),
      import("@/db/index.server"),
      import("@/db/schema"),
      import("@/lib/active-organization.server"),
    ]);
  const session = await auth.api.getSession({ headers: getRequestHeaders() });
  if (!session) throw new Error("Não autenticado.");
  const membership = await resolveActiveMembership(db, schema, session.user.id);
  if (!membership) throw new Error("Empresa ativa não encontrada.");
  const [project] = await db
    .select()
    .from(schema.projects)
    .where(
      and(
        eq(schema.projects.id, projectId),
        eq(schema.projects.organizationId, membership.organizationId),
      ),
    )
    .limit(1);
  if (!project) throw new Error("Projeto não encontrado.");
  const { requireProjectRole } = await import("@/lib/project-access.server");
  await requireProjectRole(
    db,
    schema,
    membership,
    session.user.email,
    projectId,
    "project_manager",
  );
  return { db, schema, session, membership, project };
}

export const listPropertyInspections = createServerFn({ method: "GET" })
  .validator(z.object({ projectId: z.string().uuid() }))
  .handler(async ({ data }) => {
    const { db, schema, membership } = await authenticatedContext(data.projectId);
    return db
      .select({
        id: schema.propertyInspections.id,
        inspectorName: schema.propertyInspections.inspectorName,
        inspectorEmail: schema.propertyInspections.inspectorEmail,
        dueDate: schema.propertyInspections.dueDate,
        status: schema.propertyInspections.status,
        sentAt: schema.propertyInspections.sentAt,
        completedAt: schema.propertyInspections.completedAt,
        inspectionDate: sql<string | null>`${schema.propertyInspections.formData}->>'dateTime'`,
      })
      .from(schema.propertyInspections)
      .where(
        and(
          eq(schema.propertyInspections.projectId, data.projectId),
          eq(schema.propertyInspections.organizationId, membership.organizationId),
        ),
      )
      .orderBy(desc(schema.propertyInspections.createdAt));
  });

export const sendPropertyInspection = createServerFn({ method: "POST" })
  .validator(
    z.object({
      projectId: z.string().uuid(),
      inspectorName: z.string().trim().min(2).max(180),
      inspectorEmail: email,
      dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Informe a data limite da vistoria."),
    }),
  )
  .handler(async ({ data }) => {
    const { db, schema, session, membership, project } = await authenticatedContext(data.projectId);
    const token = randomBytes(32).toString("base64url");
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    const created = await db.transaction(async (tx) => {
      const [inspection] = await tx
        .insert(schema.propertyInspections)
        .values({
          organizationId: membership.organizationId,
          projectId: data.projectId,
          inspectorName: data.inspectorName,
          inspectorEmail: data.inspectorEmail,
          dueDate: data.dueDate,
          tokenHash: hash(token),
          expiresAt,
          sentAt: new Date(),
          createdBy: session.user.id,
        })
        .returning({ id: schema.propertyInspections.id });
      if (!inspection) throw new Error("Não foi possível criar a vistoria.");
      const [task] = await tx
        .insert(schema.tasks)
        .values({
          organizationId: membership.organizationId,
          projectId: data.projectId,
          title: "Vistoria do imóvel",
          description: `Realização da vistoria do imóvel "${project.name}" pelo vistoriador "${data.inspectorName}"`,
          category: "Aquisição",
          dueDate: data.dueDate,
          status: "andamento",
          isOnlineMeeting: false,
          meetingUrl: null,
          meetingTime: null,
          createdBy: session.user.id,
        })
        .returning({ id: schema.tasks.id });
      if (!task) throw new Error("Não foi possível criar a tarefa da vistoria.");
      await tx
        .insert(schema.taskAssignees)
        .values({ taskId: task.id, contactId: null, userId: session.user.id });
      const [notification] = await tx
        .insert(schema.notifications)
        .values({
          organizationId: membership.organizationId,
          projectId: data.projectId,
          recipientUserId: session.user.id,
          type: "task",
          title: "Nova tarefa",
          message: `Vistoria do imóvel · vence ${data.dueDate.split("-").reverse().join("/")}`,
          link: `/projetos/${data.projectId}/tarefas`,
        })
        .returning({ id: schema.notifications.id });
      const [audit] = await tx
        .insert(schema.auditLogs)
        .values({
          organizationId: membership.organizationId,
          projectId: data.projectId,
          actorId: session.user.id,
          action: "task.created",
          entityType: "task",
          entityId: task.id,
          metadata: {
            title: "Vistoria do imóvel",
            status: "andamento",
            source: "property_inspection",
          },
        })
        .returning({ id: schema.auditLogs.id });
      return {
        inspectionId: inspection.id,
        taskId: task.id,
        notificationId: notification?.id,
        auditId: audit?.id,
      };
    });
    const baseUrl =
      process.env["APP_PUBLIC_URL"] || process.env["BETTER_AUTH_URL"] || "http://127.0.0.1:8081";
    const link = `${baseUrl.replace(/\/$/, "")}/vistoria/${token}`;
    const { sendTransactionalEmail, escapeHtml } = await import("@/lib/email.server");
    const formattedDueDate = data.dueDate.split("-").reverse().join("/");
    try {
      await sendTransactionalEmail({
        to: data.inspectorEmail,
        subject: `Vistoria do imóvel - ${project.name}`,
        html: `<p>Olá, ${escapeHtml(data.inspectorName)}.</p><p>Você foi convidado para realizar a vistoria do imóvel do projeto <strong>${escapeHtml(project.name)}</strong>.</p><p><strong>Data limite para realização: ${formattedDueDate}</strong></p><p><a href="${link}">Abrir formulário de vistoria</a></p><p>O link é individual e válido por 30 dias.</p>`,
      });
    } catch (error) {
      await db.transaction(async (tx) => {
        if (created.notificationId)
          await tx
            .delete(schema.notifications)
            .where(eq(schema.notifications.id, created.notificationId));
        if (created.auditId)
          await tx.delete(schema.auditLogs).where(eq(schema.auditLogs.id, created.auditId));
        await tx.delete(schema.tasks).where(eq(schema.tasks.id, created.taskId));
        await tx
          .delete(schema.propertyInspections)
          .where(eq(schema.propertyInspections.id, created.inspectionId));
      });
      throw error;
    }
    return { ok: true };
  });

export const getPublicInspection = createServerFn({ method: "GET" })
  .validator(z.object({ token: tokenSchema }))
  .handler(async ({ data }) => {
    const { db } = await import("@/db/index.server");
    const schema = await import("@/db/schema");
    const [row] = await db
      .select({
        id: schema.propertyInspections.id,
        inspectorName: schema.propertyInspections.inspectorName,
        status: schema.propertyInspections.status,
        expiresAt: schema.propertyInspections.expiresAt,
        formData: schema.propertyInspections.formData,
        projectName: schema.projects.name,
        address: schema.projects.address,
        city: schema.projects.city,
        projectData: schema.projects.data,
      })
      .from(schema.propertyInspections)
      .innerJoin(schema.projects, eq(schema.projects.id, schema.propertyInspections.projectId))
      .where(eq(schema.propertyInspections.tokenHash, hash(data.token)))
      .limit(1);
    if (!row || row.expiresAt < new Date())
      throw new Error("Link de vistoria inválido ou expirado.");
    return {
      ...row,
      propertyType: String(row.projectData?.["tipo_imovel"] || ""),
      projectData: undefined,
      formData: row.formData as Partial<InspectionAnswers>,
    };
  });

export const submitPublicInspection = createServerFn({ method: "POST" })
  .validator(z.object({ token: tokenSchema, answers: answerSchema }))
  .handler(async ({ data }) => {
    const { db } = await import("@/db/index.server");
    const schema = await import("@/db/schema");
    const [row] = await db
      .select()
      .from(schema.propertyInspections)
      .where(eq(schema.propertyInspections.tokenHash, hash(data.token)))
      .limit(1);
    if (!row || row.expiresAt < new Date())
      throw new Error("Link de vistoria inválido ou expirado.");
    if (row.status === "completed") throw new Error("Esta vistoria já foi concluída.");
    const [project] = await db
      .select()
      .from(schema.projects)
      .where(eq(schema.projects.id, row.projectId))
      .limit(1);
    if (!project) throw new Error("Projeto da vistoria não encontrado.");
    const { createInspectionDocument } = await import("@/lib/inspection-report.server");
    await createInspectionDocument(db, schema, row, project, data.answers);
    await db
      .update(schema.propertyInspections)
      .set({
        formData: data.answers,
        status: "completed",
        completedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(schema.propertyInspections.id, row.id));
    return { ok: true };
  });

export const getPropertyInspection = createServerFn({ method: "GET" })
  .validator(z.object({ projectId: z.string().uuid(), inspectionId: z.string().uuid() }))
  .handler(async ({ data }) => {
    const { db, schema, membership } = await authenticatedContext(data.projectId);
    const [row] = await db
      .select()
      .from(schema.propertyInspections)
      .where(
        and(
          eq(schema.propertyInspections.id, data.inspectionId),
          eq(schema.propertyInspections.projectId, data.projectId),
          eq(schema.propertyInspections.organizationId, membership.organizationId),
        ),
      )
      .limit(1);
    if (!row) throw new Error("Vistoria não encontrada.");
    return { ...row, tokenHash: undefined, formData: row.formData as Partial<InspectionAnswers> };
  });

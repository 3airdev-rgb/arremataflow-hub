import { createServerFn } from "@tanstack/react-start";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { z } from "zod";
import { validateDocument } from "@/lib/utils-validation";

const movementInput = z.object({
  projectId: z.string().uuid(),
  type: z.enum(["receita", "despesa"]),
  description: z.string().trim().min(2).max(240),
  category: z.string().trim().min(2).max(120),
  amount: z.number().finite().positive().max(999_999_999_999_999),
  movementDate: z.string().date().optional(),
  holderName: z.string().trim().max(180).optional(),
  holderDocument: z.string().trim().max(18).optional(),
});

async function financialContext(projectId: string, requireManager = false) {
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
  const { enforcePlanFeature } = await import("@/lib/developer.server");
  await enforcePlanFeature(membership.organizationId, "projectTabs", "Financeiro");
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
  return { db, schema, session, membership };
}

type FinancialMovementRow = {
  id: string;
  description: string;
  category: string;
  movementDate: Date;
  amount: string | number;
  status: string;
  type: string;
  holderName: string | null;
  holderDocument: string | null;
  holderType: string | null;
  documentType: string | null;
};

const mapMovement = (row: FinancialMovementRow) => ({
  id: row.id,
  descricao: row.description,
  categoria: row.category,
  data: new Intl.DateTimeFormat("pt-BR").format(row.movementDate),
  valor: Number(row.amount),
  status: row.status as
    "atrasado" | "pendente" | "aguardando" | "andamento" | "nao_iniciado" | "concluido",
  tipo: row.type as "receita" | "despesa",
  document_holder_name: row.holderName,
  document_holder_document: row.holderDocument,
  document_holder_type: row.holderType as "Origem" | "Destinatário" | null,
  document_type: row.documentType as "CPF" | "CNPJ" | null,
  comprovanteUrl: null,
  comprovanteUrls: [] as string[],
});

export const listFinancialMovements = createServerFn({ method: "GET" })
  .validator(z.object({ projectId: z.string().uuid() }))
  .handler(async ({ data }) => {
    const { db, schema, membership } = await financialContext(data.projectId);
    const rows = await db
      .select()
      .from(schema.financialMovements)
      .where(
        and(
          eq(schema.financialMovements.projectId, data.projectId),
          eq(schema.financialMovements.organizationId, membership.organizationId),
        ),
      )
      .orderBy(
        desc(schema.financialMovements.movementDate),
        desc(schema.financialMovements.createdAt),
      );
    const ids = rows.map((row) => row.id);
    const receipts = ids.length
      ? await db
          .select({ id: schema.documents.id, movementId: schema.documents.financialMovementId })
          .from(schema.documents)
          .where(
            and(
              eq(schema.documents.organizationId, membership.organizationId),
              inArray(schema.documents.financialMovementId, ids),
            ),
          )
      : [];
    return rows.map((row) => ({
      ...mapMovement(row),
      comprovanteUrls: receipts
        .filter((item) => item.movementId === row.id)
        .map((item) => `/api/documents/${item.id}`),
    }));
  });

export const createFinancialMovement = createServerFn({ method: "POST" })
  .validator(movementInput)
  .handler(async ({ data }) => {
    const { db, schema, session, membership } = await financialContext(data.projectId, true);
    const document = data.holderDocument?.replace(/\D/g, "") || null;
    if (document && !validateDocument(document)) throw new Error("CPF ou CNPJ inválido.");
    return db.transaction(async (tx) => {
      const [created] = await tx
        .insert(schema.financialMovements)
        .values({
          organizationId: membership.organizationId,
          projectId: data.projectId,
          type: data.type,
          description: data.description,
          category: data.category,
          amount: data.amount.toFixed(2),
          ...(data.movementDate ? { movementDate: new Date(`${data.movementDate}T12:00:00`) } : {}),
          holderName: data.holderName || null,
          holderDocument: document,
          holderType: data.type === "receita" ? "Origem" : "Destinatário",
          documentType: document ? (document.length === 11 ? "CPF" : "CNPJ") : null,
          createdBy: session.user.id,
        })
        .returning();
      if (!created) throw new Error("Não foi possível registrar a movimentação.");
      await tx.insert(schema.auditLogs).values({
        organizationId: membership.organizationId,
        projectId: data.projectId,
        actorId: session.user.id,
        action: "financial_movement.created",
        entityType: "financial_movement",
        entityId: created.id,
        metadata: { type: created.type, category: created.category, amount: created.amount },
      });
      return mapMovement(created);
    });
  });

export const updateFinancialMovement = createServerFn({ method: "POST" })
  .validator(movementInput.extend({ id: z.string().uuid() }))
  .handler(async ({ data }) => {
    const { db, schema, session, membership } = await financialContext(data.projectId, true);
    const document = data.holderDocument?.replace(/\D/g, "") || null;
    if (document && !validateDocument(document)) throw new Error("CPF ou CNPJ inválido.");
    return db.transaction(async (tx) => {
      const [updated] = await tx
        .update(schema.financialMovements)
        .set({
          type: data.type,
          description: data.description,
          category: data.category,
          amount: data.amount.toFixed(2),
          ...(data.movementDate ? { movementDate: new Date(`${data.movementDate}T12:00:00`) } : {}),
          holderName: data.holderName || null,
          holderDocument: document,
          holderType: data.type === "receita" ? "Origem" : "Destinatário",
          documentType: document ? (document.length === 11 ? "CPF" : "CNPJ") : null,
        })
        .where(
          and(
            eq(schema.financialMovements.id, data.id),
            eq(schema.financialMovements.projectId, data.projectId),
            eq(schema.financialMovements.organizationId, membership.organizationId),
          ),
        )
        .returning();
      if (!updated) throw new Error("Movimentação não encontrada.");
      await tx.insert(schema.auditLogs).values({
        organizationId: membership.organizationId,
        projectId: data.projectId,
        actorId: session.user.id,
        action: "financial_movement.updated",
        entityType: "financial_movement",
        entityId: updated.id,
        metadata: { type: updated.type, category: updated.category, amount: updated.amount },
      });
      return mapMovement(updated);
    });
  });

export const deleteFinancialMovement = createServerFn({ method: "POST" })
  .validator(z.object({ projectId: z.string().uuid(), id: z.string().uuid() }))
  .handler(async ({ data }) => {
    const { db, schema, session, membership } = await financialContext(data.projectId, true);
    return db.transaction(async (tx) => {
      const [deleted] = await tx
        .delete(schema.financialMovements)
        .where(
          and(
            eq(schema.financialMovements.id, data.id),
            eq(schema.financialMovements.projectId, data.projectId),
            eq(schema.financialMovements.organizationId, membership.organizationId),
          ),
        )
        .returning();
      if (!deleted) throw new Error("Movimentação não encontrada.");
      await tx.insert(schema.auditLogs).values({
        organizationId: membership.organizationId,
        projectId: data.projectId,
        actorId: session.user.id,
        action: "financial_movement.deleted",
        entityType: "financial_movement",
        entityId: deleted.id,
        metadata: { type: deleted.type, category: deleted.category, amount: deleted.amount },
      });
      return { ok: true };
    });
  });

export const findFinancialHolder = createServerFn({ method: "GET" })
  .validator(z.object({ projectId: z.string().uuid(), document: z.string().min(11).max(18) }))
  .handler(async ({ data }) => {
    const { db, schema, membership } = await financialContext(data.projectId);
    const document = data.document.replace(/\D/g, "");
    const [contact] = await db
      .select({ name: schema.contacts.name })
      .from(schema.contacts)
      .where(
        and(
          eq(schema.contacts.organizationId, membership.organizationId),
          eq(schema.contacts.document, document),
        ),
      )
      .limit(1);
    if (contact) return contact.name;
    const [movement] = await db
      .select({ name: schema.financialMovements.holderName })
      .from(schema.financialMovements)
      .where(
        and(
          eq(schema.financialMovements.organizationId, membership.organizationId),
          eq(schema.financialMovements.holderDocument, document),
        ),
      )
      .orderBy(desc(schema.financialMovements.createdAt))
      .limit(1);
    return movement?.name || null;
  });

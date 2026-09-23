import { createServerFn } from "@tanstack/react-start";
import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";

const money = z.number().finite().min(0).max(999_999_999_999_999.99);
const shortText = z.string().trim().max(180);
const dateValue = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}(?:T.*)?$/)
  .nullable();

const actionSchema = z.object({
  id: z.string().uuid().optional(),
  scope: z.enum(["regularization", "possession"]).optional(),
  tipo_acao: z.string().trim().min(2).max(180),
  numero_processo: z.string().trim().max(80),
  vara: z.string().trim().max(180),
  ultima_movimentacao: dateValue,
  movimentacoes: z
    .array(
      z.object({
        data: z
          .string()
          .regex(/^\d{4}-\d{2}-\d{2}$/)
          .or(z.literal("")),
        situacao: z.string().trim().max(1000),
      }),
    )
    .max(200)
    .default([]),
});

const regularizationSchema = z.object({
  carta_arrematacao_status: shortText,
  averbacao_status: shortText,
  protocolo_cartorio: z.string().trim().max(120),
  iptu_status: shortText,
  iptu_responsabilidade: shortText,
  iptu_valor: money,
  transferencia_cadastral_status: shortText,
  itbi_valor: money,
  tem_condominio: z.boolean(),
  condominio_debitos_anteriores: money,
  condominio_debitos_status: shortText,
  condominio_responsabilidade: shortText,
  condominio_vencimento: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .or(z.literal("")),
  condominio_taxa_mensal: money,
});

const possessionSchema = z.object({
  occupancy_status: shortText,
  possession_action_required: z.boolean(),
  expected_possession_date: dateValue,
  possession_completed_date: dateValue,
  legal_costs: money,
  bailiff_costs: money,
  locksmith_security_costs: money,
  settlement_costs: money,
  property_inspection_required: z.boolean().default(false),
});

async function context(projectId: string, requireManager = false, tab?: "Regularização" | "Posse") {
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

const mapAction = (row: {
  id: string;
  scope: string;
  actionType: string;
  processNumber: string;
  court: string;
  lastMovementDate: string | null;
  movements: Array<{ date: string; situation: string }>;
}) => ({
  id: row.id,
  tipo_acao: row.actionType,
  numero_processo: row.processNumber,
  vara: row.court,
  ultima_movimentacao: row.lastMovementDate,
  scope: row.scope === "possession" ? ("possession" as const) : ("regularization" as const),
  movimentacoes: (row.movements || []).map((movement) => ({
    data: movement.date,
    situacao: movement.situation,
  })),
});

export const getProjectOperations = createServerFn({ method: "GET" })
  .validator(z.object({ projectId: z.string().uuid() }))
  .handler(async ({ data }) => {
    const { db, schema, membership } = await context(data.projectId);
    const [operational] = await db
      .select()
      .from(schema.projectOperationalData)
      .where(
        and(
          eq(schema.projectOperationalData.projectId, data.projectId),
          eq(schema.projectOperationalData.organizationId, membership.organizationId),
        ),
      )
      .limit(1);
    const actions = await db
      .select()
      .from(schema.judicialActions)
      .where(
        and(
          eq(schema.judicialActions.projectId, data.projectId),
          eq(schema.judicialActions.organizationId, membership.organizationId),
        ),
      );
    return {
      regularization: regularizationSchema.partial().parse(operational?.regularization || {}),
      possession: possessionSchema.partial().parse(operational?.possession || {}),
      regularizationActions: actions.map(mapAction),
      possessionAction: actions.find((row) => row.scope === "possession")
        ? mapAction(actions.find((row) => row.scope === "possession")!)
        : null,
    };
  });

async function replaceActions(
  tx: any,
  schema: any,
  values: {
    projectId: string;
    organizationId: string;
    userId: string;
    scope: "regularization" | "possession";
    actions: z.infer<typeof actionSchema>[];
  },
) {
  await tx
    .delete(schema.judicialActions)
    .where(
      and(
        eq(schema.judicialActions.projectId, values.projectId),
        eq(schema.judicialActions.organizationId, values.organizationId),
        eq(schema.judicialActions.scope, values.scope),
      ),
    );
  if (values.actions.length)
    await tx.insert(schema.judicialActions).values(
      values.actions.map((action) => ({
        organizationId: values.organizationId,
        projectId: values.projectId,
        scope: values.scope,
        actionType: action.tipo_acao,
        processNumber: action.numero_processo,
        court: action.vara,
        lastMovementDate: action.ultima_movimentacao?.slice(0, 10) || null,
        movements: action.movimentacoes.map((movement) => ({
          date: movement.data,
          situation: movement.situacao,
        })),
        createdBy: values.userId,
      })),
    );
}

export const saveRegularization = createServerFn({ method: "POST" })
  .validator(
    z.object({
      projectId: z.string().uuid(),
      formData: regularizationSchema,
      actions: z.array(actionSchema).max(50),
    }),
  )
  .handler(async ({ data }) => {
    const { db, schema, session, membership } = await context(
      data.projectId,
      true,
      "Regularização",
    );
    await db.transaction(async (tx) => {
      await tx
        .insert(schema.projectOperationalData)
        .values({
          organizationId: membership.organizationId,
          projectId: data.projectId,
          regularization: data.formData,
          updatedBy: session.user.id,
        })
        .onConflictDoUpdate({
          target: schema.projectOperationalData.projectId,
          set: { regularization: data.formData, updatedBy: session.user.id, updatedAt: new Date() },
        });
      const regularizationActions = data.actions.filter((action) => action.scope !== "possession");
      const possessionActions = data.actions.filter(
        (action) => action.scope === "possession" && action.id,
      );
      await replaceActions(tx, schema, {
        projectId: data.projectId,
        organizationId: membership.organizationId,
        userId: session.user.id,
        scope: "regularization",
        actions: regularizationActions,
      });
      for (const action of possessionActions) {
        await tx
          .update(schema.judicialActions)
          .set({
            actionType: "Ação de Imissão na Posse",
            processNumber: action.numero_processo,
            court: action.vara,
            lastMovementDate: action.ultima_movimentacao?.slice(0, 10) || null,
            movements: action.movimentacoes.map((movement) => ({
              date: movement.data,
              situation: movement.situacao,
            })),
          })
          .where(
            and(
              eq(schema.judicialActions.id, action.id!),
              eq(schema.judicialActions.projectId, data.projectId),
              eq(schema.judicialActions.organizationId, membership.organizationId),
              eq(schema.judicialActions.scope, "possession"),
            ),
          );
      }
      await tx.insert(schema.auditLogs).values({
        organizationId: membership.organizationId,
        projectId: data.projectId,
        actorId: session.user.id,
        action: "regularization.updated",
        entityType: "project",
        metadata: { judicialActions: data.actions.length },
      });
    });
    return { ok: true };
  });

export const savePossession = createServerFn({ method: "POST" })
  .validator(
    z.object({
      projectId: z.string().uuid(),
      formData: possessionSchema,
      action: actionSchema.nullable(),
    }),
  )
  .handler(async ({ data }) => {
    const { db, schema, session, membership } = await context(data.projectId, true, "Posse");
    const actions = data.formData.possession_action_required && data.action ? [data.action] : [];
    await db.transaction(async (tx) => {
      await tx
        .insert(schema.projectOperationalData)
        .values({
          organizationId: membership.organizationId,
          projectId: data.projectId,
          possession: data.formData,
          updatedBy: session.user.id,
        })
        .onConflictDoUpdate({
          target: schema.projectOperationalData.projectId,
          set: { possession: data.formData, updatedBy: session.user.id, updatedAt: new Date() },
        });
      await replaceActions(tx, schema, {
        projectId: data.projectId,
        organizationId: membership.organizationId,
        userId: session.user.id,
        scope: "possession",
        actions,
      });
      await tx.insert(schema.auditLogs).values({
        organizationId: membership.organizationId,
        projectId: data.projectId,
        actorId: session.user.id,
        action: "possession.updated",
        entityType: "project",
        metadata: {
          actionRequired: data.formData.possession_action_required,
          inspectionRequired: data.formData.property_inspection_required,
          possessionCompleted: Boolean(data.formData.possession_completed_date),
          occupancyStatus: data.formData.occupancy_status,
        },
      });
    });
    return { ok: true };
  });

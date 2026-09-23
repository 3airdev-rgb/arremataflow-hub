import { createServerFn } from "@tanstack/react-start";
import { and, desc, eq, sql } from "drizzle-orm";
import { z } from "zod";

const contractType = z.enum(["advisory", "construction_services", "real_estate_sale"]);
const contractData = z.object({
  contractedName: z.string().trim().min(2).max(200),
  contractedDocument: z.string().trim().max(30).default(""),
  contractedEmail: z.string().trim().email().or(z.literal("")),
  contractedAddress: z.string().trim().max(300).default(""),
  object: z.string().trim().min(5).max(5000),
  startDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .or(z.literal("")),
  endDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .or(z.literal("")),
  amount: z.number().finite().min(0),
  paymentTerms: z.string().trim().max(2000).default(""),
  terminationNoticeDays: z.number().int().min(0).max(365),
  forum: z.string().trim().max(200).default(""),
  notes: z.string().trim().max(5000).default(""),
  providerId: z.string().uuid().or(z.literal("")),
});
const contractInput = z
  .object({
    id: z.string().uuid().optional(),
    projectId: z.string().uuid(),
    type: contractType,
    title: z.string().trim().min(2).max(200),
    data: contractData,
  })
  .refine(
    (value) =>
      !value.data.startDate || !value.data.endDate || value.data.endDate >= value.data.startDate,
    { message: "A data final não pode ser anterior à data inicial." },
  );
const normalizeContract = (row: {
  id: string;
  projectId: string;
  type: string;
  title: string;
  status: string;
  templateVersion: string | null;
  data: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}) => ({
  id: row.id,
  projectId: row.projectId,
  type: row.type,
  title: row.title,
  status: row.status,
  templateVersion: row.templateVersion,
  data: contractData.parse(row.data),
  createdAt: row.createdAt.toISOString(),
  updatedAt: row.updatedAt.toISOString(),
});

async function context(projectId: string, requireManager = false) {
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
  await enforcePlanFeature(membership.organizationId, "projectTabs", "Contratos");
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

export const listProjectContracts = createServerFn({ method: "GET" })
  .validator(z.object({ projectId: z.string().uuid() }))
  .handler(async ({ data }) => {
    const { db, schema, membership } = await context(data.projectId);
    const rows = await db
      .select()
      .from(schema.projectContracts)
      .where(
        and(
          eq(schema.projectContracts.projectId, data.projectId),
          eq(schema.projectContracts.organizationId, membership.organizationId),
        ),
      )
      .orderBy(desc(schema.projectContracts.updatedAt));
    return rows.map(normalizeContract);
  });

export const saveProjectContract = createServerFn({ method: "POST" })
  .validator(contractInput)
  .handler(async ({ data }) => {
    const { db, schema, session, membership } = await context(data.projectId, true);
    return db.transaction(async (tx) => {
      const values = {
        type: data.type,
        title: data.title,
        status: "draft",
        data: data.data,
        updatedAt: new Date(),
      };
      const [row] = data.id
        ? await tx
            .update(schema.projectContracts)
            .set(values)
            .where(
              and(
                eq(schema.projectContracts.id, data.id),
                eq(schema.projectContracts.projectId, data.projectId),
                eq(schema.projectContracts.organizationId, membership.organizationId),
              ),
            )
            .returning()
        : await tx
            .insert(schema.projectContracts)
            .values({
              organizationId: membership.organizationId,
              projectId: data.projectId,
              createdBy: session.user.id,
              ...values,
            })
            .returning();
      if (!row) throw new Error("Contrato não encontrado.");
      await tx.insert(schema.auditLogs).values({
        organizationId: membership.organizationId,
        projectId: data.projectId,
        actorId: session.user.id,
        action: data.id ? "contract.updated" : "contract.created",
        entityType: "contract",
        entityId: row.id,
        metadata: { type: row.type, title: row.title, status: row.status },
      });
      return normalizeContract(row);
    });
  });

import { createServerFn } from "@tanstack/react-start";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { phoneSchema } from "@/lib/phone";

export const brazilianStates = [
  "AC",
  "AL",
  "AP",
  "AM",
  "BA",
  "CE",
  "DF",
  "ES",
  "GO",
  "MA",
  "MT",
  "MS",
  "MG",
  "PA",
  "PB",
  "PR",
  "PE",
  "PI",
  "RJ",
  "RN",
  "RS",
  "RO",
  "RR",
  "SC",
  "SP",
  "SE",
  "TO",
] as const;

const settingsSchema = z.object({
  name: z.string().trim().min(2).max(160),
  legalDocument: z.string().trim().max(18),
  institutionalEmail: z.union([z.literal(""), z.string().trim().email().max(254)]),
  phone: phoneSchema,
  address: z.string().trim().max(200),
  addressNumber: z.string().trim().max(30),
  addressComplement: z.string().trim().max(100),
  district: z.string().trim().max(100),
  city: z.string().trim().max(100),
  state: z.union([z.literal(""), z.enum(brazilianStates)]),
  postalCode: z.string().trim().max(9),
  taskDeadlineEmails: z.boolean(),
  weeklyInvestorReports: z.boolean(),
  defaultAdvisoryFeePercent: z.number().finite().min(0).max(100),
});

async function authenticatedContext() {
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
  return { db, schema, userId: session.user.id, membership };
}

export const getOrganizationSettings = createServerFn({ method: "GET" }).handler(async () => {
  const { db, schema, userId, membership } = await authenticatedContext();
  const [organization] = await db
    .select({
      id: schema.organizations.id,
      name: schema.organizations.name,
      legalDocument: schema.organizations.legalDocument,
      institutionalEmail: schema.organizations.institutionalEmail,
      phone: schema.organizations.phone,
      address: schema.organizations.address,
      addressNumber: schema.organizations.addressNumber,
      addressComplement: schema.organizations.addressComplement,
      district: schema.organizations.district,
      city: schema.organizations.city,
      state: schema.organizations.state,
      postalCode: schema.organizations.postalCode,
      taskDeadlineEmails: schema.organizations.taskDeadlineEmails,
      weeklyInvestorReports: schema.organizations.weeklyInvestorReports,
      defaultAdvisoryFeePercent: schema.organizations.defaultAdvisoryFeePercent,
    })
    .from(schema.organizationMembers)
    .innerJoin(
      schema.organizations,
      eq(schema.organizations.id, schema.organizationMembers.organizationId),
    )
    .where(
      and(
        eq(schema.organizationMembers.userId, userId),
        eq(schema.organizationMembers.organizationId, membership.organizationId),
        eq(schema.organizationMembers.status, "active"),
      ),
    )
    .limit(1);
  if (!organization) throw new Error("Empresa ativa não encontrada.");
  return {
    ...organization,
    legalDocument: organization.legalDocument ?? "",
    institutionalEmail: organization.institutionalEmail ?? "",
    phone: organization.phone ?? "",
    address: organization.address ?? "",
    addressNumber: organization.addressNumber ?? "",
    addressComplement: organization.addressComplement ?? "",
    district: organization.district ?? "",
    city: organization.city ?? "",
    state: organization.state ?? "",
    postalCode: organization.postalCode ?? "",
    taskDeadlineEmails: organization.taskDeadlineEmails,
    weeklyInvestorReports: organization.weeklyInvestorReports,
    defaultAdvisoryFeePercent: Number(organization.defaultAdvisoryFeePercent),
  };
});

export const updateOrganizationSettings = createServerFn({ method: "POST" })
  .validator(settingsSchema)
  .handler(async ({ data }) => {
    const { db, schema, userId, membership } = await authenticatedContext();
    if (!membership || !["owner", "admin"].includes(membership.role)) {
      throw new Error("Sem permissão para alterar a empresa.");
    }
    await db.transaction(async (tx) => {
      await tx
        .update(schema.organizations)
        .set({
          ...data,
          defaultAdvisoryFeePercent: data.defaultAdvisoryFeePercent.toFixed(2),
          updatedAt: new Date(),
        })
        .where(eq(schema.organizations.id, membership.organizationId));
      await tx.insert(schema.auditLogs).values({
        organizationId: membership.organizationId,
        actorId: userId,
        action: "organization.updated",
        entityType: "organization",
        entityId: membership.organizationId,
        metadata: { fields: Object.keys(data) },
      });
    });
    return { ...data, id: membership.organizationId };
  });

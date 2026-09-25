import { and, asc, eq, inArray, or, sql } from "drizzle-orm";
import type { DbExecutor, Schema } from "@/db/types";
import {
  administratorContactColumns,
  planLimitKeyForContactType,
} from "@/lib/administrator-contact";
import { userProfileTypes } from "@/lib/contact-profile";
import { validateDocument } from "@/lib/utils-validation";

export async function findTitularAdministrator(
  db: DbExecutor,
  schema: Schema,
  organizationId: string,
) {
  const [organization] = await db
    .select({ createdBy: schema.organizations.createdBy })
    .from(schema.organizations)
    .where(eq(schema.organizations.id, organizationId))
    .limit(1);
  const administrators = await db
    .select({ userId: schema.users.id, name: schema.users.name, email: schema.users.email })
    .from(schema.organizationMembers)
    .innerJoin(schema.users, eq(schema.users.id, schema.organizationMembers.userId))
    .where(
      and(
        eq(schema.organizationMembers.organizationId, organizationId),
        inArray(schema.organizationMembers.role, ["owner", "admin"]),
      ),
    )
    .orderBy(asc(schema.organizationMembers.createdAt));
  return (
    administrators.find((administrator) => administrator.userId === organization?.createdBy) ??
    administrators[0] ??
    null
  );
}

export const isAdministratorContact = (schema: Schema, organizationId: string) =>
  sql`exists (
    select 1
    from ${schema.organizationMembers} as admin_member
    inner join ${schema.users} as admin_user on admin_user.id = admin_member.user_id
    where admin_member.organization_id = ${organizationId}
      and admin_member.role in ('owner', 'admin')
      and lower(admin_user.email) = lower(${schema.contacts.email})
  )`;

export async function syncAdministratorContacts(
  db: DbExecutor,
  schema: Schema,
  organizationId: string,
  actorId: string,
) {
  const [organization] = await db
    .select()
    .from(schema.organizations)
    .where(eq(schema.organizations.id, organizationId))
    .limit(1);
  const titular = await findTitularAdministrator(db, schema, organizationId);
  if (!organization || !titular) return { synced: false as const };
  const columns = administratorContactColumns({
    name: organization.name,
    legalDocument: organization.legalDocument ?? "",
    email: titular.email,
    phone: organization.phone ?? "",
    address: organization.address ?? "",
    addressNumber: organization.addressNumber ?? "",
    addressComplement: organization.addressComplement ?? "",
    district: organization.district ?? "",
    city: organization.city ?? "",
    state: organization.state ?? "",
    postalCode: organization.postalCode ?? "",
    birthDate: organization.birthDate ?? "",
    maritalStatus: organization.maritalStatus ?? "",
    bankName: organization.bankName ?? "",
    bankAgency: organization.bankAgency ?? "",
    bankAccount: organization.bankAccount ?? "",
  });
  if (!validateDocument(columns.document)) return { synced: false as const };

  for (const type of userProfileTypes) {
    const matches = await db
      .select({
        id: schema.contacts.id,
        email: schema.contacts.email,
        document: schema.contacts.document,
      })
      .from(schema.contacts)
      .where(
        and(
          eq(schema.contacts.organizationId, organizationId),
          eq(schema.contacts.type, type),
          or(
            eq(schema.contacts.document, columns.document),
            sql`lower(${schema.contacts.email}) = ${columns.email}`,
          ),
        ),
      );
    const own = matches.find((match) => match.email.toLowerCase() === columns.email);
    const conflict = matches.find(
      (match) => match.email.toLowerCase() !== columns.email && match.document === columns.document,
    );
    if (conflict) throw new Error("CPF ou CNPJ já cadastrado para outro participante.");
    if (own)
      await db
        .update(schema.contacts)
        .set({ ...columns, status: "active", updatedAt: new Date() })
        .where(eq(schema.contacts.id, own.id));
    else
      await db
        .insert(schema.contacts)
        .values({ organizationId, type, ...columns, createdBy: actorId });
  }
  return { synced: true as const };
}

export async function enforceContactPlanLimit(
  db: DbExecutor,
  schema: Schema,
  organizationId: string,
  type: string,
) {
  const key = planLimitKeyForContactType(type);
  if (!key) return;
  const [counted] = await db
    .select({ value: sql<number>`count(*)::int` })
    .from(schema.contacts)
    .where(
      and(
        eq(schema.contacts.organizationId, organizationId),
        eq(schema.contacts.type, type),
        eq(schema.contacts.status, "active"),
        sql`not ${isAdministratorContact(schema, organizationId)}`,
      ),
    );
  const { enforcePlanLimit } = await import("@/lib/developer.server");
  await enforcePlanLimit(organizationId, key, Number(counted?.value ?? 0));
}

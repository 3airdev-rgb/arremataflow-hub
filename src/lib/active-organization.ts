import { createServerFn } from "@tanstack/react-start";
import { and, asc, eq } from "drizzle-orm";
import { z } from "zod";

async function authenticated() {
  const [{ getRequestHeaders }, { auth }, { db }, schema] = await Promise.all([
    import("@tanstack/react-start/server"), import("@/lib/auth.server"),
    import("@/db/index.server"), import("@/db/schema"),
  ]);
  const session = await auth.api.getSession({ headers: getRequestHeaders() });
  if (!session) throw new Error("Não autenticado.");
  return { db, schema, session };
}

export const listUserOrganizations = createServerFn({ method: "GET" }).handler(async () => {
  const { db, schema, session } = await authenticated();
  const { resolveActiveMembership } = await import("@/lib/active-organization.server");
  const active = await resolveActiveMembership(db, schema, session.user.id);
  const organizations = await db.select({
    id: schema.organizations.id,
    name: schema.organizations.name,
    role: schema.organizationMembers.role,
  }).from(schema.organizationMembers)
    .innerJoin(schema.organizations, eq(schema.organizations.id, schema.organizationMembers.organizationId))
    .where(and(
      eq(schema.organizationMembers.userId, session.user.id),
      eq(schema.organizationMembers.status, "active"),
      eq(schema.organizations.status, "active"),
    )).orderBy(asc(schema.organizations.name));
  return { activeOrganizationId: active?.organizationId ?? null, organizations };
});

export const selectActiveOrganization = createServerFn({ method: "POST" })
  .validator(z.object({ organizationId: z.string().uuid() }))
  .handler(async ({ data }) => {
    const { db, schema, session } = await authenticated();
    const [membership] = await db.select({ id: schema.organizationMembers.id })
      .from(schema.organizationMembers).innerJoin(schema.organizations, eq(schema.organizations.id, schema.organizationMembers.organizationId))
      .where(and(
        eq(schema.organizationMembers.userId, session.user.id),
        eq(schema.organizationMembers.organizationId, data.organizationId),
        eq(schema.organizationMembers.status, "active"),
        eq(schema.organizations.status, "active"),
      )).limit(1);
    if (!membership) throw new Error("Você não possui acesso ativo a esta empresa.");
    await db.update(schema.users).set({ activeOrganizationId: data.organizationId, updatedAt: new Date() }).where(eq(schema.users.id, session.user.id));
    return { activeOrganizationId: data.organizationId };
  });

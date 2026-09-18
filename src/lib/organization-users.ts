import { createServerFn } from "@tanstack/react-start";
import { and, asc, eq, ne, sql } from "drizzle-orm";
import { z } from "zod";

const updateUserSchema = z.object({
  userId: z.string().min(1),
  name: z.string().trim().min(2, "Informe um nome válido.").max(120),
  email: z.string().trim().toLowerCase().email("Informe um e-mail válido.").max(254),
});
const inviteUserSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().toLowerCase().email().max(254),
  role: z.enum(["advisor", "investor"]),
});

async function administratorContext() {
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

  if (!membership || !["owner", "admin"].includes(membership.role)) {
    throw new Error("Somente administradores podem gerenciar usuários.");
  }
  return { db, schema, session, membership };
}

export const getCurrentOrganizationUser = createServerFn({ method: "GET" }).handler(async () => {
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
  if (!membership) throw new Error("Perfil ativo não encontrado.");
  const [profile] = await db
    .select({
      id: schema.users.id,
      name: schema.users.name,
      email: schema.users.email,
      role: schema.organizationMembers.role,
    })
    .from(schema.organizationMembers)
    .innerJoin(schema.users, eq(schema.users.id, schema.organizationMembers.userId))
    .where(and(
      eq(schema.organizationMembers.userId, session.user.id),
      eq(schema.organizationMembers.organizationId, membership.organizationId),
      eq(schema.organizationMembers.status, "active"),
    ))
    .limit(1);
  if (!profile) throw new Error("Perfil ativo não encontrado.");
  return profile;
});

export const getOrganizationUsers = createServerFn({ method: "GET" }).handler(async () => {
  const { db, schema, session, membership } = await administratorContext();
  const members = await db
    .select({
      id: schema.users.id,
      name: schema.users.name,
      email: schema.users.email,
      role: schema.organizationMembers.role,
      status: schema.organizationMembers.status,
    })
    .from(schema.organizationMembers)
    .innerJoin(schema.users, eq(schema.users.id, schema.organizationMembers.userId))
    .where(eq(schema.organizationMembers.organizationId, membership.organizationId))
    .orderBy(asc(schema.users.name));

  return { currentUserId: session.user.id, members };
});

export const updateOrganizationUser = createServerFn({ method: "POST" })
  .validator(updateUserSchema)
  .handler(async ({ data }) => {
    const { db, schema, membership, session } = await administratorContext();

    const [target] = await db
      .select({ id: schema.organizationMembers.id })
      .from(schema.organizationMembers)
      .where(and(
        eq(schema.organizationMembers.organizationId, membership.organizationId),
        eq(schema.organizationMembers.userId, data.userId),
      ))
      .limit(1);
    if (!target) throw new Error("Usuário não pertence a esta empresa.");

    const [duplicate] = await db
      .select({ id: schema.users.id })
      .from(schema.users)
      .where(and(eq(schema.users.email, data.email), ne(schema.users.id, data.userId)))
      .limit(1);
    if (duplicate) throw new Error("Este e-mail já está sendo usado por outro usuário.");

    return db.transaction(async (tx) => {
      const [updated] = await tx.update(schema.users).set({ name: data.name, email: data.email, updatedAt: new Date() }).where(eq(schema.users.id, data.userId)).returning({ id: schema.users.id, name: schema.users.name, email: schema.users.email });
      if (!updated) throw new Error("Usuário não encontrado.");
      await tx.insert(schema.auditLogs).values({ organizationId: membership.organizationId, actorId: session.user.id, action: "user.updated", entityType: "user", metadata: { targetUserId: data.userId, changed: ["name", "email"] } });
      return updated;
    });
  });

export const inviteOrganizationUser = createServerFn({ method: "POST" })
  .validator(inviteUserSchema)
  .handler(async ({ data }) => {
    const { db, schema, membership, session } = await administratorContext();
    const [{ randomBytes, randomUUID }, { sendTransactionalEmail, escapeHtml }] = await Promise.all([import("node:crypto"), import("@/lib/email.server")]);
    const baseUrl = process.env["BETTER_AUTH_URL"];
    if (!baseUrl) throw new Error("Endereço público do aplicativo não configurado.");
    const emailConfigured = Boolean(process.env["RESEND_API_KEY"] && process.env["AUTH_EMAIL_FROM"]);
    if (process.env["NODE_ENV"] === "production" && !emailConfigured) throw new Error("O serviço de e-mail não está configurado.");
    const token = randomBytes(32).toString("base64url"), expiresAt = new Date(Date.now() + 30 * 60 * 1000);
    const resetCallback = new URL("/redefinir-senha", baseUrl).toString();
    const inviteUrl = new URL(`/api/auth/reset-password/${token}`, baseUrl); inviteUrl.searchParams.set("callbackURL", resetCallback);
    const invited = await db.transaction(async (tx) => {
      let [user] = await tx.select().from(schema.users).where(eq(schema.users.email, data.email)).limit(1);
      if (!user) [user] = await tx.insert(schema.users).values({ id: randomUUID(), name: data.name, email: data.email, emailVerified: false }).returning();
      if (!user) throw new Error("Não foi possível criar o usuário.");
      const [existing] = await tx.select().from(schema.organizationMembers).where(and(eq(schema.organizationMembers.organizationId, membership.organizationId), eq(schema.organizationMembers.userId, user.id))).limit(1);
      if (existing?.status === "active") throw new Error("Este usuário já participa da empresa.");
      if (existing) await tx.update(schema.organizationMembers).set({ role: data.role, status: "invited", updatedAt: new Date() }).where(eq(schema.organizationMembers.id, existing.id));
      else await tx.insert(schema.organizationMembers).values({ organizationId: membership.organizationId, userId: user.id, role: data.role, status: "invited" });
      await tx.delete(schema.verifications).where(and(eq(schema.verifications.value, user.id), sql`${schema.verifications.identifier} like 'reset-password:%'`));
      await tx.insert(schema.verifications).values({ id: randomUUID(), identifier: `reset-password:${token}`, value: user.id, expiresAt });
      await tx.insert(schema.auditLogs).values({ organizationId: membership.organizationId, actorId: session.user.id, action: "user.invited", entityType: "user", metadata: { targetUserId: user.id, role: data.role } });
      return user;
    });
    if (emailConfigured) await sendTransactionalEmail({ to: invited.email, subject: "Convite para o ArremataFlow", html: `<p>Olá, ${escapeHtml(invited.name)}.</p><p>Você foi convidado para acessar o ArremataFlow.</p><p><a href="${escapeHtml(inviteUrl.toString())}">Criar minha senha</a></p><p>O link expira em 30 minutos.</p>` });
    return { id: invited.id, email: invited.email, delivery: emailConfigured ? "email" : "local", invitationUrl: emailConfigured ? null : inviteUrl.toString() };
  });

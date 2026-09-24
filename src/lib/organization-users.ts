import { createServerFn } from "@tanstack/react-start";
import { and, asc, eq, inArray, ne, sql } from "drizzle-orm";
import { z } from "zod";
import { contactInput } from "@/lib/contacts";
import { contactRowToProfile, profileToContactColumns } from "@/lib/contact-profile";
import { validateDocument } from "@/lib/utils-validation";
import { resolveInvitedMembership } from "@/lib/organization-user-role";

const personContactTypes = ["Investidor", "Assessor", "Responsável"];
const updateUserSchema = z.object({
  userId: z.string().min(1),
  name: z.string().trim().min(2, "Informe um nome válido.").max(120),
  email: z.string().trim().toLowerCase().email("Informe um e-mail válido.").max(254),
  role: z.enum(["project_manager", "advisor", "investor"]).optional(),
  profile: contactInput.omit({ type: true }).optional(),
});
const inviteUserSchema = z
  .object({
    name: z.string().trim().min(2).max(120),
    email: z.string().trim().toLowerCase().email().max(254),
    role: z.enum(["advisor", "investor", "project_manager"]),
    contactData: contactInput.optional(),
    alsoContactTypes: z
      .array(z.enum(["Investidor", "Assessor", "Responsável"]))
      .max(2)
      .optional(),
  })
  .refine(
    (data) =>
      !data.contactData ||
      (((data.role === "project_manager" && data.contactData.type === "Responsável") ||
        (data.role === "advisor" && data.contactData.type === "Assessor") ||
        (data.role === "investor" && data.contactData.type === "Investidor")) &&
        data.contactData.email.toLowerCase() === data.email &&
        data.contactData.nome === data.name),
    "Dados do responsável não correspondem ao convite.",
  )
  .refine(
    (data) =>
      !data.alsoContactTypes?.length ||
      (Boolean(data.contactData) &&
        new Set(data.alsoContactTypes).size === data.alsoContactTypes.length &&
        data.alsoContactTypes.every((type) => type !== data.contactData?.type)),
    "Perfis adicionais inválidos.",
  );

async function administratorContext(allowProjectManager = false) {
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
  const effectiveRole =
    membership && allowProjectManager
      ? await effectiveOrganizationRole(
          db,
          schema,
          membership.organizationId,
          session.user.email,
          membership.role,
        )
      : membership?.role;

  if (
    !membership ||
    !(allowProjectManager
      ? ["owner", "admin", "project_manager"].includes(effectiveRole || "")
      : ["owner", "admin"].includes(membership.role))
  ) {
    throw new Error("Somente administradores podem gerenciar usuários.");
  }
  return { db, schema, session, membership: { ...membership, role: effectiveRole! } };
}

export async function effectiveOrganizationRole(
  db: (typeof import("@/db/index.server"))["db"],
  schema: typeof import("@/db/schema"),
  organizationId: string,
  email: string,
  baseRole: string,
) {
  if (baseRole === "owner" || baseRole === "admin") return baseRole;
  const links = await db
    .select({ role: schema.projectParticipants.role })
    .from(schema.projectParticipants)
    .innerJoin(schema.contacts, eq(schema.contacts.id, schema.projectParticipants.contactId))
    .innerJoin(schema.projects, eq(schema.projects.id, schema.projectParticipants.projectId))
    .where(
      and(
        eq(schema.projects.organizationId, organizationId),
        eq(schema.contacts.organizationId, organizationId),
        eq(schema.contacts.status, "active"),
        sql`lower(${schema.contacts.email}) = lower(${email})`,
      ),
    );
  const { highestProjectRole } = await import("@/lib/project-access.server");
  const roles = [
    baseRole,
    ...links.map(({ role }) => (role === "responsible" ? "project_manager" : role)),
  ].filter((role): role is "project_manager" | "advisor" | "investor" =>
    ["project_manager", "advisor", "investor"].includes(role),
  );
  return highestProjectRole(roles) || baseRole;
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
    .where(
      and(
        eq(schema.organizationMembers.userId, session.user.id),
        eq(schema.organizationMembers.organizationId, membership.organizationId),
        eq(schema.organizationMembers.status, "active"),
      ),
    )
    .limit(1);
  if (!profile) throw new Error("Perfil ativo não encontrado.");
  return {
    ...profile,
    role: await effectiveOrganizationRole(
      db,
      schema,
      membership.organizationId,
      profile.email,
      profile.role,
    ),
  };
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

  const contactRows = await db
    .select({ email: schema.contacts.email, type: schema.contacts.type })
    .from(schema.contacts)
    .where(
      and(
        eq(schema.contacts.organizationId, membership.organizationId),
        inArray(schema.contacts.type, personContactTypes),
        eq(schema.contacts.status, "active"),
      ),
    );
  const typesByEmail = new Map<string, string[]>();
  for (const row of contactRows) {
    const key = row.email.toLowerCase();
    typesByEmail.set(key, [...(typesByEmail.get(key) ?? []), row.type]);
  }

  return {
    currentUserId: session.user.id,
    members: await Promise.all(
      members.map(async (member) => ({
        ...member,
        contactTypes: typesByEmail.get(member.email.toLowerCase()) ?? [],
        role: await effectiveOrganizationRole(
          db,
          schema,
          membership.organizationId,
          member.email,
          member.role,
        ),
      })),
    ),
  };
});

export const getOrganizationUserProfile = createServerFn({ method: "GET" })
  .validator(z.object({ userId: z.string().min(1) }))
  .handler(async ({ data }) => {
    const { db, schema, membership } = await administratorContext();
    const [target] = await db
      .select({ email: schema.users.email, role: schema.organizationMembers.role })
      .from(schema.organizationMembers)
      .innerJoin(schema.users, eq(schema.users.id, schema.organizationMembers.userId))
      .where(
        and(
          eq(schema.organizationMembers.organizationId, membership.organizationId),
          eq(schema.organizationMembers.userId, data.userId),
        ),
      )
      .limit(1);
    if (!target) throw new Error("Usuário não pertence a esta empresa.");
    const contacts = ["owner", "admin"].includes(target.role)
      ? []
      : await db
          .select()
          .from(schema.contacts)
          .where(
            and(
              eq(schema.contacts.organizationId, membership.organizationId),
              inArray(schema.contacts.type, personContactTypes),
              eq(schema.contacts.status, "active"),
              sql`lower(${schema.contacts.email}) = lower(${target.email})`,
            ),
          )
          .orderBy(asc(schema.contacts.createdAt));
    const [first] = contacts;
    return {
      types: contacts.map((contact) => contact.type),
      profile: first ? contactRowToProfile(first) : null,
    };
  });

export const updateOrganizationUser = createServerFn({ method: "POST" })
  .validator(updateUserSchema)
  .handler(async ({ data }) => {
    const { db, schema, membership, session } = await administratorContext();

    const [target] = await db
      .select({ id: schema.organizationMembers.id, role: schema.organizationMembers.role })
      .from(schema.organizationMembers)
      .where(
        and(
          eq(schema.organizationMembers.organizationId, membership.organizationId),
          eq(schema.organizationMembers.userId, data.userId),
        ),
      )
      .limit(1);
    if (!target) throw new Error("Usuário não pertence a esta empresa.");
    if (data.role && ["owner", "admin"].includes(target.role))
      throw new Error("O perfil de administrador não pode ser alterado neste formulário.");
    if (data.profile) {
      if (["owner", "admin"].includes(target.role))
        throw new Error("Administradores permitem editar somente nome e e-mail.");
      if (data.profile.nome !== data.name || data.profile.email !== data.email)
        throw new Error("Os dados informados são inconsistentes.");
      if (!validateDocument(data.profile.documento.replace(/\D/g, "")))
        throw new Error("Informe um CPF ou CNPJ válido.");
    }
    if (data.role) {
      const [person] = await db
        .select({ email: schema.users.email })
        .from(schema.users)
        .where(eq(schema.users.id, data.userId))
        .limit(1);
      if (!person) throw new Error("Usuário não encontrado.");
      const linkedRole = await effectiveOrganizationRole(
        db,
        schema,
        membership.organizationId,
        person.email,
        "investor",
      );
      const priority: Record<string, number> = { investor: 1, advisor: 2, project_manager: 3 };
      if ((priority[data.role] ?? 0) < (priority[linkedRole] ?? 0))
        throw new Error("Remova os vínculos de projeto antes de reduzir este perfil.");
    }

    const [duplicate] = await db
      .select({ id: schema.users.id })
      .from(schema.users)
      .where(and(eq(schema.users.email, data.email), ne(schema.users.id, data.userId)))
      .limit(1);
    if (duplicate) throw new Error("Este e-mail já está sendo usado por outro usuário.");

    return db.transaction(async (tx) => {
      const [before] = await tx
        .select({ email: schema.users.email })
        .from(schema.users)
        .where(eq(schema.users.id, data.userId))
        .limit(1);
      if (!before) throw new Error("Usuário não encontrado.");
      const [updated] = await tx
        .update(schema.users)
        .set({ name: data.name, email: data.email, updatedAt: new Date() })
        .where(eq(schema.users.id, data.userId))
        .returning({ id: schema.users.id, name: schema.users.name, email: schema.users.email });
      if (!updated) throw new Error("Usuário não encontrado.");
      if (data.profile) {
        const columns = profileToContactColumns(data.profile);
        const personContacts = await tx
          .select({ id: schema.contacts.id, type: schema.contacts.type })
          .from(schema.contacts)
          .where(
            and(
              eq(schema.contacts.organizationId, membership.organizationId),
              inArray(schema.contacts.type, personContactTypes),
              sql`lower(${schema.contacts.email}) = lower(${before.email})`,
            ),
          );
        if (!personContacts.length)
          throw new Error("Este usuário não possui cadastro completo para editar.");
        for (const contact of personContacts) {
          const [conflict] = await tx
            .select({ id: schema.contacts.id })
            .from(schema.contacts)
            .where(
              and(
                eq(schema.contacts.organizationId, membership.organizationId),
                eq(schema.contacts.document, columns.document),
                eq(schema.contacts.type, contact.type),
                ne(schema.contacts.id, contact.id),
              ),
            )
            .limit(1);
          if (conflict) throw new Error("CPF ou CNPJ já cadastrado para outro participante.");
        }
        await tx
          .update(schema.contacts)
          .set({ ...columns, updatedAt: new Date() })
          .where(
            inArray(
              schema.contacts.id,
              personContacts.map((contact) => contact.id),
            ),
          );
      } else if (before.email.toLowerCase() !== data.email)
        await tx
          .update(schema.contacts)
          .set({ email: data.email, updatedAt: new Date() })
          .where(
            and(
              eq(schema.contacts.organizationId, membership.organizationId),
              sql`lower(${schema.contacts.email}) = lower(${before.email})`,
            ),
          );
      if (data.role)
        await tx
          .update(schema.organizationMembers)
          .set({ role: data.role, updatedAt: new Date() })
          .where(eq(schema.organizationMembers.id, target.id));
      await tx.insert(schema.auditLogs).values({
        organizationId: membership.organizationId,
        actorId: session.user.id,
        action: "user.updated",
        entityType: "user",
        metadata: {
          targetUserId: data.userId,
          changed: data.profile
            ? ["name", "email", "profile"]
            : data.role
              ? ["name", "email", "role"]
              : ["name", "email"],
          role: data.role,
        },
      });
      return updated;
    });
  });

export const inviteOrganizationUser = createServerFn({ method: "POST" })
  .validator(inviteUserSchema)
  .handler(async ({ data }) => {
    const { db, schema, membership, session } = await administratorContext(true);
    if (membership.role === "project_manager" && !data.contactData)
      throw new Error("Gestores só podem cadastrar participantes de projetos.");
    const [{ randomBytes, randomUUID }, { sendTransactionalEmail, escapeHtml }] = await Promise.all(
      [import("node:crypto"), import("@/lib/email.server")],
    );
    const baseUrl = process.env["BETTER_AUTH_URL"];
    if (!baseUrl) throw new Error("Endereço público do aplicativo não configurado.");
    const emailConfigured = Boolean(
      process.env["RESEND_API_KEY"] && process.env["AUTH_EMAIL_FROM"],
    );
    if (process.env["NODE_ENV"] === "production" && !emailConfigured)
      throw new Error("O serviço de e-mail não está configurado.");
    const token = randomBytes(32).toString("base64url"),
      expiresAt = new Date(Date.now() + 30 * 60 * 1000);
    const resetCallback = new URL("/redefinir-senha", baseUrl).toString();
    const inviteUrl = new URL(`/api/auth/reset-password/${token}`, baseUrl);
    inviteUrl.searchParams.set("callbackURL", resetCallback);
    const invited = await db.transaction(async (tx) => {
      let [user] = await tx
        .select()
        .from(schema.users)
        .where(sql`lower(${schema.users.email}) = lower(${data.email})`)
        .limit(1);
      const isNewUser = !user;
      if (!user)
        [user] = await tx
          .insert(schema.users)
          .values({ id: randomUUID(), name: data.name, email: data.email, emailVerified: false })
          .returning();
      if (!user) throw new Error("Não foi possível criar o usuário.");
      const [existing] = await tx
        .select()
        .from(schema.organizationMembers)
        .where(
          and(
            eq(schema.organizationMembers.organizationId, membership.organizationId),
            eq(schema.organizationMembers.userId, user.id),
          ),
        )
        .limit(1);
      const requestedRole =
        data.role !== "advisor" && data.alsoContactTypes?.includes("Assessor")
          ? "advisor"
          : data.role;
      const resolved = resolveInvitedMembership(
        existing,
        requestedRole,
        Boolean(data.contactData),
        isNewUser,
      );
      const effectiveRole = resolved.role;
      const invitationNeeded = resolved.invitationNeeded;
      if (
        !existing ||
        existing.role !== effectiveRole ||
        existing.status !== (invitationNeeded ? "invited" : "active")
      ) {
        if (existing)
          await tx
            .update(schema.organizationMembers)
            .set({
              role: effectiveRole,
              status: invitationNeeded ? "invited" : "active",
              updatedAt: new Date(),
            })
            .where(eq(schema.organizationMembers.id, existing.id));
        else
          await tx.insert(schema.organizationMembers).values({
            organizationId: membership.organizationId,
            userId: user.id,
            role: effectiveRole,
            status: invitationNeeded ? "invited" : "active",
          });
      }
      if (invitationNeeded) {
        await tx
          .delete(schema.verifications)
          .where(
            and(
              eq(schema.verifications.value, user.id),
              sql`${schema.verifications.identifier} like 'reset-password:%'`,
            ),
          );
        await tx.insert(schema.verifications).values({
          id: randomUUID(),
          identifier: `reset-password:${token}`,
          value: user.id,
          expiresAt,
        });
        await tx.insert(schema.auditLogs).values({
          organizationId: membership.organizationId,
          actorId: session.user.id,
          action: "user.invited",
          entityType: "user",
          metadata: { targetUserId: user.id, role: data.role },
        });
      } else if (!existing || existing.role !== effectiveRole || existing.status !== "active") {
        await tx.insert(schema.auditLogs).values({
          organizationId: membership.organizationId,
          actorId: session.user.id,
          action: "user.linked",
          entityType: "user",
          metadata: { targetUserId: user.id, role: effectiveRole, previousRole: existing?.role },
        });
      }
      let contact: { id: string; nome: string } | null = null;
      if (data.contactData) {
        const normalizedDocument = data.contactData.documento.replace(/\D/g, "");
        if (!validateDocument(normalizedDocument))
          throw new Error("Informe um CPF ou CNPJ válido.");
        const [duplicate] = await tx
          .select({
            id: schema.contacts.id,
            nome: schema.contacts.name,
            email: schema.contacts.email,
            document: schema.contacts.document,
          })
          .from(schema.contacts)
          .where(
            and(
              eq(schema.contacts.organizationId, membership.organizationId),
              eq(schema.contacts.document, normalizedDocument),
              eq(schema.contacts.type, data.contactData.type),
            ),
          )
          .limit(1);
        if (duplicate && duplicate.email.toLowerCase() !== data.email)
          throw new Error("Documento já cadastrado com outro e-mail nesta empresa.");
        const {
          type,
          nome,
          documento: _documento,
          email,
          celulares,
          ...details
        } = data.contactData;
        const [created] = duplicate
          ? [duplicate]
          : await tx
              .insert(schema.contacts)
              .values({
                organizationId: membership.organizationId,
                type,
                name: nome,
                document: normalizedDocument,
                email,
                phones: celulares.filter(Boolean),
                details,
                createdBy: session.user.id,
              })
              .returning({ id: schema.contacts.id, nome: schema.contacts.name });
        if (!created) throw new Error("Não foi possível cadastrar o responsável.");
        contact = created;
        if (!duplicate)
          await tx.insert(schema.auditLogs).values({
            organizationId: membership.organizationId,
            actorId: session.user.id,
            action: "contact.created",
            entityType: "contact",
            entityId: created.id,
            metadata: { type: data.contactData.type },
          });
        for (const extraType of data.alsoContactTypes ?? []) {
          const [extraDuplicate] = await tx
            .select({ id: schema.contacts.id, email: schema.contacts.email })
            .from(schema.contacts)
            .where(
              and(
                eq(schema.contacts.organizationId, membership.organizationId),
                eq(schema.contacts.document, normalizedDocument),
                eq(schema.contacts.type, extraType),
              ),
            )
            .limit(1);
          if (extraDuplicate) {
            if (extraDuplicate.email.toLowerCase() !== data.email)
              throw new Error("Documento já cadastrado com outro e-mail nesta empresa.");
            continue;
          }
          const [extra] = await tx
            .insert(schema.contacts)
            .values({
              organizationId: membership.organizationId,
              type: extraType,
              name: nome,
              document: normalizedDocument,
              email,
              phones: celulares.filter(Boolean),
              details,
              createdBy: session.user.id,
            })
            .returning({ id: schema.contacts.id });
          if (!extra) throw new Error("Não foi possível cadastrar o perfil adicional.");
          await tx.insert(schema.auditLogs).values({
            organizationId: membership.organizationId,
            actorId: session.user.id,
            action: "contact.created",
            entityType: "contact",
            entityId: extra.id,
            metadata: { type: extraType },
          });
        }
      }
      return { user, contact, invitationNeeded };
    });
    let deliveredByEmail = false;
    if (invited.invitationNeeded && emailConfigured) {
      try {
        await sendTransactionalEmail({
          to: invited.user.email,
          subject: "Convite para o ArremataFlow",
          html: `<p>Olá, ${escapeHtml(invited.user.name)}.</p><p>Você foi convidado para acessar o ArremataFlow.</p><p><a href="${escapeHtml(inviteUrl.toString())}">Criar minha senha</a></p><p>O link expira em 30 minutos.</p>`,
        });
        deliveredByEmail = true;
      } catch {
        // A conta foi criada; o link local permite concluir o convite sem duplicá-la.
      }
    }
    return {
      id: invited.user.id,
      email: invited.user.email,
      contact: invited.contact,
      delivery: invited.invitationNeeded ? (deliveredByEmail ? "email" : "local") : "existing",
      invitationUrl: invited.invitationNeeded && !deliveredByEmail ? inviteUrl.toString() : null,
    };
  });

export const removeOrganizationUser = createServerFn({ method: "POST" })
  .validator(z.object({ userId: z.string().min(1) }))
  .handler(async ({ data }) => {
    const { db, schema, membership, session } = await administratorContext();
    if (data.userId === session.user.id)
      throw new Error("Você não pode remover o seu próprio acesso.");
    const [target] = await db
      .select({
        id: schema.organizationMembers.id,
        role: schema.organizationMembers.role,
        status: schema.organizationMembers.status,
      })
      .from(schema.organizationMembers)
      .where(
        and(
          eq(schema.organizationMembers.organizationId, membership.organizationId),
          eq(schema.organizationMembers.userId, data.userId),
        ),
      )
      .limit(1);
    if (!target) throw new Error("Usuário não pertence a esta empresa.");
    if (["owner", "admin"].includes(target.role))
      throw new Error("Usuários administradores não podem ser removidos.");

    await db.transaction(async (tx) => {
      await tx
        .delete(schema.organizationMembers)
        .where(eq(schema.organizationMembers.id, target.id));
      const [otherMembership] = await tx
        .select({ id: schema.organizationMembers.id })
        .from(schema.organizationMembers)
        .where(eq(schema.organizationMembers.userId, data.userId))
        .limit(1);
      if (!otherMembership)
        await tx
          .delete(schema.verifications)
          .where(
            and(
              eq(schema.verifications.value, data.userId),
              sql`${schema.verifications.identifier} like 'reset-password:%'`,
            ),
          );
      await tx
        .update(schema.users)
        .set({ activeOrganizationId: null, updatedAt: new Date() })
        .where(
          and(
            eq(schema.users.id, data.userId),
            eq(schema.users.activeOrganizationId, membership.organizationId),
          ),
        );
      await tx.insert(schema.auditLogs).values({
        organizationId: membership.organizationId,
        actorId: session.user.id,
        action: "user.removed",
        entityType: "user",
        metadata: {
          targetUserId: data.userId,
          previousRole: target.role,
          previousStatus: target.status,
        },
      });
    });
    return { ok: true };
  });

export const renewOrganizationInvitation = createServerFn({ method: "POST" })
  .validator(z.object({ userId: z.string().min(1) }))
  .handler(async ({ data }) => {
    const { db, schema, membership, session } = await administratorContext();
    const [target] = await db
      .select({
        email: schema.users.email,
        name: schema.users.name,
        status: schema.organizationMembers.status,
      })
      .from(schema.organizationMembers)
      .innerJoin(schema.users, eq(schema.users.id, schema.organizationMembers.userId))
      .where(
        and(
          eq(schema.organizationMembers.organizationId, membership.organizationId),
          eq(schema.organizationMembers.userId, data.userId),
        ),
      )
      .limit(1);
    if (!target || target.status !== "invited")
      throw new Error("Não há convite pendente para este usuário.");
    const baseUrl = process.env["BETTER_AUTH_URL"];
    if (!baseUrl) throw new Error("Endereço público do aplicativo não configurado.");
    const [{ randomBytes, randomUUID }, { sendTransactionalEmail, escapeHtml }] = await Promise.all(
      [import("node:crypto"), import("@/lib/email.server")],
    );
    const token = randomBytes(32).toString("base64url");
    const inviteUrl = new URL(`/api/auth/reset-password/${token}`, baseUrl);
    inviteUrl.searchParams.set("callbackURL", new URL("/redefinir-senha", baseUrl).toString());
    await db.transaction(async (tx) => {
      await tx
        .delete(schema.verifications)
        .where(
          and(
            eq(schema.verifications.value, data.userId),
            sql`${schema.verifications.identifier} like 'reset-password:%'`,
          ),
        );
      await tx.insert(schema.verifications).values({
        id: randomUUID(),
        identifier: `reset-password:${token}`,
        value: data.userId,
        expiresAt: new Date(Date.now() + 30 * 60 * 1000),
      });
      await tx.insert(schema.auditLogs).values({
        organizationId: membership.organizationId,
        actorId: session.user.id,
        action: "user.invitation_renewed",
        entityType: "user",
        metadata: { targetUserId: data.userId },
      });
    });
    let deliveredByEmail = false;
    if (process.env["RESEND_API_KEY"] && process.env["AUTH_EMAIL_FROM"]) {
      try {
        await sendTransactionalEmail({
          to: target.email,
          subject: "Convite para o ArremataFlow",
          html: `<p>Olá, ${escapeHtml(target.name)}.</p><p>Seu convite para acessar o ArremataFlow foi renovado.</p><p><a href="${escapeHtml(inviteUrl.toString())}">Criar minha senha</a></p><p>O link expira em 30 minutos.</p>`,
        });
        deliveredByEmail = true;
      } catch {
        // O link local permanece disponível ao administrador.
      }
    }
    return {
      delivery: deliveredByEmail ? "email" : "local",
      invitationUrl: deliveredByEmail ? null : inviteUrl.toString(),
    };
  });

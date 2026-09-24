import { createServerFn } from "@tanstack/react-start";
import { and, asc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { requiresUserAccount } from "@/lib/contact-profile";
import { phoneSchema } from "@/lib/phone";
import { validateDocument } from "@/lib/utils-validation";

export const contactTypes = [
  "Investidor",
  "Assessor",
  "Responsável",
  "Leiloeiro",
  "Corretor",
  "Imobiliária",
  "Fornecedor",
] as const;

export const contactInput = z.object({
  type: z.enum(contactTypes),
  nome: z.string().trim().min(2).max(180),
  documento: z.string().trim().min(11).max(18),
  email: z.string().trim().toLowerCase().email().max(254),
  celulares: z.array(phoneSchema).max(5),
  dataNascimento: z
    .union([
      z.literal(""),
      z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/, "Informe ano, mês e dia da data de nascimento.")
        .refine((value) => {
          const [year, month, day] = value.split("-").map(Number);
          const parsed = new Date(Date.UTC(year!, month! - 1, day));
          return (
            parsed.getUTCFullYear() === year &&
            parsed.getUTCMonth() === month! - 1 &&
            parsed.getUTCDate() === day &&
            parsed <= new Date()
          );
        }, "Informe uma data de nascimento válida e não futura."),
    ])
    .optional(),
  estadoCivil: z.string().max(40).optional(),
  endereco: z.string().max(300).optional(),
  numero: z.string().trim().max(30).optional(),
  complemento: z.string().trim().max(120).optional(),
  bairro: z.string().trim().max(120).optional(),
  cep: z.string().trim().max(9).optional(),
  banco: z.string().max(100).optional(),
  agencia: z.string().max(30).optional(),
  conta: z.string().max(40).optional(),
  website: z.union([z.literal(""), z.string().url().max(300)]).optional(),
  cidade: z.string().max(120).optional(),
  estado: z.string().max(2).optional(),
});

async function contactContext(requireManager = false) {
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
  const role = requireManager
    ? await (
        await import("@/lib/organization-users")
      ).effectiveOrganizationRole(
        db,
        schema,
        membership.organizationId,
        session.user.email,
        membership.role,
      )
    : membership.role;
  if (requireManager && !["owner", "admin", "project_manager"].includes(role)) {
    throw new Error("Sem permissão para cadastrar participantes.");
  }
  return { db, schema, session, membership };
}

export const listContacts = createServerFn({ method: "GET" }).handler(async () => {
  const { db, schema, membership } = await contactContext();
  const rows = await db
    .select()
    .from(schema.contacts)
    .where(
      and(
        eq(schema.contacts.organizationId, membership.organizationId),
        eq(schema.contacts.status, "active"),
      ),
    )
    .orderBy(asc(schema.contacts.name));
  return rows.map((row) => ({
    id: row.id,
    nome: row.name,
    email: row.email,
    documento: row.document,
    perfil: row.type,
    tipo: row.type,
    celulares: row.phones,
    ...row.details,
  }));
});

export const createContact = createServerFn({ method: "POST" })
  .validator(contactInput)
  .handler(async ({ data }) => {
    if (requiresUserAccount(data.type))
      throw new Error(
        "Investidores, assessores e gestores são cadastrados junto com o usuário de acesso.",
      );
    const { db, schema, session, membership } = await contactContext(true);
    if (data.type === "Investidor" || data.type === "Assessor") {
      const { enforcePlanFeature } = await import("@/lib/developer.server");
      await enforcePlanFeature(
        membership.organizationId,
        "menuItems",
        data.type === "Investidor" ? "Investidores" : "Assessores",
      );
    }
    const normalizedDocument = data.documento.replace(/\D/g, "");
    if (!validateDocument(normalizedDocument)) throw new Error("Informe um CPF ou CNPJ válido.");
    return db.transaction(async (tx) => {
      await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${membership.organizationId}))`);
      const limitKey =
        data.type === "Investidor"
          ? "maxInvestors"
          : data.type === "Assessor"
            ? "maxAdvisors"
            : data.type === "Responsável"
              ? "maxProjectManagers"
              : null;
      if (limitKey) {
        const [{ enforcePlanLimit }, counted] = await Promise.all([
          import("@/lib/developer.server"),
          tx
            .select({ value: sql<number>`count(*)::int` })
            .from(schema.contacts)
            .where(
              and(
                eq(schema.contacts.organizationId, membership.organizationId),
                eq(schema.contacts.type, data.type),
                eq(schema.contacts.status, "active"),
              ),
            ),
        ]);
        await enforcePlanLimit(membership.organizationId, limitKey, Number(counted[0]?.value ?? 0));
      }
      const [duplicate] = await tx
        .select({ id: schema.contacts.id })
        .from(schema.contacts)
        .where(
          and(
            eq(schema.contacts.organizationId, membership.organizationId),
            eq(schema.contacts.document, normalizedDocument),
            eq(schema.contacts.type, data.type),
          ),
        )
        .limit(1);
      if (duplicate) throw new Error("CPF já Cadastrado.");
      const { type, nome, documento: _documento, email, celulares, ...details } = data;
      const [created] = await tx
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
        .returning();
      if (!created) throw new Error("Não foi possível cadastrar o participante.");
      await tx.insert(schema.auditLogs).values({
        organizationId: membership.organizationId,
        actorId: session.user.id,
        action: "contact.created",
        entityType: "contact",
        entityId: created.id,
        metadata: { type: created.type },
      });
      return {
        id: created.id,
        nome: created.name,
        email: created.email,
        documento: created.document,
        perfil: created.type,
        tipo: created.type,
      };
    });
  });

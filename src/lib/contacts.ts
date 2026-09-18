import { createServerFn } from "@tanstack/react-start";
import { and, asc, eq } from "drizzle-orm";
import { z } from "zod";
import { validateDocument } from "@/lib/utils-validation";

export const contactTypes = [
  "Investidor", "Assessor", "Responsável", "Leiloeiro", "Corretor", "Imobiliária", "Fornecedor",
] as const;

const contactInput = z.object({
  type: z.enum(contactTypes),
  nome: z.string().trim().min(2).max(180),
  documento: z.string().trim().min(11).max(18),
  email: z.string().trim().toLowerCase().email().max(254),
  celulares: z.array(z.string().trim().max(30)).max(5),
  dataNascimento: z.string().max(10).optional(),
  estadoCivil: z.string().max(40).optional(),
  endereco: z.string().max(300).optional(),
  banco: z.string().max(100).optional(),
  agencia: z.string().max(30).optional(),
  conta: z.string().max(40).optional(),
  website: z.union([z.literal(""), z.string().url().max(300)]).optional(),
  cidade: z.string().max(120).optional(),
  estado: z.string().max(2).optional(),
});

async function contactContext(requireManager = false) {
  const [{ getRequestHeaders }, { auth }, { db }, schema] = await Promise.all([
    import("@tanstack/react-start/server"), import("@/lib/auth.server"),
    import("@/db/index.server"), import("@/db/schema"),
  ]);
  const session = await auth.api.getSession({ headers: getRequestHeaders() });
  if (!session) throw new Error("Não autenticado.");
  const { resolveActiveMembership } = await import("@/lib/active-organization.server");
  const membership = await resolveActiveMembership(db, schema, session.user.id);
  if (!membership) throw new Error("Empresa ativa não encontrada.");
  if (requireManager && !["owner", "admin"].includes(membership.role)) {
    throw new Error("Sem permissão para cadastrar participantes.");
  }
  return { db, schema, session, membership };
}

export const listContacts = createServerFn({ method: "GET" }).handler(async () => {
  const { db, schema, membership } = await contactContext();
  const rows = await db.select().from(schema.contacts).where(and(
    eq(schema.contacts.organizationId, membership.organizationId),
    eq(schema.contacts.status, "active"),
  )).orderBy(asc(schema.contacts.name));
  return rows.map((row) => ({
    id: row.id, nome: row.name, email: row.email, documento: row.document,
    perfil: row.type, tipo: row.type, celulares: row.phones, ...row.details,
  }));
});

export const createContact = createServerFn({ method: "POST" })
  .validator(contactInput)
  .handler(async ({ data }) => {
    const { db, schema, session, membership } = await contactContext(true);
    const normalizedDocument = data.documento.replace(/\D/g, "");
    if (!validateDocument(normalizedDocument)) throw new Error("Informe um CPF ou CNPJ válido.");
    const [duplicate] = await db.select({ id: schema.contacts.id }).from(schema.contacts).where(and(
      eq(schema.contacts.organizationId, membership.organizationId),
      eq(schema.contacts.document, normalizedDocument),
    )).limit(1);
    if (duplicate) throw new Error("Este CPF ou CNPJ já está cadastrado nesta empresa.");
    const { type, nome, documento: _documento, email, celulares, ...details } = data;
    const [created] = await db.insert(schema.contacts).values({
      organizationId: membership.organizationId, type, name: nome,
      document: normalizedDocument, email, phones: celulares.filter(Boolean), details,
      createdBy: session.user.id,
    }).returning();
    if (!created) throw new Error("Não foi possível cadastrar o participante.");
    await db.insert(schema.auditLogs).values({ organizationId: membership.organizationId, actorId: session.user.id, action: "contact.created", entityType: "contact", entityId: created.id, metadata: { type: created.type } });
    return { id: created.id, nome: created.name, email: created.email, documento: created.document, perfil: created.type, tipo: created.type };
  });

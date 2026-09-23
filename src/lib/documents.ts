import { createServerFn } from "@tanstack/react-start";
import { and, desc, eq, sql } from "drizzle-orm";
import { z } from "zod";

async function documentContext(projectId: string) {
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
  await enforcePlanFeature(membership.organizationId, "projectTabs", "Documentos");
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
  await requireProjectRole(db, schema, membership, session.user.email, projectId);
  return { db, schema, session, membership };
}

export const listProjectDocuments = createServerFn({ method: "GET" })
  .validator(z.object({ projectId: z.string().uuid() }))
  .handler(async ({ data }) => {
    const { db, schema, membership } = await documentContext(data.projectId);
    const rows = await db
      .select({ document: schema.documents, author: schema.users.name })
      .from(schema.documents)
      .innerJoin(schema.users, eq(schema.users.id, schema.documents.uploadedBy))
      .where(
        and(
          eq(schema.documents.projectId, data.projectId),
          eq(schema.documents.organizationId, membership.organizationId),
        ),
      )
      .orderBy(desc(schema.documents.createdAt));
    return rows.map(({ document, author }) => ({
      id: document.id,
      nome: document.displayName,
      categoria: document.category,
      versao: `v${document.version}`,
      autor: author,
      data: new Intl.DateTimeFormat("pt-BR").format(document.createdAt),
      tamanho: `${(document.sizeBytes / 1024).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} KB`,
      url: `/api/documents/${document.id}`,
    }));
  });

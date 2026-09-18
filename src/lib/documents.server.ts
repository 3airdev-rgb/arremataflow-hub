import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { and, eq, sql } from "drizzle-orm";
import { auth } from "@/lib/auth.server";
import { db } from "@/db/index.server";
import * as schema from "@/db/schema";
import { financialCategories } from "@/lib/financial-categories";
import { resolveActiveMembership } from "@/lib/active-organization.server";

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const allowedMime = new Set(["application/pdf", "image/jpeg", "image/png", "image/webp"]);

function storageRoot() {
  const configured = process.env["DOCUMENT_STORAGE_PATH"];
  if (process.env["NODE_ENV"] === "production" && !configured) throw new Error("DOCUMENT_STORAGE_PATH não configurado.");
  return path.resolve(configured || path.join(process.cwd(), ".data", "documents"));
}

function detectedMime(bytes: Buffer) {
  if (bytes.subarray(0, 5).toString() === "%PDF-") return "application/pdf";
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return "image/png";
  if (bytes.subarray(0, 4).toString() === "RIFF" && bytes.subarray(8, 12).toString() === "WEBP") return "image/webp";
  return null;
}

async function requestContext(request: Request, projectId?: string, requireManager = false) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) throw new Response("Não autenticado.", { status: 401 });
  const membership = await resolveActiveMembership(db, schema, session.user.id);
  if (!membership) throw new Response("Empresa ativa não encontrada.", { status: 403 });
  if (requireManager && !["owner", "admin"].includes(membership.role)) throw new Response("Sem permissão.", { status: 403 });
  if (projectId) {
    const [project] = await db.select({ id: schema.projects.id }).from(schema.projects).where(and(
      eq(schema.projects.id, projectId), eq(schema.projects.organizationId, membership.organizationId),
    )).limit(1);
    if (!project) throw new Response("Projeto não encontrado.", { status: 404 });
    if (!["owner", "admin"].includes(membership.role)) {
      const expectedRole = membership.role === "advisor" ? "advisor" : "investor";
      const [access] = await db.select({ id: schema.projectParticipants.id })
        .from(schema.projectParticipants)
        .innerJoin(schema.contacts, eq(schema.contacts.id, schema.projectParticipants.contactId))
        .where(and(eq(schema.projectParticipants.projectId, projectId),
          eq(schema.projectParticipants.role, expectedRole),
          eq(schema.contacts.organizationId, membership.organizationId),
          eq(schema.contacts.status, "active"),
          sql`lower(${schema.contacts.email}) = lower(${session.user.email})`)).limit(1);
      if (!access) throw new Response("Projeto não vinculado ao usuário.", { status: 403 });
    }
  }
  return { session, membership };
}

function assertSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) throw new Response("Origem inválida.", { status: 403 });
}

export async function uploadDocument(request: Request) {
  assertSameOrigin(request);
  const length = Number(request.headers.get("content-length") || 0);
  if (length > MAX_FILE_SIZE + 1024 * 1024) throw new Response("Arquivo muito grande.", { status: 413 });
  if (!request.headers.get("content-type")?.startsWith("multipart/form-data")) throw new Response("Formato de requisição inválido.", { status: 415 });
  const form = await request.formData();
  const file = form.get("file");
  const projectId = String(form.get("projectId") || "");
  const displayName = String(form.get("name") || "").trim();
  const category = String(form.get("category") || "");
  const financialMovementId = String(form.get("financialMovementId") || "") || null;
  if (!(file instanceof File) || !projectId.match(/^[0-9a-f-]{36}$/i)) throw new Response("Arquivo ou projeto inválido.", { status: 400 });
  if (displayName.length < 2 || displayName.length > 180) throw new Response("Nome do documento inválido.", { status: 400 });
  if (!financialCategories.includes(category as any)) throw new Response("Categoria inválida.", { status: 400 });
  if (file.size < 1 || file.size > MAX_FILE_SIZE) throw new Response("O arquivo deve ter até 10 MB.", { status: 413 });
  if (!allowedMime.has(file.type)) throw new Response("Tipo de arquivo não permitido.", { status: 415 });
  const { session, membership } = await requestContext(request, projectId, true);
  if (financialMovementId) {
    const [movement] = await db.select({ id: schema.financialMovements.id }).from(schema.financialMovements).where(and(
      eq(schema.financialMovements.id, financialMovementId), eq(schema.financialMovements.projectId, projectId),
      eq(schema.financialMovements.organizationId, membership.organizationId),
    )).limit(1);
    if (!movement) throw new Response("Movimentação financeira inválida.", { status: 400 });
  }
  const bytes = Buffer.from(await file.arrayBuffer());
  const mime = detectedMime(bytes);
  if (!mime || mime !== file.type) throw new Response("O conteúdo do arquivo não corresponde ao tipo informado.", { status: 415 });
  const extension = mime === "application/pdf" ? ".pdf" : mime === "image/jpeg" ? ".jpg" : mime === "image/png" ? ".png" : ".webp";
  const storageKey = `${membership.organizationId}/${projectId}/${randomUUID()}${extension}`;
  const root = storageRoot();
  const target = path.resolve(root, storageKey);
  if (!target.startsWith(`${root}${path.sep}`)) throw new Response("Destino inválido.", { status: 400 });
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, bytes, { flag: "wx", mode: 0o600 });
  try {
    const [versionRow] = await db.select({ nextVersion: sql<number>`coalesce(max(${schema.documents.version}), 0) + 1` })
      .from(schema.documents).where(and(eq(schema.documents.projectId, projectId), eq(schema.documents.displayName, displayName)));
    if (!versionRow) throw new Error("Não foi possível calcular a versão do documento.");
    const nextVersion = versionRow.nextVersion;
    const [created] = await db.transaction(async (tx) => {
      const inserted = await tx.insert(schema.documents).values({
        organizationId: membership.organizationId, projectId, financialMovementId,
        displayName, originalName: path.basename(file.name).slice(0, 240), category,
        version: Number(nextVersion), storageKey, mimeType: mime, sizeBytes: bytes.length,
        sha256: createHash("sha256").update(bytes).digest("hex"), uploadedBy: session.user.id,
      }).returning();
      const document = inserted[0];
      if (!document) throw new Error("Não foi possível registrar o documento.");
      await tx.insert(schema.auditLogs).values({
        organizationId: membership.organizationId, projectId, actorId: session.user.id,
        action: "document.uploaded", entityType: "document", entityId: document.id,
        metadata: { category, sizeBytes: bytes.length, sha256: document.sha256 },
      });
      return inserted;
    });
    if (!created) throw new Error("Não foi possível registrar o documento.");
    return Response.json({ id: created.id }, { status: 201 });
  } catch (error) {
    await unlink(target).catch(() => undefined);
    throw error;
  }
}

export async function downloadDocument(request: Request, id: string) {
  const [document] = await db.select().from(schema.documents).where(eq(schema.documents.id, id)).limit(1);
  if (!document) throw new Response("Documento não encontrado.", { status: 404 });
  const { membership } = await requestContext(request, document.projectId);
  if (document.organizationId !== membership.organizationId) throw new Response("Documento não encontrado.", { status: 404 });
  const root = storageRoot();
  const target = path.resolve(root, document.storageKey);
  if (!target.startsWith(`${root}${path.sep}`)) throw new Response("Destino inválido.", { status: 400 });
  const bytes = await readFile(target).catch(() => null);
  if (!bytes) throw new Response("Arquivo indisponível.", { status: 404 });
  const safeName = document.originalName.replace(/[\r\n"\\]/g, "_");
  return new Response(bytes, { headers: {
    "Content-Type": document.mimeType,
    "Content-Length": String(bytes.length),
    "Content-Disposition": `attachment; filename="${safeName}"; filename*=UTF-8''${encodeURIComponent(document.originalName)}`,
    "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff",
    "Content-Security-Policy": "default-src 'none'; sandbox",
  }});
}

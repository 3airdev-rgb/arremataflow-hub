import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { and, asc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { auth } from "@/lib/auth.server";
import { db } from "@/db/index.server";
import * as schema from "@/db/schema";
import { resolveActiveMembership } from "@/lib/active-organization.server";
import { requireProjectRole } from "@/lib/project-access.server";

const MAX_FILE_SIZE = 5 * 1024 * 1024;
const allowedMime = new Set(["image/jpeg", "image/png", "image/webp"]);

function storageRoot() {
  const configured = process.env["DOCUMENT_STORAGE_PATH"];
  if (process.env["NODE_ENV"] === "production" && !configured)
    throw new Error("DOCUMENT_STORAGE_PATH não configurado.");
  return path.resolve(configured || path.join(process.cwd(), ".data", "documents"));
}

function detectedMime(bytes: Buffer) {
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])))
    return "image/png";
  if (bytes.subarray(0, 4).toString() === "RIFF" && bytes.subarray(8, 12).toString() === "WEBP")
    return "image/webp";
  return null;
}

function assertSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin)
    throw new Response("Origem inválida.", { status: 403 });
}

async function context(request: Request, projectId: string, requireManager = false) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) throw new Response("Não autenticado.", { status: 401 });
  const membership = await resolveActiveMembership(db, schema, session.user.id);
  if (!membership) throw new Response("Empresa ativa não encontrada.", { status: 403 });
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
  if (!project) throw new Response("Projeto não encontrado.", { status: 404 });
  try {
    await requireProjectRole(
      db,
      schema,
      membership,
      session.user.email,
      projectId,
      requireManager ? "project_manager" : "investor",
    );
  } catch {
    throw new Response("Projeto não vinculado ao usuário.", { status: 403 });
  }
  return { session, membership };
}

const responsePhoto = (row: typeof schema.projectImages.$inferSelect) => ({
  id: row.id,
  url: `/api/project-images/${row.id}`,
  file_path: row.storageKey,
  file_name: row.originalName,
  is_main: row.isMain,
  display_order: row.displayOrder,
});

export async function uploadProjectImage(request: Request) {
  assertSameOrigin(request);
  const length = Number(request.headers.get("content-length") || 0);
  if (length > MAX_FILE_SIZE + 512_000) throw new Response("Imagem muito grande.", { status: 413 });
  if (!request.headers.get("content-type")?.startsWith("multipart/form-data"))
    throw new Response("Formato inválido.", { status: 415 });
  const form = await request.formData();
  const file = form.get("file"),
    projectId = String(form.get("projectId") || "");
  if (!(file instanceof File) || !z.string().uuid().safeParse(projectId).success)
    throw new Response("Imagem ou projeto inválido.", { status: 400 });
  if (file.size < 1 || file.size > MAX_FILE_SIZE)
    throw new Response("A imagem deve ter até 5 MB.", { status: 413 });
  if (!allowedMime.has(file.type))
    throw new Response("Formato de imagem não permitido.", { status: 415 });
  const { session, membership } = await context(request, projectId, true);
  const bytes = Buffer.from(await file.arrayBuffer()),
    mime = detectedMime(bytes);
  if (!mime || mime !== file.type)
    throw new Response("O conteúdo da imagem não corresponde ao formato informado.", {
      status: 415,
    });
  const extension = mime === "image/jpeg" ? ".jpg" : mime === "image/png" ? ".png" : ".webp";
  const storageKey = `${membership.organizationId}/${projectId}/images/${randomUUID()}${extension}`;
  const root = storageRoot(),
    target = path.resolve(root, storageKey);
  if (!target.startsWith(`${root}${path.sep}`))
    throw new Response("Destino inválido.", { status: 400 });
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, bytes, { flag: "wx", mode: 0o600 });
  try {
    const created = await db.transaction(async (tx) => {
      await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${projectId}))`);
      const existing = await tx
        .select({ id: schema.projectImages.id })
        .from(schema.projectImages)
        .where(eq(schema.projectImages.projectId, projectId))
        .orderBy(asc(schema.projectImages.displayOrder));
      if (existing.length >= 10)
        throw new Response("Limite de 10 fotos atingido.", { status: 409 });
      const [row] = await tx
        .insert(schema.projectImages)
        .values({
          organizationId: membership.organizationId,
          projectId,
          storageKey,
          originalName: path.basename(file.name).slice(0, 240),
          mimeType: mime,
          sizeBytes: bytes.length,
          sha256: createHash("sha256").update(bytes).digest("hex"),
          displayOrder: existing.length,
          isMain: existing.length === 0,
          uploadedBy: session.user.id,
        })
        .returning();
      if (!row) throw new Error("Não foi possível registrar a foto.");
      if (row.isMain)
        await tx
          .update(schema.projects)
          .set({ mainImage: `/api/project-images/${row.id}`, updatedAt: new Date() })
          .where(eq(schema.projects.id, projectId));
      await tx.insert(schema.auditLogs).values({
        organizationId: membership.organizationId,
        projectId,
        actorId: session.user.id,
        action: "project_image.uploaded",
        entityType: "project_image",
        entityId: row.id,
        metadata: { sizeBytes: row.sizeBytes, sha256: row.sha256 },
      });
      return row;
    });
    return Response.json(responsePhoto(created), { status: 201 });
  } catch (error) {
    await unlink(target).catch(() => undefined);
    throw error;
  }
}

export async function readProjectImage(request: Request, id: string) {
  const [image] = await db
    .select()
    .from(schema.projectImages)
    .where(eq(schema.projectImages.id, id))
    .limit(1);
  if (!image) throw new Response("Imagem não encontrada.", { status: 404 });
  const { membership } = await context(request, image.projectId);
  if (image.organizationId !== membership.organizationId)
    throw new Response("Imagem não encontrada.", { status: 404 });
  const root = storageRoot(),
    target = path.resolve(root, image.storageKey);
  if (!target.startsWith(`${root}${path.sep}`))
    throw new Response("Destino inválido.", { status: 400 });
  const bytes = await readFile(target).catch(() => null);
  if (!bytes) throw new Response("Imagem indisponível.", { status: 404 });
  return new Response(bytes, {
    headers: {
      "Content-Type": image.mimeType,
      "Content-Length": String(bytes.length),
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
      "Content-Disposition": "inline",
    },
  });
}

export async function deleteProjectImage(request: Request, id: string) {
  assertSameOrigin(request);
  const [image] = await db
    .select()
    .from(schema.projectImages)
    .where(eq(schema.projectImages.id, id))
    .limit(1);
  if (!image) throw new Response("Imagem não encontrada.", { status: 404 });
  const { session, membership } = await context(request, image.projectId, true);
  await db.transaction(async (tx) => {
    await tx
      .delete(schema.projectImages)
      .where(
        and(
          eq(schema.projectImages.id, id),
          eq(schema.projectImages.organizationId, membership.organizationId),
        ),
      );
    const remaining = await tx
      .select()
      .from(schema.projectImages)
      .where(eq(schema.projectImages.projectId, image.projectId))
      .orderBy(asc(schema.projectImages.displayOrder));
    for (let index = 0; index < remaining.length; index++)
      await tx
        .update(schema.projectImages)
        .set({ displayOrder: index, isMain: index === 0 })
        .where(eq(schema.projectImages.id, remaining[index]!.id));
    await tx
      .update(schema.projects)
      .set({
        mainImage: remaining[0] ? `/api/project-images/${remaining[0].id}` : null,
        updatedAt: new Date(),
      })
      .where(eq(schema.projects.id, image.projectId));
    await tx.insert(schema.auditLogs).values({
      organizationId: membership.organizationId,
      projectId: image.projectId,
      actorId: session.user.id,
      action: "project_image.deleted",
      entityType: "project_image",
      entityId: image.id,
      metadata: { originalName: image.originalName },
    });
  });
  const root = storageRoot(),
    target = path.resolve(root, image.storageKey);
  if (target.startsWith(`${root}${path.sep}`)) await unlink(target).catch(() => undefined);
  return new Response(null, { status: 204 });
}

const orderInput = z.object({
  projectId: z.string().uuid(),
  ids: z.array(z.string().uuid()).min(1).max(10),
});
export async function orderProjectImages(request: Request) {
  assertSameOrigin(request);
  const parsed = orderInput.safeParse(await request.json().catch(() => null));
  if (!parsed.success || new Set(parsed.data.ids).size !== parsed.data.ids.length)
    throw new Response("Ordem inválida.", { status: 400 });
  const { session, membership } = await context(request, parsed.data.projectId, true);
  const rows = await db
    .select()
    .from(schema.projectImages)
    .where(
      and(
        eq(schema.projectImages.projectId, parsed.data.projectId),
        eq(schema.projectImages.organizationId, membership.organizationId),
      ),
    );
  if (
    rows.length !== parsed.data.ids.length ||
    rows.some((row) => !parsed.data.ids.includes(row.id))
  )
    throw new Response("Lista de imagens incompleta.", { status: 400 });
  await db.transaction(async (tx) => {
    await tx
      .update(schema.projectImages)
      .set({ isMain: false })
      .where(eq(schema.projectImages.projectId, parsed.data.projectId));
    for (let index = 0; index < parsed.data.ids.length; index++)
      await tx
        .update(schema.projectImages)
        .set({ displayOrder: index, isMain: index === 0 })
        .where(eq(schema.projectImages.id, parsed.data.ids[index]!));
    await tx
      .update(schema.projects)
      .set({ mainImage: `/api/project-images/${parsed.data.ids[0]}`, updatedAt: new Date() })
      .where(eq(schema.projects.id, parsed.data.projectId));
    await tx.insert(schema.auditLogs).values({
      organizationId: membership.organizationId,
      projectId: parsed.data.projectId,
      actorId: session.user.id,
      action: "project_images.reordered",
      entityType: "project",
      entityId: parsed.data.projectId,
      metadata: { count: rows.length },
    });
  });
  return Response.json({ ok: true });
}

import { randomUUID } from "node:crypto";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { eq } from "drizzle-orm";
import { db } from "@/db/index.server";
import * as schema from "@/db/schema";
import { auth } from "@/lib/auth.server";
import { resolveActiveMembership } from "@/lib/active-organization.server";

const maxSize = 10 * 1024 * 1024;
const mimeTypes = new Set(["application/pdf", "image/jpeg", "image/png", "image/webp"]);
function root() {
  const configured = process.env["DOCUMENT_STORAGE_PATH"];
  if (process.env["NODE_ENV"] === "production" && !configured)
    throw new Error("DOCUMENT_STORAGE_PATH não configurado.");
  return path.resolve(configured || path.join(process.cwd(), ".data", "documents"));
}
function detectedMime(bytes: Buffer) {
  if (bytes.subarray(0, 5).toString() === "%PDF-") return "application/pdf";
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])))
    return "image/png";
  if (bytes.subarray(0, 4).toString() === "RIFF" && bytes.subarray(8, 12).toString() === "WEBP")
    return "image/webp";
  return null;
}
async function access(request: Request, ticketId: string) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) throw new Response("Não autenticado.", { status: 401 });
  const [user, ticket] = await Promise.all([
    db
      .select({ systemRole: schema.users.systemRole })
      .from(schema.users)
      .where(eq(schema.users.id, session.user.id)),
    db.select().from(schema.supportTickets).where(eq(schema.supportTickets.id, ticketId)),
  ]);
  if (!ticket[0]) throw new Response("Chamado não encontrado.", { status: 404 });
  if (user[0]?.systemRole !== "developer") {
    const membership = await resolveActiveMembership(db, schema, session.user.id);
    if (
      !membership ||
      membership.organizationId !== ticket[0].organizationId ||
      ticket[0].openedBy !== session.user.id
    )
      throw new Response("Chamado não encontrado.", { status: 404 });
  }
  return { userId: session.user.id, ticket: ticket[0] };
}
export async function uploadSupportAttachment(request: Request) {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin)
    throw new Response("Origem inválida.", { status: 403 });
  if (Number(request.headers.get("content-length") || 0) > maxSize + 1048576)
    throw new Response("Arquivo muito grande.", { status: 413 });
  if (!request.headers.get("content-type")?.startsWith("multipart/form-data"))
    throw new Response("Formato inválido.", { status: 415 });
  const form = await request.formData();
  const ticketId = String(form.get("ticketId") || "");
  const file = form.get("file");
  const { userId, ticket } = await access(request, ticketId);
  if (!(file instanceof File) || !file.size || file.size > maxSize)
    throw new Response("Arquivo inválido ou maior que 10 MB.", { status: 400 });
  const bytes = Buffer.from(await file.arrayBuffer());
  const mimeType = detectedMime(bytes);
  if (!mimeType || !mimeTypes.has(mimeType))
    throw new Response("Use PDF, JPG, PNG ou WebP.", { status: 415 });
  const storageKey = `${ticket.organizationId}/support/${ticket.id}/${randomUUID()}`;
  const target = path.resolve(root(), storageKey);
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, bytes, { flag: "wx" });
  try {
    const [record] = await db
      .insert(schema.supportAttachments)
      .values({
        ticketId,
        storageKey,
        originalName: file.name.slice(0, 255),
        mimeType,
        sizeBytes: bytes.length,
        uploadedBy: userId,
      })
      .returning();
    return Response.json(record);
  } catch (error) {
    await unlink(target).catch(() => {});
    throw error;
  }
}
export async function downloadSupportAttachment(request: Request, id: string) {
  const [attachment] = await db
    .select()
    .from(schema.supportAttachments)
    .where(eq(schema.supportAttachments.id, id));
  if (!attachment) throw new Response("Anexo não encontrado.", { status: 404 });
  await access(request, attachment.ticketId);
  const storageRoot = root();
  const target = path.resolve(storageRoot, attachment.storageKey);
  if (!target.startsWith(`${storageRoot}${path.sep}`))
    throw new Response("Arquivo inválido.", { status: 400 });
  const bytes = await readFile(target).catch(() => null);
  if (!bytes) throw new Response("Arquivo indisponível.", { status: 404 });
  const safeName = attachment.originalName.replace(/[\r\n"\\]/g, "_");
  return new Response(bytes, {
    headers: {
      "Content-Type": attachment.mimeType,
      "Content-Disposition": `attachment; filename="${safeName}"; filename*=UTF-8''${encodeURIComponent(attachment.originalName)}`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

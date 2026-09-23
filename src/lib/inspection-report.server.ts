import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, unlink } from "node:fs/promises";
import { spawn } from "node:child_process";
import path from "node:path";
import { and, eq, sql } from "drizzle-orm";
import type { DbExecutor, Schema } from "@/db/types";
import type { InspectionAnswers } from "@/lib/property-inspections";

function storageRoot() {
  const configured = process.env["DOCUMENT_STORAGE_PATH"];
  if (process.env["NODE_ENV"] === "production" && !configured)
    throw new Error("DOCUMENT_STORAGE_PATH não configurado.");
  return path.resolve(configured || path.join(process.cwd(), ".data", "documents"));
}

function generatePdf(target: string, payload: unknown) {
  return new Promise<void>((resolve, reject) => {
    const script = path.resolve(process.cwd(), "scripts", "generate-inspection-pdf.mjs");
    const child = spawn(process.execPath, [script, target], { stdio: ["pipe", "ignore", "pipe"] });
    let error = "";
    child.stderr.on("data", (chunk) => {
      error += String(chunk);
    });
    child.on("error", reject);
    child.on("close", (code) =>
      code === 0 ? resolve() : reject(new Error(error || `Falha ao gerar PDF (${code}).`)),
    );
    child.stdin.end(JSON.stringify(payload));
  });
}

export async function createInspectionDocument(
  db: DbExecutor,
  schema: Schema,
  inspection: Schema["propertyInspections"]["$inferSelect"],
  project: Schema["projects"]["$inferSelect"],
  answers: InspectionAnswers,
) {
  const storageKey = `${inspection.organizationId}/${inspection.projectId}/${randomUUID()}.pdf`;
  const root = storageRoot();
  const target = path.resolve(root, storageKey);
  if (!target.startsWith(`${root}${path.sep}`)) throw new Error("Destino do relatório inválido.");
  await mkdir(path.dirname(target), { recursive: true });
  await generatePdf(target, {
    project: { name: project.name, address: project.address, city: project.city },
    inspectorName: inspection.inspectorName,
    data: answers,
  });
  const bytes = await readFile(target);
  try {
    const [versionRow] = await db
      .select({ nextVersion: sql<number>`coalesce(max(${schema.documents.version}), 0) + 1` })
      .from(schema.documents)
      .where(
        and(
          eq(schema.documents.projectId, inspection.projectId),
          eq(schema.documents.displayName, "Vistoria do imóvel"),
        ),
      );
    await db.insert(schema.documents).values({
      organizationId: inspection.organizationId,
      projectId: inspection.projectId,
      displayName: "Vistoria do imóvel",
      originalName: "vistoria-do-imovel.pdf",
      category: "Aquisição",
      version: Number(versionRow?.nextVersion || 1),
      storageKey,
      mimeType: "application/pdf",
      sizeBytes: bytes.length,
      sha256: createHash("sha256").update(bytes).digest("hex"),
      uploadedBy: inspection.createdBy,
    });
  } catch (error) {
    await unlink(target).catch(() => undefined);
    throw error;
  }
}

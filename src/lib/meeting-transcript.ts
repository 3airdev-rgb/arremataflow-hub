export const wordMimeTypes = {
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
} as const;

export const transcriptMimeTypes: readonly string[] = [
  "application/pdf",
  wordMimeTypes.doc,
  wordMimeTypes.docx,
];

export const transcriptExtensions = ".pdf,.doc,.docx";

const mimeByExtension: Record<string, string> = {
  pdf: "application/pdf",
  doc: wordMimeTypes.doc,
  docx: wordMimeTypes.docx,
};

/** Alguns navegadores enviam tipo vazio para .doc/.docx; usa a extensão nesse caso. */
export function transcriptMimeFromFile(file: { name: string; type: string }): string {
  if (transcriptMimeTypes.includes(file.type)) return file.type;
  const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
  return mimeByExtension[extension] ?? file.type;
}

/** Confere a assinatura real do arquivo para Word (.doc e .docx). Só roda no servidor (usa Buffer). */
export function detectWordMime(bytes: Buffer): string | null {
  const oleHeader = Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]);
  if (bytes.subarray(0, 8).equals(oleHeader))
    return bytes.includes(Buffer.from("WordDocument", "utf16le")) ? wordMimeTypes.doc : null;
  const isZip = bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 0x03 && bytes[3] === 0x04;
  return isZip && bytes.includes("word/document.xml") ? wordMimeTypes.docx : null;
}

export function transcriptExtension(mime: string): string {
  if (mime === wordMimeTypes.doc) return ".doc";
  if (mime === wordMimeTypes.docx) return ".docx";
  return ".pdf";
}

/** "Reunião OnLine 24/09/2026 14:30" a partir da data (AAAA-MM-DD) e do horário (HH:mm) da tarefa. */
export function meetingTranscriptName(dueDate: string | null, meetingTime: string | null): string {
  const date = dueDate ? dueDate.split("-").reverse().join("/") : "";
  return ["Reunião OnLine", date, meetingTime ?? ""].filter(Boolean).join(" ");
}

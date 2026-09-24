import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  detectWordMime,
  meetingTranscriptName,
  transcriptMimeFromFile,
  wordMimeTypes,
} from "./meeting-transcript.ts";

describe("meetingTranscriptName", () => {
  it("usa data e horário da tarefa", () => {
    assert.equal(meetingTranscriptName("2026-09-24", "14:30"), "Reunião OnLine 24/09/2026 14:30");
  });

  it("omite o que não foi informado", () => {
    assert.equal(meetingTranscriptName(null, "09:00"), "Reunião OnLine 09:00");
    assert.equal(meetingTranscriptName("2026-01-05", null), "Reunião OnLine 05/01/2026");
    assert.equal(meetingTranscriptName(null, null), "Reunião OnLine");
  });
});

describe("transcriptMimeFromFile", () => {
  it("mantém o tipo informado quando é permitido", () => {
    assert.equal(
      transcriptMimeFromFile({ name: "a.bin", type: "application/pdf" }),
      "application/pdf",
    );
  });

  it("deduz pela extensão quando o navegador não informa o tipo", () => {
    assert.equal(transcriptMimeFromFile({ name: "Ata.DOCX", type: "" }), wordMimeTypes.docx);
    assert.equal(transcriptMimeFromFile({ name: "ata.doc", type: "" }), wordMimeTypes.doc);
  });

  it("não aceita outras extensões", () => {
    assert.equal(transcriptMimeFromFile({ name: "x.exe", type: "" }), "");
  });
});

describe("detectWordMime", () => {
  it("reconhece .docx pelo zip com word/document.xml", () => {
    const bytes = Buffer.concat([
      Buffer.from([0x50, 0x4b, 0x03, 0x04]),
      Buffer.from("....word/document.xml...."),
    ]);
    assert.equal(detectWordMime(bytes), wordMimeTypes.docx);
  });

  it("recusa zip que não é Word", () => {
    const bytes = Buffer.concat([Buffer.from([0x50, 0x4b, 0x03, 0x04]), Buffer.from("xl/sheet1")]);
    assert.equal(detectWordMime(bytes), null);
  });

  it("reconhece .doc pelo contêiner OLE com WordDocument", () => {
    const bytes = Buffer.concat([
      Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]),
      Buffer.from("WordDocument", "utf16le"),
    ]);
    assert.equal(detectWordMime(bytes), wordMimeTypes.doc);
  });

  it("recusa outros conteúdos", () => {
    assert.equal(detectWordMime(Buffer.from("texto qualquer")), null);
    assert.equal(
      detectWordMime(Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1, 1, 2])),
      null,
    );
  });
});

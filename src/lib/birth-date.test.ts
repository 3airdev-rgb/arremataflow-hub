import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  ageFromIso,
  birthDateError,
  birthDateToIso,
  isoToBirthDate,
  maskBirthDate,
} from "./birth-date.ts";

const now = new Date(2026, 8, 24); // 24/09/2026

describe("maskBirthDate", () => {
  it("insere as barras conforme a digitação", () => {
    assert.equal(maskBirthDate("1"), "1");
    assert.equal(maskBirthDate("120"), "12/0");
    assert.equal(maskBirthDate("12051"), "12/05/1");
    assert.equal(maskBirthDate("12051990"), "12/05/1990");
  });

  it("ignora letras, barras repetidas e excesso de dígitos", () => {
    assert.equal(maskBirthDate("12/05/1990"), "12/05/1990");
    assert.equal(maskBirthDate("a1b2c0d5e1f9g9h0i7j"), "12/05/1990");
  });
});

describe("birthDateToIso", () => {
  it("converte uma data completa e válida", () => {
    assert.equal(birthDateToIso("05/03/1988", now), "1988-03-05");
    assert.equal(birthDateToIso("29/02/2000", now), "2000-02-29");
  });

  it("recusa datas incompletas, inexistentes, antigas demais ou futuras", () => {
    assert.equal(birthDateToIso("05/03/19", now), null);
    assert.equal(birthDateToIso("31/04/1990", now), null);
    assert.equal(birthDateToIso("29/02/2001", now), null);
    assert.equal(birthDateToIso("01/01/1899", now), null);
    assert.equal(birthDateToIso("25/09/2026", now), null);
  });

  it("aceita o dia de hoje", () => {
    assert.equal(birthDateToIso("24/09/2026", now), "2026-09-24");
  });
});

describe("birthDateError", () => {
  it("não reclama enquanto a pessoa ainda digita", () => {
    assert.equal(birthDateError("", now), null);
    assert.equal(birthDateError("12/05", now), null);
  });

  it("explica o problema quando a data completa é inválida", () => {
    assert.match(birthDateError("31/02/1990", now) ?? "", /inválida/);
    assert.match(birthDateError("01/01/1850", now) ?? "", /1900/);
    assert.match(birthDateError("01/01/2030", now) ?? "", /futura/);
    assert.equal(birthDateError("12/05/1990", now), null);
  });
});

describe("isoToBirthDate e ageFromIso", () => {
  it("formata a data salva", () => {
    assert.equal(isoToBirthDate("1988-03-05"), "05/03/1988");
    assert.equal(isoToBirthDate("1988--"), "");
    assert.equal(isoToBirthDate(""), "");
    assert.equal(isoToBirthDate(undefined), "");
  });

  it("calcula a idade considerando o aniversário", () => {
    assert.equal(ageFromIso("1990-09-24", now), 36);
    assert.equal(ageFromIso("1990-09-25", now), 35);
    assert.equal(ageFromIso("2026-09-24", now), 0);
    assert.equal(ageFromIso("2030-01-01", now), null);
    assert.equal(ageFromIso("abc", now), null);
  });
});

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  formatDocument,
  maskCNPJ,
  maskCPF,
  validateCNPJ,
  validateCPF,
  validateDocument,
} from "./utils-validation.ts";

describe("validateCPF", () => {
  it("aceita CPF válido com ou sem máscara", () => {
    assert.equal(validateCPF("529.982.247-25"), true);
    assert.equal(validateCPF("52998224725"), true);
  });

  it("rejeita dígito verificador incorreto, sequências repetidas e tamanho errado", () => {
    assert.equal(validateCPF("529.982.247-24"), false);
    assert.equal(validateCPF("111.111.111-11"), false);
    assert.equal(validateCPF("5299822472"), false);
    assert.equal(validateCPF(""), false);
  });
});

describe("validateCNPJ", () => {
  it("aceita CNPJ válido com ou sem máscara", () => {
    assert.equal(validateCNPJ("11.222.333/0001-81"), true);
    assert.equal(validateCNPJ("11222333000181"), true);
  });

  it("rejeita dígito verificador incorreto, sequências repetidas e tamanho errado", () => {
    assert.equal(validateCNPJ("11.222.333/0001-82"), false);
    assert.equal(validateCNPJ("00.000.000/0000-00"), false);
    assert.equal(validateCNPJ("1122233300018"), false);
  });
});

describe("validateDocument", () => {
  it("escolhe CPF ou CNPJ pela quantidade de dígitos", () => {
    assert.equal(validateDocument("529.982.247-25"), true);
    assert.equal(validateDocument("11.222.333/0001-81"), true);
  });

  it("rejeita documentos com quantidade de dígitos diferente de 11 ou 14", () => {
    assert.equal(validateDocument("123456789012"), false);
    assert.equal(validateDocument(""), false);
  });
});

describe("máscaras", () => {
  it("formata CPF completo", () => {
    assert.equal(maskCPF("52998224725"), "529.982.247-25");
  });

  it("formata CNPJ completo no padrão oficial com barra", () => {
    assert.equal(maskCNPJ("11222333000181"), "11.222.333/0001-81");
  });

  it("descarta dígitos excedentes e caracteres não numéricos", () => {
    assert.equal(maskCPF("529.982.247-25999"), "529.982.247-25");
    assert.equal(maskCNPJ("11.222.333/0001-81999"), "11.222.333/0001-81");
  });

  it("formatDocument usa a máscara de CPF até 11 dígitos e a de CNPJ acima", () => {
    assert.equal(formatDocument("52998224725"), "529.982.247-25");
    assert.equal(formatDocument("11222333000181"), "11.222.333/0001-81");
  });
});

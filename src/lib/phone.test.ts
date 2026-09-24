import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { formatPhoneInput, normalizePhone, phoneSchema } from "./phone.ts";

describe("normalizePhone", () => {
  it("converte formatos brasileiros comuns para +55DDDNÚMERO", () => {
    assert.equal(normalizePhone("(48) 98444-3883"), "+5548984443883");
    assert.equal(normalizePhone("48984443883"), "+5548984443883");
    assert.equal(normalizePhone("+55 48 98444-3883"), "+5548984443883");
    assert.equal(normalizePhone("5548984443883"), "+5548984443883");
  });

  it("aceita telefone fixo com 8 dígitos", () => {
    assert.equal(normalizePhone("(48) 3333-4444"), "+554833334444");
    assert.equal(normalizePhone("554833334444"), "+554833334444");
  });

  it("não confunde o DDD 55 (Rio Grande do Sul) com o código do país", () => {
    assert.equal(normalizePhone("55999998888"), "+5555999998888");
    assert.equal(normalizePhone("5533334444"), "+555533334444");
    assert.equal(normalizePhone("+5555999998888"), "+5555999998888");
  });

  it("mantém vazio como vazio", () => {
    assert.equal(normalizePhone(""), "");
    assert.equal(normalizePhone("   "), "");
  });

  it("rejeita números inválidos e de outros países", () => {
    assert.equal(normalizePhone("489555454875"), null);
    assert.equal(normalizePhone("98444-3883"), null);
    assert.equal(normalizePhone("4898444388"), null);
    assert.equal(normalizePhone("Cleo"), null);
    assert.equal(normalizePhone("+1 555 123 4567"), null);
    assert.equal(normalizePhone("(00) 98444-3883"), null);
  });
});

describe("formatPhoneInput", () => {
  it("prefixa +55 automaticamente enquanto o usuário digita", () => {
    assert.equal(formatPhoneInput("4"), "+554");
    assert.equal(formatPhoneInput("48"), "+5548");
    assert.equal(formatPhoneInput("48984443883"), "+5548984443883");
  });

  it("não duplica o prefixo quando ele já está no campo", () => {
    assert.equal(formatPhoneInput("+5548"), "+5548");
    assert.equal(formatPhoneInput("+55489"), "+55489");
    assert.equal(formatPhoneInput("+5555"), "+5555");
  });

  it("permite apagar o campo por completo com o backspace", () => {
    assert.equal(formatPhoneInput("+55"), "");
    assert.equal(formatPhoneInput("+5"), "");
    assert.equal(formatPhoneInput("+"), "");
    assert.equal(formatPhoneInput(""), "");
  });

  it("converte números colados em vários formatos", () => {
    assert.equal(formatPhoneInput("(48) 98444-3883"), "+5548984443883");
    assert.equal(formatPhoneInput("+55 48 98444-3883"), "+5548984443883");
    assert.equal(formatPhoneInput("5548984443883"), "+5548984443883");
  });

  it("limita a 11 dígitos depois do +55", () => {
    assert.equal(formatPhoneInput("+554898444388399"), "+5548984443883");
  });
});

describe("phoneSchema", () => {
  it("normaliza valores válidos e aceita vazio", () => {
    assert.equal(phoneSchema.parse("(48) 98444-3883"), "+5548984443883");
    assert.equal(phoneSchema.parse(""), "");
  });

  it("recusa telefone fora do padrão com mensagem clara", () => {
    const result = phoneSchema.safeParse("12345");
    assert.equal(result.success, false);
    assert.match(result.error?.issues[0]?.message ?? "", /\+5548999999999/);
  });
});

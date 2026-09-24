import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import { isEmailConfigured } from "./email.server.ts";

const keys = [
  "EMAIL_PROVIDER",
  "AUTH_EMAIL_FROM",
  "RESEND_API_KEY",
  "SMTP_HOST",
  "SMTP_PORT",
  "SMTP_USER",
  "SMTP_PASSWORD",
] as const;

describe("isEmailConfigured", () => {
  const saved: Record<string, string | undefined> = {};

  beforeEach(() => {
    for (const key of keys) {
      saved[key] = process.env[key];
      delete process.env[key];
    }
  });

  afterEach(() => {
    for (const key of keys) {
      if (saved[key] === undefined) delete process.env[key];
      else process.env[key] = saved[key];
    }
  });

  it("não está configurado sem remetente, qualquer que seja o provedor", () => {
    process.env["RESEND_API_KEY"] = "re_x";
    assert.equal(isEmailConfigured(), false);
  });

  it("com Resend, exige a chave da API", () => {
    process.env["AUTH_EMAIL_FROM"] = "ArremataFlow <a@example.com>";
    assert.equal(isEmailConfigured(), false);
    process.env["RESEND_API_KEY"] = "re_x";
    assert.equal(isEmailConfigured(), true);
  });

  it("com SMTP, considera configurado sem precisar da chave do Resend", () => {
    process.env["EMAIL_PROVIDER"] = "smtp";
    process.env["AUTH_EMAIL_FROM"] = "ArremataFlow <a@gmail.com>";
    process.env["SMTP_HOST"] = "smtp.gmail.com";
    process.env["SMTP_PORT"] = "587";
    process.env["SMTP_USER"] = "a@gmail.com";
    process.env["SMTP_PASSWORD"] = "senha-de-app";
    assert.equal(isEmailConfigured(), true);
  });

  it("com SMTP, exige host, usuário e senha", () => {
    process.env["EMAIL_PROVIDER"] = "smtp";
    process.env["AUTH_EMAIL_FROM"] = "ArremataFlow <a@gmail.com>";
    process.env["SMTP_HOST"] = "smtp.gmail.com";
    process.env["SMTP_USER"] = "a@gmail.com";
    assert.equal(isEmailConfigured(), false);
    process.env["SMTP_PASSWORD"] = "senha-de-app";
    assert.equal(isEmailConfigured(), true);
  });

  it("com SMTP, rejeita porta inválida", () => {
    process.env["EMAIL_PROVIDER"] = "smtp";
    process.env["AUTH_EMAIL_FROM"] = "ArremataFlow <a@gmail.com>";
    process.env["SMTP_HOST"] = "smtp.gmail.com";
    process.env["SMTP_PORT"] = "abc";
    process.env["SMTP_USER"] = "a@gmail.com";
    process.env["SMTP_PASSWORD"] = "senha-de-app";
    assert.equal(isEmailConfigured(), false);
  });
});

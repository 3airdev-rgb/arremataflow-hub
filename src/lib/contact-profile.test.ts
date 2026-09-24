import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { contactRowToProfile, profileToContactColumns } from "./contact-profile.ts";

describe("contactRowToProfile", () => {
  it("monta o perfil a partir da linha de contato e dos detalhes", () => {
    const profile = contactRowToProfile({
      name: "Ana Souza",
      document: "52998224725",
      email: "ana@example.com",
      phones: ["(48) 99999-0000"],
      details: { cidade: "Florianópolis", estado: "SC", numero: 42, ignorado: "x" },
    });
    assert.deepEqual(profile, {
      nome: "Ana Souza",
      documento: "52998224725",
      email: "ana@example.com",
      celulares: ["(48) 99999-0000"],
      cidade: "Florianópolis",
      estado: "SC",
    });
  });

  it("garante ao menos um campo de celular vazio para o formulário", () => {
    const profile = contactRowToProfile({
      name: "Ana",
      document: "52998224725",
      email: "ana@example.com",
      phones: [],
      details: {},
    });
    assert.deepEqual(profile.celulares, [""]);
  });
});

describe("profileToContactColumns", () => {
  it("normaliza documento e e-mail, remove celulares vazios e guarda só detalhes informados", () => {
    const columns = profileToContactColumns({
      nome: "Ana Souza",
      documento: "529.982.247-25",
      email: " Ana@Example.com ",
      celulares: ["(48) 99999-0000", "  "],
      cidade: "Florianópolis",
      banco: "",
    });
    assert.deepEqual(columns, {
      name: "Ana Souza",
      document: "52998224725",
      email: "ana@example.com",
      phones: ["(48) 99999-0000"],
      details: { cidade: "Florianópolis", banco: "" },
    });
  });

  it("é o inverso de contactRowToProfile para dados já normalizados", () => {
    const row = {
      name: "Bia",
      document: "11222333000181",
      email: "bia@example.com",
      phones: ["(11) 90000-0000"],
      details: { dataNascimento: "1990-05-10", estadoCivil: "casado" },
    };
    assert.deepEqual(profileToContactColumns(contactRowToProfile(row)), row);
  });
});

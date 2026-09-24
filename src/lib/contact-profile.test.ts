import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  contactRowToProfile,
  joinProfileLabels,
  profileToContactColumns,
  requiresUserAccount,
  uniquePeople,
} from "./contact-profile.ts";

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

describe("joinProfileLabels", () => {
  it("usa Gestor de Projetos para o tipo Responsável", () => {
    assert.equal(joinProfileLabels(["Responsável"]), "Gestor de Projetos");
  });

  it("ordena os perfis e junta com vírgula e 'e'", () => {
    assert.equal(joinProfileLabels(["Investidor", "Assessor"]), "Assessor e Investidor");
    assert.equal(
      joinProfileLabels(["Investidor", "Responsável", "Assessor"]),
      "Gestor de Projetos, Assessor e Investidor",
    );
  });

  it("ignora tipos desconhecidos e retorna vazio sem perfis", () => {
    assert.equal(joinProfileLabels(["Leiloeiro"]), "");
    assert.equal(joinProfileLabels([]), "");
  });
});

describe("requiresUserAccount", () => {
  it("exige conta de usuário para investidor, assessor e gestor de projetos", () => {
    assert.equal(requiresUserAccount("Investidor"), true);
    assert.equal(requiresUserAccount("Assessor"), true);
    assert.equal(requiresUserAccount("Responsável"), true);
  });

  it("não exige conta para os demais tipos de contato", () => {
    for (const type of ["Leiloeiro", "Corretor", "Imobiliária", "Fornecedor"])
      assert.equal(requiresUserAccount(type), false);
  });
});

describe("uniquePeople", () => {
  const maria = { id: "1", email: "maria@example.com", tipo: "Assessor" };
  const mariaGestor = { id: "2", email: "Maria@Example.com", tipo: "Responsável" };
  const paulo = { id: "3", email: "paulo@example.com", tipo: "Assessor" };

  it("mostra a pessoa uma única vez mesmo com vários cadastros", () => {
    const result = uniquePeople([maria, mariaGestor, paulo], ["Responsável", "Assessor"]);
    assert.equal(result.length, 2);
  });

  it("prefere o cadastro do tipo de maior prioridade", () => {
    const result = uniquePeople([maria, mariaGestor], ["Responsável", "Assessor"]);
    assert.deepEqual(result, [mariaGestor]);
    const inverse = uniquePeople([mariaGestor, maria], ["Assessor", "Responsável"]);
    assert.deepEqual(inverse, [maria]);
  });

  it("mantém a ordem original e as pessoas com e-mails diferentes", () => {
    const result = uniquePeople([paulo, maria, mariaGestor], ["Responsável", "Assessor"]);
    assert.deepEqual(
      result.map((person) => person.id),
      ["3", "2"],
    );
  });

  it("não altera listas sem repetição", () => {
    assert.deepEqual(uniquePeople([maria, paulo], ["Assessor"]), [maria, paulo]);
    assert.deepEqual(uniquePeople([], ["Assessor"]), []);
  });
});

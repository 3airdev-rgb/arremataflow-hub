import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  administratorContactColumns,
  countableManagerChange,
  planLimitKeyForContactType,
} from "./administrator-contact.ts";
import { assertPlanLimit } from "./plan-limits.ts";

describe("planLimitKeyForContactType", () => {
  it("associa cada perfil ao limite do plano correspondente", () => {
    assert.equal(planLimitKeyForContactType("Investidor"), "maxInvestors");
    assert.equal(planLimitKeyForContactType("Assessor"), "maxAdvisors");
    assert.equal(planLimitKeyForContactType("Responsável"), "maxProjectManagers");
  });

  it("não limita tipos de contato que não são perfis de usuário", () => {
    for (const type of ["Leiloeiro", "Corretor", "Imobiliária", "Fornecedor", ""])
      assert.equal(planLimitKeyForContactType(type), null);
  });
});

describe("administratorContactColumns", () => {
  const registration = {
    name: " Cleo Marcus Garcia ",
    legalDocument: "032.929.669-81",
    email: " 3AirDev@Gmail.com ",
    phone: "+5548984443883",
    address: "Rua Sagrado Coração de Jesus",
    addressNumber: "811",
    addressComplement: "Casa 104",
    district: "Morro das Pedras",
    city: "Florianópolis",
    state: "SC",
    postalCode: "88066070",
  };

  it("inclui nascimento, estado civil e dados bancários quando informados", () => {
    const columns = administratorContactColumns({
      ...registration,
      birthDate: "1988-03-05",
      maritalStatus: "casado",
      bankName: " Itaú ",
      bankAgency: "0001",
      bankAccount: "12345-6",
    });
    assert.deepEqual(columns.details, {
      endereco: "Rua Sagrado Coração de Jesus",
      numero: "811",
      complemento: "Casa 104",
      bairro: "Morro das Pedras",
      cidade: "Florianópolis",
      estado: "SC",
      cep: "88066070",
      dataNascimento: "1988-03-05",
      estadoCivil: "casado",
      banco: "Itaú",
      agencia: "0001",
      conta: "12345-6",
    });
  });

  it("converte o cadastro da empresa nas colunas de um contato", () => {
    assert.deepEqual(administratorContactColumns(registration), {
      name: "Cleo Marcus Garcia",
      document: "03292966981",
      email: "3airdev@gmail.com",
      phones: ["+5548984443883"],
      details: {
        endereco: "Rua Sagrado Coração de Jesus",
        numero: "811",
        complemento: "Casa 104",
        bairro: "Morro das Pedras",
        cidade: "Florianópolis",
        estado: "SC",
        cep: "88066070",
      },
    });
  });

  it("omite telefone e detalhes não informados", () => {
    const columns = administratorContactColumns({
      ...registration,
      phone: "",
      addressComplement: "  ",
      district: "",
    });
    assert.deepEqual(columns.phones, []);
    assert.equal("complemento" in columns.details, false);
    assert.equal("bairro" in columns.details, false);
    assert.equal(columns.details["cidade"], "Florianópolis");
  });
});

describe("countableManagerChange", () => {
  it("não conta o administrador como gestor já existente nem como novo", () => {
    const change = countableManagerChange(["admin"], ["admin", "ana"], ["admin"]);
    assert.deepEqual(change, { existingCount: 0, additions: ["ana"] });
  });

  it("conta somente gestores que não são administradores", () => {
    const change = countableManagerChange(["admin", "ana"], ["admin", "ana", "bia"], ["admin"]);
    assert.deepEqual(change, { existingCount: 1, additions: ["bia"] });
  });

  it("não trata como nova adição quem já é gestor de outro projeto", () => {
    const change = countableManagerChange(["ana"], ["ana"], []);
    assert.deepEqual(change, { existingCount: 1, additions: [] });
  });

  it("ignora repetições nos pedidos", () => {
    assert.deepEqual(countableManagerChange([], ["ana", "ana"], []), {
      existingCount: 0,
      additions: ["ana"],
    });
  });
});

describe("limites do plano sem contar o administrador", () => {
  // Plano Starter: até 2 assessores. Cada cadastro conta uma vez; o administrador não entra na conta.
  const starterAdvisors = 2;

  it("permite o administrador como assessor e ainda dois assessores comuns", () => {
    const regularAdvisors = 0;
    for (let cadastrados = regularAdvisors; cadastrados < starterAdvisors; cadastrados++)
      assert.doesNotThrow(() => assertPlanLimit(starterAdvisors, cadastrados));
  });

  it("bloqueia o terceiro assessor comum, mesmo com o administrador cadastrado à parte", () => {
    const regularAdvisors = 2;
    assert.throws(() => assertPlanLimit(starterAdvisors, regularAdvisors), /Limite do plano/);
  });

  it("plano sem limite nunca bloqueia", () => {
    assert.doesNotThrow(() => assertPlanLimit(null, 1000));
  });
});

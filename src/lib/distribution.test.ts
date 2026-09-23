import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { computeDistribution } from "./distribution.ts";

const base = {
  finalSaleValue: 500_000,
  taxValue: 10_000,
  originCommission: 20_000,
  acquisition: 300_000,
  expenses: 50_000,
  participants: [
    { nome: "Ana", percentual: 60 },
    { nome: "Bia", percentual: 40 },
  ],
  advisors: [{ nome: "Carlos", percentual: 100 }],
};

describe("computeDistribution", () => {
  it("apura o resultado como venda menos tributos, comissão e capital investido", () => {
    const snapshot = computeDistribution(base);
    assert.equal(snapshot.investedCapital, 350_000);
    assert.equal(snapshot.result, 120_000);
    assert.equal(snapshot.finalSaleValue, 500_000);
    assert.equal(snapshot.taxValue, 10_000);
    assert.equal(snapshot.commissionValue, 20_000);
  });

  it("divide o resultado meio a meio entre investidores e assessoria", () => {
    const snapshot = computeDistribution(base);
    assert.equal(snapshot.investorShare, 60_000);
    assert.equal(snapshot.advisoryShare, 60_000);
  });

  it("distribui a parte de cada grupo pelos percentuais dos participantes", () => {
    const snapshot = computeDistribution(base);
    assert.deepEqual(snapshot.investors, [
      { nome: "Ana", percentual: 60, valor: 36_000 },
      { nome: "Bia", percentual: 40, valor: 24_000 },
    ]);
    assert.deepEqual(snapshot.assessors, [{ nome: "Carlos", percentual: 100, valor: 60_000 }]);
  });

  it("ignora participantes sem nome e trata percentual inválido como zero", () => {
    const snapshot = computeDistribution({
      ...base,
      participants: [
        { nome: "", percentual: 50 },
        { nome: "Duda", percentual: "abc" },
        null,
        { nome: "Eva", percentual: "25" },
      ],
    });
    assert.deepEqual(snapshot.investors, [
      { nome: "Duda", percentual: 0, valor: 0 },
      { nome: "Eva", percentual: 25, valor: 15_000 },
    ]);
  });

  it("propaga prejuízo como resultado e partes negativos", () => {
    const snapshot = computeDistribution({ ...base, finalSaleValue: 300_000 });
    assert.equal(snapshot.result, -80_000);
    assert.equal(snapshot.investorShare, -40_000);
    assert.equal(snapshot.investors[0]?.valor, -24_000);
  });

  it("trata tributo ausente como zero", () => {
    assert.equal(computeDistribution({ ...base, taxValue: null }).result, 130_000);
    assert.equal(computeDistribution({ ...base, taxValue: undefined }).taxValue, 0);
  });

  it("retorna listas vazias quando não há participantes", () => {
    const snapshot = computeDistribution({ ...base, participants: [], advisors: [] });
    assert.deepEqual(snapshot.investors, []);
    assert.deepEqual(snapshot.assessors, []);
  });
});

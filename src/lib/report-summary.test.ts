import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { cashFlowSummary } from "./report-summary.ts";

describe("cashFlowSummary", () => {
  it("soma créditos, débitos e calcula o capital investido com a aquisição do projeto", () => {
    const summary = cashFlowSummary(
      [
        { type: "despesa", amount: "2500.25" },
        { type: "despesa", amount: 21350 },
        { type: "receita", amount: "1000" },
      ],
      [{ data: { valor_aquisicao: 650000 } }],
    );
    assert.equal(summary.credits, 1000);
    assert.equal(Math.round(summary.debits * 100), 2385025);
    assert.equal(summary.acquisition, 650000);
    assert.equal(Math.round(summary.capitalInvested * 100), 65_000_000 + 2385025);
  });

  it("soma a aquisição de todos os projetos do relatório", () => {
    const summary = cashFlowSummary(
      [{ type: "despesa", amount: 100 }],
      [{ data: { valor_aquisicao: 650000 } }, { data: { valor_aquisicao: "920000" } }],
    );
    assert.equal(summary.acquisition, 1_570_000);
    assert.equal(summary.capitalInvested, 1_570_100);
  });

  it("trata aquisição ausente ou inválida como zero e ignora receitas no capital", () => {
    const summary = cashFlowSummary(
      [
        { type: "receita", amount: 5000 },
        { type: "despesa", amount: null },
      ],
      [{ data: {} }, { data: { valor_aquisicao: "abc" } }],
    );
    assert.equal(summary.acquisition, 0);
    assert.equal(summary.debits, 0);
    assert.equal(summary.capitalInvested, 0);
  });
});

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  addBillingPeriod,
  computeRevenue,
  daysUntil,
  effectiveSubscriptionStatus,
  isEntitledStatus,
  monthlyEquivalent,
  slugifyPlanName,
} from "./billing.ts";

const now = new Date("2026-09-24T12:00:00Z");
const day = (offset: number) => new Date(now.getTime() + offset * 86_400_000);

describe("effectiveSubscriptionStatus", () => {
  it("mantém o status salvo quando a vigência está válida", () => {
    assert.equal(
      effectiveSubscriptionStatus({ status: "active", endsAt: day(10), trialEndsAt: null }, now),
      "active",
    );
    assert.equal(
      effectiveSubscriptionStatus({ status: "past_due", endsAt: day(-3), trialEndsAt: null }, now),
      "past_due",
    );
  });

  it("marca como vencida a assinatura ativa com vigência encerrada", () => {
    assert.equal(
      effectiveSubscriptionStatus({ status: "active", endsAt: day(-1), trialEndsAt: null }, now),
      "expired",
    );
  });

  it("marca como vencido o teste que já terminou", () => {
    assert.equal(
      effectiveSubscriptionStatus({ status: "trialing", endsAt: null, trialEndsAt: day(-1) }, now),
      "expired",
    );
    assert.equal(
      effectiveSubscriptionStatus({ status: "trialing", endsAt: null, trialEndsAt: day(2) }, now),
      "trialing",
    );
  });

  it("não altera assinaturas canceladas ou pausadas e trata status desconhecido como ativa", () => {
    assert.equal(
      effectiveSubscriptionStatus({ status: "canceled", endsAt: day(-30), trialEndsAt: null }, now),
      "canceled",
    );
    assert.equal(
      effectiveSubscriptionStatus({ status: "paused", endsAt: null, trialEndsAt: null }, now),
      "paused",
    );
    assert.equal(
      effectiveSubscriptionStatus({ status: "qualquer", endsAt: null, trialEndsAt: null }, now),
      "active",
    );
  });
});

describe("isEntitledStatus", () => {
  it("mantém o direito ao plano em teste, ativa e em atraso", () => {
    for (const status of ["trialing", "active", "past_due"])
      assert.equal(isEntitledStatus(status), true);
    for (const status of ["canceled", "expired", "paused"])
      assert.equal(isEntitledStatus(status), false);
  });
});

describe("receita recorrente", () => {
  it("converte o valor anual em equivalente mensal", () => {
    assert.equal(monthlyEquivalent("monthly", 300), 300);
    assert.equal(monthlyEquivalent("annual", 1200), 100);
    assert.equal(monthlyEquivalent(null, 300), 0);
    assert.equal(monthlyEquivalent("monthly", null), 0);
  });

  it("soma ativas e em atraso, separa o valor em risco e o potencial dos testes", () => {
    const revenue = computeRevenue([
      { status: "active", billingCycle: "monthly", amount: 300 },
      { status: "active", billingCycle: "annual", amount: 1200 },
      { status: "past_due", billingCycle: "monthly", amount: 100 },
      { status: "trialing", billingCycle: "monthly", amount: 500 },
      { status: "canceled", billingCycle: "monthly", amount: 999 },
      { status: "expired", billingCycle: "annual", amount: 999 },
    ]);
    assert.equal(revenue.mrr, 500);
    assert.equal(revenue.arr, 6000);
    assert.equal(revenue.atRiskMrr, 100);
    assert.equal(revenue.trialPotentialMrr, 500);
  });
});

describe("addBillingPeriod", () => {
  it("avança um mês ou um ano mantendo o dia", () => {
    assert.equal(
      addBillingPeriod(new Date("2026-03-15T00:00:00Z"), "monthly").toISOString().slice(0, 10),
      "2026-04-15",
    );
    assert.equal(
      addBillingPeriod(new Date("2026-03-15T00:00:00Z"), "annual").toISOString().slice(0, 10),
      "2027-03-15",
    );
  });

  it("ajusta o dia quando o mês seguinte é mais curto", () => {
    assert.equal(
      addBillingPeriod(new Date("2026-01-31T00:00:00Z"), "monthly").toISOString().slice(0, 10),
      "2026-02-28",
    );
    assert.equal(
      addBillingPeriod(new Date("2028-02-29T00:00:00Z"), "annual").toISOString().slice(0, 10),
      "2029-02-28",
    );
  });
});

describe("daysUntil e slugifyPlanName", () => {
  it("conta os dias restantes arredondando para cima", () => {
    assert.equal(daysUntil(day(3), now), 3);
    assert.equal(daysUntil(new Date(now.getTime() + 3_600_000), now), 1);
    assert.equal(daysUntil(day(-2), now), -2);
  });

  it("gera identificadores seguros a partir do nome do plano", () => {
    assert.equal(slugifyPlanName("Plano Ação & Cia. Ltda!"), "plano-acao-cia-ltda");
    assert.equal(slugifyPlanName("   "), "");
  });
});

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { GRACE_DAYS, subscriptionAccess, trialWindow } from "./access.ts";

const day = 86_400_000;
const now = new Date("2026-09-24T12:00:00Z");
const at = (days: number) => new Date(now.getTime() + days * day);

describe("subscriptionAccess", () => {
  it("empresa sem assinatura mantém o acesso", () => {
    assert.equal(subscriptionAccess(null, now).allowed, true);
  });

  it("assinatura ativa dentro da vigência", () => {
    const state = subscriptionAccess({ status: "active", endsAt: at(10), trialEndsAt: null }, now);
    assert.equal(state.allowed, true);
    assert.equal(state.reason, "ok");
    assert.equal(state.daysLeft, 10);
  });

  it("teste usa a data de fim do teste", () => {
    const state = subscriptionAccess(
      { status: "trialing", endsAt: at(30), trialEndsAt: at(5) },
      now,
    );
    assert.equal(state.expiresAt?.getTime(), at(5).getTime());
    assert.equal(state.daysLeft, 5);
  });

  it("vencida há menos de 3 dias ainda tem acesso, em carência", () => {
    const state = subscriptionAccess({ status: "active", endsAt: at(-2), trialEndsAt: null }, now);
    assert.equal(state.allowed, true);
    assert.equal(state.reason, "grace");
  });

  it("bloqueia depois de 3 dias do vencimento", () => {
    const edge = subscriptionAccess(
      { status: "active", endsAt: at(-GRACE_DAYS), trialEndsAt: null },
      now,
    );
    assert.equal(edge.allowed, true);
    const state = subscriptionAccess(
      { status: "active", endsAt: new Date(at(-GRACE_DAYS).getTime() - 1000), trialEndsAt: null },
      now,
    );
    assert.equal(state.allowed, false);
    assert.equal(state.reason, "expired");
  });

  it("teste terminado há mais de 3 dias bloqueia", () => {
    const state = subscriptionAccess(
      { status: "trialing", endsAt: at(-4), trialEndsAt: at(-4) },
      now,
    );
    assert.equal(state.allowed, false);
  });

  it("em atraso segue a mesma regra de carência", () => {
    assert.equal(
      subscriptionAccess({ status: "past_due", endsAt: at(-1), trialEndsAt: null }, now).allowed,
      true,
    );
    assert.equal(
      subscriptionAccess({ status: "past_due", endsAt: at(-5), trialEndsAt: null }, now).allowed,
      false,
    );
  });

  it("cancelada e pausada bloqueiam na hora", () => {
    for (const status of ["canceled", "paused"])
      assert.equal(
        subscriptionAccess({ status, endsAt: at(20), trialEndsAt: null }, now).allowed,
        false,
      );
  });

  it("vencida sem data bloqueia; ativa sem data libera", () => {
    assert.equal(
      subscriptionAccess({ status: "expired", endsAt: null, trialEndsAt: null }, now).allowed,
      false,
    );
    assert.equal(
      subscriptionAccess({ status: "active", endsAt: null, trialEndsAt: null }, now).allowed,
      true,
    );
  });
});

describe("trialWindow", () => {
  it("dura 14 dias", () => {
    const { startsAt, endsAt } = trialWindow(now);
    assert.equal((endsAt.getTime() - startsAt.getTime()) / day, 14);
  });
});

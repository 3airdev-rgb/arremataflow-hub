import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { higherSubscriptionPlans } from "./subscription-plans.ts";

describe("higherSubscriptionPlans", () => {
  it("oferece os planos acima na escada padrão", () => {
    assert.deepEqual(higherSubscriptionPlans("starter"), ["professional", "custom"]);
    assert.deepEqual(higherSubscriptionPlans("professional"), ["custom"]);
    assert.deepEqual(higherSubscriptionPlans("custom"), []);
  });

  it("não oferece upgrade a quem está em plano personalizado de cliente", () => {
    assert.deepEqual(higherSubscriptionPlans("custom-acme-3f9a"), []);
    assert.deepEqual(higherSubscriptionPlans(""), []);
  });
});

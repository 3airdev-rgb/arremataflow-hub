import assert from "node:assert/strict";
import {
  higherSubscriptionPlans,
  subscriptionCycleLabel,
  subscriptionDateLabel,
} from "../src/lib/subscription-plans.ts";

assert.deepEqual(higherSubscriptionPlans("starter"), ["professional", "custom"]);
assert.deepEqual(higherSubscriptionPlans("professional"), ["custom"]);
assert.deepEqual(higherSubscriptionPlans("custom"), []);
assert.equal(subscriptionCycleLabel("monthly"), "Mensal");
assert.equal(subscriptionCycleLabel("annual"), "Anual");
assert.equal(subscriptionCycleLabel(null), "Não informado");
assert.equal(subscriptionDateLabel("2026-09-23T00:00:00.000Z"), "23/09/2026");
assert.equal(subscriptionDateLabel(null), "Não informada");
console.log("Upgrades validados: apenas planos superiores são oferecidos.");

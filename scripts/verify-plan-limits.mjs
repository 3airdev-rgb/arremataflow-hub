import assert from "node:assert/strict";
import { assertPlanFeature, assertPlanLimit } from "../src/lib/plan-limits.ts";

assert.doesNotThrow(() => assertPlanLimit(null, 1000));
assert.doesNotThrow(() => assertPlanLimit(3, 2));
assert.throws(() => assertPlanLimit(0, 0), /Limite do plano atingido/);
assert.throws(() => assertPlanLimit(3, 3), /Limite do plano atingido/);
assert.throws(() => assertPlanLimit(3, 5), /Limite do plano atingido/);
assert.doesNotThrow(() => assertPlanFeature(null, "Projetos"));
assert.doesNotThrow(() => assertPlanFeature(["Projetos"], "Projetos"));
assert.throws(() => assertPlanFeature(["Projetos"], "Relatórios"), /Recurso não disponível/);
process.stdout.write("Limites validados: sem limite, abaixo, zero e uso já acima do plano.\n");

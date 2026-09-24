import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { canonicalTaskValue, mergeTaskPeople, type TaskPersonSource } from "./task-people.ts";

const person = (over: Partial<TaskPersonSource> & { value: string }): TaskPersonSource => ({
  label: "Fulano",
  email: "",
  type: "Assessor",
  participantOnly: false,
  ...over,
});

describe("mergeTaskPeople", () => {
  it("une cadastros com o mesmo e-mail e junta os papéis", () => {
    const result = mergeTaskPeople([
      person({ value: "contact:1", label: "Maria", email: "m@x.com", type: "Investidor" }),
      person({ value: "contact:2", label: "Maria A.", email: "M@x.com", type: "Assessor" }),
    ]);
    assert.equal(result.length, 1);
    assert.equal(result[0]?.type, "Investidor, Assessor");
    assert.deepEqual(result[0]?.aliases, ["contact:2"]);
  });

  it("une pela igualdade de nome ignorando acentos e caixa", () => {
    const result = mergeTaskPeople([
      person({
        value: "user:a",
        label: "Cleo Marcus Garcia",
        email: "a@x.com",
        type: "Administrador",
      }),
      person({
        value: "contact:b",
        label: "cleo  marcus garcía",
        email: "b@x.com",
        type: "Assessor",
      }),
    ]);
    assert.equal(result.length, 1);
    assert.equal(result[0]?.value, "user:a");
    assert.equal(result[0]?.type, "Administrador, Assessor");
  });

  it("não repete o mesmo papel", () => {
    const result = mergeTaskPeople([
      person({ value: "contact:1", label: "Ana", email: "a@x.com" }),
      person({ value: "contact:2", label: "Ana", email: "a@x.com" }),
    ]);
    assert.equal(result[0]?.type, "Assessor");
  });

  it("só é exclusivo de participante se todos os cadastros forem", () => {
    const only = mergeTaskPeople([
      person({ value: "provider:1", label: "Obra Ltda", email: "o@x.com", participantOnly: true }),
    ]);
    assert.equal(only[0]?.participantOnly, true);
    const both = mergeTaskPeople([
      person({ value: "provider:1", label: "Ana", email: "a@x.com", participantOnly: true }),
      person({ value: "contact:2", label: "Ana", email: "a@x.com" }),
    ]);
    assert.equal(both[0]?.participantOnly, false);
  });

  it("mantém pessoas diferentes sem e-mail separadas", () => {
    const result = mergeTaskPeople([
      person({ value: "contact:1", label: "Ana" }),
      person({ value: "contact:2", label: "Bia" }),
    ]);
    assert.equal(result.length, 2);
  });
});

describe("canonicalTaskValue", () => {
  it("converte valores de cadastros duplicados", () => {
    const options = mergeTaskPeople([
      person({ value: "user:a", label: "Ana", email: "a@x.com" }),
      person({ value: "contact:b", label: "Ana", email: "a@x.com" }),
    ]);
    assert.equal(canonicalTaskValue(options, "contact:b"), "user:a");
    assert.equal(canonicalTaskValue(options, "user:a"), "user:a");
    assert.equal(canonicalTaskValue(options, "contact:zzz"), "contact:zzz");
  });
});

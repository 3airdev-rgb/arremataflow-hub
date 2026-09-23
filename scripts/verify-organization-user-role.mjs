import assert from "node:assert/strict";
import { resolveInvitedMembership } from "../src/lib/organization-user-role.ts";

assert.deepEqual(resolveInvitedMembership(undefined, "project_manager", true, true), {
  role: "investor",
  status: "invited",
  invitationNeeded: true,
});
assert.deepEqual(resolveInvitedMembership(undefined, "advisor", true, false), {
  role: "advisor",
  status: "active",
  invitationNeeded: false,
});
assert.deepEqual(
  resolveInvitedMembership({ role: "admin", status: "active" }, "investor", true, false),
  {
    role: "admin",
    status: "active",
    invitationNeeded: false,
  },
);
assert.deepEqual(
  resolveInvitedMembership({ role: "investor", status: "active" }, "advisor", true, false),
  {
    role: "investor",
    status: "active",
    invitationNeeded: false,
  },
);
assert.deepEqual(
  resolveInvitedMembership({ role: "advisor", status: "active" }, "project_manager", false, false),
  {
    role: "project_manager",
    status: "active",
    invitationNeeded: false,
  },
);
console.log("Teste concluído: convite apenas para conta nova e preservação de perfis existentes.");

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { homePathForRole, isAdminRole } from "./role-home.ts";

describe("isAdminRole", () => {
  it("considera administrador apenas dono e admin", () => {
    assert.equal(isAdminRole("owner"), true);
    assert.equal(isAdminRole("admin"), true);
    for (const role of ["project_manager", "advisor", "investor", ""])
      assert.equal(isAdminRole(role), false);
  });
});

describe("homePathForRole", () => {
  it("leva somente o administrador ao dashboard", () => {
    assert.equal(homePathForRole("owner"), "/dashboard");
    assert.equal(homePathForRole("admin"), "/dashboard");
    for (const role of ["project_manager", "advisor", "investor", "desconhecido"])
      assert.notEqual(homePathForRole(role), "/dashboard");
  });

  it("usa a página inicial própria de cada perfil", () => {
    assert.equal(homePathForRole("project_manager"), "/projetos");
    assert.equal(homePathForRole("investor"), "/investidor");
    assert.equal(homePathForRole("advisor"), "/assessores");
  });
});

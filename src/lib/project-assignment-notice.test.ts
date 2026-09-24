import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildProjectAssignmentEmail,
  newlyAddedParticipants,
} from "./project-assignment-notice.ts";

describe("newlyAddedParticipants", () => {
  it("avisa todos os participantes de um projeto novo", () => {
    const added = newlyAddedParticipants(
      [],
      [
        { contactId: "a", role: "investor" },
        { contactId: "b", role: "advisor" },
        { contactId: "c", role: "responsible" },
      ],
    );
    assert.deepEqual(added, [
      { contactId: "a", roles: ["investor"] },
      { contactId: "b", roles: ["advisor"] },
      { contactId: "c", roles: ["responsible"] },
    ]);
  });

  it("não avisa quem já estava no projeto com o mesmo papel", () => {
    const links = [
      { contactId: "a", role: "investor" },
      { contactId: "b", role: "advisor" },
    ];
    assert.deepEqual(newlyAddedParticipants(links, links), []);
  });

  it("avisa somente os recém-adicionados ao editar um projeto", () => {
    const added = newlyAddedParticipants(
      [{ contactId: "a", role: "investor" }],
      [
        { contactId: "a", role: "investor" },
        { contactId: "b", role: "investor" },
      ],
    );
    assert.deepEqual(added, [{ contactId: "b", roles: ["investor"] }]);
  });

  it("avisa quando quem já estava ganha um novo papel no mesmo projeto", () => {
    const added = newlyAddedParticipants(
      [{ contactId: "a", role: "investor" }],
      [
        { contactId: "a", role: "investor" },
        { contactId: "a", role: "advisor" },
      ],
    );
    assert.deepEqual(added, [{ contactId: "a", roles: ["advisor"] }]);
  });

  it("reúne vários papéis novos da mesma pessoa em um único aviso, sem repetir", () => {
    const added = newlyAddedParticipants(
      [],
      [
        { contactId: "a", role: "investor" },
        { contactId: "a", role: "responsible" },
        { contactId: "a", role: "investor" },
      ],
    );
    assert.deepEqual(added, [{ contactId: "a", roles: ["responsible", "investor"] }]);
  });

  it("ignora vínculos de quem não é usuário do sistema", () => {
    const added = newlyAddedParticipants(
      [],
      [
        { contactId: "x", role: "auctioneer" },
        { contactId: "y", role: "broker" },
        { contactId: "z", role: "supplier" },
        { contactId: "w", role: "agency" },
      ],
    );
    assert.deepEqual(added, []);
  });

  it("não avisa quem foi apenas removido do projeto", () => {
    assert.deepEqual(newlyAddedParticipants([{ contactId: "a", role: "investor" }], []), []);
  });
});

describe("buildProjectAssignmentEmail", () => {
  const base = {
    recipientName: "Ana Souza",
    projectCode: "AF-2026-001",
    projectName: "Casa no Jurerê",
    projectUrl: "https://app.example.com/projetos/123",
  };

  it("informa o projeto, o papel e o link de acesso", () => {
    const email = buildProjectAssignmentEmail({ ...base, roles: ["investor"] });
    assert.equal(email.subject, "Você foi adicionado ao projeto AF-2026-001");
    assert.match(email.html, /Olá, Ana Souza\./);
    assert.match(email.html, /AF-2026-001 - Casa no Jurerê/);
    assert.match(email.html, /como <strong>Investidor<\/strong>/);
    assert.match(email.html, /href="https:\/\/app\.example\.com\/projetos\/123"/);
  });

  it("lista vários papéis e usa Gestor de Projetos para o responsável", () => {
    const email = buildProjectAssignmentEmail({ ...base, roles: ["responsible", "investor"] });
    assert.match(email.html, /Gestor de Projetos e Investidor/);
  });

  it("escapa HTML em nomes para evitar injeção no e-mail", () => {
    const email = buildProjectAssignmentEmail({
      ...base,
      recipientName: '<img src=x onerror="alert(1)">',
      projectName: "Casa <b>&</b>",
      roles: ["advisor"],
    });
    assert.doesNotMatch(email.html, /<img/);
    assert.doesNotMatch(email.html, /<b>/);
    assert.match(email.html, /&lt;img src=x onerror=&quot;alert\(1\)&quot;&gt;/);
    assert.match(email.html, /Casa &lt;b&gt;&amp;&lt;\/b&gt;/);
  });
});

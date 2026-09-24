import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildAlerts,
  countByKey,
  dayKeys,
  limitUsage,
  monthKeys,
  sumByMonth,
  ticketSlaState,
  type AlertInput,
} from "./developer-metrics.ts";

const now = new Date("2026-09-24T12:00:00Z");
const day = (offset: number) => new Date(now.getTime() + offset * 86_400_000);
const hours = (offset: number) => new Date(now.getTime() + offset * 3_600_000);

describe("séries por período", () => {
  it("gera os últimos meses em ordem cronológica, atravessando o ano", () => {
    assert.deepEqual(monthKeys(new Date("2026-02-10T00:00:00Z"), 4), [
      "2025-11",
      "2025-12",
      "2026-01",
      "2026-02",
    ]);
  });

  it("gera os últimos dias em ordem cronológica", () => {
    assert.deepEqual(dayKeys(now, 3), ["2026-09-22", "2026-09-23", "2026-09-24"]);
  });

  it("conta ocorrências por mês ignorando datas fora do intervalo e nulas", () => {
    const keys = monthKeys(now, 3);
    const counts = countByKey(
      [
        new Date("2026-09-01T00:00:00Z"),
        new Date("2026-09-30T00:00:00Z"),
        new Date("2026-07-05T00:00:00Z"),
        new Date("2020-01-01T00:00:00Z"),
        null,
      ],
      keys,
      7,
    );
    assert.deepEqual(counts, [1, 0, 2]);
  });

  it("soma valores por mês com arredondamento em centavos", () => {
    const keys = monthKeys(now, 2);
    const sums = sumByMonth(
      [
        { date: new Date("2026-09-02T00:00:00Z"), amount: 10.105 },
        { date: new Date("2026-09-20T00:00:00Z"), amount: 20.1 },
        { date: new Date("2026-08-15T00:00:00Z"), amount: 5 },
        { date: null, amount: 100 },
      ],
      keys,
    );
    assert.deepEqual(sums, [5, 30.21]);
  });
});

describe("limitUsage", () => {
  it("classifica o uso pelo percentual do limite", () => {
    assert.equal(limitUsage(1, 10).level, "ok");
    assert.equal(limitUsage(8, 10).level, "warning");
    assert.equal(limitUsage(10, 10).level, "critical");
    assert.equal(limitUsage(12, 10).percent, 120);
  });

  it("trata ausência de limite e limite zero", () => {
    assert.deepEqual(limitUsage(50, null), {
      used: 50,
      limit: null,
      percent: null,
      level: "unlimited",
    });
    assert.equal(limitUsage(0, 0).level, "ok");
    assert.equal(limitUsage(1, 0).level, "critical");
  });
});

describe("ticketSlaState", () => {
  const base = {
    status: "open",
    createdAt: hours(-10),
    firstRespondedAt: null,
    resolvedAt: null,
    resolutionDueAt: hours(100),
    firstResponseDueAt: hours(10),
  };

  it("está em dia quando há bastante prazo", () => {
    assert.deepEqual(ticketSlaState(base, now), { firstResponse: "ok", resolution: "ok" });
  });

  it("alerta quando resta menos de 25% do prazo", () => {
    const state = ticketSlaState({ ...base, firstResponseDueAt: hours(3) }, now);
    assert.equal(state.firstResponse, "at_risk");
  });

  it("marca vencido quando o prazo passou sem resposta", () => {
    const state = ticketSlaState({ ...base, firstResponseDueAt: hours(-1) }, now);
    assert.equal(state.firstResponse, "breached");
  });

  it("considera cumprido o que já foi respondido ou resolvido", () => {
    const answered = ticketSlaState(
      { ...base, firstResponseDueAt: hours(-1), firstRespondedAt: hours(-5) },
      now,
    );
    assert.equal(answered.firstResponse, "done");
    const resolved = ticketSlaState({ ...base, status: "resolved", resolvedAt: hours(-1) }, now);
    assert.equal(resolved.firstResponse, "done");
    assert.equal(resolved.resolution, "done");
  });
});

describe("buildAlerts", () => {
  const empty: AlertInput = {
    now,
    subscriptions: [],
    usage: [],
    tickets: [],
    storageRatio: 0.1,
    companiesWithoutPlan: [],
  };
  const okSla = { firstResponse: "ok", resolution: "ok" } as const;

  it("não gera alertas quando está tudo em ordem", () => {
    assert.deepEqual(buildAlerts(empty), []);
  });

  it("alerta pagamento em atraso e assinatura vencida como críticos, com destino no financeiro", () => {
    const alerts = buildAlerts({
      ...empty,
      subscriptions: [
        {
          organizationId: "a",
          company: "Alfa",
          status: "past_due",
          endsAt: null,
          trialEndsAt: null,
          cancelAtPeriodEnd: false,
        },
        {
          organizationId: "b",
          company: "Beta",
          status: "expired",
          endsAt: day(-2),
          trialEndsAt: null,
          cancelAtPeriodEnd: false,
        },
      ],
    });
    assert.deepEqual(
      alerts.map((alert) => [alert.severity, alert.tab, alert.organizationId]),
      [
        ["critical", "financeiro", "a"],
        ["critical", "financeiro", "b"],
      ],
    );
  });

  it("avisa sobre teste terminando, renovação próxima e cancelamento agendado", () => {
    const alerts = buildAlerts({
      ...empty,
      subscriptions: [
        {
          organizationId: "t",
          company: "Teste",
          status: "trialing",
          endsAt: null,
          trialEndsAt: day(2),
          cancelAtPeriodEnd: false,
        },
        {
          organizationId: "r",
          company: "Renova",
          status: "active",
          endsAt: day(5),
          trialEndsAt: null,
          cancelAtPeriodEnd: false,
        },
        {
          organizationId: "c",
          company: "Cancela",
          status: "active",
          endsAt: day(1),
          trialEndsAt: null,
          cancelAtPeriodEnd: true,
        },
        {
          organizationId: "l",
          company: "Longe",
          status: "active",
          endsAt: day(40),
          trialEndsAt: null,
          cancelAtPeriodEnd: false,
        },
      ],
    });
    const titles = alerts.map((alert) => alert.title);
    assert.equal(alerts.length, 3);
    assert.ok(titles.some((title) => title.startsWith("Teste termina em 2 dias")));
    assert.ok(titles.some((title) => title.startsWith("Renovação em 5 dias")));
    assert.ok(titles.some((title) => title.startsWith("Cancelamento agendado em 1 dia:")));
  });

  it("sinaliza limites atingidos (upgrade) e próximos, ignorando planos sem limite", () => {
    const alerts = buildAlerts({
      ...empty,
      usage: [
        { organizationId: "a", company: "Alfa", label: "assessores", used: 2, limit: 2 },
        { organizationId: "b", company: "Beta", label: "investidores", used: 9, limit: 10 },
        { organizationId: "c", company: "Gama", label: "projetos", used: 1, limit: 10 },
        { organizationId: "d", company: "Delta", label: "projetos", used: 500, limit: null },
      ],
    });
    assert.deepEqual(
      alerts.map((alert) => [alert.severity, alert.tab]),
      [
        ["warning", "planos"],
        ["info", "planos"],
      ],
    );
  });

  it("prioriza chamados vencidos e urgentes sem resposta e ignora os encerrados", () => {
    const alerts = buildAlerts({
      ...empty,
      tickets: [
        {
          id: "1",
          controlNumber: "AF-1",
          priority: "normal",
          status: "open",
          sla: { firstResponse: "breached", resolution: "ok" },
        },
        { id: "2", controlNumber: "AF-2", priority: "urgent", status: "open", sla: okSla },
        {
          id: "3",
          controlNumber: "AF-3",
          priority: "normal",
          status: "open",
          sla: { firstResponse: "at_risk", resolution: "ok" },
        },
        {
          id: "4",
          controlNumber: "AF-4",
          priority: "urgent",
          status: "resolved",
          sla: { firstResponse: "breached", resolution: "breached" },
        },
      ],
    });
    assert.deepEqual(
      alerts.map((alert) => [alert.id, alert.severity]),
      [
        ["sla-1", "critical"],
        ["urgent-2", "critical"],
        ["risk-3", "warning"],
      ],
    );
  });

  it("alerta armazenamento e empresas sem plano", () => {
    const alerts = buildAlerts({
      ...empty,
      storageRatio: 0.9,
      companiesWithoutPlan: [{ id: "x", name: "Sem Plano Ltda" }],
    });
    assert.deepEqual(
      alerts.map((alert) => [alert.id, alert.severity]),
      [
        ["storage", "critical"],
        ["no-plan-x", "warning"],
      ],
    );
  });

  it("ordena por severidade", () => {
    const alerts = buildAlerts({
      ...empty,
      storageRatio: 0.75,
      subscriptions: [
        {
          organizationId: "a",
          company: "Alfa",
          status: "past_due",
          endsAt: null,
          trialEndsAt: null,
          cancelAtPeriodEnd: false,
        },
      ],
      usage: [{ organizationId: "b", company: "Beta", label: "projetos", used: 9, limit: 10 }],
    });
    assert.deepEqual(
      alerts.map((alert) => alert.severity),
      ["critical", "warning", "info"],
    );
  });
});

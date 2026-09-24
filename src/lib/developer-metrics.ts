import { daysUntil, type SubscriptionStatus } from "./billing.ts";

export function monthKeys(now: Date, count: number): string[] {
  const keys: string[] = [];
  for (let offset = count - 1; offset >= 0; offset -= 1) {
    const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - offset, 1));
    keys.push(date.toISOString().slice(0, 7));
  }
  return keys;
}

export function dayKeys(now: Date, count: number): string[] {
  const keys: string[] = [];
  for (let offset = count - 1; offset >= 0; offset -= 1) {
    const date = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - offset),
    );
    keys.push(date.toISOString().slice(0, 10));
  }
  return keys;
}

export function countByKey(
  dates: Array<Date | null | undefined>,
  keys: string[],
  keyLength: 7 | 10,
): number[] {
  const counts = new Map(keys.map((key) => [key, 0]));
  for (const date of dates) {
    if (!date) continue;
    const key = date.toISOString().slice(0, keyLength);
    if (counts.has(key)) counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return keys.map((key) => counts.get(key) ?? 0);
}

export function sumByMonth(
  entries: Array<{ date: Date | null | undefined; amount: number }>,
  keys: string[],
): number[] {
  const sums = new Map(keys.map((key) => [key, 0]));
  for (const entry of entries) {
    if (!entry.date || !Number.isFinite(entry.amount)) continue;
    const key = entry.date.toISOString().slice(0, 7);
    if (sums.has(key)) sums.set(key, (sums.get(key) ?? 0) + entry.amount);
  }
  return keys.map((key) => Math.round((sums.get(key) ?? 0) * 100) / 100);
}

export type LimitLevel = "unlimited" | "ok" | "warning" | "critical";

export function limitUsage(used: number, limit: number | null) {
  if (limit === null) return { used, limit, percent: null, level: "unlimited" as LimitLevel };
  const percent = limit === 0 ? (used > 0 ? 100 : 0) : Math.round((used / limit) * 100);
  const level: LimitLevel = percent >= 100 ? "critical" : percent >= 80 ? "warning" : "ok";
  return { used, limit, percent, level };
}

export type SlaState = "ok" | "at_risk" | "breached" | "done";

function slaState(dueAt: Date, createdAt: Date, doneAt: Date | null, now: Date): SlaState {
  if (doneAt) return "done";
  if (now > dueAt) return "breached";
  const window = dueAt.getTime() - createdAt.getTime();
  return window > 0 && dueAt.getTime() - now.getTime() < window * 0.25 ? "at_risk" : "ok";
}

export function ticketSlaState(
  ticket: {
    status: string;
    createdAt: Date;
    firstResponseDueAt: Date;
    firstRespondedAt: Date | null;
    resolutionDueAt: Date;
    resolvedAt: Date | null;
  },
  now: Date = new Date(),
) {
  const closed = ["resolved", "closed"].includes(ticket.status);
  return {
    firstResponse: slaState(
      ticket.firstResponseDueAt,
      ticket.createdAt,
      ticket.firstRespondedAt ?? (closed ? (ticket.resolvedAt ?? now) : null),
      now,
    ),
    resolution: slaState(
      ticket.resolutionDueAt,
      ticket.createdAt,
      ticket.resolvedAt ?? (closed ? now : null),
      now,
    ),
  };
}

export type AlertTab = "dashboard" | "planos" | "financeiro" | "helpdesk";
export type DashboardAlert = {
  id: string;
  severity: "critical" | "warning" | "info";
  title: string;
  detail: string;
  tab: AlertTab;
  organizationId?: string;
};

export type AlertInput = {
  now: Date;
  subscriptions: Array<{
    organizationId: string;
    company: string;
    status: SubscriptionStatus;
    endsAt: Date | null;
    trialEndsAt: Date | null;
    cancelAtPeriodEnd: boolean;
  }>;
  usage: Array<{
    organizationId: string;
    company: string;
    label: string;
    used: number;
    limit: number | null;
  }>;
  tickets: Array<{
    id: string;
    controlNumber: string;
    priority: string;
    status: string;
    sla: ReturnType<typeof ticketSlaState>;
  }>;
  storageRatio: number;
  companiesWithoutPlan: Array<{ id: string; name: string }>;
};

const severityOrder = { critical: 0, warning: 1, info: 2 } as const;
const plural = (count: number, one: string, many: string) => (count === 1 ? one : many);

export function buildAlerts(input: AlertInput): DashboardAlert[] {
  const alerts: DashboardAlert[] = [];
  for (const subscription of input.subscriptions) {
    const base = { tab: "financeiro" as const, organizationId: subscription.organizationId };
    if (subscription.status === "past_due")
      alerts.push({
        ...base,
        id: `past-due-${subscription.organizationId}`,
        severity: "critical",
        title: `Pagamento em atraso: ${subscription.company}`,
        detail: "A cobrança falhou e a assinatura está em atraso.",
      });
    if (subscription.status === "expired")
      alerts.push({
        ...base,
        id: `expired-${subscription.organizationId}`,
        severity: "critical",
        title: `Assinatura vencida: ${subscription.company}`,
        detail: "A vigência terminou sem renovação.",
      });
    if (subscription.status === "trialing" && subscription.trialEndsAt) {
      const days = daysUntil(subscription.trialEndsAt, input.now);
      if (days >= 0 && days <= 3)
        alerts.push({
          ...base,
          id: `trial-${subscription.organizationId}`,
          severity: "warning",
          title: `Teste termina em ${days} ${plural(days, "dia", "dias")}: ${subscription.company}`,
          detail: "Converta o teste em assinatura antes do fim do período.",
        });
    }
    if (subscription.status === "active" && subscription.endsAt) {
      const days = daysUntil(subscription.endsAt, input.now);
      if (days >= 0 && days <= 7)
        alerts.push({
          ...base,
          id: `renewal-${subscription.organizationId}`,
          severity: "warning",
          title: subscription.cancelAtPeriodEnd
            ? `Cancelamento agendado em ${days} ${plural(days, "dia", "dias")}: ${subscription.company}`
            : `Renovação em ${days} ${plural(days, "dia", "dias")}: ${subscription.company}`,
          detail: subscription.cancelAtPeriodEnd
            ? "O cliente pediu para não renovar."
            : "Confirme a cobrança da próxima vigência.",
        });
    }
  }
  for (const item of input.usage) {
    if (item.limit === null) continue;
    const usage = limitUsage(item.used, item.limit);
    if (usage.level === "critical")
      alerts.push({
        id: `limit-${item.organizationId}-${item.label}`,
        severity: "warning",
        title: `Limite de ${item.label} atingido: ${item.company}`,
        detail: `${item.used} de ${item.limit}. Oportunidade de upgrade.`,
        tab: "planos",
        organizationId: item.organizationId,
      });
    else if (usage.level === "warning")
      alerts.push({
        id: `limit-${item.organizationId}-${item.label}`,
        severity: "info",
        title: `${item.label} perto do limite: ${item.company}`,
        detail: `${item.used} de ${item.limit} (${usage.percent}%).`,
        tab: "planos",
        organizationId: item.organizationId,
      });
  }
  for (const ticket of input.tickets) {
    if (["resolved", "closed"].includes(ticket.status)) continue;
    const breached =
      ticket.sla.firstResponse === "breached" || ticket.sla.resolution === "breached";
    const atRisk = ticket.sla.firstResponse === "at_risk" || ticket.sla.resolution === "at_risk";
    if (breached)
      alerts.push({
        id: `sla-${ticket.id}`,
        severity: "critical",
        title: `Prazo vencido no chamado ${ticket.controlNumber}`,
        detail: "O prazo de resposta ou de solução foi ultrapassado.",
        tab: "helpdesk",
      });
    else if (ticket.priority === "urgent" && ticket.sla.firstResponse !== "done")
      alerts.push({
        id: `urgent-${ticket.id}`,
        severity: "critical",
        title: `Chamado urgente sem resposta: ${ticket.controlNumber}`,
        detail: "Responda primeiro os chamados urgentes.",
        tab: "helpdesk",
      });
    else if (atRisk)
      alerts.push({
        id: `risk-${ticket.id}`,
        severity: "warning",
        title: `Prazo se esgotando no chamado ${ticket.controlNumber}`,
        detail: "Menos de 25% do prazo restante.",
        tab: "helpdesk",
      });
  }
  if (input.storageRatio >= 0.7)
    alerts.push({
      id: "storage",
      severity: input.storageRatio > 0.85 ? "critical" : "warning",
      title: `Armazenamento em ${Math.round(input.storageRatio * 100)}% da capacidade`,
      detail: "Amplie o disco ou limpe arquivos antes de esgotar.",
      tab: "dashboard",
    });
  for (const company of input.companiesWithoutPlan)
    alerts.push({
      id: `no-plan-${company.id}`,
      severity: "warning",
      title: `Empresa sem plano: ${company.name}`,
      detail: "Atribua um plano para aplicar limites e liberar recursos.",
      tab: "financeiro",
      organizationId: company.id,
    });
  return alerts.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);
}

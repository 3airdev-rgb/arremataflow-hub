export const subscriptionStatuses = [
  "trialing",
  "active",
  "past_due",
  "paused",
  "canceled",
  "expired",
] as const;
export type SubscriptionStatus = (typeof subscriptionStatuses)[number];

export const subscriptionStatusLabels: Record<SubscriptionStatus, string> = {
  trialing: "Em teste",
  active: "Ativa",
  past_due: "Em atraso",
  paused: "Pausada",
  canceled: "Cancelada",
  expired: "Vencida",
};

export const billingCycles = ["monthly", "annual"] as const;
export type BillingCycle = (typeof billingCycles)[number];

export const paymentStatuses = ["paid", "pending", "failed", "refunded"] as const;
export type PaymentStatus = (typeof paymentStatuses)[number];

export const paymentStatusLabels: Record<PaymentStatus, string> = {
  paid: "Pago",
  pending: "Pendente",
  failed: "Falhou",
  refunded: "Estornado",
};

export const paymentMethods = ["card", "pix", "boleto", "transfer", "other"] as const;
export type PaymentMethod = (typeof paymentMethods)[number];

export const paymentMethodLabels: Record<PaymentMethod, string> = {
  card: "Cartão",
  pix: "PIX",
  boleto: "Boleto",
  transfer: "Transferência",
  other: "Outro",
};

// Status com direito ao plano: em atraso continua valendo enquanto a cobrança é tentada.
const entitledStatuses: readonly string[] = ["trialing", "active", "past_due"];
export const entitledSubscriptionStatuses = [...entitledStatuses];
export const isEntitledStatus = (status: string) => entitledStatuses.includes(status);

const isSubscriptionStatus = (status: string): status is SubscriptionStatus =>
  (subscriptionStatuses as readonly string[]).includes(status);

export function effectiveSubscriptionStatus(
  subscription: { status: string; endsAt: Date | null; trialEndsAt: Date | null },
  now: Date = new Date(),
): SubscriptionStatus {
  const status = isSubscriptionStatus(subscription.status) ? subscription.status : "active";
  if (status === "trialing" && subscription.trialEndsAt && subscription.trialEndsAt < now)
    return "expired";
  if (status === "active" && subscription.endsAt && subscription.endsAt < now) return "expired";
  return status;
}

export function monthlyEquivalent(cycle: string | null, amount: number | null): number {
  if (amount === null || !Number.isFinite(amount) || amount < 0) return 0;
  if (cycle === "monthly") return amount;
  if (cycle === "annual") return amount / 12;
  return 0;
}

export type RevenueInput = {
  status: SubscriptionStatus;
  billingCycle: string | null;
  amount: number | null;
};

export function computeRevenue(subscriptions: RevenueInput[]) {
  let mrr = 0;
  let atRiskMrr = 0;
  let trialPotentialMrr = 0;
  for (const subscription of subscriptions) {
    const monthly = monthlyEquivalent(subscription.billingCycle, subscription.amount);
    if (subscription.status === "active") mrr += monthly;
    else if (subscription.status === "past_due") {
      mrr += monthly;
      atRiskMrr += monthly;
    } else if (subscription.status === "trialing") trialPotentialMrr += monthly;
  }
  return { mrr, arr: mrr * 12, atRiskMrr, trialPotentialMrr };
}

export function addBillingPeriod(from: Date, cycle: BillingCycle): Date {
  const months = cycle === "annual" ? 12 : 1;
  const target = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth() + months, 1));
  const lastDay = new Date(
    Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0),
  ).getUTCDate();
  target.setUTCDate(Math.min(from.getUTCDate(), lastDay));
  return target;
}

export function daysUntil(date: Date, now: Date = new Date()): number {
  return Math.ceil((date.getTime() - now.getTime()) / 86_400_000);
}

export function slugifyPlanName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

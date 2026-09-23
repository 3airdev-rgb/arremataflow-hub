export const subscriptionPlanOrder = ["starter", "professional", "custom"] as const;
export type SubscriptionPlanId = (typeof subscriptionPlanOrder)[number];

export function higherSubscriptionPlans(planId: SubscriptionPlanId) {
  return subscriptionPlanOrder.slice(subscriptionPlanOrder.indexOf(planId) + 1);
}

export function subscriptionCycleLabel(cycle: string | null) {
  return cycle === "monthly" ? "Mensal" : cycle === "annual" ? "Anual" : "Não informado";
}

export function subscriptionDateLabel(value: string | null) {
  return value
    ? new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC" }).format(new Date(value))
    : "Não informada";
}

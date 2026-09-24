export const TRIAL_DAYS = 14;
export const GRACE_DAYS = 3;
export const TRIAL_PLAN_ID = "professional";

const dayMs = 86_400_000;

export type AccessReason =
  "ok" | "no_subscription" | "grace" | "expired" | "canceled" | "paused" | "unpaid";

export type AccessState = {
  allowed: boolean;
  reason: AccessReason;
  /** Fim da vigência (ou do teste) que vale para o cálculo. */
  expiresAt: Date | null;
  /** Último instante com acesso, já somada a tolerância. */
  graceEndsAt: Date | null;
  daysLeft: number | null;
};

type SubscriptionForAccess = {
  status: string;
  endsAt: Date | null;
  trialEndsAt: Date | null;
};

/**
 * Empresa sem assinatura registrada mantém o acesso (empresas anteriores à cobrança).
 * Com assinatura: acesso até o vencimento + GRACE_DAYS; cancelada ou pausada bloqueia na hora.
 */
export function subscriptionAccess(
  subscription: SubscriptionForAccess | null,
  now: Date = new Date(),
): AccessState {
  if (!subscription)
    return {
      allowed: true,
      reason: "no_subscription",
      expiresAt: null,
      graceEndsAt: null,
      daysLeft: null,
    };
  const blocked = (reason: AccessReason): AccessState => ({
    allowed: false,
    reason,
    expiresAt: subscription.endsAt,
    graceEndsAt: null,
    daysLeft: null,
  });
  if (subscription.status === "canceled") return blocked("canceled");
  if (subscription.status === "paused") return blocked("paused");
  const expiresAt =
    subscription.status === "trialing"
      ? (subscription.trialEndsAt ?? subscription.endsAt)
      : subscription.endsAt;
  if (!expiresAt) {
    if (subscription.status === "expired") return blocked("expired");
    return { allowed: true, reason: "ok", expiresAt: null, graceEndsAt: null, daysLeft: null };
  }
  const graceEndsAt = new Date(expiresAt.getTime() + GRACE_DAYS * dayMs);
  const daysLeft = Math.ceil((expiresAt.getTime() - now.getTime()) / dayMs);
  if (now <= expiresAt) return { allowed: true, reason: "ok", expiresAt, graceEndsAt, daysLeft };
  if (now <= graceEndsAt)
    return { allowed: true, reason: "grace", expiresAt, graceEndsAt, daysLeft };
  return { allowed: false, reason: "expired", expiresAt, graceEndsAt, daysLeft };
}

export function trialWindow(now: Date = new Date()) {
  return { startsAt: now, endsAt: new Date(now.getTime() + TRIAL_DAYS * dayMs) };
}

export const accessReasonMessages: Record<AccessReason, string> = {
  ok: "",
  no_subscription: "",
  grace: "Sua assinatura venceu. Renove em até 3 dias para não perder o acesso.",
  expired: "O período da assinatura terminou e o prazo de renovação acabou.",
  canceled: "A assinatura foi cancelada.",
  paused: "A assinatura está pausada.",
  unpaid: "Há um pagamento pendente.",
};

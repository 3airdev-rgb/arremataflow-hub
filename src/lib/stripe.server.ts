import { eq, or } from "drizzle-orm";
import { db } from "@/db/index.server";
import type { DbExecutor } from "@/db/types";
import * as schema from "@/db/schema";
import { developer } from "@/lib/developer.server";
import {
  describeStripeEvent,
  verifyStripeSignature,
  type BillingAction,
} from "@/lib/stripe-billing";

export const stripeEventsToEnable = [
  "checkout.session.completed",
  "customer.subscription.created",
  "customer.subscription.updated",
  "customer.subscription.deleted",
  "invoice.paid",
  "invoice.payment_failed",
];

export const appBaseUrl = () =>
  (process.env["APP_PUBLIC_URL"] || process.env["BETTER_AUTH_URL"] || "").replace(/\/$/, "");

export function stripeSetup() {
  const key = process.env["STRIPE_SECRET_KEY"] ?? "";
  const base = appBaseUrl();
  return {
    secretKeyConfigured: Boolean(key),
    webhookSecretConfigured: Boolean(process.env["STRIPE_WEBHOOK_SECRET"]),
    mode: key.startsWith("sk_live_")
      ? ("live" as const)
      : key.startsWith("sk_test_")
        ? ("test" as const)
        : null,
    webhookUrl: base ? `${base}/api/stripe/webhook` : null,
    events: stripeEventsToEnable,
  };
}

async function stripeRequest(path: string, params: URLSearchParams) {
  const key = process.env["STRIPE_SECRET_KEY"];
  if (!key) throw new Error("A chave secreta da Stripe (STRIPE_SECRET_KEY) não está configurada.");
  const response = await fetch(`https://api.stripe.com/v1${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params,
  });
  const body = (await response.json().catch(() => null)) as Record<string, unknown> | null;
  if (!response.ok) {
    const message = (body?.["error"] as { message?: string } | undefined)?.message;
    throw new Error(
      message ? `Stripe: ${message}` : `Falha na comunicação com a Stripe (${response.status}).`,
    );
  }
  return body ?? {};
}

/** Cria a sessão de checkout da Stripe; se ainda há teste com mais de 2 dias, ele é mantido. */
export async function createCheckoutSession(input: {
  organizationId: string;
  planId?: string;
  cycle: "monthly" | "annual";
  successUrl: string;
  cancelUrl: string;
}) {
  const [row] = await db
    .select({
      planId: schema.organizationPlans.planId,
      trialEndsAt: schema.organizationPlans.trialEndsAt,
      status: schema.organizationPlans.status,
      customerId: schema.organizationPlans.stripeCustomerId,
      adminEmail: schema.users.email,
    })
    .from(schema.organizationPlans)
    .innerJoin(
      schema.organizations,
      eq(schema.organizations.id, schema.organizationPlans.organizationId),
    )
    .innerJoin(schema.users, eq(schema.users.id, schema.organizations.createdBy))
    .where(eq(schema.organizationPlans.organizationId, input.organizationId))
    .limit(1);
  if (!row) throw new Error("Atribua um plano à empresa antes de gerar o link de pagamento.");
  const [plan] = await db
    .select({
      monthlyPriceId: schema.plans.stripeMonthlyPriceId,
      annualPriceId: schema.plans.stripeAnnualPriceId,
    })
    .from(schema.plans)
    .where(eq(schema.plans.id, input.planId ?? row.planId))
    .limit(1);
  if (!plan) throw new Error("Plano não encontrado.");
  const priceId = input.cycle === "annual" ? plan.annualPriceId : plan.monthlyPriceId;
  if (!priceId)
    throw new Error(
      "O plano não tem o ID de preço da Stripe para este ciclo. Informe-o na aba Planos.",
    );
  const params = new URLSearchParams({
    mode: "subscription",
    "line_items[0][price]": priceId,
    "line_items[0][quantity]": "1",
    client_reference_id: input.organizationId,
    "metadata[organization_id]": input.organizationId,
    "subscription_data[metadata][organization_id]": input.organizationId,
    success_url: input.successUrl,
    cancel_url: input.cancelUrl,
    locale: "pt-BR",
    allow_promotion_codes: "true",
  });
  if (row.customerId) params.set("customer", row.customerId);
  else params.set("customer_email", row.adminEmail);
  if (
    row.status === "trialing" &&
    row.trialEndsAt &&
    row.trialEndsAt.getTime() - Date.now() > 2 * 86_400_000
  )
    params.set(
      "subscription_data[trial_end]",
      String(Math.floor(row.trialEndsAt.getTime() / 1000)),
    );
  const session = await stripeRequest("/checkout/sessions", params);
  const url = typeof session["url"] === "string" ? session["url"] : null;
  if (!url) throw new Error("A Stripe não retornou o link de pagamento.");
  return { url };
}

export async function createCheckoutLinkImpl(data: {
  organizationId: string;
  cycle: "monthly" | "annual";
}) {
  await developer();
  const base = appBaseUrl();
  if (!base) throw new Error("Endereço público do aplicativo (APP_PUBLIC_URL) não configurado.");
  return createCheckoutSession({
    organizationId: data.organizationId,
    cycle: data.cycle,
    successUrl: `${base}/desenvolvedor?aba=financeiro&checkout=sucesso`,
    cancelUrl: `${base}/desenvolvedor?aba=financeiro&checkout=cancelado`,
  });
}

export async function createOrganizationPortalSession(organizationId: string, returnUrl: string) {
  const [row] = await db
    .select({ customerId: schema.organizationPlans.stripeCustomerId })
    .from(schema.organizationPlans)
    .where(eq(schema.organizationPlans.organizationId, organizationId))
    .limit(1);
  if (!row?.customerId)
    throw new Error(
      "A empresa ainda não tem cliente na Stripe; gere um link de pagamento primeiro.",
    );
  const session = await stripeRequest(
    "/billing_portal/sessions",
    new URLSearchParams({ customer: row.customerId, return_url: returnUrl }),
  );
  const url = typeof session["url"] === "string" ? session["url"] : null;
  if (!url) throw new Error("A Stripe não retornou o link do portal.");
  return { url };
}

export async function createPortalLinkImpl(data: { organizationId: string }) {
  await developer();
  const base = appBaseUrl();
  if (!base) throw new Error("Endereço público do aplicativo (APP_PUBLIC_URL) não configurado.");
  return createOrganizationPortalSession(
    data.organizationId,
    `${base}/desenvolvedor?aba=financeiro`,
  );
}

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function findSubscriptionRow(
  tx: DbExecutor,
  ref: {
    subscriptionId?: string | null;
    customerId?: string | null;
    organizationId?: string | null;
  },
) {
  const conditions = [];
  if (ref.subscriptionId)
    conditions.push(eq(schema.organizationPlans.stripeSubscriptionId, ref.subscriptionId));
  if (ref.organizationId && uuidPattern.test(ref.organizationId))
    conditions.push(eq(schema.organizationPlans.organizationId, ref.organizationId));
  if (ref.customerId)
    conditions.push(eq(schema.organizationPlans.stripeCustomerId, ref.customerId));
  for (const condition of conditions) {
    const [row] = await tx.select().from(schema.organizationPlans).where(condition).limit(1);
    if (row) return row;
  }
  return null;
}

export async function applyBillingAction(tx: DbExecutor, action: BillingAction): Promise<string> {
  if (action.kind === "ignored") return `ignorado:${action.type}`;
  const now = new Date();

  if (action.kind === "checkout_completed") {
    const row = await findSubscriptionRow(tx, action);
    if (!row) return "empresa-nao-encontrada";
    await tx
      .update(schema.organizationPlans)
      .set({
        stripeCustomerId: action.customerId ?? row.stripeCustomerId,
        stripeSubscriptionId: action.subscriptionId ?? row.stripeSubscriptionId,
      })
      .where(eq(schema.organizationPlans.organizationId, row.organizationId));
    return "checkout-vinculado";
  }

  if (action.kind === "subscription") {
    const row = await findSubscriptionRow(tx, action);
    if (!row) return "empresa-nao-encontrada";
    const set: Partial<typeof schema.organizationPlans.$inferInsert> = {
      stripeSubscriptionId: action.subscriptionId,
      cancelAtPeriodEnd: action.cancelAtPeriodEnd,
      trialEndsAt: action.trialEnd,
    };
    if (action.customerId) set.stripeCustomerId = action.customerId;
    if (action.status) {
      set.status = action.status;
      if (action.status !== row.status) set.statusUpdatedAt = now;
    }
    if (action.currentPeriodEnd) set.endsAt = action.currentPeriodEnd;
    if (action.interval) set.billingCycle = action.interval;
    if (action.unitAmount !== null) set.subscriptionAmount = action.unitAmount.toFixed(2);
    if (action.priceId) {
      const [plan] = await tx
        .select({ id: schema.plans.id })
        .from(schema.plans)
        .where(
          or(
            eq(schema.plans.stripeMonthlyPriceId, action.priceId),
            eq(schema.plans.stripeAnnualPriceId, action.priceId),
          ),
        )
        .limit(1);
      if (plan) set.planId = plan.id;
    }
    await tx
      .update(schema.organizationPlans)
      .set(set)
      .where(eq(schema.organizationPlans.organizationId, row.organizationId));
    return `assinatura-${action.status ?? "sem-mudanca"}`;
  }

  const row = await findSubscriptionRow(tx, action);
  if (!row) return "empresa-nao-encontrada";

  if (action.kind === "invoice_paid") {
    if (action.amount > 0)
      await tx
        .insert(schema.billingPayments)
        .values({
          organizationId: row.organizationId,
          planId: row.planId,
          amount: action.amount.toFixed(2),
          currency: action.currency,
          status: "paid",
          method: "card",
          source: "stripe",
          description: "Fatura paga na Stripe",
          stripeInvoiceId: action.invoiceId,
          stripePaymentIntentId: action.paymentIntentId,
          periodStart: action.periodStart,
          periodEnd: action.periodEnd,
          paidAt: action.paidAt ?? now,
        })
        .onConflictDoNothing();
    const set: Partial<typeof schema.organizationPlans.$inferInsert> = {};
    if (row.status !== "canceled") {
      set.status = "active";
      if (row.status !== "active") set.statusUpdatedAt = now;
    }
    if (action.periodEnd && (!row.endsAt || action.periodEnd > row.endsAt))
      set.endsAt = action.periodEnd;
    if (!row.startsAt) set.startsAt = action.periodStart ?? action.paidAt ?? now;
    if (Object.keys(set).length)
      await tx
        .update(schema.organizationPlans)
        .set(set)
        .where(eq(schema.organizationPlans.organizationId, row.organizationId));
    return "fatura-paga";
  }

  await tx
    .insert(schema.billingPayments)
    .values({
      organizationId: row.organizationId,
      planId: row.planId,
      amount: action.amount.toFixed(2),
      currency: action.currency,
      status: "failed",
      method: "card",
      source: "stripe",
      description: `Cobrança recusada na Stripe${action.attemptCount ? ` (tentativa ${action.attemptCount})` : ""}`,
      stripeInvoiceId: action.invoiceId,
    })
    .onConflictDoNothing();
  if (row.status === "active" || row.status === "trialing")
    await tx
      .update(schema.organizationPlans)
      .set({ status: "past_due", statusUpdatedAt: now })
      .where(eq(schema.organizationPlans.organizationId, row.organizationId));
  return "fatura-recusada";
}

export async function handleStripeWebhook(request: Request): Promise<Response> {
  const secret = process.env["STRIPE_WEBHOOK_SECRET"];
  if (!secret) return new Response("Webhook da Stripe não configurado.", { status: 503 });
  if (Number(request.headers.get("content-length") || 0) > 1_000_000)
    return new Response("Conteúdo muito grande.", { status: 413 });
  const payload = await request.text();
  if (!verifyStripeSignature(payload, request.headers.get("stripe-signature"), secret))
    return new Response("Assinatura inválida.", { status: 400 });
  let event: { id?: unknown; type?: unknown; data?: { object?: unknown } };
  try {
    event = JSON.parse(payload);
  } catch {
    return new Response("Conteúdo inválido.", { status: 400 });
  }
  if (typeof event.id !== "string" || typeof event.type !== "string")
    return new Response("Evento inválido.", { status: 400 });
  const eventId = event.id;
  const eventType = event.type;
  try {
    const outcome = await db.transaction(async (tx) => {
      const inserted = await tx
        .insert(schema.stripeEvents)
        .values({ id: eventId, type: eventType, payload: JSON.parse(payload) })
        .onConflictDoNothing()
        .returning({ id: schema.stripeEvents.id });
      if (!inserted.length) return "duplicado";
      return applyBillingAction(
        tx,
        describeStripeEvent(
          event.data ? { type: eventType, data: event.data } : { type: eventType },
        ),
      );
    });
    return Response.json({ received: true, outcome });
  } catch (error) {
    console.error(
      "Falha ao processar evento da Stripe.",
      eventType,
      error instanceof Error ? error.message : error,
    );
    return new Response("Erro ao processar o evento.", { status: 500 });
  }
}

import { createHmac, timingSafeEqual } from "node:crypto";
import type { BillingCycle, SubscriptionStatus } from "./billing.ts";

export function signStripePayload(payload: string, secret: string, timestamp: number): string {
  const signature = createHmac("sha256", secret).update(`${timestamp}.${payload}`).digest("hex");
  return `t=${timestamp},v1=${signature}`;
}

export function verifyStripeSignature(
  payload: string,
  header: string | null,
  secret: string,
  nowSeconds: number = Math.floor(Date.now() / 1000),
  toleranceSeconds = 300,
): boolean {
  if (!header || !secret) return false;
  const parts = header.split(",").map((part) => part.trim().split("="));
  const timestamp = parts.find(([key]) => key === "t")?.[1];
  const signatures = parts
    .filter(([key]) => key === "v1")
    .map(([, value]) => value)
    .filter((value): value is string => Boolean(value));
  if (!timestamp || signatures.length === 0) return false;
  const signedAt = Number(timestamp);
  if (!Number.isInteger(signedAt) || Math.abs(nowSeconds - signedAt) > toleranceSeconds)
    return false;
  const expected = createHmac("sha256", secret).update(`${timestamp}.${payload}`).digest("hex");
  return signatures.some(
    (signature) =>
      signature.length === expected.length &&
      timingSafeEqual(Buffer.from(signature), Buffer.from(expected)),
  );
}

export function mapStripeSubscriptionStatus(status: string): SubscriptionStatus | null {
  switch (status) {
    case "trialing":
      return "trialing";
    case "active":
      return "active";
    case "past_due":
    case "unpaid":
      return "past_due";
    case "paused":
      return "paused";
    case "canceled":
      return "canceled";
    case "incomplete_expired":
      return "expired";
    default:
      return null;
  }
}

export const centsToAmount = (cents: number): number => Math.round(cents) / 100;

type Json = Record<string, unknown>;
const asObject = (value: unknown): Json | null =>
  value && typeof value === "object" && !Array.isArray(value) ? (value as Json) : null;
const asString = (value: unknown): string | null =>
  typeof value === "string" && value ? value : null;
const asNumber = (value: unknown): number | null =>
  typeof value === "number" && Number.isFinite(value) ? value : null;
const fromUnix = (value: unknown): Date | null => {
  const seconds = asNumber(value);
  return seconds === null ? null : new Date(seconds * 1000);
};
const idOf = (value: unknown): string | null =>
  asString(value) ?? asString(asObject(value)?.["id"]);

export type BillingAction =
  | {
      kind: "checkout_completed";
      organizationId: string | null;
      customerId: string | null;
      subscriptionId: string | null;
    }
  | {
      kind: "subscription";
      deleted: boolean;
      organizationId: string | null;
      customerId: string | null;
      subscriptionId: string;
      status: SubscriptionStatus | null;
      currentPeriodEnd: Date | null;
      trialEnd: Date | null;
      cancelAtPeriodEnd: boolean;
      priceId: string | null;
      unitAmount: number | null;
      interval: BillingCycle | null;
    }
  | {
      kind: "invoice_paid";
      invoiceId: string;
      customerId: string | null;
      subscriptionId: string | null;
      amount: number;
      currency: string;
      paidAt: Date | null;
      periodStart: Date | null;
      periodEnd: Date | null;
      paymentIntentId: string | null;
    }
  | {
      kind: "invoice_failed";
      invoiceId: string;
      customerId: string | null;
      subscriptionId: string | null;
      amount: number;
      currency: string;
      attemptCount: number | null;
    }
  | { kind: "ignored"; type: string };

function subscriptionOfInvoice(invoice: Json): string | null {
  return (
    idOf(invoice["subscription"]) ??
    idOf(asObject(asObject(invoice["parent"])?.["subscription_details"])?.["subscription"])
  );
}

export function describeStripeEvent(event: { type: string; data?: { object?: unknown } }) {
  const object = asObject(event.data?.object);
  if (!object) return { kind: "ignored", type: event.type } satisfies BillingAction;

  if (event.type === "checkout.session.completed") {
    const metadata = asObject(object["metadata"]);
    return {
      kind: "checkout_completed",
      organizationId:
        asString(object["client_reference_id"]) ?? asString(metadata?.["organization_id"]),
      customerId: idOf(object["customer"]),
      subscriptionId: idOf(object["subscription"]),
    } satisfies BillingAction;
  }

  if (
    event.type === "customer.subscription.created" ||
    event.type === "customer.subscription.updated" ||
    event.type === "customer.subscription.deleted"
  ) {
    const id = asString(object["id"]);
    if (!id) return { kind: "ignored", type: event.type } satisfies BillingAction;
    const firstItem = asObject(
      Array.isArray(asObject(object["items"])?.["data"])
        ? (asObject(object["items"])?.["data"] as unknown[])[0]
        : null,
    );
    const price = asObject(firstItem?.["price"]);
    const interval = asString(asObject(price?.["recurring"])?.["interval"]);
    const deleted = event.type === "customer.subscription.deleted";
    return {
      kind: "subscription",
      deleted,
      organizationId: asString(asObject(object["metadata"])?.["organization_id"]),
      customerId: idOf(object["customer"]),
      subscriptionId: id,
      status: deleted ? "canceled" : mapStripeSubscriptionStatus(asString(object["status"]) ?? ""),
      currentPeriodEnd: fromUnix(object["current_period_end"] ?? firstItem?.["current_period_end"]),
      trialEnd: fromUnix(object["trial_end"]),
      cancelAtPeriodEnd: object["cancel_at_period_end"] === true,
      priceId: asString(price?.["id"]),
      unitAmount:
        asNumber(price?.["unit_amount"]) === null
          ? null
          : centsToAmount(asNumber(price?.["unit_amount"]) ?? 0),
      interval: interval === "month" ? "monthly" : interval === "year" ? "annual" : null,
    } satisfies BillingAction;
  }

  if (event.type === "invoice.paid" || event.type === "invoice.payment_succeeded") {
    const invoiceId = asString(object["id"]);
    if (!invoiceId) return { kind: "ignored", type: event.type } satisfies BillingAction;
    const lines = asObject(object["lines"]);
    const firstLine = asObject(
      Array.isArray(lines?.["data"]) ? (lines["data"] as unknown[])[0] : null,
    );
    const linePeriod = asObject(firstLine?.["period"]);
    return {
      kind: "invoice_paid",
      invoiceId,
      customerId: idOf(object["customer"]),
      subscriptionId: subscriptionOfInvoice(object),
      amount: centsToAmount(asNumber(object["amount_paid"]) ?? 0),
      currency: asString(object["currency"]) ?? "brl",
      paidAt: fromUnix(asObject(object["status_transitions"])?.["paid_at"]),
      periodStart: fromUnix(linePeriod?.["start"] ?? object["period_start"]),
      periodEnd: fromUnix(linePeriod?.["end"] ?? object["period_end"]),
      paymentIntentId: idOf(object["payment_intent"]),
    } satisfies BillingAction;
  }

  if (event.type === "invoice.payment_failed") {
    const invoiceId = asString(object["id"]);
    if (!invoiceId) return { kind: "ignored", type: event.type } satisfies BillingAction;
    return {
      kind: "invoice_failed",
      invoiceId,
      customerId: idOf(object["customer"]),
      subscriptionId: subscriptionOfInvoice(object),
      amount: centsToAmount(asNumber(object["amount_due"]) ?? 0),
      currency: asString(object["currency"]) ?? "brl",
      attemptCount: asNumber(object["attempt_count"]),
    } satisfies BillingAction;
  }

  return { kind: "ignored", type: event.type } satisfies BillingAction;
}

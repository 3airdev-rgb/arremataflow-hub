import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  centsToAmount,
  describeStripeEvent,
  mapStripeSubscriptionStatus,
  signStripePayload,
  verifyStripeSignature,
} from "./stripe-billing.ts";

const secret = "whsec_teste";
const payload = JSON.stringify({ id: "evt_1", type: "invoice.paid" });
const now = 1_800_000_000;

describe("verifyStripeSignature", () => {
  it("aceita uma assinatura válida e recente", () => {
    const header = signStripePayload(payload, secret, now);
    assert.equal(verifyStripeSignature(payload, header, secret, now), true);
  });

  it("rejeita corpo alterado, segredo errado e cabeçalho ausente ou malformado", () => {
    const header = signStripePayload(payload, secret, now);
    assert.equal(verifyStripeSignature(payload + " ", header, secret, now), false);
    assert.equal(verifyStripeSignature(payload, header, "outro", now), false);
    assert.equal(verifyStripeSignature(payload, null, secret, now), false);
    assert.equal(verifyStripeSignature(payload, "lixo", secret, now), false);
    assert.equal(verifyStripeSignature(payload, `t=${now}`, secret, now), false);
    assert.equal(verifyStripeSignature(payload, header, "", now), false);
  });

  it("rejeita assinaturas fora da tolerância de 5 minutos (repetição de ataque)", () => {
    const header = signStripePayload(payload, secret, now - 600);
    assert.equal(verifyStripeSignature(payload, header, secret, now), false);
    const recent = signStripePayload(payload, secret, now - 200);
    assert.equal(verifyStripeSignature(payload, recent, secret, now), true);
  });

  it("aceita quando qualquer uma das assinaturas v1 for válida", () => {
    const valid = signStripePayload(payload, secret, now).split("v1=")[1];
    const header = `t=${now},v1=${"0".repeat(64)},v1=${valid}`;
    assert.equal(verifyStripeSignature(payload, header, secret, now), true);
  });
});

describe("mapStripeSubscriptionStatus", () => {
  it("traduz os status da Stripe para os do sistema", () => {
    assert.equal(mapStripeSubscriptionStatus("active"), "active");
    assert.equal(mapStripeSubscriptionStatus("trialing"), "trialing");
    assert.equal(mapStripeSubscriptionStatus("past_due"), "past_due");
    assert.equal(mapStripeSubscriptionStatus("unpaid"), "past_due");
    assert.equal(mapStripeSubscriptionStatus("canceled"), "canceled");
    assert.equal(mapStripeSubscriptionStatus("paused"), "paused");
    assert.equal(mapStripeSubscriptionStatus("incomplete_expired"), "expired");
  });

  it("ignora o status incompleto até o primeiro pagamento", () => {
    assert.equal(mapStripeSubscriptionStatus("incomplete"), null);
    assert.equal(mapStripeSubscriptionStatus("desconhecido"), null);
  });
});

describe("describeStripeEvent", () => {
  it("lê o checkout concluído com a empresa vinda de client_reference_id", () => {
    const action = describeStripeEvent({
      type: "checkout.session.completed",
      data: {
        object: { client_reference_id: "org-1", customer: "cus_1", subscription: "sub_1" },
      },
    });
    assert.deepEqual(action, {
      kind: "checkout_completed",
      organizationId: "org-1",
      customerId: "cus_1",
      subscriptionId: "sub_1",
    });
  });

  it("lê a assinatura atualizada com período, preço e cancelamento agendado", () => {
    const action = describeStripeEvent({
      type: "customer.subscription.updated",
      data: {
        object: {
          id: "sub_1",
          customer: "cus_1",
          status: "active",
          cancel_at_period_end: true,
          current_period_end: 1_800_000_000,
          trial_end: null,
          metadata: { organization_id: "org-1" },
          items: {
            data: [
              { price: { id: "price_1", unit_amount: 299000, recurring: { interval: "year" } } },
            ],
          },
        },
      },
    });
    assert.equal(action.kind, "subscription");
    if (action.kind !== "subscription") return;
    assert.equal(action.status, "active");
    assert.equal(action.cancelAtPeriodEnd, true);
    assert.equal(action.priceId, "price_1");
    assert.equal(action.unitAmount, 2990);
    assert.equal(action.interval, "annual");
    assert.equal(action.organizationId, "org-1");
    assert.equal(action.currentPeriodEnd?.getTime(), 1_800_000_000_000);
  });

  it("lê o fim do período no item quando a versão da API o move para lá", () => {
    const action = describeStripeEvent({
      type: "customer.subscription.updated",
      data: {
        object: {
          id: "sub_1",
          status: "active",
          items: { data: [{ current_period_end: 1_800_000_500, price: { id: "p" } }] },
        },
      },
    });
    assert.equal(
      action.kind === "subscription" && action.currentPeriodEnd?.getTime(),
      1_800_000_500_000,
    );
  });

  it("trata a assinatura excluída como cancelada", () => {
    const action = describeStripeEvent({
      type: "customer.subscription.deleted",
      data: { object: { id: "sub_1", customer: "cus_1", status: "canceled" } },
    });
    assert.equal(action.kind === "subscription" && action.deleted, true);
    assert.equal(action.kind === "subscription" && action.status, "canceled");
  });

  it("lê a fatura paga em reais e o período cobrado", () => {
    const action = describeStripeEvent({
      type: "invoice.paid",
      data: {
        object: {
          id: "in_1",
          customer: "cus_1",
          subscription: "sub_1",
          amount_paid: 29900,
          currency: "brl",
          payment_intent: "pi_1",
          status_transitions: { paid_at: 1_800_000_100 },
          lines: { data: [{ period: { start: 1_800_000_000, end: 1_802_592_000 } }] },
        },
      },
    });
    assert.equal(action.kind, "invoice_paid");
    if (action.kind !== "invoice_paid") return;
    assert.equal(action.amount, 299);
    assert.equal(action.subscriptionId, "sub_1");
    assert.equal(action.paymentIntentId, "pi_1");
    assert.equal(action.periodEnd?.getTime(), 1_802_592_000_000);
  });

  it("encontra a assinatura da fatura no formato novo da API", () => {
    const action = describeStripeEvent({
      type: "invoice.payment_succeeded",
      data: {
        object: {
          id: "in_2",
          amount_paid: 1000,
          parent: { subscription_details: { subscription: "sub_9" } },
        },
      },
    });
    assert.equal(action.kind === "invoice_paid" && action.subscriptionId, "sub_9");
  });

  it("lê a fatura que falhou com o número da tentativa", () => {
    const action = describeStripeEvent({
      type: "invoice.payment_failed",
      data: {
        object: {
          id: "in_3",
          customer: "cus_1",
          subscription: "sub_1",
          amount_due: 5000,
          attempt_count: 2,
        },
      },
    });
    assert.deepEqual(action, {
      kind: "invoice_failed",
      invoiceId: "in_3",
      customerId: "cus_1",
      subscriptionId: "sub_1",
      amount: 50,
      currency: "brl",
      attemptCount: 2,
    });
  });

  it("ignora eventos desconhecidos e objetos inválidos", () => {
    assert.deepEqual(
      describeStripeEvent({ type: "charge.refunded", data: { object: { id: "ch_1" } } }),
      {
        kind: "ignored",
        type: "charge.refunded",
      },
    );
    assert.deepEqual(describeStripeEvent({ type: "invoice.paid" }), {
      kind: "ignored",
      type: "invoice.paid",
    });
    assert.deepEqual(
      describeStripeEvent({ type: "invoice.paid", data: { object: { amount_paid: 1 } } }),
      {
        kind: "ignored",
        type: "invoice.paid",
      },
    );
  });
});

describe("centsToAmount", () => {
  it("converte centavos em reais sem erros de ponto flutuante", () => {
    assert.equal(centsToAmount(29900), 299);
    assert.equal(centsToAmount(1999), 19.99);
    assert.equal(centsToAmount(0), 0);
  });
});

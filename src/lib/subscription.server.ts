import { getRequestHeaders } from "@tanstack/react-start/server";
import { and, eq, notInArray } from "drizzle-orm";
import { db } from "@/db/index.server";
import * as schema from "@/db/schema";
import { auth } from "@/lib/auth.server";
import { resolveActiveMembership } from "@/lib/active-organization.server";
import { createSupportTicketImpl } from "@/lib/support.server";
import { higherSubscriptionPlans, type SubscriptionPlanId } from "@/lib/subscription-plans";

async function adminContext() {
  const session = await auth.api.getSession({ headers: getRequestHeaders() });
  if (!session) throw new Error("Não autenticado.");
  const membership = await resolveActiveMembership(db, schema, session.user.id);
  if (!membership || !["owner", "admin"].includes(membership.role))
    throw new Error("Somente administradores podem gerenciar a assinatura.");
  return membership;
}

async function subscriptionForOrganization(organizationId: string) {
  const [row] = await db
    .select({
      planId: schema.organizationPlans.planId,
      planName: schema.plans.name,
      status: schema.organizationPlans.status,
      billingCycle: schema.organizationPlans.billingCycle,
      startsAt: schema.organizationPlans.startsAt,
      endsAt: schema.organizationPlans.endsAt,
    })
    .from(schema.organizationPlans)
    .innerJoin(schema.plans, eq(schema.plans.id, schema.organizationPlans.planId))
    .where(eq(schema.organizationPlans.organizationId, organizationId))
    .limit(1);
  return row;
}

export async function getCompanySubscriptionImpl() {
  const membership = await adminContext();
  const row = await subscriptionForOrganization(membership.organizationId);
  if (!row) return null;
  return {
    ...row,
    startsAt: row.startsAt?.toISOString() ?? null,
    endsAt: row.endsAt?.toISOString() ?? null,
  };
}

export async function requestSubscriptionUpgradeImpl(data: { targetPlanId: SubscriptionPlanId }) {
  const membership = await adminContext();
  const current = await subscriptionForOrganization(membership.organizationId);
  if (!current || current.status !== "active") throw new Error("Assinatura ativa não encontrada.");
  if (!higherSubscriptionPlans(current.planId as SubscriptionPlanId).includes(data.targetPlanId))
    throw new Error("Selecione um plano superior ao atual.");
  const [target] = await db
    .select({ name: schema.plans.name })
    .from(schema.plans)
    .where(eq(schema.plans.id, data.targetPlanId))
    .limit(1);
  if (!target) throw new Error("Plano não encontrado.");
  const subject = `Solicitação de upgrade para ${target.name}`;
  const [pending] = await db
    .select({ id: schema.supportTickets.id })
    .from(schema.supportTickets)
    .where(
      and(
        eq(schema.supportTickets.organizationId, membership.organizationId),
        eq(schema.supportTickets.subject, subject),
        notInArray(schema.supportTickets.status, ["resolved", "closed"]),
      ),
    )
    .limit(1);
  if (pending)
    throw new Error("Já existe uma solicitação de upgrade em andamento para este plano.");
  const ticket = await createSupportTicketImpl({
    subject,
    category: "Dúvidas Operacionais",
    description: `Solicito a alteração do plano ${current.planName} para ${target.name}. A mudança depende de análise e confirmação do Desenvolvedor; esta solicitação não ativa o plano nem realiza cobrança.`,
    priority: "normal",
  });
  return { ticketId: ticket.id, controlNumber: ticket.controlNumber };
}

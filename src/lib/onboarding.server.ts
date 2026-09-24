import { randomBytes } from "node:crypto";
import { getRequestHeaders } from "@tanstack/react-start/server";
import { and, asc, eq } from "drizzle-orm";
import { db } from "@/db/index.server";
import * as schema from "@/db/schema";
import { subscriptionAccess, trialWindow, TRIAL_PLAN_ID } from "@/lib/access";
import { resolveActiveMembership } from "@/lib/active-organization.server";
import { auth } from "@/lib/auth.server";
import { slugifyPlanName } from "@/lib/billing";
import { organizationSubscription } from "@/lib/developer.server";
import {
  appBaseUrl,
  createCheckoutSession,
  createOrganizationPortalSession,
} from "@/lib/stripe.server";
import { formatDocument, validateDocument } from "@/lib/utils-validation";

async function sessionUser() {
  const session = await auth.api.getSession({ headers: getRequestHeaders() });
  if (!session) throw new Error("Não autenticado.");
  return session.user;
}

export type AccessGate =
  | { kind: "developer" }
  | { kind: "no_organization" }
  | { kind: "no_access" }
  | {
      kind: "ok" | "blocked";
      canManage: boolean;
      reason: string;
      status: string | null;
      inGrace: boolean;
      daysLeft: number | null;
      expiresAt: string | null;
      graceEndsAt: string | null;
    };

/** Situação de acesso do usuário logado: define para onde ele deve ser levado. */
export async function getAccessGateImpl(): Promise<AccessGate> {
  const user = await sessionUser();
  const [row] = await db
    .select({ systemRole: schema.users.systemRole })
    .from(schema.users)
    .where(eq(schema.users.id, user.id))
    .limit(1);
  if (row?.systemRole === "developer") return { kind: "developer" };
  const membership = await resolveActiveMembership(db, schema, user.id);
  if (!membership) {
    const [anyMembership] = await db
      .select({ id: schema.organizationMembers.id })
      .from(schema.organizationMembers)
      .where(eq(schema.organizationMembers.userId, user.id))
      .limit(1);
    return { kind: anyMembership ? "no_access" : "no_organization" };
  }
  const found = await organizationSubscription(membership.organizationId);
  const state = subscriptionAccess(found?.subscription ?? null);
  return {
    kind: state.allowed ? "ok" : "blocked",
    canManage: ["owner", "admin"].includes(membership.role),
    reason: state.reason,
    status: found?.subscription.status ?? null,
    inGrace: state.reason === "grace",
    daysLeft: state.daysLeft,
    expiresAt: state.expiresAt?.toISOString() ?? null,
    graceEndsAt: state.graceEndsAt?.toISOString() ?? null,
  };
}

export async function createCompanyImpl(data: { name: string; legalDocument: string }) {
  const user = await sessionUser();
  const digits = data.legalDocument.replace(/\D/g, "");
  if (digits && !validateDocument(digits)) throw new Error("Informe um CPF ou CNPJ válido.");
  const [existing] = await db
    .select({ id: schema.organizationMembers.id })
    .from(schema.organizationMembers)
    .where(eq(schema.organizationMembers.userId, user.id))
    .limit(1);
  if (existing) throw new Error("Sua conta já está vinculada a uma empresa.");
  const [profile] = await db
    .select({ systemRole: schema.users.systemRole })
    .from(schema.users)
    .where(eq(schema.users.id, user.id))
    .limit(1);
  if (profile?.systemRole) throw new Error("Esta conta não pode criar uma empresa.");

  const { startsAt, endsAt } = trialWindow();
  const slug = `${slugifyPlanName(data.name) || "empresa"}-${randomBytes(3).toString("hex")}`;
  const organizationId = await db.transaction(async (tx) => {
    const [organization] = await tx
      .insert(schema.organizations)
      .values({
        name: data.name,
        slug,
        legalDocument: digits ? formatDocument(digits) : null,
        institutionalEmail: user.email,
        createdBy: user.id,
      })
      .returning({ id: schema.organizations.id });
    if (!organization) throw new Error("Não foi possível criar a empresa.");
    await tx.insert(schema.organizationMembers).values({
      organizationId: organization.id,
      userId: user.id,
      role: "owner",
      status: "active",
    });
    await tx.insert(schema.organizationPlans).values({
      organizationId: organization.id,
      planId: TRIAL_PLAN_ID,
      status: "trialing",
      startsAt,
      endsAt,
      trialEndsAt: endsAt,
    });
    await tx
      .update(schema.users)
      .set({ activeOrganizationId: organization.id, updatedAt: new Date() })
      .where(eq(schema.users.id, user.id));
    return organization.id;
  });
  return { organizationId, trialEndsAt: endsAt.toISOString() };
}

export async function getPlansCatalogImpl() {
  const user = await sessionUser();
  const membership = await resolveActiveMembership(db, schema, user.id);
  const plans = await db
    .select()
    .from(schema.plans)
    .where(and(eq(schema.plans.kind, "standard"), eq(schema.plans.active, true)))
    .orderBy(asc(schema.plans.monthlyPrice));
  const found = membership ? await organizationSubscription(membership.organizationId) : null;
  const state = subscriptionAccess(found?.subscription ?? null);
  return {
    canManage: Boolean(membership && ["owner", "admin"].includes(membership.role)),
    hasOrganization: Boolean(membership),
    current: found
      ? {
          planId: found.plan.id,
          planName: found.plan.name,
          status: found.subscription.status,
          reason: state.reason,
          allowed: state.allowed,
          expiresAt: state.expiresAt?.toISOString() ?? null,
          graceEndsAt: state.graceEndsAt?.toISOString() ?? null,
          daysLeft: state.daysLeft,
          hasStripeCustomer: Boolean(found.subscription.stripeCustomerId),
          cancelAtPeriodEnd: found.subscription.cancelAtPeriodEnd,
        }
      : null,
    plans: plans.map((plan) => ({
      id: plan.id,
      name: plan.name,
      description: plan.description,
      monthlyPrice: plan.monthlyPrice === null ? null : Number(plan.monthlyPrice),
      annualPrice: plan.annualPrice === null ? null : Number(plan.annualPrice),
      maxActiveProjects: plan.maxActiveProjects,
      maxInvestors: plan.maxInvestors,
      maxAdvisors: plan.maxAdvisors,
      maxProjectManagers: plan.maxProjectManagers,
      menuItems: plan.menuItems,
      projectTabs: plan.projectTabs,
      advisoryModalities: plan.advisoryModalities,
      cycles: {
        monthly: Boolean(plan.stripeMonthlyPriceId),
        annual: Boolean(plan.stripeAnnualPriceId),
      },
    })),
  };
}

async function managerMembership() {
  const user = await sessionUser();
  const membership = await resolveActiveMembership(db, schema, user.id);
  if (!membership || !["owner", "admin"].includes(membership.role))
    throw new Error("Somente o administrador da empresa pode contratar ou alterar o plano.");
  return membership;
}

export async function startCheckoutImpl(data: { planId: string; cycle: "monthly" | "annual" }) {
  const membership = await managerMembership();
  if (!process.env["STRIPE_SECRET_KEY"])
    throw new Error("O pagamento online ainda não está disponível. Fale com o suporte.");
  const [plan] = await db
    .select({ id: schema.plans.id })
    .from(schema.plans)
    .where(
      and(
        eq(schema.plans.id, data.planId),
        eq(schema.plans.kind, "standard"),
        eq(schema.plans.active, true),
      ),
    )
    .limit(1);
  if (!plan) throw new Error("Plano não disponível para contratação.");
  const base = appBaseUrl();
  if (!base) throw new Error("O endereço público do aplicativo não está configurado.");
  return createCheckoutSession({
    organizationId: membership.organizationId,
    planId: plan.id,
    cycle: data.cycle,
    successUrl: `${base}/planos?checkout=sucesso`,
    cancelUrl: `${base}/planos?checkout=cancelado`,
  });
}

export async function openBillingPortalImpl() {
  const membership = await managerMembership();
  if (!process.env["STRIPE_SECRET_KEY"])
    throw new Error("O pagamento online ainda não está disponível. Fale com o suporte.");
  const base = appBaseUrl();
  if (!base) throw new Error("O endereço público do aplicativo não está configurado.");
  return createOrganizationPortalSession(membership.organizationId, `${base}/planos`);
}

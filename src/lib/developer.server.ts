import { getRequestHeaders } from "@tanstack/react-start/server";
import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/index.server";
import * as schema from "@/db/schema";
import { auth } from "@/lib/auth.server";
import { resolveActiveMembership } from "@/lib/active-organization.server";
import { assertPlanFeature, assertPlanLimit } from "@/lib/plan-limits";

async function currentUser() {
  const session = await auth.api.getSession({ headers: getRequestHeaders() });
  if (!session) throw new Error("Não autenticado.");
  const [user] = await db
    .select({ id: schema.users.id, systemRole: schema.users.systemRole })
    .from(schema.users)
    .where(eq(schema.users.id, session.user.id))
    .limit(1);
  if (!user) throw new Error("Usuário não encontrado.");
  return user;
}

async function developer() {
  const user = await currentUser();
  if (user.systemRole !== "developer") throw new Error("Acesso exclusivo do Desenvolvedor.");
  return user;
}

export async function getSystemRoleImpl() {
  const user = await currentUser();
  return user.systemRole;
}

export async function getDeveloperDashboardImpl() {
  await developer();
  const [planRows, companies, projects, documentStorage, imageStorage, attachmentStorage, tickets] =
    await Promise.all([
      db.select().from(schema.plans),
      db
        .select({
          id: schema.organizations.id,
          name: schema.organizations.name,
          planId: schema.organizationPlans.planId,
          status: schema.organizationPlans.status,
          organizationStatus: schema.organizations.status,
          billingCycle: schema.organizationPlans.billingCycle,
          subscriptionAmount: schema.organizationPlans.subscriptionAmount,
          startsAt: schema.organizationPlans.startsAt,
          endsAt: schema.organizationPlans.endsAt,
        })
        .from(schema.organizations)
        .leftJoin(
          schema.organizationPlans,
          eq(schema.organizations.id, schema.organizationPlans.organizationId),
        ),
      db
        .select({ status: schema.projects.status, data: schema.projects.data })
        .from(schema.projects),
      db
        .select({ value: sql<string>`coalesce(sum(${schema.documents.sizeBytes}), 0)` })
        .from(schema.documents),
      db
        .select({ value: sql<string>`coalesce(sum(${schema.projectImages.sizeBytes}), 0)` })
        .from(schema.projectImages),
      db
        .select({ value: sql<string>`coalesce(sum(${schema.supportAttachments.sizeBytes}), 0)` })
        .from(schema.supportAttachments),
      db
        .select({
          status: schema.supportTickets.status,
          priority: schema.supportTickets.priority,
          createdAt: schema.supportTickets.createdAt,
          firstRespondedAt: schema.supportTickets.firstRespondedAt,
          resolvedAt: schema.supportTickets.resolvedAt,
        })
        .from(schema.supportTickets),
    ]);
  const activeCompanies = companies.filter(
    (company) => company.status === "active" && company.organizationStatus === "active",
  );
  const subscriptions = activeCompanies.filter(
    (company) =>
      company.subscriptionAmount !== null &&
      (company.billingCycle === "monthly" || company.billingCycle === "annual"),
  );
  const monthlyRevenue = subscriptions
    .filter((company) => company.billingCycle === "monthly")
    .reduce((sum, company) => sum + Number(company.subscriptionAmount), 0);
  const annualRevenue = subscriptions
    .filter((company) => company.billingCycle === "annual")
    .reduce((sum, company) => sum + Number(company.subscriptionAmount), 0);
  const averageMinutes = (field: "firstRespondedAt" | "resolvedAt") => {
    const values = tickets
      .filter((ticket) => ticket[field])
      .map((ticket) => (ticket[field]!.getTime() - ticket.createdAt.getTime()) / 60000);
    return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
  };
  const capacityGb = Number(process.env["MEDIA_CAPACITY_GB"] || 100);
  const storageCapacityBytes =
    (Number.isFinite(capacityGb) && capacityGb > 0 ? capacityGb : 100) * 1024 ** 3;
  const storageByCategory = {
    documents: Number(documentStorage[0]?.value ?? 0),
    photos: Number(imageStorage[0]?.value ?? 0),
    support: Number(attachmentStorage[0]?.value ?? 0),
  };
  const storageBytes = Object.values(storageByCategory).reduce((sum, value) => sum + value, 0);
  const investedCapital = projects.reduce((sum, project) => {
    const data = project.data as Record<string, unknown>;
    const value = Number(data["capital_investido"] ?? data["capitalInvestido"] ?? 0);
    return sum + (Number.isFinite(value) ? value : 0);
  }, 0);
  return {
    plans: planRows,
    companies,
    projectCount: projects.length,
    projectsInProgress: projects.filter((project) => project.status === "andamento").length,
    investedCapital,
    storageBytes,
    storageCapacityBytes,
    storageByCategory,
    ticketCount: tickets.length,
    pendingTickets: tickets.filter((ticket) => !["resolved", "closed"].includes(ticket.status))
      .length,
    urgentTickets: tickets.filter(
      (ticket) => ticket.priority === "urgent" && !["resolved", "closed"].includes(ticket.status),
    ).length,
    averageFirstResponseMinutes: averageMinutes("firstRespondedAt"),
    averageResolutionMinutes: averageMinutes("resolvedAt"),
    activeByPlan: planRows.map((plan) => ({
      id: plan.id,
      name: plan.name,
      count: activeCompanies.filter((company) => company.planId === plan.id).length,
      percent: activeCompanies.length
        ? (100 * activeCompanies.filter((company) => company.planId === plan.id).length) /
          activeCompanies.length
        : 0,
    })),
    recurringRevenue: monthlyRevenue + annualRevenue / 12,
    projectedAnnualRevenue: (monthlyRevenue + annualRevenue / 12) * 12,
    billingCycles: {
      monthly: subscriptions.filter((company) => company.billingCycle === "monthly").length,
      annual: subscriptions.filter((company) => company.billingCycle === "annual").length,
    },
    billingConfigured: subscriptions.length > 0,
  };
}

const planInput = z.object({
  id: z.enum(["starter", "professional", "custom"]),
  monthlyPrice: z.number().finite().min(0).nullable(),
  annualPrice: z.number().finite().min(0).nullable(),
  maxActiveProjects: z.number().int().min(0).nullable(),
  maxInvestors: z.number().int().min(0).nullable(),
  maxAdvisors: z.number().int().min(0).nullable(),
  maxProjectManagers: z.number().int().min(0).nullable(),
  firstResponseHours: z.number().int().min(1).max(720),
  resolutionHours: z.number().int().min(1).max(2160),
  menuItems: z.array(z.string().min(1)).max(30),
  advisoryModalities: z.array(z.string().min(1)).max(20),
  projectTabs: z.array(z.string().min(1)).max(30),
});

export async function updatePlanImpl(data: z.infer<typeof planInput>) {
  const actor = await developer();
  const [before] = await db.select().from(schema.plans).where(eq(schema.plans.id, data.id));
  if (!before) throw new Error("Plano não encontrado.");
  await db.transaction(async (tx) => {
    await tx
      .update(schema.plans)
      .set({
        ...data,
        monthlyPrice: data.monthlyPrice === null ? null : data.monthlyPrice.toFixed(2),
        annualPrice: data.annualPrice === null ? null : data.annualPrice.toFixed(2),
        updatedAt: new Date(),
      })
      .where(eq(schema.plans.id, data.id));
    await tx.insert(schema.developerAuditLogs).values({
      actorId: actor.id,
      action: "plan.updated",
      targetId: data.id,
      before,
      after: data,
    });
  });
  return { ok: true };
}

export async function assignOrganizationPlanImpl(data: {
  organizationId: string;
  planId: "starter" | "professional" | "custom";
  billingCycle?: "monthly" | "annual" | null | undefined;
  subscriptionAmount?: number | null | undefined;
  startsAt?: string | null | undefined;
  endsAt?: string | null | undefined;
}) {
  const actor = await developer();
  const startsAt = data.startsAt ? new Date(`${data.startsAt}T00:00:00.000Z`) : null;
  const endsAt = data.endsAt ? new Date(`${data.endsAt}T00:00:00.000Z`) : null;
  if (
    (startsAt &&
      (Number.isNaN(startsAt.getTime()) ||
        startsAt.toISOString().slice(0, 10) !== data.startsAt)) ||
    (endsAt &&
      (Number.isNaN(endsAt.getTime()) || endsAt.toISOString().slice(0, 10) !== data.endsAt))
  )
    throw new Error("Informe datas válidas para a vigência.");
  if (startsAt && endsAt && endsAt < startsAt)
    throw new Error("O término da vigência deve ser posterior ao início.");
  const [before] = await db
    .select()
    .from(schema.organizationPlans)
    .where(eq(schema.organizationPlans.organizationId, data.organizationId));
  await db.transaction(async (tx) => {
    await tx
      .insert(schema.organizationPlans)
      .values({
        organizationId: data.organizationId,
        planId: data.planId,
        billingCycle: data.billingCycle ?? null,
        startsAt,
        endsAt,
        subscriptionAmount:
          data.subscriptionAmount == null ? null : data.subscriptionAmount.toFixed(2),
      })
      .onConflictDoUpdate({
        target: schema.organizationPlans.organizationId,
        set: {
          planId: data.planId,
          billingCycle: data.billingCycle ?? null,
          startsAt,
          endsAt,
          subscriptionAmount:
            data.subscriptionAmount == null ? null : data.subscriptionAmount.toFixed(2),
          status: "active",
          assignedAt: new Date(),
        },
      });
    await tx.insert(schema.developerAuditLogs).values({
      actorId: actor.id,
      action: "organization.plan_assigned",
      targetId: data.organizationId,
      before: before ?? null,
      after: data,
    });
  });
  return { ok: true };
}

export async function activePlanForOrganization(organizationId: string) {
  const [plan] = await db
    .select({ plan: schema.plans })
    .from(schema.organizationPlans)
    .innerJoin(schema.plans, eq(schema.plans.id, schema.organizationPlans.planId))
    .where(
      and(
        eq(schema.organizationPlans.organizationId, organizationId),
        eq(schema.organizationPlans.status, "active"),
      ),
    )
    .limit(1);
  return plan?.plan ?? null;
}

export async function getActivePlanImpl() {
  const user = await currentUser();
  const membership = await resolveActiveMembership(db, schema, user.id);
  if (!membership) throw new Error("Empresa ativa não encontrada.");
  return activePlanForOrganization(membership.organizationId);
}

export async function enforcePlanLimit(
  organizationId: string,
  key: "maxActiveProjects" | "maxInvestors" | "maxAdvisors" | "maxProjectManagers",
  currentCount: number,
) {
  const plan = await activePlanForOrganization(organizationId);
  const limit = plan?.[key];
  assertPlanLimit(limit ?? null, currentCount);
}

export async function enforcePlanFeature(
  organizationId: string,
  kind: "menuItems" | "projectTabs" | "advisoryModalities",
  feature: string,
) {
  const plan = await activePlanForOrganization(organizationId);
  assertPlanFeature(plan?.[kind] ?? null, feature);
}

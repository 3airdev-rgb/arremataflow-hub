import { randomBytes } from "node:crypto";
import { and, asc, count, desc, eq, gte, inArray, sql } from "drizzle-orm";
import { db } from "@/db/index.server";
import * as schema from "@/db/schema";
import {
  addBillingPeriod,
  computeRevenue,
  daysUntil,
  effectiveSubscriptionStatus,
  slugifyPlanName,
  subscriptionStatuses,
  subscriptionStatusLabels,
  type SubscriptionStatus,
} from "@/lib/billing";
import { developer } from "@/lib/developer.server";
import type { PaymentInput, PlanFields, SubscriptionInput } from "@/lib/developer-schemas";
import {
  buildAlerts,
  countByKey,
  dayKeys,
  limitUsage,
  monthKeys,
  sumByMonth,
  ticketSlaState,
} from "@/lib/developer-metrics";
import { stripeSetup } from "@/lib/stripe.server";

const DAY = 86_400_000;
const builtInPlanIds = ["starter", "professional", "custom"];
const iso = (date: Date | null | undefined) => date?.toISOString() ?? null;
const number = (value: string | number | null | undefined) =>
  value === null || value === undefined ? null : Number(value);
const openTicket = (status: string) => !["resolved", "closed"].includes(status);

function average(values: number[]) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
}

function parseDateOnly(value: string | null, label: string): Date | null {
  if (!value) return null;
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value)
    throw new Error(`Informe uma data válida para ${label}.`);
  return date;
}

export async function getOverviewImpl(input: { rangeDays: 7 | 30 | 90 }) {
  await developer();
  const now = new Date();
  const rangeStart = new Date(now.getTime() - input.rangeDays * DAY);
  const previousStart = new Date(rangeStart.getTime() - input.rangeDays * DAY);
  const twelveMonthsAgo = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 11, 1));

  const [
    organizations,
    subscriptions,
    projects,
    members,
    tickets,
    payments,
    usageResult,
    documentStorage,
    imageStorage,
    attachmentStorage,
    audit,
  ] = await Promise.all([
    db
      .select({
        id: schema.organizations.id,
        name: schema.organizations.name,
        status: schema.organizations.status,
        createdAt: schema.organizations.createdAt,
      })
      .from(schema.organizations),
    db
      .select({
        organizationId: schema.organizationPlans.organizationId,
        planId: schema.organizationPlans.planId,
        planName: schema.plans.name,
        status: schema.organizationPlans.status,
        billingCycle: schema.organizationPlans.billingCycle,
        amount: schema.organizationPlans.subscriptionAmount,
        endsAt: schema.organizationPlans.endsAt,
        trialEndsAt: schema.organizationPlans.trialEndsAt,
        cancelAtPeriodEnd: schema.organizationPlans.cancelAtPeriodEnd,
        maxActiveProjects: schema.plans.maxActiveProjects,
        maxInvestors: schema.plans.maxInvestors,
        maxAdvisors: schema.plans.maxAdvisors,
        maxProjectManagers: schema.plans.maxProjectManagers,
      })
      .from(schema.organizationPlans)
      .innerJoin(schema.plans, eq(schema.plans.id, schema.organizationPlans.planId)),
    db
      .select({
        organizationId: schema.projects.organizationId,
        status: schema.projects.status,
        createdAt: schema.projects.createdAt,
        data: schema.projects.data,
      })
      .from(schema.projects),
    db
      .select({
        userId: schema.organizationMembers.userId,
        status: schema.organizationMembers.status,
        createdAt: schema.organizationMembers.createdAt,
      })
      .from(schema.organizationMembers),
    db
      .select({
        id: schema.supportTickets.id,
        controlNumber: schema.supportTickets.controlNumber,
        subject: schema.supportTickets.subject,
        category: schema.supportTickets.category,
        status: schema.supportTickets.status,
        priority: schema.supportTickets.priority,
        createdAt: schema.supportTickets.createdAt,
        firstResponseDueAt: schema.supportTickets.firstResponseDueAt,
        firstRespondedAt: schema.supportTickets.firstRespondedAt,
        resolutionDueAt: schema.supportTickets.resolutionDueAt,
        resolvedAt: schema.supportTickets.resolvedAt,
        organizationName: schema.organizations.name,
      })
      .from(schema.supportTickets)
      .innerJoin(
        schema.organizations,
        eq(schema.organizations.id, schema.supportTickets.organizationId),
      ),
    db
      .select({
        organizationId: schema.billingPayments.organizationId,
        amount: schema.billingPayments.amount,
        status: schema.billingPayments.status,
        paidAt: schema.billingPayments.paidAt,
        createdAt: schema.billingPayments.createdAt,
      })
      .from(schema.billingPayments)
      .where(gte(schema.billingPayments.createdAt, twelveMonthsAgo)),
    db.execute(sql`
      select c.organization_id, c.type, count(*)::int as total
      from contacts c
      where c.status = 'active' and c.type in ('Investidor', 'Assessor', 'Responsável')
        and not exists (
          select 1 from organization_members m
          join users u on u.id = m.user_id
          where m.organization_id = c.organization_id and m.role in ('owner', 'admin')
            and lower(u.email) = lower(c.email)
        )
      group by c.organization_id, c.type
    `),
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
        id: schema.developerAuditLogs.id,
        action: schema.developerAuditLogs.action,
        targetId: schema.developerAuditLogs.targetId,
        createdAt: schema.developerAuditLogs.createdAt,
        actorName: schema.users.name,
      })
      .from(schema.developerAuditLogs)
      .innerJoin(schema.users, eq(schema.users.id, schema.developerAuditLogs.actorId))
      .orderBy(desc(schema.developerAuditLogs.createdAt))
      .limit(6),
  ]);

  const orgName = new Map(
    organizations.map((organization) => [organization.id, organization.name]),
  );
  const subscriptionByOrg = new Map(
    subscriptions.map((subscription) => [subscription.organizationId, subscription]),
  );
  const effective = subscriptions.map((subscription) => ({
    ...subscription,
    effectiveStatus: effectiveSubscriptionStatus(subscription, now),
  }));

  const inRange = (date: Date | null) => Boolean(date && date >= rangeStart);
  const inPrevious = (date: Date | null) =>
    Boolean(date && date >= previousStart && date < rangeStart);
  const paidPayments = payments.filter((payment) => payment.status === "paid");
  const paidDate = (payment: (typeof payments)[number]) => payment.paidAt ?? payment.createdAt;
  const sumAmount = (rows: typeof payments) =>
    rows.reduce((total, payment) => total + Number(payment.amount), 0);

  const revenue = computeRevenue(
    effective.map((subscription) => ({
      status: subscription.effectiveStatus,
      billingCycle: subscription.billingCycle,
      amount: number(subscription.amount),
    })),
  );
  const statusCounts = Object.fromEntries(
    subscriptionStatuses.map((status) => [status, 0]),
  ) as Record<SubscriptionStatus, number>;
  for (const subscription of effective) statusCounts[subscription.effectiveStatus] += 1;

  const activeMemberIds = new Set(
    members.filter((member) => member.status === "active").map((member) => member.userId),
  );
  const newMembers = members.filter((member) => member.status === "active");

  const slaTickets = tickets.map((ticket) => ({ ticket, sla: ticketSlaState(ticket, now) }));
  const openTickets = slaTickets.filter(({ ticket }) => openTicket(ticket.status));
  const minutesBetween = (later: Date, earlier: Date) =>
    (later.getTime() - earlier.getTime()) / 60_000;

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

  const contactUsage = new Map<string, number>();
  for (const row of usageResult.rows as Array<{
    organization_id: string;
    type: string;
    total: number;
  }>)
    contactUsage.set(`${row.organization_id}:${row.type}`, Number(row.total));
  const activeProjectsByOrg = new Map<string, number>();
  for (const project of projects)
    if (project.status !== "concluido")
      activeProjectsByOrg.set(
        project.organizationId,
        (activeProjectsByOrg.get(project.organizationId) ?? 0) + 1,
      );

  const usageAll = subscriptions.flatMap((subscription) => {
    const company = orgName.get(subscription.organizationId) ?? "Empresa";
    const rows = [
      {
        label: "projetos ativos",
        used: activeProjectsByOrg.get(subscription.organizationId) ?? 0,
        limit: subscription.maxActiveProjects,
      },
      {
        label: "investidores",
        used: contactUsage.get(`${subscription.organizationId}:Investidor`) ?? 0,
        limit: subscription.maxInvestors,
      },
      {
        label: "assessores",
        used: contactUsage.get(`${subscription.organizationId}:Assessor`) ?? 0,
        limit: subscription.maxAdvisors,
      },
      {
        label: "gestores",
        used: contactUsage.get(`${subscription.organizationId}:Responsável`) ?? 0,
        limit: subscription.maxProjectManagers,
      },
    ];
    return rows.map((row) => ({
      organizationId: subscription.organizationId,
      company,
      planName: subscription.planName,
      ...row,
    }));
  });
  const usageTop = usageAll
    .filter((row) => row.limit !== null)
    .map((row) => ({ ...row, ...limitUsage(row.used, row.limit) }))
    .sort((a, b) => (b.percent ?? 0) - (a.percent ?? 0))
    .slice(0, 8);

  const alerts = buildAlerts({
    now,
    subscriptions: effective.map((subscription) => ({
      organizationId: subscription.organizationId,
      company: orgName.get(subscription.organizationId) ?? "Empresa",
      status: subscription.effectiveStatus,
      endsAt: subscription.endsAt,
      trialEndsAt: subscription.trialEndsAt,
      cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
    })),
    usage: usageAll,
    tickets: openTickets.map(({ ticket, sla }) => ({
      id: ticket.id,
      controlNumber: ticket.controlNumber,
      priority: ticket.priority,
      status: ticket.status,
      sla,
    })),
    storageRatio: storageCapacityBytes ? storageBytes / storageCapacityBytes : 0,
    companiesWithoutPlan: organizations
      .filter(
        (organization) =>
          organization.status === "active" && !subscriptionByOrg.has(organization.id),
      )
      .map((organization) => ({ id: organization.id, name: organization.name })),
  });

  const months = monthKeys(now, 6);
  const days = dayKeys(now, input.rangeDays);
  const activity = [
    ...[...organizations]
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, 5)
      .map((organization) => ({
        id: `org-${organization.id}`,
        at: organization.createdAt.toISOString(),
        kind: "company" as const,
        text: `Nova empresa: ${organization.name}`,
      })),
    ...[...tickets]
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, 5)
      .map((ticket) => ({
        id: `ticket-${ticket.id}`,
        at: ticket.createdAt.toISOString(),
        kind: "ticket" as const,
        text: `Chamado ${ticket.controlNumber} de ${ticket.organizationName}: ${ticket.subject}`,
      })),
    ...[...paidPayments]
      .sort((a, b) => paidDate(b).getTime() - paidDate(a).getTime())
      .slice(0, 5)
      .map((payment) => ({
        id: `payment-${payment.organizationId}-${paidDate(payment).getTime()}`,
        at: paidDate(payment).toISOString(),
        kind: "payment" as const,
        text: `Pagamento de ${Number(payment.amount).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })} (${orgName.get(payment.organizationId) ?? "Empresa"})`,
      })),
    ...audit.map((entry) => ({
      id: `audit-${entry.id}`,
      at: entry.createdAt.toISOString(),
      kind: "audit" as const,
      text: `${entry.actorName}: ${entry.action} (${entry.targetId})`,
    })),
  ]
    .sort((a, b) => b.at.localeCompare(a.at))
    .slice(0, 12);

  const paidThisRange = paidPayments.filter((payment) => inRange(paidDate(payment)));
  const paidPreviousRange = paidPayments.filter((payment) => inPrevious(paidDate(payment)));

  return {
    generatedAt: now.toISOString(),
    rangeDays: input.rangeDays,
    kpis: {
      companies: {
        total: organizations.length,
        active: organizations.filter((organization) => organization.status === "active").length,
        newInRange: organizations.filter((organization) => inRange(organization.createdAt)).length,
        newPrevious: organizations.filter((organization) => inPrevious(organization.createdAt))
          .length,
      },
      users: {
        total: activeMemberIds.size,
        newInRange: newMembers.filter((member) => inRange(member.createdAt)).length,
        newPrevious: newMembers.filter((member) => inPrevious(member.createdAt)).length,
      },
      projects: {
        total: projects.length,
        inProgress: projects.filter((project) => project.status === "andamento").length,
        newInRange: projects.filter((project) => inRange(project.createdAt)).length,
        newPrevious: projects.filter((project) => inPrevious(project.createdAt)).length,
        investedCapital,
      },
      revenue: {
        ...revenue,
        receivedInRange: sumAmount(paidThisRange),
        receivedPrevious: sumAmount(paidPreviousRange),
      },
      subscriptions: {
        byStatus: statusCounts,
        withoutPlan: organizations.filter((o) => !subscriptionByOrg.has(o.id)).length,
      },
      tickets: {
        open: openTickets.length,
        urgent: openTickets.filter(({ ticket }) => ticket.priority === "urgent").length,
        breached: openTickets.filter(
          ({ sla }) => sla.firstResponse === "breached" || sla.resolution === "breached",
        ).length,
        openedInRange: tickets.filter((ticket) => inRange(ticket.createdAt)).length,
        openedPrevious: tickets.filter((ticket) => inPrevious(ticket.createdAt)).length,
        resolvedInRange: tickets.filter((ticket) => inRange(ticket.resolvedAt)).length,
        averageFirstResponseMinutes: average(
          tickets
            .filter((ticket) => ticket.firstRespondedAt)
            .map((ticket) => minutesBetween(ticket.firstRespondedAt!, ticket.createdAt)),
        ),
        averageResolutionMinutes: average(
          tickets
            .filter((ticket) => ticket.resolvedAt)
            .map((ticket) => minutesBetween(ticket.resolvedAt!, ticket.createdAt)),
        ),
      },
      storage: {
        bytes: storageBytes,
        capacityBytes: storageCapacityBytes,
        byCategory: storageByCategory,
      },
    },
    series: {
      months,
      newCompanies: countByKey(
        organizations.map((organization) => organization.createdAt),
        months,
        7,
      ),
      receivedRevenue: sumByMonth(
        paidPayments.map((payment) => ({
          date: paidDate(payment),
          amount: Number(payment.amount),
        })),
        months,
      ),
      days,
      ticketsOpened: countByKey(
        tickets.map((ticket) => ticket.createdAt),
        days,
        10,
      ),
      ticketsResolved: countByKey(
        tickets.map((ticket) => ticket.resolvedAt),
        days,
        10,
      ),
      newProjects: countByKey(
        projects.map((project) => project.createdAt),
        days,
        10,
      ),
    },
    distributions: {
      byPlan: Object.entries(
        effective.reduce<Record<string, number>>((accumulator, subscription) => {
          accumulator[subscription.planName] = (accumulator[subscription.planName] ?? 0) + 1;
          return accumulator;
        }, {}),
      ).map(([name, value]) => ({ name, value })),
      byStatus: subscriptionStatuses
        .map((status) => ({
          status,
          label: subscriptionStatusLabels[status],
          value: statusCounts[status],
        }))
        .filter((item) => item.value > 0),
      ticketsByPriority: ["urgent", "high", "normal", "low"].map((priority) => ({
        priority,
        value: openTickets.filter(({ ticket }) => ticket.priority === priority).length,
      })),
      ticketsByCategory: Object.entries(
        openTickets.reduce<Record<string, number>>((accumulator, { ticket }) => {
          accumulator[ticket.category] = (accumulator[ticket.category] ?? 0) + 1;
          return accumulator;
        }, {}),
      ).map(([name, value]) => ({ name, value })),
    },
    usage: usageTop,
    alerts,
    activity,
    stripeConfigured: stripeSetup().secretKeyConfigured,
  };
}

export async function getPlansOverviewImpl() {
  await developer();
  const [planRows, assignments, companies] = await Promise.all([
    db.select().from(schema.plans).orderBy(asc(schema.plans.createdAt)),
    db
      .select({ planId: schema.organizationPlans.planId, total: count() })
      .from(schema.organizationPlans)
      .groupBy(schema.organizationPlans.planId),
    db
      .select({ id: schema.organizations.id, name: schema.organizations.name })
      .from(schema.organizations)
      .orderBy(asc(schema.organizations.name)),
  ]);
  const assigned = new Map(assignments.map((row) => [row.planId, Number(row.total)]));
  const companyName = new Map(companies.map((company) => [company.id, company.name]));
  const order = (id: string) => (builtInPlanIds.includes(id) ? builtInPlanIds.indexOf(id) : 99);
  return {
    companies,
    plans: planRows
      .map((plan) => ({
        ...plan,
        monthlyPrice: number(plan.monthlyPrice),
        annualPrice: number(plan.annualPrice),
        updatedAt: plan.updatedAt.toISOString(),
        createdAt: plan.createdAt.toISOString(),
        companyCount: assigned.get(plan.id) ?? 0,
        ownerName: plan.ownerOrganizationId
          ? (companyName.get(plan.ownerOrganizationId) ?? null)
          : null,
        builtIn: builtInPlanIds.includes(plan.id),
      }))
      .sort((a, b) => order(a.id) - order(b.id) || a.createdAt.localeCompare(b.createdAt)),
  };
}

async function assertPlanOwner(data: PlanFields) {
  if (data.kind === "standard" && data.ownerOrganizationId)
    throw new Error("Somente planos personalizados podem ser exclusivos de uma empresa.");
  if (data.ownerOrganizationId) {
    const [organization] = await db
      .select({ id: schema.organizations.id })
      .from(schema.organizations)
      .where(eq(schema.organizations.id, data.ownerOrganizationId))
      .limit(1);
    if (!organization) throw new Error("Empresa do plano não encontrada.");
  }
}

const planColumns = (data: PlanFields) => ({
  name: data.name,
  description: data.description,
  kind: data.kind,
  ownerOrganizationId: data.ownerOrganizationId,
  monthlyPrice: data.monthlyPrice === null ? null : data.monthlyPrice.toFixed(2),
  annualPrice: data.annualPrice === null ? null : data.annualPrice.toFixed(2),
  maxActiveProjects: data.maxActiveProjects,
  maxInvestors: data.maxInvestors,
  maxAdvisors: data.maxAdvisors,
  maxProjectManagers: data.maxProjectManagers,
  firstResponseHours: data.firstResponseHours,
  resolutionHours: data.resolutionHours,
  menuItems: data.menuItems,
  advisoryModalities: data.advisoryModalities,
  projectTabs: data.projectTabs,
  stripeMonthlyPriceId: data.stripeMonthlyPriceId,
  stripeAnnualPriceId: data.stripeAnnualPriceId,
});

export async function createPlanImpl(data: PlanFields) {
  const actor = await developer();
  await assertPlanOwner(data);
  const slug = slugifyPlanName(data.name) || "plano";
  const prefix = data.kind === "custom" ? "cliente" : "plano";
  let id = "";
  for (let attempt = 0; attempt < 5 && !id; attempt += 1) {
    const candidate = `${prefix}-${slug}-${randomBytes(2).toString("hex")}`;
    const [existing] = await db
      .select({ id: schema.plans.id })
      .from(schema.plans)
      .where(eq(schema.plans.id, candidate))
      .limit(1);
    if (!existing) id = candidate;
  }
  if (!id) throw new Error("Não foi possível gerar um identificador para o plano.");
  await db.transaction(async (tx) => {
    await tx.insert(schema.plans).values({ id, ...planColumns(data) });
    await tx.insert(schema.developerAuditLogs).values({
      actorId: actor.id,
      action: "plan.created",
      targetId: id,
      after: data,
    });
  });
  return { id };
}

export async function updatePlanImpl(data: PlanFields & { id: string }) {
  const actor = await developer();
  const [before] = await db.select().from(schema.plans).where(eq(schema.plans.id, data.id));
  if (!before) throw new Error("Plano não encontrado.");
  if (builtInPlanIds.includes(data.id) && (data.kind !== before.kind || data.ownerOrganizationId))
    throw new Error("Os planos padrão do sistema não podem mudar de tipo nem ser exclusivos.");
  await assertPlanOwner(data);
  if (data.ownerOrganizationId && data.ownerOrganizationId !== before.ownerOrganizationId) {
    const [foreign] = await db
      .select({ organizationId: schema.organizationPlans.organizationId })
      .from(schema.organizationPlans)
      .where(
        and(
          eq(schema.organizationPlans.planId, data.id),
          sql`${schema.organizationPlans.organizationId} <> ${data.ownerOrganizationId}`,
        ),
      )
      .limit(1);
    if (foreign)
      throw new Error("Outras empresas já usam este plano; remova-as antes de torná-lo exclusivo.");
  }
  await db.transaction(async (tx) => {
    await tx
      .update(schema.plans)
      .set({ ...planColumns(data), updatedAt: new Date() })
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

async function companiesUsingPlan(planId: string) {
  const [row] = await db
    .select({ total: count() })
    .from(schema.organizationPlans)
    .where(eq(schema.organizationPlans.planId, planId));
  return Number(row?.total ?? 0);
}

export async function setPlanActiveImpl(data: { id: string; active: boolean }) {
  const actor = await developer();
  if (!data.active && builtInPlanIds.includes(data.id))
    throw new Error("Os planos padrão do sistema não podem ser desativados.");
  if (!data.active && (await companiesUsingPlan(data.id)) > 0)
    throw new Error("Há empresas neste plano; mude o plano delas antes de desativá-lo.");
  await db.transaction(async (tx) => {
    const updated = await tx
      .update(schema.plans)
      .set({ active: data.active, updatedAt: new Date() })
      .where(eq(schema.plans.id, data.id))
      .returning({ id: schema.plans.id });
    if (!updated.length) throw new Error("Plano não encontrado.");
    await tx.insert(schema.developerAuditLogs).values({
      actorId: actor.id,
      action: data.active ? "plan.activated" : "plan.deactivated",
      targetId: data.id,
    });
  });
  return { ok: true };
}

export async function deletePlanImpl(data: { id: string }) {
  const actor = await developer();
  if (builtInPlanIds.includes(data.id))
    throw new Error("Os planos padrão do sistema não podem ser excluídos.");
  if ((await companiesUsingPlan(data.id)) > 0)
    throw new Error("Há empresas neste plano; mude o plano delas antes de excluí-lo.");
  await db.transaction(async (tx) => {
    const [before] = await tx.select().from(schema.plans).where(eq(schema.plans.id, data.id));
    if (!before) throw new Error("Plano não encontrado.");
    await tx.delete(schema.plans).where(eq(schema.plans.id, data.id));
    await tx.insert(schema.developerAuditLogs).values({
      actorId: actor.id,
      action: "plan.deleted",
      targetId: data.id,
      before,
    });
  });
  return { ok: true };
}

export async function getFinanceImpl() {
  await developer();
  const now = new Date();
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const lastMonthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
  const [organizations, subscriptions, payments, plans] = await Promise.all([
    db
      .select({
        id: schema.organizations.id,
        name: schema.organizations.name,
        status: schema.organizations.status,
        adminEmail: schema.users.email,
      })
      .from(schema.organizations)
      .innerJoin(schema.users, eq(schema.users.id, schema.organizations.createdBy))
      .orderBy(asc(schema.organizations.name)),
    db
      .select({
        organizationId: schema.organizationPlans.organizationId,
        planId: schema.organizationPlans.planId,
        planName: schema.plans.name,
        planKind: schema.plans.kind,
        status: schema.organizationPlans.status,
        billingCycle: schema.organizationPlans.billingCycle,
        amount: schema.organizationPlans.subscriptionAmount,
        startsAt: schema.organizationPlans.startsAt,
        endsAt: schema.organizationPlans.endsAt,
        trialEndsAt: schema.organizationPlans.trialEndsAt,
        cancelAtPeriodEnd: schema.organizationPlans.cancelAtPeriodEnd,
        statusUpdatedAt: schema.organizationPlans.statusUpdatedAt,
        stripeCustomerId: schema.organizationPlans.stripeCustomerId,
        stripeSubscriptionId: schema.organizationPlans.stripeSubscriptionId,
        planMonthlyPrice: schema.plans.monthlyPrice,
        planAnnualPrice: schema.plans.annualPrice,
        stripeMonthlyPriceId: schema.plans.stripeMonthlyPriceId,
        stripeAnnualPriceId: schema.plans.stripeAnnualPriceId,
      })
      .from(schema.organizationPlans)
      .innerJoin(schema.plans, eq(schema.plans.id, schema.organizationPlans.planId)),
    db
      .select()
      .from(schema.billingPayments)
      .orderBy(desc(schema.billingPayments.createdAt))
      .limit(200),
    db
      .select({
        id: schema.plans.id,
        name: schema.plans.name,
        kind: schema.plans.kind,
        active: schema.plans.active,
        ownerOrganizationId: schema.plans.ownerOrganizationId,
        monthlyPrice: schema.plans.monthlyPrice,
        annualPrice: schema.plans.annualPrice,
      })
      .from(schema.plans),
  ]);
  const subscriptionByOrg = new Map(subscriptions.map((row) => [row.organizationId, row]));
  const companyName = new Map(
    organizations.map((organization) => [organization.id, organization.name]),
  );
  const paidByOrg = new Map<string, { total: number; last: Date | null; failed: number }>();
  for (const payment of payments) {
    const entry = paidByOrg.get(payment.organizationId) ?? { total: 0, last: null, failed: 0 };
    if (payment.status === "paid") {
      entry.total += Number(payment.amount);
      const date = payment.paidAt ?? payment.createdAt;
      if (!entry.last || date > entry.last) entry.last = date;
    }
    if (payment.status === "failed") entry.failed += 1;
    paidByOrg.set(payment.organizationId, entry);
  }

  const rows = organizations.map((organization) => {
    const subscription = subscriptionByOrg.get(organization.id);
    const paid = paidByOrg.get(organization.id);
    const effectiveStatus = subscription ? effectiveSubscriptionStatus(subscription, now) : null;
    return {
      organizationId: organization.id,
      company: organization.name,
      companyStatus: organization.status,
      adminEmail: organization.adminEmail,
      planId: subscription?.planId ?? null,
      planName: subscription?.planName ?? null,
      planKind: subscription?.planKind ?? null,
      status: subscription?.status ?? null,
      effectiveStatus,
      billingCycle: subscription?.billingCycle ?? null,
      amount: number(subscription?.amount),
      startsAt: iso(subscription?.startsAt),
      endsAt: iso(subscription?.endsAt),
      trialEndsAt: iso(subscription?.trialEndsAt),
      daysToEnd: subscription?.endsAt ? daysUntil(subscription.endsAt, now) : null,
      cancelAtPeriodEnd: subscription?.cancelAtPeriodEnd ?? false,
      stripeCustomerId: subscription?.stripeCustomerId ?? null,
      stripeSubscriptionId: subscription?.stripeSubscriptionId ?? null,
      hasStripePrice: Boolean(
        subscription?.stripeMonthlyPriceId || subscription?.stripeAnnualPriceId,
      ),
      totalPaid: paid?.total ?? 0,
      lastPaymentAt: iso(paid?.last),
      failedPayments: paid?.failed ?? 0,
    };
  });

  const revenue = computeRevenue(
    rows
      .filter((row) => row.effectiveStatus)
      .map((row) => ({
        status: row.effectiveStatus!,
        billingCycle: row.billingCycle,
        amount: row.amount,
      })),
  );
  const paid = payments.filter((payment) => payment.status === "paid");
  const paidDate = (payment: (typeof payments)[number]) => payment.paidAt ?? payment.createdAt;
  const sum = (list: typeof payments) =>
    list.reduce((total, payment) => total + Number(payment.amount), 0);
  const billable = rows.filter(
    (row) => row.effectiveStatus === "active" || row.effectiveStatus === "past_due",
  );
  const canceledRecently = subscriptions.filter(
    (subscription) =>
      subscription.status === "canceled" &&
      subscription.statusUpdatedAt >= new Date(now.getTime() - 90 * DAY),
  ).length;
  const upcoming = rows
    .filter(
      (row) =>
        row.effectiveStatus === "active" &&
        !row.cancelAtPeriodEnd &&
        row.daysToEnd !== null &&
        row.daysToEnd >= 0 &&
        row.daysToEnd <= 30,
    )
    .sort((a, b) => (a.daysToEnd ?? 0) - (b.daysToEnd ?? 0));

  return {
    generatedAt: now.toISOString(),
    stripe: stripeSetup(),
    plans: plans.map((plan) => ({
      ...plan,
      monthlyPrice: number(plan.monthlyPrice),
      annualPrice: number(plan.annualPrice),
    })),
    subscriptions: rows,
    payments: payments.map((payment) => ({
      id: payment.id,
      organizationId: payment.organizationId,
      company: companyName.get(payment.organizationId) ?? "Empresa",
      amount: Number(payment.amount),
      status: payment.status,
      method: payment.method,
      source: payment.source,
      description: payment.description,
      stripeInvoiceId: payment.stripeInvoiceId,
      paidAt: iso(payment.paidAt),
      periodStart: iso(payment.periodStart),
      periodEnd: iso(payment.periodEnd),
      createdAt: payment.createdAt.toISOString(),
    })),
    kpis: {
      ...revenue,
      activeSubscriptions: rows.filter((row) => row.effectiveStatus === "active").length,
      trialing: rows.filter((row) => row.effectiveStatus === "trialing").length,
      pastDue: rows.filter((row) => row.effectiveStatus === "past_due").length,
      expired: rows.filter((row) => row.effectiveStatus === "expired").length,
      canceled: rows.filter((row) => row.effectiveStatus === "canceled").length,
      withoutPlan: rows.filter((row) => !row.effectiveStatus).length,
      averageTicket: billable.length ? revenue.mrr / billable.length : 0,
      receivedThisMonth: sum(paid.filter((payment) => paidDate(payment) >= monthStart)),
      receivedLastMonth: sum(
        paid.filter(
          (payment) => paidDate(payment) >= lastMonthStart && paidDate(payment) < monthStart,
        ),
      ),
      failedLast30: payments.filter(
        (payment) =>
          payment.status === "failed" && payment.createdAt >= new Date(now.getTime() - 30 * DAY),
      ).length,
      pendingAmount: sum(payments.filter((payment) => payment.status === "pending")),
      canceledLast90: canceledRecently,
      upcomingAmount30: upcoming.reduce((total, row) => total + (row.amount ?? 0), 0),
      upcomingCount30: upcoming.length,
    },
  };
}

export async function saveSubscriptionImpl(data: SubscriptionInput) {
  const actor = await developer();
  const startsAt = parseDateOnly(data.startsAt, "o início da vigência");
  const endsAt = parseDateOnly(data.endsAt, "o término da vigência");
  const trialEndsAt = parseDateOnly(data.trialEndsAt, "o fim do teste");
  if (startsAt && endsAt && endsAt < startsAt)
    throw new Error("O término da vigência deve ser posterior ao início.");
  const [plan] = await db.select().from(schema.plans).where(eq(schema.plans.id, data.planId));
  if (!plan) throw new Error("Plano não encontrado.");
  if (plan.ownerOrganizationId && plan.ownerOrganizationId !== data.organizationId)
    throw new Error("Este plano é exclusivo de outra empresa.");
  const [before] = await db
    .select()
    .from(schema.organizationPlans)
    .where(eq(schema.organizationPlans.organizationId, data.organizationId));
  if (!plan.active && before?.planId !== data.planId)
    throw new Error("Este plano está desativado e não pode ser atribuído.");
  const values = {
    planId: data.planId,
    status: data.status,
    billingCycle: data.billingCycle,
    subscriptionAmount:
      data.subscriptionAmount === null ? null : data.subscriptionAmount.toFixed(2),
    startsAt,
    endsAt,
    trialEndsAt,
    cancelAtPeriodEnd: data.cancelAtPeriodEnd,
    stripeCustomerId: data.stripeCustomerId,
    stripeSubscriptionId: data.stripeSubscriptionId,
  };
  await db.transaction(async (tx) => {
    await tx
      .insert(schema.organizationPlans)
      .values({ organizationId: data.organizationId, ...values })
      .onConflictDoUpdate({
        target: schema.organizationPlans.organizationId,
        set: {
          ...values,
          assignedAt: before?.planId === data.planId ? before.assignedAt : new Date(),
          statusUpdatedAt: before?.status === data.status ? before.statusUpdatedAt : new Date(),
        },
      });
    await tx.insert(schema.developerAuditLogs).values({
      actorId: actor.id,
      action: "subscription.updated",
      targetId: data.organizationId,
      before: before ?? null,
      after: data,
    });
  });
  return { ok: true };
}

export async function recordPaymentImpl(data: PaymentInput) {
  const actor = await developer();
  const paidAt = parseDateOnly(data.paidAt, "a data do pagamento") ?? new Date();
  const [subscription] = await db
    .select()
    .from(schema.organizationPlans)
    .where(eq(schema.organizationPlans.organizationId, data.organizationId));
  if (data.renewSubscription) {
    if (data.status !== "paid")
      throw new Error("Só é possível renovar a vigência com pagamento confirmado.");
    if (!subscription) throw new Error("Atribua um plano à empresa antes de renovar a vigência.");
    if (subscription.billingCycle !== "monthly" && subscription.billingCycle !== "annual")
      throw new Error("Defina o ciclo de cobrança (mensal ou anual) para renovar a vigência.");
  }
  await db.transaction(async (tx) => {
    let periodStart: Date | null = null;
    let periodEnd: Date | null = null;
    if (data.renewSubscription && subscription && subscription.billingCycle) {
      const base =
        subscription.endsAt && subscription.endsAt > paidAt ? subscription.endsAt : paidAt;
      periodStart = base;
      periodEnd = addBillingPeriod(base, subscription.billingCycle as "monthly" | "annual");
      await tx
        .update(schema.organizationPlans)
        .set({
          status: "active",
          startsAt: subscription.startsAt ?? paidAt,
          endsAt: periodEnd,
          cancelAtPeriodEnd: false,
          statusUpdatedAt: new Date(),
        })
        .where(eq(schema.organizationPlans.organizationId, data.organizationId));
    }
    await tx.insert(schema.billingPayments).values({
      organizationId: data.organizationId,
      planId: subscription?.planId ?? null,
      amount: data.amount.toFixed(2),
      status: data.status,
      method: data.method,
      source: "manual",
      description: data.description,
      paidAt: data.status === "paid" ? paidAt : null,
      periodStart,
      periodEnd,
      createdBy: actor.id,
    });
    await tx.insert(schema.developerAuditLogs).values({
      actorId: actor.id,
      action: "payment.recorded",
      targetId: data.organizationId,
      after: { ...data },
    });
  });
  return { ok: true };
}

export async function setPaymentStatusImpl(data: {
  id: string;
  status: "paid" | "failed" | "refunded";
}) {
  const actor = await developer();
  await db.transaction(async (tx) => {
    const [before] = await tx
      .select()
      .from(schema.billingPayments)
      .where(eq(schema.billingPayments.id, data.id));
    if (!before) throw new Error("Pagamento não encontrado.");
    const allowed =
      (before.status === "pending" && (data.status === "paid" || data.status === "failed")) ||
      (before.status === "paid" && data.status === "refunded");
    if (!allowed) throw new Error("Esta alteração de status não é permitida.");
    await tx
      .update(schema.billingPayments)
      .set({ status: data.status, paidAt: data.status === "paid" ? new Date() : before.paidAt })
      .where(eq(schema.billingPayments.id, data.id));
    await tx.insert(schema.developerAuditLogs).values({
      actorId: actor.id,
      action: "payment.status_changed",
      targetId: before.organizationId,
      before: { id: before.id, status: before.status },
      after: { id: before.id, status: data.status },
    });
  });
  return { ok: true };
}

export async function getHelpDeskImpl() {
  await developer();
  const now = new Date();
  const rows = await db
    .select({
      id: schema.supportTickets.id,
      controlNumber: schema.supportTickets.controlNumber,
      subject: schema.supportTickets.subject,
      category: schema.supportTickets.category,
      status: schema.supportTickets.status,
      priority: schema.supportTickets.priority,
      createdAt: schema.supportTickets.createdAt,
      updatedAt: schema.supportTickets.updatedAt,
      firstResponseDueAt: schema.supportTickets.firstResponseDueAt,
      firstRespondedAt: schema.supportTickets.firstRespondedAt,
      resolutionDueAt: schema.supportTickets.resolutionDueAt,
      resolvedAt: schema.supportTickets.resolvedAt,
      organizationId: schema.supportTickets.organizationId,
      organizationName: schema.organizations.name,
      openedByName: schema.users.name,
    })
    .from(schema.supportTickets)
    .innerJoin(
      schema.organizations,
      eq(schema.organizations.id, schema.supportTickets.organizationId),
    )
    .innerJoin(schema.users, eq(schema.users.id, schema.supportTickets.openedBy))
    .orderBy(desc(schema.supportTickets.createdAt));
  const tickets = rows.map((ticket) => ({
    ...ticket,
    sla: ticketSlaState(ticket, now),
    createdAt: ticket.createdAt.toISOString(),
    updatedAt: ticket.updatedAt.toISOString(),
    firstResponseDueAt: ticket.firstResponseDueAt.toISOString(),
    resolutionDueAt: ticket.resolutionDueAt.toISOString(),
    firstRespondedAt: iso(ticket.firstRespondedAt),
    resolvedAt: iso(ticket.resolvedAt),
  }));
  const open = tickets.filter((ticket) => openTicket(ticket.status));
  const minutes = (later: string, earlier: string) =>
    (new Date(later).getTime() - new Date(earlier).getTime()) / 60_000;
  return {
    generatedAt: now.toISOString(),
    tickets,
    kpis: {
      open: open.length,
      urgent: open.filter((ticket) => ticket.priority === "urgent").length,
      waitingUser: tickets.filter((ticket) => ticket.status === "waiting").length,
      breached: open.filter(
        (ticket) => ticket.sla.firstResponse === "breached" || ticket.sla.resolution === "breached",
      ).length,
      atRisk: open.filter(
        (ticket) => ticket.sla.firstResponse === "at_risk" || ticket.sla.resolution === "at_risk",
      ).length,
      resolvedLast7: tickets.filter(
        (ticket) =>
          ticket.resolvedAt && new Date(ticket.resolvedAt) >= new Date(now.getTime() - 7 * DAY),
      ).length,
      averageFirstResponseMinutes: average(
        tickets
          .filter((ticket) => ticket.firstRespondedAt)
          .map((ticket) => minutes(ticket.firstRespondedAt!, ticket.createdAt)),
      ),
      averageResolutionMinutes: average(
        tickets
          .filter((ticket) => ticket.resolvedAt)
          .map((ticket) => minutes(ticket.resolvedAt!, ticket.createdAt)),
      ),
    },
    categories: [...new Set(tickets.map((ticket) => ticket.category))].sort(),
  };
}

export async function listCompaniesImpl() {
  await developer();
  return db
    .select({ id: schema.organizations.id, name: schema.organizations.name })
    .from(schema.organizations)
    .where(inArray(schema.organizations.status, ["active"]))
    .orderBy(asc(schema.organizations.name));
}

import { getRequestHeaders } from "@tanstack/react-start/server";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db/index.server";
import * as schema from "@/db/schema";
import { auth } from "@/lib/auth.server";
import { resolveActiveMembership } from "@/lib/active-organization.server";
import { entitledSubscriptionStatuses } from "@/lib/billing";
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

export async function developer() {
  const user = await currentUser();
  if (user.systemRole !== "developer") throw new Error("Acesso exclusivo do Desenvolvedor.");
  return user;
}

export async function getSystemRoleImpl() {
  const user = await currentUser();
  return user.systemRole;
}

export async function activePlanForOrganization(organizationId: string) {
  const [plan] = await db
    .select({ plan: schema.plans })
    .from(schema.organizationPlans)
    .innerJoin(schema.plans, eq(schema.plans.id, schema.organizationPlans.planId))
    .where(
      and(
        eq(schema.organizationPlans.organizationId, organizationId),
        inArray(schema.organizationPlans.status, entitledSubscriptionStatuses),
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

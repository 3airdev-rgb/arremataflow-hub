import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export const getSystemRole = createServerFn({ method: "GET" }).handler(async () =>
  (await import("@/lib/developer.server")).getSystemRoleImpl(),
);
export const getDeveloperDashboard = createServerFn({ method: "GET" }).handler(async () =>
  (await import("@/lib/developer.server")).getDeveloperDashboardImpl(),
);
export const getActivePlan = createServerFn({ method: "GET" }).handler(async () =>
  (await import("@/lib/developer.server")).getActivePlanImpl(),
);

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
export const updatePlan = createServerFn({ method: "POST" })
  .validator(planInput)
  .handler(async ({ data }) => (await import("@/lib/developer.server")).updatePlanImpl(data));
export const assignOrganizationPlan = createServerFn({ method: "POST" })
  .validator(
    z.object({
      organizationId: z.string().uuid(),
      planId: z.enum(["starter", "professional", "custom"]),
      billingCycle: z.enum(["monthly", "annual"]).nullable(),
      subscriptionAmount: z.number().finite().min(0).nullable(),
      startsAt: z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/)
        .nullable(),
      endsAt: z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/)
        .nullable(),
    }),
  )
  .handler(async ({ data }) =>
    (await import("@/lib/developer.server")).assignOrganizationPlanImpl(data),
  );

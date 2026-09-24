import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { paymentStatuses } from "@/lib/billing";
import {
  paymentSchema,
  planFieldsSchema,
  planUpdateSchema,
  subscriptionSchema,
} from "@/lib/developer-schemas";

const panel = () => import("@/lib/developer-panel.server");
const stripe = () => import("@/lib/stripe.server");

export const getSystemRole = createServerFn({ method: "GET" }).handler(async () =>
  (await import("@/lib/developer.server")).getSystemRoleImpl(),
);
export const getActivePlan = createServerFn({ method: "GET" }).handler(async () =>
  (await import("@/lib/developer.server")).getActivePlanImpl(),
);

export const getDeveloperOverview = createServerFn({ method: "GET" })
  .validator(z.object({ rangeDays: z.union([z.literal(7), z.literal(30), z.literal(90)]) }))
  .handler(async ({ data }) => (await panel()).getOverviewImpl(data));

export const getPlansOverview = createServerFn({ method: "GET" }).handler(async () =>
  (await panel()).getPlansOverviewImpl(),
);
export const createPlan = createServerFn({ method: "POST" })
  .validator(planFieldsSchema)
  .handler(async ({ data }) => (await panel()).createPlanImpl(data));
export const updatePlan = createServerFn({ method: "POST" })
  .validator(planUpdateSchema)
  .handler(async ({ data }) => (await panel()).updatePlanImpl(data));
export const setPlanActive = createServerFn({ method: "POST" })
  .validator(z.object({ id: z.string().min(1), active: z.boolean() }))
  .handler(async ({ data }) => (await panel()).setPlanActiveImpl(data));
export const deletePlan = createServerFn({ method: "POST" })
  .validator(z.object({ id: z.string().min(1) }))
  .handler(async ({ data }) => (await panel()).deletePlanImpl(data));

export const getFinance = createServerFn({ method: "GET" }).handler(async () =>
  (await panel()).getFinanceImpl(),
);
export const saveSubscription = createServerFn({ method: "POST" })
  .validator(subscriptionSchema)
  .handler(async ({ data }) => (await panel()).saveSubscriptionImpl(data));
export const recordPayment = createServerFn({ method: "POST" })
  .validator(paymentSchema)
  .handler(async ({ data }) => (await panel()).recordPaymentImpl(data));
export const setPaymentStatus = createServerFn({ method: "POST" })
  .validator(
    z.object({
      id: z.string().uuid(),
      status: z.enum(paymentStatuses).exclude(["pending"]),
    }),
  )
  .handler(async ({ data }) => (await panel()).setPaymentStatusImpl(data));

export const createCheckoutLink = createServerFn({ method: "POST" })
  .validator(z.object({ organizationId: z.string().uuid(), cycle: z.enum(["monthly", "annual"]) }))
  .handler(async ({ data }) => (await stripe()).createCheckoutLinkImpl(data));
export const createPortalLink = createServerFn({ method: "POST" })
  .validator(z.object({ organizationId: z.string().uuid() }))
  .handler(async ({ data }) => (await stripe()).createPortalLinkImpl(data));

export const getHelpDesk = createServerFn({ method: "GET" }).handler(async () =>
  (await panel()).getHelpDeskImpl(),
);

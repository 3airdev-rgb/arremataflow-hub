import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { subscriptionPlanOrder } from "@/lib/subscription-plans";

export const getCompanySubscription = createServerFn({ method: "GET" }).handler(async () =>
  (await import("@/lib/subscription.server")).getCompanySubscriptionImpl(),
);

export const requestSubscriptionUpgrade = createServerFn({ method: "POST" })
  .validator(z.object({ targetPlanId: z.enum(subscriptionPlanOrder) }))
  .handler(async ({ data }) =>
    (await import("@/lib/subscription.server")).requestSubscriptionUpgradeImpl(data),
  );

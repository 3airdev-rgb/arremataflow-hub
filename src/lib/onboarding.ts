import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const server = () => import("@/lib/onboarding.server");

export const getAccessGate = createServerFn({ method: "GET" }).handler(async () =>
  (await server()).getAccessGateImpl(),
);

export const createCompany = createServerFn({ method: "POST" })
  .validator(
    z.object({
      name: z.string().trim().min(2).max(160),
      legalDocument: z.string().trim().max(18).default(""),
    }),
  )
  .handler(async ({ data }) => (await server()).createCompanyImpl(data));

export const getPlansCatalog = createServerFn({ method: "GET" }).handler(async () =>
  (await server()).getPlansCatalogImpl(),
);

export const startCheckout = createServerFn({ method: "POST" })
  .validator(z.object({ planId: z.string().min(1).max(80), cycle: z.enum(["monthly", "annual"]) }))
  .handler(async ({ data }) => (await server()).startCheckoutImpl(data));

export const openBillingPortal = createServerFn({ method: "POST" }).handler(async () =>
  (await server()).openBillingPortalImpl(),
);

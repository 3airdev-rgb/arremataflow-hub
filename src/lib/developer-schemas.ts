import { z } from "zod";
import { billingCycles, paymentMethods, paymentStatuses, subscriptionStatuses } from "./billing.ts";

export const menuOptions = [
  "Dashboard",
  "Projetos",
  "Investidores",
  "Assessores",
  "Relatórios",
  "Notificações",
  "Configurações",
  "Suporte",
];
export const projectTabOptions = [
  "Visão Geral",
  "Regularização",
  "Posse",
  "Financeiro",
  "Documentos",
  "Tarefas",
  "Obra",
  "Venda",
  "Resultado",
  "Contratos",
  "Distribuição de Resultados",
  "Histórico",
];
export const modalityOptions = [
  "completa",
  "parcial",
  "juridica",
  "operacional",
  "consultiva",
  "nenhuma",
];
export const modalityLabels: Record<string, string> = {
  completa: "Assessoria Completa",
  parcial: "Assessoria Parcial",
  juridica: "Assessoria Jurídica",
  operacional: "Assessoria Operacional",
  consultiva: "Consultoria Específica",
  nenhuma: "Sem Assessoria",
};

const optionalPriceId = z
  .string()
  .trim()
  .max(80)
  .regex(/^price_[A-Za-z0-9_]+$/, "Informe um ID de preço da Stripe (price_...).")
  .nullable()
  .or(z.literal("").transform(() => null));

const optionalLimit = z.number().int().min(0).nullable();
const optionalPrice = z.number().finite().min(0).nullable();

export const planFieldsSchema = z.object({
  name: z.string().trim().min(2, "Informe o nome do plano.").max(80),
  description: z
    .string()
    .trim()
    .max(500)
    .nullable()
    .transform((value) => value || null),
  kind: z.enum(["standard", "custom"]),
  ownerOrganizationId: z.string().uuid().nullable(),
  monthlyPrice: optionalPrice,
  annualPrice: optionalPrice,
  maxActiveProjects: optionalLimit,
  maxInvestors: optionalLimit,
  maxAdvisors: optionalLimit,
  maxProjectManagers: optionalLimit,
  firstResponseHours: z.number().int().min(1).max(720),
  resolutionHours: z.number().int().min(1).max(2160),
  menuItems: z.array(z.string().min(1)).max(30),
  advisoryModalities: z.array(z.string().min(1)).max(20),
  projectTabs: z.array(z.string().min(1)).max(30),
  stripeMonthlyPriceId: optionalPriceId,
  stripeAnnualPriceId: optionalPriceId,
});
export type PlanFields = z.infer<typeof planFieldsSchema>;

export const planUpdateSchema = planFieldsSchema.extend({ id: z.string().min(1).max(80) });

const dateOnly = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .nullable();

export const subscriptionSchema = z.object({
  organizationId: z.string().uuid(),
  planId: z.string().min(1).max(80),
  status: z.enum(subscriptionStatuses),
  billingCycle: z.enum(billingCycles).nullable(),
  subscriptionAmount: z.number().finite().min(0).nullable(),
  startsAt: dateOnly,
  endsAt: dateOnly,
  trialEndsAt: dateOnly,
  cancelAtPeriodEnd: z.boolean(),
  stripeCustomerId: z
    .string()
    .trim()
    .max(80)
    .nullable()
    .transform((value) => value || null),
  stripeSubscriptionId: z
    .string()
    .trim()
    .max(80)
    .nullable()
    .transform((value) => value || null),
});
export type SubscriptionInput = z.infer<typeof subscriptionSchema>;

export const paymentSchema = z.object({
  organizationId: z.string().uuid(),
  amount: z.number().finite().positive("Informe o valor do pagamento.").max(99_999_999),
  method: z.enum(paymentMethods),
  status: z.enum(paymentStatuses),
  description: z
    .string()
    .trim()
    .max(300)
    .nullable()
    .transform((value) => value || null),
  paidAt: dateOnly,
  renewSubscription: z.boolean(),
});
export type PaymentInput = z.infer<typeof paymentSchema>;

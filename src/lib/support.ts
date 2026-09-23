import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export const supportPriorityLabels: Record<string, string> = {
  low: "Baixa",
  normal: "Média",
  high: "Alta",
  urgent: "Urgente",
};
export const supportStatusLabels: Record<string, string> = {
  open: "Aberto",
  in_progress: "Em Análise",
  waiting: "Aguardando Usuário",
  resolved: "Resolvido",
  closed: "Fechado",
};
export const supportCategories = [
  "Dúvidas Operacionais",
  "Financeiro e Rateio",
  "Acesso e Permissões",
  "Problemas Técnicos e Notificações",
  "Sugestão de Melhoria",
] as const;

export const listSupportTickets = createServerFn({ method: "GET" }).handler(async () =>
  (await import("@/lib/support.server")).listSupportTicketsImpl(),
);
export const getSupportThread = createServerFn({ method: "GET" })
  .validator(z.object({ ticketId: z.string().uuid() }))
  .handler(async ({ data }) => (await import("@/lib/support.server")).getSupportThreadImpl(data));
export const createSupportTicket = createServerFn({ method: "POST" })
  .validator(
    z.object({
      subject: z.string().trim().min(3).max(160),
      category: z.enum(supportCategories),
      description: z.string().trim().min(10).max(10000),
      priority: z.enum(["low", "normal", "high", "urgent"]),
      projectId: z.string().uuid().optional(),
    }),
  )
  .handler(async ({ data }) =>
    (await import("@/lib/support.server")).createSupportTicketImpl(data),
  );
export const replySupportTicket = createServerFn({ method: "POST" })
  .validator(
    z
      .object({
        ticketId: z.string().uuid(),
        body: z.string().trim().max(10000),
        status: z.enum(["open", "in_progress", "waiting", "resolved", "closed"]).optional(),
      })
      .refine(
        (value) => value.body.length > 0 || !!value.status,
        "Informe uma mensagem ou altere o status.",
      ),
  )
  .handler(async ({ data }) => (await import("@/lib/support.server")).replySupportTicketImpl(data));

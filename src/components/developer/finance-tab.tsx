import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Copy, CreditCard, ExternalLink, Link2, Pencil, RefreshCw, Wallet } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  billingCycles,
  paymentMethodLabels,
  paymentMethods,
  paymentStatusLabels,
  subscriptionStatuses,
  subscriptionStatusLabels,
  type PaymentMethod,
  type PaymentStatus,
  type SubscriptionStatus,
} from "@/lib/billing";
import {
  createCheckoutLink,
  createPortalLink,
  getFinance,
  recordPayment,
  saveSubscription,
  setPaymentStatus,
} from "@/lib/developer";
import { cn } from "@/lib/utils";
import { Badge, Empty, Metric, Panel, StatusBadge, Trend } from "./shared";
import { brl, compactBrl, dateInputValue, formatDate, selectClass } from "./format";

type Finance = Awaited<ReturnType<typeof getFinance>>;
type Row = Finance["subscriptions"][number];
type Payment = Finance["payments"][number];
const cycleLabels = { monthly: "Mensal", annual: "Anual" } as const;

const errorMessage = (error: unknown, fallback: string) => {
  if (error instanceof Error && error.message) {
    try {
      const first = (JSON.parse(error.message) as Array<{ message?: string }>)[0]?.message;
      if (first) return first;
    } catch {
      /* mensagem simples */
    }
    return error.message;
  }
  return fallback;
};

const todayInput = () => new Date().toISOString().slice(0, 10);
const addDaysInput = (days: number) =>
  new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);

function SubscriptionDialog({
  row,
  finance,
  onClose,
}: {
  row: Row;
  finance: Finance;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const plans = finance.plans.filter(
    (plan) =>
      (plan.active || plan.id === row.planId) &&
      (!plan.ownerOrganizationId || plan.ownerOrganizationId === row.organizationId),
  );
  const [state, setState] = useState({
    planId: row.planId ?? plans[0]?.id ?? "",
    status: (row.status ?? "active") as SubscriptionStatus,
    billingCycle: row.billingCycle ?? "",
    amount: row.amount === null ? "" : String(row.amount),
    startsAt: dateInputValue(row.startsAt),
    endsAt: dateInputValue(row.endsAt),
    trialEndsAt: dateInputValue(row.trialEndsAt),
    cancelAtPeriodEnd: row.cancelAtPeriodEnd,
    stripeCustomerId: row.stripeCustomerId ?? "",
    stripeSubscriptionId: row.stripeSubscriptionId ?? "",
  });
  const set = <K extends keyof typeof state>(key: K, value: (typeof state)[K]) =>
    setState((current) => ({ ...current, [key]: value }));
  const selectedPlan = plans.find((plan) => plan.id === state.planId);
  const planPrice =
    state.billingCycle === "annual"
      ? selectedPlan?.annualPrice
      : state.billingCycle === "monthly"
        ? selectedPlan?.monthlyPrice
        : null;
  const save = useMutation({
    mutationFn: () =>
      saveSubscription({
        data: {
          organizationId: row.organizationId,
          planId: state.planId,
          status: state.status,
          billingCycle:
            state.billingCycle === "" ? null : (state.billingCycle as "monthly" | "annual"),
          subscriptionAmount: state.amount === "" ? null : Number(state.amount),
          startsAt: state.startsAt || null,
          endsAt: state.endsAt || null,
          trialEndsAt: state.trialEndsAt || null,
          cancelAtPeriodEnd: state.cancelAtPeriodEnd,
          stripeCustomerId: state.stripeCustomerId || null,
          stripeSubscriptionId: state.stripeSubscriptionId || null,
        },
      }),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["developer-finance"] }),
        queryClient.invalidateQueries({ queryKey: ["developer-plans"] }),
        queryClient.invalidateQueries({ queryKey: ["developer-overview"] }),
      ]);
      toast.success("Assinatura atualizada.");
      onClose();
    },
    onError: (error) => toast.error(errorMessage(error, "Não foi possível salvar a assinatura.")),
  });

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[92vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Assinatura de {row.company}</DialogTitle>
          <DialogDescription>
            Plano, valor, vigência e situação contratada. Alterações ficam registradas na auditoria.
          </DialogDescription>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={(event: FormEvent) => {
            event.preventDefault();
            save.mutate();
          }}
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="sub-plan">Plano</Label>
              <select
                id="sub-plan"
                required
                className={cn(selectClass, "w-full")}
                value={state.planId}
                onChange={(event) => set("planId", event.target.value)}
              >
                {plans.map((plan) => (
                  <option key={plan.id} value={plan.id}>
                    {plan.name}
                    {plan.kind === "custom" ? " (personalizado)" : ""}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="sub-status">Status</Label>
              <select
                id="sub-status"
                className={cn(selectClass, "w-full")}
                value={state.status}
                onChange={(event) => set("status", event.target.value as SubscriptionStatus)}
              >
                {subscriptionStatuses.map((status) => (
                  <option key={status} value={status}>
                    {subscriptionStatusLabels[status]}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="sub-cycle">Tipo de cobrança</Label>
              <select
                id="sub-cycle"
                className={cn(selectClass, "w-full")}
                value={state.billingCycle}
                onChange={(event) => set("billingCycle", event.target.value)}
              >
                <option value="">Sem ciclo</option>
                {billingCycles.map((cycle) => (
                  <option key={cycle} value={cycle}>
                    {cycleLabels[cycle]}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="sub-amount">Valor da assinatura (R$)</Label>
              <div className="flex gap-2">
                <Input
                  id="sub-amount"
                  type="number"
                  min="0"
                  step="0.01"
                  value={state.amount}
                  onChange={(event) => set("amount", event.target.value)}
                  placeholder="0,00"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={planPrice == null}
                  onClick={() => planPrice != null && set("amount", String(planPrice))}
                  title="Usar o preço do plano para este ciclo"
                >
                  Preço do plano
                </Button>
              </div>
            </div>
            <div className="space-y-1">
              <Label htmlFor="sub-starts">Início da vigência</Label>
              <Input
                id="sub-starts"
                type="date"
                value={state.startsAt}
                onChange={(event) => set("startsAt", event.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="sub-ends">Fim da vigência</Label>
              <Input
                id="sub-ends"
                type="date"
                value={state.endsAt}
                onChange={(event) => set("endsAt", event.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="sub-trial">Fim do teste gratuito</Label>
              <div className="flex gap-2">
                <Input
                  id="sub-trial"
                  type="date"
                  value={state.trialEndsAt}
                  onChange={(event) => set("trialEndsAt", event.target.value)}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setState((current) => ({
                      ...current,
                      status: "trialing",
                      startsAt: current.startsAt || todayInput(),
                      trialEndsAt: addDaysInput(14),
                    }))
                  }
                >
                  Teste de 14 dias
                </Button>
              </div>
            </div>
            <label className="flex items-center gap-2 self-end pb-2 text-sm">
              <input
                type="checkbox"
                checked={state.cancelAtPeriodEnd}
                onChange={(event) => set("cancelAtPeriodEnd", event.target.checked)}
              />
              Cancelar ao fim da vigência (não renovar)
            </label>
          </div>
          <details className="rounded-lg border p-3 text-sm">
            <summary className="cursor-pointer font-medium">
              Vínculo com a Stripe (preenchido automaticamente pelo webhook)
            </summary>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label htmlFor="sub-customer">Cliente (cus_...)</Label>
                <Input
                  id="sub-customer"
                  value={state.stripeCustomerId}
                  onChange={(event) => set("stripeCustomerId", event.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="sub-subscription">Assinatura (sub_...)</Label>
                <Input
                  id="sub-subscription"
                  value={state.stripeSubscriptionId}
                  onChange={(event) => set("stripeSubscriptionId", event.target.value)}
                />
              </div>
            </div>
          </details>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={save.isPending || !state.planId}>
              {save.isPending ? "Salvando..." : "Salvar assinatura"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function PaymentDialog({ row, onClose }: { row: Row; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<PaymentStatus>("paid");
  const [renew, setRenew] = useState(
    row.billingCycle === "monthly" || row.billingCycle === "annual",
  );
  const save = useMutation({
    mutationFn: (form: FormData) =>
      recordPayment({
        data: {
          organizationId: row.organizationId,
          amount: Number(form.get("amount")),
          method: String(form.get("method")) as PaymentMethod,
          status,
          description: String(form.get("description") ?? "").trim() || null,
          paidAt: String(form.get("paidAt") ?? "") || null,
          renewSubscription: status === "paid" && renew,
        },
      }),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["developer-finance"] }),
        queryClient.invalidateQueries({ queryKey: ["developer-overview"] }),
      ]);
      toast.success("Pagamento registrado.");
      onClose();
    },
    onError: (error) => toast.error(errorMessage(error, "Não foi possível registrar o pagamento.")),
  });
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Registrar pagamento de {row.company}</DialogTitle>
          <DialogDescription>
            Para PIX, boleto ou transferência fora da Stripe. Pagamentos da Stripe entram sozinhos
            pelo webhook.
          </DialogDescription>
        </DialogHeader>
        <form
          className="space-y-3"
          onSubmit={(event) => {
            event.preventDefault();
            save.mutate(new FormData(event.currentTarget));
          }}
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="pay-amount">Valor (R$)</Label>
              <Input
                id="pay-amount"
                name="amount"
                type="number"
                step="0.01"
                min="0.01"
                required
                defaultValue={row.amount ?? ""}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="pay-method">Forma de pagamento</Label>
              <select
                id="pay-method"
                name="method"
                className={cn(selectClass, "w-full")}
                defaultValue="pix"
              >
                {paymentMethods.map((method) => (
                  <option key={method} value={method}>
                    {paymentMethodLabels[method]}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="pay-status">Situação</Label>
              <select
                id="pay-status"
                className={cn(selectClass, "w-full")}
                value={status}
                onChange={(event) => setStatus(event.target.value as PaymentStatus)}
              >
                <option value="paid">Pago</option>
                <option value="pending">Pendente</option>
              </select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="pay-date">Data do pagamento</Label>
              <Input id="pay-date" name="paidAt" type="date" defaultValue={todayInput()} />
            </div>
          </div>
          <div className="space-y-1">
            <Label htmlFor="pay-description">Observação</Label>
            <Input
              id="pay-description"
              name="description"
              maxLength={300}
              placeholder="Ex.: PIX referente a outubro"
            />
          </div>
          <label
            className={cn("flex items-center gap-2 text-sm", status !== "paid" && "opacity-50")}
          >
            <input
              type="checkbox"
              disabled={status !== "paid"}
              checked={renew && status === "paid"}
              onChange={(event) => setRenew(event.target.checked)}
            />
            Renovar a vigência por mais um ciclo (
            {row.billingCycle
              ? cycleLabels[row.billingCycle as "monthly" | "annual"]
              : "defina o ciclo antes"}
            )
          </label>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={save.isPending}>
              {save.isPending ? "Salvando..." : "Registrar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function StripePanel({ stripe }: { stripe: Finance["stripe"] }) {
  const copy = async (value: string) => {
    await navigator.clipboard.writeText(value);
    toast.success("Copiado.");
  };
  const ready = stripe.secretKeyConfigured && stripe.webhookSecretConfigured;
  return (
    <Panel
      title="Integração com a Stripe"
      description="A Stripe processa o pagamento e avisa o servidor; o app apenas lê o status gravado no banco."
      actions={
        <Badge tone={ready ? "good" : "warning"}>
          {ready
            ? `Conectada${stripe.mode ? ` (${stripe.mode === "live" ? "produção" : "teste"})` : ""}`
            : "Pendente de configuração"}
        </Badge>
      }
    >
      <div className="grid gap-4 lg:grid-cols-2">
        <ol className="list-decimal space-y-2 pl-5 text-sm">
          <li>
            Na Stripe, crie um <strong>produto</strong> por plano com preço <strong>mensal</strong>{" "}
            e <strong>anual</strong>, e cole os IDs <code>price_...</code> na aba Planos.
          </li>
          <li>
            No servidor, defina <code>STRIPE_SECRET_KEY</code> e <code>STRIPE_WEBHOOK_SECRET</code>{" "}
            no <code>.env</code> e reinicie o app.
          </li>
          <li>
            Em Stripe → Developers → Webhooks, cadastre o endereço abaixo com os eventos listados.
          </li>
          <li>
            Na linha da empresa, gere o <strong>link de pagamento</strong> e envie ao cliente. Ao
            pagar, a assinatura passa a <em>Ativa</em> e a vigência é renovada automaticamente.
          </li>
          <li>
            Cobrança recusada marca <em>Em atraso</em>; cancelamentos e renovações chegam sozinhos.
            O cliente gerencia cartão e faturas no <strong>portal</strong>.
          </li>
        </ol>
        <div className="space-y-3 text-sm">
          <ul className="space-y-1">
            <li className="flex items-center gap-2">
              <Badge tone={stripe.secretKeyConfigured ? "good" : "danger"}>
                {stripe.secretKeyConfigured ? "OK" : "Falta"}
              </Badge>{" "}
              STRIPE_SECRET_KEY
            </li>
            <li className="flex items-center gap-2">
              <Badge tone={stripe.webhookSecretConfigured ? "good" : "danger"}>
                {stripe.webhookSecretConfigured ? "OK" : "Falta"}
              </Badge>{" "}
              STRIPE_WEBHOOK_SECRET
            </li>
          </ul>
          <div>
            <p className="mb-1 font-medium">Endereço do webhook</p>
            {stripe.webhookUrl ? (
              <div className="flex items-center gap-2">
                <code className="min-w-0 flex-1 break-all rounded bg-muted px-2 py-1">
                  {stripe.webhookUrl}
                </code>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => void copy(stripe.webhookUrl!)}
                  aria-label="Copiar endereço do webhook"
                >
                  <Copy className="size-4" aria-hidden="true" />
                </Button>
              </div>
            ) : (
              <p className="text-muted-foreground">
                Defina APP_PUBLIC_URL (endereço público com HTTPS).
              </p>
            )}
          </div>
          <div>
            <p className="mb-1 font-medium">Eventos a habilitar</p>
            <ul className="flex flex-wrap gap-1.5">
              {stripe.events.map((event) => (
                <li key={event}>
                  <code className="rounded bg-muted px-1.5 py-0.5 text-xs">{event}</code>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </Panel>
  );
}

export function FinanceTab({ focus }: { focus?: string | undefined }) {
  const queryClient = useQueryClient();
  const { data, isPending, isFetching, error, refetch } = useQuery({
    queryKey: ["developer-finance"],
    queryFn: () => getFinance(),
    refetchInterval: 30_000,
  });
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [planFilter, setPlanFilter] = useState("");
  const [paymentFilter, setPaymentFilter] = useState("");
  const [editing, setEditing] = useState<Row | null>(null);
  const [paying, setPaying] = useState<Row | null>(null);
  const focusRef = useRef<HTMLTableRowElement | null>(null);

  useEffect(() => {
    if (focus && data) focusRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [focus, data]);

  const link = useMutation({
    mutationFn: (row: Row) =>
      createCheckoutLink({
        data: {
          organizationId: row.organizationId,
          cycle: row.billingCycle === "annual" ? "annual" : "monthly",
        },
      }),
    onSuccess: async ({ url }) => {
      await navigator.clipboard.writeText(url);
      toast.success("Link de pagamento copiado. Envie ao cliente para concluir a assinatura.");
    },
    onError: (cause) => toast.error(errorMessage(cause, "Não foi possível gerar o link.")),
  });
  const portal = useMutation({
    mutationFn: (row: Row) => createPortalLink({ data: { organizationId: row.organizationId } }),
    onSuccess: ({ url }) => window.open(url, "_blank", "noopener,noreferrer"),
    onError: (cause) => toast.error(errorMessage(cause, "Não foi possível abrir o portal.")),
  });
  const changeStatus = useMutation({
    mutationFn: (input: { id: string; status: "paid" | "failed" | "refunded" }) =>
      setPaymentStatus({ data: input }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["developer-finance"] });
      toast.success("Pagamento atualizado.");
    },
    onError: (cause) => toast.error(errorMessage(cause, "Não foi possível alterar o pagamento.")),
  });

  const rows = useMemo(() => {
    if (!data) return [];
    const term = search.trim().toLowerCase();
    return data.subscriptions.filter(
      (row) =>
        (!term ||
          row.company.toLowerCase().includes(term) ||
          row.adminEmail.toLowerCase().includes(term)) &&
        (!statusFilter ||
          (statusFilter === "none"
            ? !row.effectiveStatus
            : row.effectiveStatus === statusFilter)) &&
        (!planFilter || row.planId === planFilter),
    );
  }, [data, search, statusFilter, planFilter]);

  if (isPending) return <p className="p-4 text-muted-foreground">Carregando financeiro…</p>;
  if (error || !data) return <Empty>Não foi possível carregar o financeiro.</Empty>;
  const { kpis } = data;
  const payments = data.payments.filter(
    (payment) => !paymentFilter || payment.status === paymentFilter,
  );

  return (
    <div className="space-y-6">
      <section
        aria-label="Indicadores financeiros"
        className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"
      >
        <Metric
          title="MRR"
          value={brl(kpis.mrr)}
          hint={`ARR ${compactBrl(kpis.arr)} · ticket médio ${brl(kpis.averageTicket)}`}
        />
        <Metric
          title="Recebido no mês"
          value={brl(kpis.receivedThisMonth)}
          hint={<Trend current={kpis.receivedThisMonth} previous={kpis.receivedLastMonth} />}
        />
        <Metric
          title="Em atraso"
          value={kpis.pastDue}
          tone={kpis.pastDue > 0 ? "danger" : "good"}
          hint={`${brl(kpis.atRiskMrr)}/mês em risco · ${kpis.failedLast30} cobrança(s) recusada(s) em 30 dias`}
          onClick={() => setStatusFilter("past_due")}
        />
        <Metric
          title="A vencer em 30 dias"
          value={brl(kpis.upcomingAmount30)}
          hint={`${kpis.upcomingCount30} renovação(ões) · ${brl(kpis.pendingAmount)} pendente(s)`}
        />
        <Metric
          title="Assinaturas ativas"
          value={kpis.activeSubscriptions}
          hint={`${kpis.trialing} em teste · ${kpis.expired} vencida(s)`}
          onClick={() => setStatusFilter("active")}
        />
        <Metric
          title="Cancelamentos (90 dias)"
          value={kpis.canceledLast90}
          tone={kpis.canceledLast90 > 0 ? "warning" : "default"}
          hint={`${kpis.canceled} cancelada(s) no total`}
          onClick={() => setStatusFilter("canceled")}
        />
        <Metric
          title="Potencial dos testes"
          value={`${brl(kpis.trialPotentialMrr)}/mês`}
          hint="Se todos os testes virarem assinatura"
          onClick={() => setStatusFilter("trialing")}
        />
        <Metric
          title="Empresas sem plano"
          value={kpis.withoutPlan}
          tone={kpis.withoutPlan > 0 ? "warning" : "good"}
          hint="Sem limites nem cobrança definidos"
          onClick={() => setStatusFilter("none")}
        />
      </section>

      <StripePanel stripe={data.stripe} />

      <Panel
        title="Clientes e assinaturas"
        description="Plano contratado, tipo, valor, vigência e situação de cada empresa."
        actions={
          <Button variant="outline" size="sm" onClick={() => void refetch()} disabled={isFetching}>
            <RefreshCw className={cn("size-4", isFetching && "animate-spin")} aria-hidden="true" />{" "}
            Atualizar
          </Button>
        }
      >
        <div className="mb-3 grid gap-2 sm:grid-cols-3">
          <Input
            aria-label="Buscar empresa"
            placeholder="Buscar empresa ou e-mail…"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          <select
            aria-label="Filtrar por status"
            className={selectClass}
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
          >
            <option value="">Todos os status</option>
            {subscriptionStatuses.map((status) => (
              <option key={status} value={status}>
                {subscriptionStatusLabels[status]}
              </option>
            ))}
            <option value="none">Sem plano</option>
          </select>
          <select
            aria-label="Filtrar por plano"
            className={selectClass}
            value={planFilter}
            onChange={(event) => setPlanFilter(event.target.value)}
          >
            <option value="">Todos os planos</option>
            {data.plans.map((plan) => (
              <option key={plan.id} value={plan.id}>
                {plan.name}
              </option>
            ))}
          </select>
        </div>
        {rows.length === 0 ? (
          <Empty>Nenhuma empresa encontrada.</Empty>
        ) : (
          <div
            className="table-scroll overflow-x-auto"
            role="region"
            aria-label="Tabela de assinaturas"
            tabIndex={0}
          >
            <table className="w-full min-w-[980px] text-left text-sm">
              <thead className="text-xs uppercase text-muted-foreground">
                <tr className="border-b">
                  <th className="p-2 font-medium">Empresa</th>
                  <th className="p-2 font-medium">Plano</th>
                  <th className="p-2 font-medium">Tipo</th>
                  <th className="p-2 font-medium">Valor</th>
                  <th className="p-2 font-medium">Vigência</th>
                  <th className="p-2 font-medium">Status</th>
                  <th className="p-2 font-medium">Pagamentos</th>
                  <th className="p-2 text-right font-medium">Ações</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr
                    key={row.organizationId}
                    ref={row.organizationId === focus ? focusRef : undefined}
                    className={cn(
                      "border-b align-top last:border-0",
                      row.organizationId === focus && "bg-primary-soft",
                    )}
                  >
                    <td className="p-2">
                      <span className="block font-medium">{row.company}</span>
                      <span className="block text-xs text-muted-foreground">{row.adminEmail}</span>
                    </td>
                    <td className="p-2">
                      {row.planName ?? <span className="text-muted-foreground">—</span>}
                      {row.planKind === "custom" ? <Badge tone="brand">Personalizado</Badge> : null}
                    </td>
                    <td className="p-2">
                      {row.billingCycle
                        ? cycleLabels[row.billingCycle as "monthly" | "annual"]
                        : "—"}
                    </td>
                    <td className="p-2 tabular-nums">
                      {row.amount !== null ? brl(row.amount) : "—"}
                    </td>
                    <td className="p-2">
                      <span className="block whitespace-nowrap">
                        {formatDate(row.startsAt)} → {formatDate(row.endsAt)}
                      </span>
                      {row.effectiveStatus === "trialing" && row.trialEndsAt ? (
                        <span className="block text-xs text-muted-foreground">
                          Teste até {formatDate(row.trialEndsAt)}
                        </span>
                      ) : row.daysToEnd !== null && row.effectiveStatus !== "canceled" ? (
                        <span
                          className={cn(
                            "block text-xs",
                            row.daysToEnd < 0
                              ? "text-red-600"
                              : row.daysToEnd <= 7
                                ? "text-amber-600"
                                : "text-muted-foreground",
                          )}
                        >
                          {row.daysToEnd < 0
                            ? `venceu há ${Math.abs(row.daysToEnd)} dia(s)`
                            : `${row.daysToEnd} dia(s) restantes`}
                        </span>
                      ) : null}
                    </td>
                    <td className="p-2">
                      <StatusBadge status={row.effectiveStatus} />
                      {row.cancelAtPeriodEnd ? (
                        <span className="mt-1 block text-xs text-amber-600">Não renova</span>
                      ) : null}
                      {row.stripeSubscriptionId ? (
                        <span className="mt-1 block text-xs text-muted-foreground">
                          Stripe vinculada
                        </span>
                      ) : null}
                    </td>
                    <td className="p-2">
                      <span className="block tabular-nums">{brl(row.totalPaid)}</span>
                      <span className="block text-xs text-muted-foreground">
                        {row.lastPaymentAt
                          ? `último em ${formatDate(row.lastPaymentAt)}`
                          : "sem pagamentos"}
                        {row.failedPayments ? ` · ${row.failedPayments} recusado(s)` : ""}
                      </span>
                    </td>
                    <td className="p-2">
                      <div className="flex flex-wrap justify-end gap-1">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setEditing(row)}
                          aria-label={`Editar assinatura de ${row.company}`}
                        >
                          <Pencil className="size-4" aria-hidden="true" /> Editar
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setPaying(row)}
                          disabled={!row.planId}
                          aria-label={`Registrar pagamento de ${row.company}`}
                        >
                          <Wallet className="size-4" aria-hidden="true" /> Pagamento
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={
                            !row.planId ||
                            !data.stripe.secretKeyConfigured ||
                            !row.hasStripePrice ||
                            link.isPending
                          }
                          title={
                            !data.stripe.secretKeyConfigured
                              ? "Configure a Stripe"
                              : !row.hasStripePrice
                                ? "Informe o ID de preço da Stripe no plano"
                                : "Copiar link de pagamento"
                          }
                          onClick={() => link.mutate(row)}
                          aria-label={`Gerar link de pagamento de ${row.company}`}
                        >
                          <Link2 className="size-4" aria-hidden="true" /> Link
                        </Button>
                        {row.stripeCustomerId ? (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => portal.mutate(row)}
                            disabled={portal.isPending}
                            aria-label={`Abrir portal do cliente ${row.company}`}
                          >
                            <ExternalLink className="size-4" aria-hidden="true" /> Portal
                          </Button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <Panel
        title="Pagamentos"
        description="Últimos 200 lançamentos, da Stripe e manuais."
        actions={
          <select
            aria-label="Filtrar pagamentos por situação"
            className={selectClass}
            value={paymentFilter}
            onChange={(event) => setPaymentFilter(event.target.value)}
          >
            <option value="">Todas as situações</option>
            {Object.entries(paymentStatusLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        }
      >
        {payments.length === 0 ? (
          <Empty>Nenhum pagamento registrado.</Empty>
        ) : (
          <div
            className="table-scroll overflow-x-auto"
            role="region"
            aria-label="Tabela de pagamentos"
            tabIndex={0}
          >
            <table className="w-full min-w-[820px] text-left text-sm">
              <thead className="text-xs uppercase text-muted-foreground">
                <tr className="border-b">
                  <th className="p-2 font-medium">Data</th>
                  <th className="p-2 font-medium">Empresa</th>
                  <th className="p-2 font-medium">Valor</th>
                  <th className="p-2 font-medium">Forma</th>
                  <th className="p-2 font-medium">Situação</th>
                  <th className="p-2 font-medium">Origem</th>
                  <th className="p-2 font-medium">Detalhes</th>
                  <th className="p-2 text-right font-medium">Ações</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((payment: Payment) => (
                  <tr key={payment.id} className="border-b align-top last:border-0">
                    <td className="whitespace-nowrap p-2">
                      {formatDate(payment.paidAt ?? payment.createdAt)}
                    </td>
                    <td className="p-2">{payment.company}</td>
                    <td className="p-2 tabular-nums">{brl(payment.amount)}</td>
                    <td className="p-2">
                      {payment.method
                        ? (paymentMethodLabels[payment.method as PaymentMethod] ?? payment.method)
                        : "—"}
                    </td>
                    <td className="p-2">
                      <Badge
                        tone={
                          payment.status === "paid"
                            ? "good"
                            : payment.status === "failed"
                              ? "danger"
                              : payment.status === "pending"
                                ? "warning"
                                : "muted"
                        }
                      >
                        {paymentStatusLabels[payment.status as PaymentStatus] ?? payment.status}
                      </Badge>
                    </td>
                    <td className="p-2">
                      <span className="inline-flex items-center gap-1">
                        <CreditCard className="size-3.5" aria-hidden="true" />{" "}
                        {payment.source === "stripe" ? "Stripe" : "Manual"}
                      </span>
                    </td>
                    <td className="p-2 text-xs text-muted-foreground">
                      {payment.description ?? ""}
                      {payment.periodEnd ? ` · período até ${formatDate(payment.periodEnd)}` : ""}
                    </td>
                    <td className="p-2">
                      <div className="flex justify-end gap-1">
                        {payment.status === "pending" ? (
                          <>
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={changeStatus.isPending}
                              onClick={() =>
                                changeStatus.mutate({ id: payment.id, status: "paid" })
                              }
                            >
                              Marcar pago
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              disabled={changeStatus.isPending}
                              onClick={() =>
                                changeStatus.mutate({ id: payment.id, status: "failed" })
                              }
                            >
                              Falhou
                            </Button>
                          </>
                        ) : null}
                        {payment.status === "paid" ? (
                          <Button
                            size="sm"
                            variant="ghost"
                            disabled={changeStatus.isPending}
                            onClick={() =>
                              changeStatus.mutate({ id: payment.id, status: "refunded" })
                            }
                          >
                            Marcar estornado
                          </Button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      {editing ? (
        <SubscriptionDialog
          key={editing.organizationId}
          row={editing}
          finance={data}
          onClose={() => setEditing(null)}
        />
      ) : null}
      {paying ? (
        <PaymentDialog key={paying.organizationId} row={paying} onClose={() => setPaying(null)} />
      ) : null}
    </div>
  );
}

import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, Check, CheckCircle2, Loader2 } from "lucide-react";
import { z } from "zod";
import { OnboardingShell } from "@/components/onboarding-shell";
import { Button } from "@/components/ui/button";
import { TRIAL_DAYS } from "@/lib/access";
import { authClient } from "@/lib/auth-client";
import { formatBRL } from "@/lib/format-currency";
import { getPlansCatalog, openBillingPortal, startCheckout } from "@/lib/onboarding";
import { showValidationAlert } from "@/lib/validation-feedback";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/planos")({
  ssr: false,
  validateSearch: z.object({
    boasvindas: z.string().optional(),
    checkout: z.enum(["sucesso", "cancelado"]).optional(),
  }),
  head: () => ({ meta: [{ title: "Planos | ArremataFlow" }] }),
  component: PlansPage,
});

type Catalog = Awaited<ReturnType<typeof getPlansCatalog>>;
type CatalogPlan = Catalog["plans"][number];

const dateLabel = (value: string | null) =>
  value ? new Intl.DateTimeFormat("pt-BR", { dateStyle: "long" }).format(new Date(value)) : "";

const limitLabel = (value: number | null, singular: string, plural: string) =>
  value === null ? `${plural} ilimitados` : `Até ${value} ${value === 1 ? singular : plural}`;

function PlansPage() {
  const { boasvindas, checkout } = Route.useSearch();
  const [cycle, setCycle] = useState<"monthly" | "annual">("monthly");
  const [pending, setPending] = useState<string | null>(null);
  const catalog = useQuery({
    queryKey: ["plans-catalog"],
    queryFn: () => getPlansCatalog(),
    // Após o pagamento, a Stripe avisa o servidor pelo webhook; consulta até refletir.
    refetchInterval: (query) =>
      checkout === "sucesso" && !query.state.data?.current?.hasStripeCustomer ? 3000 : false,
  });
  const data = catalog.data;
  const current = data?.current ?? null;
  const blocked = current ? !current.allowed : false;

  const run = async (key: string, action: () => Promise<{ url: string }>) => {
    setPending(key);
    try {
      const { url } = await action();
      window.location.href = url;
    } catch (error) {
      showValidationAlert(error, "Não foi possível abrir o pagamento agora.");
      setPending(null);
    }
  };

  return (
    <OnboardingShell
      wide
      actions={
        <div className="flex items-center gap-2">
          {current?.allowed ? (
            <Button asChild variant="outline" size="sm">
              <Link to="/projetos">Ir para o sistema</Link>
            </Button>
          ) : null}
          <Button
            variant="ghost"
            size="sm"
            onClick={async () => {
              await authClient.signOut();
              location.href = "/";
            }}
          >
            Sair
          </Button>
        </div>
      }
    >
      <div className="mb-8 max-w-2xl space-y-2">
        <h1 className="text-3xl font-semibold">Escolha seu plano</h1>
        <p className="text-muted-foreground">
          Todos os planos incluem o painel completo de gestão do pós-arremate. Compare o que cada um
          contempla e assine quando quiser.
        </p>
      </div>

      {checkout === "sucesso" ? (
        <Banner tone="good" icon={<Loader2 className="size-4 animate-spin" />}>
          Pagamento recebido. Estamos confirmando com a Stripe; isso leva alguns segundos.
          {current?.hasStripeCustomer ? " Assinatura confirmada!" : ""}
        </Banner>
      ) : null}
      {checkout === "cancelado" ? (
        <Banner tone="warning" icon={<AlertTriangle className="size-4" />}>
          O pagamento foi cancelado. Você pode escolher um plano novamente quando quiser.
        </Banner>
      ) : null}
      {blocked ? (
        <Banner tone="danger" icon={<AlertTriangle className="size-4" />}>
          {current?.reason === "canceled"
            ? "A assinatura da empresa foi cancelada."
            : current?.reason === "paused"
              ? "A assinatura da empresa está pausada."
              : "O período da assinatura terminou e o prazo de renovação acabou."}{" "}
          {data?.canManage
            ? "Escolha um plano abaixo para liberar o acesso novamente."
            : "Peça ao administrador da sua empresa para renovar o plano."}
        </Banner>
      ) : null}
      {current?.reason === "grace" ? (
        <Banner tone="warning" icon={<AlertTriangle className="size-4" />}>
          Sua assinatura venceu. Renove até {dateLabel(current.graceEndsAt)} para não perder o
          acesso.
        </Banner>
      ) : null}
      {boasvindas && current?.status === "trialing" && !blocked ? (
        <Banner tone="good" icon={<CheckCircle2 className="size-4" />}>
          Seu teste de {TRIAL_DAYS} dias do plano {current.planName} já está ativo, até{" "}
          {dateLabel(current.expiresAt)}. Você pode começar a usar agora e assinar quando quiser.
        </Banner>
      ) : null}
      {current?.status === "trialing" && !boasvindas && !blocked && current.reason === "ok" ? (
        <Banner tone="info" icon={<CheckCircle2 className="size-4" />}>
          Teste gratuito do plano {current.planName}: restam {Math.max(current.daysLeft ?? 0, 0)}{" "}
          dia(s), até {dateLabel(current.expiresAt)}.
        </Banner>
      ) : null}

      {data && !data.hasOrganization ? (
        <Banner tone="warning" icon={<AlertTriangle className="size-4" />}>
          Sua conta não está vinculada a uma empresa ativa. Fale com o administrador.
        </Banner>
      ) : null}

      <div className="mb-6 inline-flex rounded-lg border bg-card p-1 text-sm">
        {(
          [
            ["monthly", "Mensal"],
            ["annual", "Anual"],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            onClick={() => setCycle(value)}
            className={cn(
              "rounded-md px-4 py-1.5 transition-colors",
              cycle === value ? "bg-primary text-primary-foreground" : "hover:bg-accent",
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {catalog.isPending ? (
        <p className="text-sm text-muted-foreground">Carregando planos…</p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {(data?.plans ?? []).map((plan) => (
            <PlanCard
              key={plan.id}
              plan={plan}
              cycle={cycle}
              isCurrent={current?.planId === plan.id}
              canManage={Boolean(data?.canManage)}
              busy={pending === plan.id}
              onChoose={() =>
                run(plan.id, () => startCheckout({ data: { planId: plan.id, cycle } }))
              }
            />
          ))}
        </div>
      )}

      {data?.canManage && current?.hasStripeCustomer ? (
        <div className="mt-8 rounded-xl border bg-card p-4 text-sm">
          <p className="font-medium">Já é assinante?</p>
          <p className="mb-3 text-muted-foreground">
            Troque de plano, atualize o cartão, veja faturas ou cancele no portal seguro da Stripe.
          </p>
          <Button
            variant="outline"
            disabled={pending === "portal"}
            onClick={() => run("portal", () => openBillingPortal())}
          >
            {pending === "portal" ? <Loader2 className="size-4 animate-spin" /> : null}
            Gerenciar assinatura
          </Button>
        </div>
      ) : null}
      <p className="mt-8 text-xs text-muted-foreground">
        Planos personalizados para a sua operação? Fale com a nossa equipe.
      </p>
    </OnboardingShell>
  );
}

function Banner({
  tone,
  icon,
  children,
}: {
  tone: "good" | "warning" | "danger" | "info";
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  const tones = {
    good: "border-emerald-200 bg-emerald-50 text-emerald-900",
    warning: "border-amber-200 bg-amber-50 text-amber-900",
    danger: "border-red-200 bg-red-50 text-red-900",
    info: "border-sky-200 bg-sky-50 text-sky-900",
  } as const;
  return (
    <div className={cn("mb-4 flex items-start gap-2 rounded-lg border p-3 text-sm", tones[tone])}>
      <span className="mt-0.5 shrink-0">{icon}</span>
      <p>{children}</p>
    </div>
  );
}

function PlanCard({
  plan,
  cycle,
  isCurrent,
  canManage,
  busy,
  onChoose,
}: {
  plan: CatalogPlan;
  cycle: "monthly" | "annual";
  isCurrent: boolean;
  canManage: boolean;
  busy: boolean;
  onChoose: () => void;
}) {
  const price = cycle === "annual" ? plan.annualPrice : plan.monthlyPrice;
  const available = cycle === "annual" ? plan.cycles.annual : plan.cycles.monthly;
  const features = [
    limitLabel(plan.maxActiveProjects, "projeto ativo", "projetos ativos"),
    limitLabel(plan.maxInvestors, "investidor", "investidores"),
    limitLabel(plan.maxAdvisors, "assessor", "assessores"),
    limitLabel(plan.maxProjectManagers, "gestor de projetos", "gestores de projetos"),
  ];
  return (
    <section
      className={cn(
        "flex flex-col rounded-xl border bg-card p-5",
        isCurrent && "border-brand ring-1 ring-brand",
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-xl font-semibold">{plan.name}</h2>
        {isCurrent ? (
          <span className="rounded-full bg-primary-soft px-2 py-0.5 text-xs font-medium text-brand">
            Seu plano
          </span>
        ) : null}
      </div>
      {plan.description ? (
        <p className="mt-1 text-sm text-muted-foreground">{plan.description}</p>
      ) : null}
      <p className="mt-4 text-3xl font-semibold tabular-nums">
        {price === null ? "Sob consulta" : formatBRL(price)}
        {price === null ? null : (
          <span className="text-sm font-normal text-muted-foreground">
            {cycle === "annual" ? " /ano" : " /mês"}
          </span>
        )}
      </p>
      {cycle === "annual" && plan.annualPrice ? (
        <p className="text-xs text-muted-foreground">
          equivale a {formatBRL(plan.annualPrice / 12)} por mês
        </p>
      ) : null}
      <ul className="mt-4 flex-1 space-y-2 text-sm">
        {features.map((feature) => (
          <Feature key={feature}>{feature}</Feature>
        ))}
        {plan.menuItems.length ? <Feature>Menus: {plan.menuItems.join(", ")}</Feature> : null}
        {plan.projectTabs.length ? (
          <Feature>Abas do projeto: {plan.projectTabs.join(", ")}</Feature>
        ) : null}
        {plan.advisoryModalities.length ? (
          <Feature>Assessoria: {plan.advisoryModalities.join(", ")}</Feature>
        ) : null}
      </ul>
      <Button
        className="mt-5 w-full"
        disabled={!canManage || !available || busy || price === null}
        onClick={onChoose}
      >
        {busy ? <Loader2 className="size-4 animate-spin" /> : null}
        {!canManage
          ? "Somente o administrador"
          : !available
            ? "Indisponível no momento"
            : isCurrent
              ? "Assinar este plano"
              : `Assinar ${plan.name}`}
      </Button>
    </section>
  );
}

function Feature({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2">
      <Check className="mt-0.5 size-4 shrink-0 text-emerald-600" aria-hidden="true" />
      <span>{children}</span>
    </li>
  );
}

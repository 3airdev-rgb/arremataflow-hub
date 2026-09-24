import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, CircleDashed, Pencil, Plus, Power, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
  createPlan,
  deletePlan,
  getPlansOverview,
  setPlanActive,
  updatePlan,
} from "@/lib/developer";
import {
  menuOptions,
  modalityLabels,
  modalityOptions,
  projectTabOptions,
  type PlanFields,
} from "@/lib/developer-schemas";
import { cn } from "@/lib/utils";
import { Badge, Empty, Panel } from "./shared";
import { brl, selectClass } from "./format";

type PlanRow = Awaited<ReturnType<typeof getPlansOverview>>["plans"][number];
type Company = Awaited<ReturnType<typeof getPlansOverview>>["companies"][number];
const filters = [
  { key: "all", label: "Todos" },
  { key: "standard", label: "Padrão" },
  { key: "custom", label: "Personalizados" },
  { key: "inactive", label: "Inativos" },
] as const;

const errorMessage = (error: unknown, fallback: string) => {
  if (error instanceof Error && error.message) {
    try {
      const parsed = JSON.parse(error.message) as Array<{ message?: string }>;
      const first = parsed[0]?.message;
      if (first) return first;
    } catch {
      /* mensagem simples */
    }
    return error.message;
  }
  return fallback;
};

const limitText = (value: number | null) => (value === null ? "sem limite" : String(value));

function PlanFormDialog({
  plan,
  companies,
  open,
  onOpenChange,
}: {
  plan: PlanRow | null;
  companies: Company[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const [kind, setKind] = useState<"standard" | "custom">(
    plan?.kind === "standard" ? "standard" : "custom",
  );
  const builtIn = plan?.builtIn ?? false;
  const save = useMutation({
    mutationFn: async (data: PlanFields) =>
      plan ? updatePlan({ data: { ...data, id: plan.id } }) : createPlan({ data }),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["developer-plans"] }),
        queryClient.invalidateQueries({ queryKey: ["developer-finance"] }),
        queryClient.invalidateQueries({ queryKey: ["developer-overview"] }),
      ]);
      toast.success(plan ? "Plano atualizado." : "Plano criado.");
      onOpenChange(false);
    },
    onError: (error) => toast.error(errorMessage(error, "Não foi possível salvar o plano.")),
  });

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const text = (name: string) => String(form.get(name) ?? "").trim();
    const nullableNumber = (name: string) => (text(name) === "" ? null : Number(text(name)));
    const owner = text("ownerOrganizationId");
    save.mutate({
      name: text("name"),
      description: text("description") || null,
      kind,
      ownerOrganizationId: kind === "custom" && owner ? owner : null,
      monthlyPrice: nullableNumber("monthlyPrice"),
      annualPrice: nullableNumber("annualPrice"),
      maxActiveProjects: nullableNumber("maxActiveProjects"),
      maxInvestors: nullableNumber("maxInvestors"),
      maxAdvisors: nullableNumber("maxAdvisors"),
      maxProjectManagers: nullableNumber("maxProjectManagers"),
      firstResponseHours: Number(text("firstResponseHours")),
      resolutionHours: Number(text("resolutionHours")),
      menuItems: menuOptions.filter((value) => form.has(`menu:${value}`)),
      advisoryModalities: modalityOptions.filter((value) => form.has(`modal:${value}`)),
      projectTabs: projectTabOptions.filter((value) => form.has(`tab:${value}`)),
      stripeMonthlyPriceId: text("stripeMonthlyPriceId") || null,
      stripeAnnualPriceId: text("stripeAnnualPriceId") || null,
    });
  };

  const number = (
    name: string,
    label: string,
    value: number | null,
    step = "1",
    placeholder = "Sem limite",
  ) => (
    <div className="min-w-0 space-y-1">
      <Label htmlFor={`plan-${name}`}>{label}</Label>
      <Input
        id={`plan-${name}`}
        name={name}
        type="number"
        min="0"
        step={step}
        defaultValue={value ?? ""}
        placeholder={placeholder}
      />
    </div>
  );
  const checks = (
    title: string,
    prefix: string,
    options: string[],
    selected: string[],
    labels?: Record<string, string>,
  ) => (
    <fieldset className="min-w-0 space-y-1">
      <legend className="mb-1 text-sm font-medium">{title}</legend>
      {options.map((option) => (
        <label key={option} className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            name={`${prefix}:${option}`}
            defaultChecked={plan ? selected.includes(option) : true}
          />
          {labels?.[option] ?? option}
        </label>
      ))}
    </fieldset>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{plan ? `Editar plano: ${plan.name}` : "Novo plano"}</DialogTitle>
          <DialogDescription>
            Deixe um limite em branco para não limitar. Planos personalizados podem ser exclusivos
            de uma empresa.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-5">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1 sm:col-span-2">
              <Label htmlFor="plan-name">Nome do plano</Label>
              <Input
                id="plan-name"
                name="name"
                required
                minLength={2}
                maxLength={80}
                defaultValue={plan?.name ?? ""}
                placeholder="Ex.: Plano Marcon & Garcia"
              />
            </div>
            <div className="space-y-1 sm:col-span-2">
              <Label htmlFor="plan-description">Descrição (interna)</Label>
              <Input
                id="plan-description"
                name="description"
                maxLength={500}
                defaultValue={plan?.description ?? ""}
                placeholder="Condições combinadas com o cliente"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="plan-kind">Tipo</Label>
              <select
                id="plan-kind"
                className={cn(selectClass, "w-full")}
                value={kind}
                disabled={builtIn}
                onChange={(event) => setKind(event.target.value as "standard" | "custom")}
              >
                <option value="custom">Personalizado (por cliente)</option>
                <option value="standard">Padrão (catálogo)</option>
              </select>
            </div>
            {kind === "custom" ? (
              <div className="space-y-1">
                <Label htmlFor="plan-owner">Exclusivo da empresa</Label>
                <select
                  id="plan-owner"
                  name="ownerOrganizationId"
                  className={cn(selectClass, "w-full")}
                  defaultValue={plan?.ownerOrganizationId ?? ""}
                  disabled={builtIn}
                >
                  <option value="">Qualquer empresa</option>
                  {companies.map((company) => (
                    <option key={company.id} value={company.id}>
                      {company.name}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {number(
              "monthlyPrice",
              "Preço mensal (R$)",
              plan?.monthlyPrice ?? null,
              "0.01",
              "Não definido",
            )}
            {number(
              "annualPrice",
              "Preço anual (R$)",
              plan?.annualPrice ?? null,
              "0.01",
              "Não definido",
            )}
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {number("maxActiveProjects", "Projetos ativos", plan?.maxActiveProjects ?? null)}
            {number("maxProjectManagers", "Gestores de projeto", plan?.maxProjectManagers ?? null)}
            {number("maxInvestors", "Investidores", plan?.maxInvestors ?? null)}
            {number("maxAdvisors", "Assessores", plan?.maxAdvisors ?? null)}
            {number(
              "firstResponseHours",
              "Prazo da 1ª resposta (horas)",
              plan?.firstResponseHours ?? 24,
              "1",
              "24",
            )}
            {number(
              "resolutionHours",
              "Prazo da solução (horas)",
              plan?.resolutionHours ?? 72,
              "1",
              "72",
            )}
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="plan-stripe-monthly">ID do preço mensal na Stripe</Label>
              <Input
                id="plan-stripe-monthly"
                name="stripeMonthlyPriceId"
                placeholder="price_..."
                defaultValue={plan?.stripeMonthlyPriceId ?? ""}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="plan-stripe-annual">ID do preço anual na Stripe</Label>
              <Input
                id="plan-stripe-annual"
                name="stripeAnnualPriceId"
                placeholder="price_..."
                defaultValue={plan?.stripeAnnualPriceId ?? ""}
              />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            {checks("Menu", "menu", menuOptions, plan?.menuItems ?? [])}
            {checks(
              "Modalidades",
              "modal",
              modalityOptions,
              plan?.advisoryModalities ?? [],
              modalityLabels,
            )}
            {checks("Abas do projeto", "tab", projectTabOptions, plan?.projectTabs ?? [])}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={save.isPending}>
              {save.isPending ? "Salvando..." : plan ? "Salvar plano" : "Criar plano"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function PlansTab() {
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<(typeof filters)[number]["key"]>("all");
  const [editing, setEditing] = useState<PlanRow | "new" | null>(null);
  const [deleting, setDeleting] = useState<PlanRow | null>(null);
  const { data, isPending, error } = useQuery({
    queryKey: ["developer-plans"],
    queryFn: () => getPlansOverview(),
  });
  const refresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["developer-plans"] }),
      queryClient.invalidateQueries({ queryKey: ["developer-finance"] }),
      queryClient.invalidateQueries({ queryKey: ["developer-overview"] }),
    ]);
  };
  const toggleActive = useMutation({
    mutationFn: (plan: PlanRow) => setPlanActive({ data: { id: plan.id, active: !plan.active } }),
    onSuccess: async () => {
      await refresh();
      toast.success("Plano atualizado.");
    },
    onError: (cause) => toast.error(errorMessage(cause, "Não foi possível alterar o plano.")),
  });
  const remove = useMutation({
    mutationFn: (plan: PlanRow) => deletePlan({ data: { id: plan.id } }),
    onSuccess: async () => {
      await refresh();
      setDeleting(null);
      toast.success("Plano excluído.");
    },
    onError: (cause) => toast.error(errorMessage(cause, "Não foi possível excluir o plano.")),
  });

  if (isPending) return <p className="p-4 text-muted-foreground">Carregando planos…</p>;
  if (error || !data) return <Empty>Não foi possível carregar os planos.</Empty>;

  const visible = data.plans.filter((plan) =>
    filter === "all"
      ? true
      : filter === "inactive"
        ? !plan.active
        : filter === "standard"
          ? plan.kind === "standard"
          : plan.kind === "custom",
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div
          className="inline-flex flex-wrap rounded-lg border bg-card p-1 text-sm"
          role="group"
          aria-label="Filtrar planos"
        >
          {filters.map((item) => (
            <button
              key={item.key}
              type="button"
              aria-pressed={filter === item.key}
              onClick={() => setFilter(item.key)}
              className={cn(
                "min-h-9 rounded-md px-3 font-medium",
                filter === item.key
                  ? "bg-brand text-brand-foreground"
                  : "text-muted-foreground hover:bg-accent",
              )}
            >
              {item.label}
            </button>
          ))}
        </div>
        <Button onClick={() => setEditing("new")}>
          <Plus className="size-4" aria-hidden="true" /> Novo plano
        </Button>
      </div>

      {visible.length === 0 ? (
        <Empty>Nenhum plano neste filtro.</Empty>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {visible.map((plan) => (
            <Panel
              key={plan.id}
              title={plan.name}
              description={plan.description ?? undefined}
              className={cn(!plan.active && "opacity-70")}
              actions={
                <div className="flex flex-wrap justify-end gap-1">
                  <Badge tone={plan.kind === "custom" ? "brand" : "info"}>
                    {plan.kind === "custom" ? "Personalizado" : "Padrão"}
                  </Badge>
                  {!plan.active ? <Badge tone="warning">Inativo</Badge> : null}
                </div>
              }
            >
              <dl className="space-y-1.5 text-sm">
                {plan.ownerName ? (
                  <div className="flex justify-between gap-2">
                    <dt className="text-muted-foreground">Exclusivo de</dt>
                    <dd className="text-right font-medium">{plan.ownerName}</dd>
                  </div>
                ) : null}
                <div className="flex justify-between gap-2">
                  <dt className="text-muted-foreground">Preço</dt>
                  <dd className="text-right">
                    {plan.monthlyPrice !== null ? `${brl(plan.monthlyPrice)}/mês` : "—"}
                    {plan.annualPrice !== null ? ` · ${brl(plan.annualPrice)}/ano` : ""}
                  </dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-muted-foreground">Limites</dt>
                  <dd className="text-right">
                    Projetos {limitText(plan.maxActiveProjects)} · Inv.{" "}
                    {limitText(plan.maxInvestors)} · Ass. {limitText(plan.maxAdvisors)} · Gest.{" "}
                    {limitText(plan.maxProjectManagers)}
                  </dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-muted-foreground">Suporte</dt>
                  <dd>
                    {plan.firstResponseHours} h / {plan.resolutionHours} h
                  </dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-muted-foreground">Stripe</dt>
                  <dd className="flex gap-2">
                    {[
                      ["mensal", plan.stripeMonthlyPriceId],
                      ["anual", plan.stripeAnnualPriceId],
                    ].map(([label, id]) => (
                      <span key={label} className="inline-flex items-center gap-1">
                        {id ? (
                          <CheckCircle2 className="size-3.5 text-emerald-600" aria-hidden="true" />
                        ) : (
                          <CircleDashed
                            className="size-3.5 text-muted-foreground"
                            aria-hidden="true"
                          />
                        )}
                        {label}
                      </span>
                    ))}
                  </dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-muted-foreground">Empresas</dt>
                  <dd className="font-medium">{plan.companyCount}</dd>
                </div>
              </dl>
              <div className="mt-4 flex flex-wrap gap-2">
                <Button size="sm" variant="outline" onClick={() => setEditing(plan)}>
                  <Pencil className="size-4" aria-hidden="true" /> Editar
                </Button>
                {!plan.builtIn ? (
                  <>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={toggleActive.isPending}
                      onClick={() => toggleActive.mutate(plan)}
                    >
                      <Power className="size-4" aria-hidden="true" />{" "}
                      {plan.active ? "Desativar" : "Ativar"}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-destructive hover:text-destructive"
                      disabled={plan.companyCount > 0}
                      title={plan.companyCount > 0 ? "Há empresas neste plano" : undefined}
                      onClick={() => setDeleting(plan)}
                    >
                      <Trash2 className="size-4" aria-hidden="true" /> Excluir
                    </Button>
                  </>
                ) : null}
              </div>
            </Panel>
          ))}
        </div>
      )}

      {editing ? (
        <PlanFormDialog
          key={editing === "new" ? "new" : editing.id}
          plan={editing === "new" ? null : editing}
          companies={data.companies}
          open
          onOpenChange={(open) => {
            if (!open) setEditing(null);
          }}
        />
      ) : null}

      <AlertDialog
        open={Boolean(deleting)}
        onOpenChange={(open) => !open && !remove.isPending && setDeleting(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir plano</AlertDialogTitle>
            <AlertDialogDescription>
              O plano {deleting?.name} será excluído definitivamente. Só é possível excluir planos
              sem empresas vinculadas.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={remove.isPending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={remove.isPending}
              onClick={(event) => {
                event.preventDefault();
                if (deleting) remove.mutate(deleting);
              }}
            >
              {remove.isPending ? "Excluindo..." : "Excluir plano"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

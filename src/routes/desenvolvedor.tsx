import { createFileRoute, redirect } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  getDeveloperDashboard,
  getSystemRole,
  updatePlan,
  assignOrganizationPlan,
} from "@/lib/developer";
import {
  listSupportTickets,
  getSupportThread,
  replySupportTicket,
  supportPriorityLabels,
  supportStatusLabels,
} from "@/lib/support";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authClient } from "@/lib/auth-client";

export const Route = createFileRoute("/desenvolvedor")({
  beforeLoad: async () => {
    if ((await getSystemRole()) !== "developer") throw redirect({ to: "/dashboard" });
  },
  component: DeveloperPage,
});

const menuOptions = [
  "Dashboard",
  "Projetos",
  "Investidores",
  "Assessores",
  "Relatórios",
  "Notificações",
  "Configurações",
  "Suporte",
];
const tabOptions = [
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
const modalityOptions = ["completa", "parcial", "juridica", "operacional", "consultiva", "nenhuma"];
const modalityLabels: Record<string, string> = {
  completa: "Assessoria Completa",
  parcial: "Assessoria Parcial",
  juridica: "Assessoria Jurídica",
  operacional: "Assessoria Operacional",
  consultiva: "Consultoria Específica",
  nenhuma: "Sem Assessoria",
};

function DeveloperPage() {
  const queryClient = useQueryClient();
  const { data, isLoading, error } = useQuery({
    queryKey: ["developer-dashboard"],
    queryFn: () => getDeveloperDashboard(),
  });
  const { data: tickets = [] } = useQuery({
    queryKey: ["developer-tickets"],
    queryFn: () => listSupportTickets(),
  });
  const [selectedTicket, setSelectedTicket] = useState<string | null>(null);
  const { data: thread } = useQuery({
    queryKey: ["developer-thread", selectedTicket],
    queryFn: () => getSupportThread({ data: { ticketId: selectedTicket! } }),
    enabled: !!selectedTicket,
  });
  const [reply, setReply] = useState("");
  const [replyFiles, setReplyFiles] = useState<FileList | null>(null);
  const [ticketStatusFilter, setTicketStatusFilter] = useState("");
  const [ticketPriorityFilter, setTicketPriorityFilter] = useState("");
  const [ticketCategoryFilter, setTicketCategoryFilter] = useState("");
  const [status, setStatus] = useState("in_progress");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  if (isLoading) return <main className="p-6">Carregando painel…</main>;
  if (error || !data) return <main className="p-6">Não foi possível carregar o painel.</main>;
  return (
    <main className="min-h-dvh max-w-full overflow-x-hidden bg-background p-4 text-foreground md:p-8">
      <div className="mx-auto max-w-7xl space-y-8">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-semibold">Painel do Desenvolvedor</h1>
            <p className="text-muted-foreground">Planos, indicadores e suporte do ArremataFlow</p>
          </div>
          <Button
            variant="outline"
            onClick={async () => {
              await authClient.signOut();
              location.href = "/";
            }}
          >
            Sair
          </Button>
        </header>
        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-label="Indicadores">
          <Metric title="Projetos" value={String(data.projectCount)} />
          <Metric title="Projetos em andamento" value={String(data.projectsInProgress)} />
          <Metric
            title="Capital investido sob gestão"
            value={data.investedCapital.toLocaleString("pt-BR", {
              style: "currency",
              currency: "BRL",
            })}
          />
          <Metric title="Chamados pendentes" value={String(data.pendingTickets)} />
          <Metric title="Urgentes pendentes" value={String(data.urgentTickets)} />
          <Metric
            title="MRR"
            value={
              data.billingConfigured
                ? data.recurringRevenue.toLocaleString("pt-BR", {
                    style: "currency",
                    currency: "BRL",
                  })
                : "Sem assinaturas com valor informado"
            }
          />
          <Metric
            title="ARR projetado"
            value={
              data.billingConfigured
                ? data.projectedAnnualRevenue.toLocaleString("pt-BR", {
                    style: "currency",
                    currency: "BRL",
                  })
                : "Sem dados"
            }
          />
          <Metric
            title="Ciclos de cobrança"
            value={`${data.billingCycles.monthly} mensais · ${data.billingCycles.annual} anuais`}
          />
          <Metric
            title="Primeira resposta média"
            value={
              data.averageFirstResponseMinutes == null
                ? "Sem dados"
                : `${Math.round(data.averageFirstResponseMinutes)} min`
            }
          />
          <Metric
            title="Solução média"
            value={
              data.averageResolutionMinutes == null
                ? "Sem dados"
                : `${Math.round(data.averageResolutionMinutes)} min`
            }
          />
        </section>
        <section className="space-y-3 rounded-xl border bg-card p-5" aria-label="Armazenamento">
          <h2 className="text-xl font-semibold">Armazenamento de mídias</h2>
          <p className="break-words">
            {(data.storageBytes / 1024 ** 3).toLocaleString("pt-BR", { maximumFractionDigits: 2 })}{" "}
            GB usados de {(data.storageCapacityBytes / 1024 ** 3).toLocaleString("pt-BR")} GB ·{" "}
            {Math.round((data.storageBytes / data.storageCapacityBytes) * 100)}% ·{" "}
            {Math.max(
              0,
              (data.storageCapacityBytes - data.storageBytes) / 1024 ** 3,
            ).toLocaleString("pt-BR", { maximumFractionDigits: 2 })}{" "}
            GB livres
          </p>
          <div
            role="progressbar"
            aria-valuenow={Math.min(100, (data.storageBytes / data.storageCapacityBytes) * 100)}
            aria-valuemin={0}
            aria-valuemax={100}
            className="h-3 overflow-hidden rounded-full bg-muted"
          >
            <div
              className={`h-full ${data.storageBytes / data.storageCapacityBytes > 0.85 ? "bg-red-500" : data.storageBytes / data.storageCapacityBytes >= 0.7 ? "bg-yellow-500" : "bg-emerald-500"}`}
              style={{
                width: `${Math.min(100, (data.storageBytes / data.storageCapacityBytes) * 100)}%`,
              }}
            />
          </div>
          <div className="grid gap-2 text-sm sm:grid-cols-3">
            <p>
              Documentos:{" "}
              {(data.storageByCategory.documents / 1048576).toLocaleString("pt-BR", {
                maximumFractionDigits: 2,
              })}{" "}
              MB
            </p>
            <p>
              Fotos:{" "}
              {(data.storageByCategory.photos / 1048576).toLocaleString("pt-BR", {
                maximumFractionDigits: 2,
              })}{" "}
              MB
            </p>
            <p>
              Anexos de chamados:{" "}
              {(data.storageByCategory.support / 1048576).toLocaleString("pt-BR", {
                maximumFractionDigits: 2,
              })}{" "}
              MB
            </p>
          </div>
        </section>
        <section className="space-y-3">
          <h2 className="text-xl font-semibold">Empresas ativas por plano</h2>
          <div className="grid gap-4 sm:grid-cols-3">
            {data.activeByPlan.map((item) => (
              <Metric
                key={item.id}
                title={item.name}
                value={`${item.count} · ${item.percent.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`}
              />
            ))}
          </div>
          <p className="text-sm text-muted-foreground">
            Contagem de empresas vinculadas. Não representa assinaturas pagas.
          </p>
        </section>
        <section className="space-y-4">
          <h2 className="text-xl font-semibold">Planos</h2>
          <div className="grid gap-4 lg:grid-cols-3">
            {[...data.plans]
              .sort(
                (a, b) =>
                  ["starter", "professional", "custom"].indexOf(a.id) -
                  ["starter", "professional", "custom"].indexOf(b.id),
              )
              .map((plan) => (
                <form
                  key={plan.id}
                  className="min-w-0 space-y-3 rounded-xl border bg-card p-5"
                  onSubmit={async (event) => {
                    event.preventDefault();
                    setSaving(true);
                    setMessage("");
                    const form = new FormData(event.currentTarget);
                    const nullable = (name: string) =>
                      form.get(name) === "" ? null : Number(form.get(name));
                    try {
                      await updatePlan({
                        data: {
                          id: plan.id as "starter" | "professional" | "custom",
                          monthlyPrice: nullable("monthlyPrice"),
                          annualPrice: nullable("annualPrice"),
                          maxActiveProjects: nullable("maxActiveProjects"),
                          maxInvestors: nullable("maxInvestors"),
                          maxAdvisors: nullable("maxAdvisors"),
                          maxProjectManagers: nullable("maxProjectManagers"),
                          firstResponseHours: Number(form.get("firstResponseHours")),
                          resolutionHours: Number(form.get("resolutionHours")),
                          menuItems: menuOptions.filter((value) => form.has(`menu:${value}`)),
                          advisoryModalities: modalityOptions.filter((value) =>
                            form.has(`modal:${value}`),
                          ),
                          projectTabs: tabOptions.filter((value) => form.has(`tab:${value}`)),
                        },
                      });
                      await queryClient.invalidateQueries({ queryKey: ["developer-dashboard"] });
                      setMessage("Plano salvo.");
                    } catch (cause) {
                      setMessage(cause instanceof Error ? cause.message : "Erro ao salvar.");
                    } finally {
                      setSaving(false);
                    }
                  }}
                >
                  <h3 className="text-lg font-semibold">{plan.name}</h3>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <NumberField
                      idPrefix={plan.id}
                      name="monthlyPrice"
                      label="Preço mensal (R$)"
                      value={plan.monthlyPrice}
                      step="0.01"
                    />
                    <NumberField
                      idPrefix={plan.id}
                      name="annualPrice"
                      label="Preço anual (R$)"
                      value={plan.annualPrice}
                      step="0.01"
                    />
                  </div>
                  <NumberField
                    idPrefix={plan.id}
                    name="maxActiveProjects"
                    label="Projetos ativos"
                    value={plan.maxActiveProjects}
                  />
                  <div className="grid gap-3 sm:grid-cols-2">
                    <NumberField
                      idPrefix={plan.id}
                      name="maxInvestors"
                      label="Investidores"
                      value={plan.maxInvestors}
                    />
                    <NumberField
                      idPrefix={plan.id}
                      name="maxAdvisors"
                      label="Assessores"
                      value={plan.maxAdvisors}
                    />
                  </div>
                  <NumberField
                    idPrefix={plan.id}
                    name="maxProjectManagers"
                    label="Gestores de projeto"
                    value={plan.maxProjectManagers}
                  />
                  <NumberField
                    idPrefix={plan.id}
                    name="firstResponseHours"
                    label="Prazo da primeira resposta (horas)"
                    value={plan.firstResponseHours}
                  />
                  <NumberField
                    idPrefix={plan.id}
                    name="resolutionHours"
                    label="Prazo da solução (horas)"
                    value={plan.resolutionHours}
                  />
                  <Checks
                    title="Menu"
                    prefix="menu"
                    options={menuOptions}
                    selected={plan.menuItems}
                  />
                  <Checks
                    title="Modalidades"
                    prefix="modal"
                    options={modalityOptions}
                    selected={plan.advisoryModalities}
                  />
                  <Checks
                    title="Abas do projeto"
                    prefix="tab"
                    options={tabOptions}
                    selected={plan.projectTabs}
                  />
                  <Button disabled={saving}>Salvar plano</Button>
                </form>
              ))}
          </div>
        </section>
        <section className="space-y-4">
          <h2 className="text-xl font-semibold">Empresas</h2>
          <div className="rounded-xl border bg-card">
            <table className="w-full table-fixed text-left text-sm">
              <thead>
                <tr className="border-b">
                  <th className="p-3">Empresa</th>
                  <th className="p-3">Plano</th>
                  <th className="p-3">Ação</th>
                </tr>
              </thead>
              <tbody>
                {data.companies.map((company) => (
                  <tr key={company.id} className="border-b last:border-0">
                    <td className="break-words p-3">{company.name}</td>
                    <td className="p-3">
                      {data.plans.find((plan) => plan.id === company.planId)?.name ?? "Sem plano"}
                    </td>
                    <td className="p-3">
                      <form
                        className="flex min-w-0 flex-wrap gap-2"
                        onSubmit={async (event) => {
                          event.preventDefault();
                          const values = new FormData(event.currentTarget);
                          try {
                            await assignOrganizationPlan({
                              data: {
                                organizationId: company.id,
                                planId: String(values.get("planId")) as
                                  "starter" | "professional" | "custom",
                                billingCycle: (values.get("billingCycle") || null) as
                                  "monthly" | "annual" | null,
                                startsAt: (values.get("startsAt") || null) as string | null,
                                endsAt: (values.get("endsAt") || null) as string | null,
                                subscriptionAmount:
                                  values.get("subscriptionAmount") === ""
                                    ? null
                                    : Number(values.get("subscriptionAmount")),
                              },
                            });
                            await queryClient.invalidateQueries({
                              queryKey: ["developer-dashboard"],
                            });
                            setMessage("Assinatura atualizada.");
                          } catch (cause) {
                            setMessage(
                              cause instanceof Error ? cause.message : "Erro ao salvar assinatura.",
                            );
                          }
                        }}
                      >
                        <select
                          className="max-w-full rounded-md border bg-background p-2"
                          name="planId"
                          defaultValue={company.planId ?? "custom"}
                          aria-label={`Plano de ${company.name}`}
                        >
                          {data.plans.map((plan) => (
                            <option key={plan.id} value={plan.id}>
                              {plan.name}
                            </option>
                          ))}
                        </select>
                        <select
                          name="billingCycle"
                          aria-label={`Ciclo de ${company.name}`}
                          defaultValue={company.billingCycle ?? ""}
                          className="max-w-full rounded-md border bg-background p-2"
                        >
                          <option value="">Sem ciclo</option>
                          <option value="monthly">Mensal</option>
                          <option value="annual">Anual</option>
                        </select>
                        <Input
                          name="subscriptionAmount"
                          aria-label={`Valor da assinatura de ${company.name}`}
                          type="number"
                          min="0"
                          step="0.01"
                          defaultValue={company.subscriptionAmount ?? ""}
                          placeholder="Valor R$"
                          className="min-w-0 basis-24"
                        />
                        <Input
                          name="startsAt"
                          aria-label={`Início da vigência de ${company.name}`}
                          type="date"
                          defaultValue={
                            company.startsAt
                              ? new Date(company.startsAt).toISOString().slice(0, 10)
                              : ""
                          }
                          className="min-w-0 basis-36"
                        />
                        <Input
                          name="endsAt"
                          aria-label={`Término da vigência de ${company.name}`}
                          type="date"
                          defaultValue={
                            company.endsAt
                              ? new Date(company.endsAt).toISOString().slice(0, 10)
                              : ""
                          }
                          className="min-w-0 basis-36"
                        />
                        <Button type="submit" variant="outline">
                          Salvar
                        </Button>
                      </form>
                    </td>
                  </tr>
                ))}
                {data.companies.length === 0 && (
                  <tr>
                    <td colSpan={3} className="p-3 text-muted-foreground">
                      Nenhuma empresa cadastrada.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
        <section className="space-y-4">
          <h2 className="text-xl font-semibold">Help Desk</h2>
          <div className="grid gap-2 sm:grid-cols-3">
            <select
              aria-label="Filtrar status"
              value={ticketStatusFilter}
              onChange={(event) => setTicketStatusFilter(event.target.value)}
              className="min-w-0 rounded border bg-background p-2"
            >
              <option value="">Todos os status</option>
              {Object.entries(supportStatusLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
            <select
              aria-label="Filtrar prioridade"
              value={ticketPriorityFilter}
              onChange={(event) => setTicketPriorityFilter(event.target.value)}
              className="min-w-0 rounded border bg-background p-2"
            >
              <option value="">Todas as prioridades</option>
              {Object.entries(supportPriorityLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
            <select
              aria-label="Filtrar categoria"
              value={ticketCategoryFilter}
              onChange={(event) => setTicketCategoryFilter(event.target.value)}
              className="min-w-0 rounded border bg-background p-2"
            >
              <option value="">Todas as categorias</option>
              {Array.from(new Set(tickets.map((ticket) => ticket.category))).map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
          </div>
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
            <div className="rounded-xl border bg-card p-4">
              {tickets.filter(
                (ticket) =>
                  (!ticketStatusFilter || ticket.status === ticketStatusFilter) &&
                  (!ticketPriorityFilter || ticket.priority === ticketPriorityFilter) &&
                  (!ticketCategoryFilter || ticket.category === ticketCategoryFilter),
              ).length
                ? tickets
                    .filter(
                      (ticket) =>
                        (!ticketStatusFilter || ticket.status === ticketStatusFilter) &&
                        (!ticketPriorityFilter || ticket.priority === ticketPriorityFilter) &&
                        (!ticketCategoryFilter || ticket.category === ticketCategoryFilter),
                    )
                    .map((ticket) => (
                      <button
                        key={ticket.id}
                        type="button"
                        onClick={() => setSelectedTicket(ticket.id)}
                        className="block w-full min-w-0 break-words border-b p-3 text-left hover:bg-accent focus-visible:outline-2 focus-visible:outline-ring"
                      >
                        <strong>{ticket.controlNumber}</strong>
                        <br />
                        {ticket.subject}
                        <br />
                        <small>{supportStatusLabels[ticket.status] ?? ticket.status}</small>
                      </button>
                    ))
                : "Nenhum chamado."}
            </div>
            {thread && (
              <div className="space-y-3 rounded-xl border bg-card p-4">
                <h3 className="font-semibold">{thread.ticket.subject}</h3>
                <p className="text-sm">
                  {thread.ticket.category} · {thread.ticket.controlNumber}
                </p>
                {thread.history.map((entry) => (
                  <p key={entry.id} className="text-sm">
                    {new Date(entry.createdAt).toLocaleString("pt-BR")} · {entry.actorName}:{" "}
                    {supportStatusLabels[entry.toStatus] ?? entry.toStatus}
                  </p>
                ))}
                {thread.attachments.map((attachment) => (
                  <p key={attachment.id}>
                    <a className="underline" href={`/api/support-attachments/${attachment.id}`}>
                      {attachment.originalName}
                    </a>
                  </p>
                ))}
                <p className="text-sm">
                  Prioridade:{" "}
                  {supportPriorityLabels[thread.ticket.priority] ?? thread.ticket.priority} ·
                  Status: {supportStatusLabels[thread.ticket.status] ?? thread.ticket.status} ·
                  Responsável: {thread.assigneeName ?? "Não atribuído"}
                </p>
                <p className="text-sm">
                  Primeira resposta até{" "}
                  {new Date(thread.ticket.firstResponseDueAt).toLocaleString("pt-BR")} · Solução até{" "}
                  {new Date(thread.ticket.resolutionDueAt).toLocaleString("pt-BR")}
                </p>
                <p className="text-sm">
                  Primeira resposta:{" "}
                  {thread.ticket.firstRespondedAt
                    ? new Date(thread.ticket.firstRespondedAt).toLocaleString("pt-BR")
                    : "Pendente"}{" "}
                  · Solução:{" "}
                  {thread.ticket.resolvedAt
                    ? new Date(thread.ticket.resolvedAt).toLocaleString("pt-BR")
                    : "Pendente"}
                </p>
                <div className="max-h-72 space-y-2 overflow-y-auto">
                  {thread.messages.map((entry) => (
                    <div key={entry.id} className="rounded border p-3 text-sm">
                      <strong>{entry.authorName}</strong> ·{" "}
                      {new Date(entry.createdAt).toLocaleString("pt-BR")}
                      <p className="whitespace-pre-wrap">{entry.body}</p>
                    </div>
                  ))}
                </div>
                <form
                  className="space-y-2"
                  onSubmit={async (event) => {
                    event.preventDefault();
                    await replySupportTicket({
                      data: {
                        ticketId: thread.ticket.id,
                        body: reply,
                        status: status as
                          "open" | "in_progress" | "waiting" | "resolved" | "closed",
                      },
                    });
                    for (const file of Array.from(replyFiles || [])) {
                      const form = new FormData();
                      form.set("ticketId", thread.ticket.id);
                      form.set("file", file);
                      const response = await fetch("/api/support-attachments/upload", {
                        method: "POST",
                        body: form,
                      });
                      if (!response.ok) throw new Error(await response.text());
                    }
                    setReply("");
                    setReplyFiles(null);
                    await queryClient.invalidateQueries({
                      queryKey: ["developer-thread", selectedTicket],
                    });
                    await queryClient.invalidateQueries({ queryKey: ["developer-tickets"] });
                  }}
                >
                  <Label htmlFor="reply">Resposta</Label>
                  <textarea
                    id="reply"
                    required
                    value={reply}
                    onChange={(event) => setReply(event.target.value)}
                    className="min-h-24 w-full rounded border bg-background p-2"
                  />
                  <select
                    aria-label="Status"
                    value={status}
                    onChange={(event) => setStatus(event.target.value)}
                    className="rounded border bg-background p-2"
                  >
                    <option value="open">Aberto</option>
                    <option value="in_progress">Em Análise</option>
                    <option value="waiting">Aguardando Usuário</option>
                    <option value="resolved">Resolvido</option>
                    <option value="closed">Fechado</option>
                  </select>
                  <Button>Responder</Button>
                  <Input
                    aria-label="Anexos da resposta"
                    type="file"
                    multiple
                    accept=".pdf,.jpg,.jpeg,.png,.webp"
                    onChange={(event) => setReplyFiles(event.target.files)}
                  />
                </form>
              </div>
            )}
          </div>
        </section>
        {message && <p role="status">{message}</p>}
      </div>
    </main>
  );
}

function Metric({ title, value }: { title: string; value: string }) {
  return (
    <div className="min-w-0 rounded-xl border bg-card p-5">
      <p className="text-sm text-muted-foreground">{title}</p>
      <p className="mt-2 break-words text-xl font-semibold">{value}</p>
    </div>
  );
}
function NumberField({
  idPrefix,
  name,
  label,
  value,
  step = "1",
}: {
  idPrefix: string;
  name: string;
  label: string;
  value: string | number | null;
  step?: string;
}) {
  return (
    <div className="min-w-0 space-y-1">
      <Label htmlFor={`${idPrefix}-${name}`}>{label}</Label>
      <Input
        id={`${idPrefix}-${name}`}
        name={name}
        type="number"
        min="0"
        step={step}
        defaultValue={value ?? ""}
        placeholder={
          name === "monthlyPrice" || name === "annualPrice" ? "Não definido" : "Sem limite"
        }
      />
    </div>
  );
}
function Checks({
  title,
  prefix,
  options,
  selected,
}: {
  title: string;
  prefix: string;
  options: string[];
  selected: string[];
}) {
  return (
    <fieldset className="space-y-1">
      <legend className="font-medium">{title}</legend>
      {options.map((option) => (
        <label key={option} className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            name={`${prefix}:${option}`}
            defaultChecked={selected.includes(option)}
          />
          {prefix === "modal" ? modalityLabels[option] : option}
        </label>
      ))}
    </fieldset>
  );
}

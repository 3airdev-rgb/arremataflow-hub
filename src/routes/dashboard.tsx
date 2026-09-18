import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  FolderKanban,
  FileCheck,
  AlertTriangle,
  KeyRound,
  Hammer,
  Store,
  Wallet,
  BadgeDollarSign,
  TrendingUp,
  CircleCheckBig,
  CalendarDays,
  Activity,
} from "lucide-react";
import { AppLayout } from "@/components/app-layout";
import { KpiCard } from "@/components/kpi-card";
import { getOrganizationSettings } from "@/lib/organization-settings";
import { listProjects } from "@/lib/projects";

export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard Executivo | ArremataFlow" },
      {
        name: "description",
        content:
          "Indicadores operacionais e financeiros da carteira: projetos ativos, pendências, capital investido e resultados.",
      },
      { property: "og:title", content: "Dashboard Executivo | ArremataFlow" },
      {
        property: "og:description",
        content: "KPIs, pipeline, alertas críticos e tarefas do dia em uma única visão.",
      },
    ],
  }),
  component: Dashboard,
});

const formatBRL = (value: number) => new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
}).format(value);

const pipelineStages = ["Aquisição", "Regularização", "Posse", "Obra", "Venda"];

function Dashboard() {
  const { data: organization } = useQuery({
    queryKey: ["active-organization"],
    queryFn: () => getOrganizationSettings(),
  });
  const { data: projects = [] } = useQuery({
    queryKey: ["projects"],
    queryFn: () => listProjects(),
  });
  const countStage = (terms: string[]) => projects.filter((project: any) => {
    const stage = String(project.etapa || "").toLowerCase();
    return terms.some((term) => stage.includes(term));
  }).length;
  const capitalInvested = projects.reduce((total: number, project: any) => total + (Number(project.valor_aquisicao) || 0), 0);
  const fees = projects.reduce((total: number, project: any) => total + (Number(project.valor_honorarios) || 0), 0);
  const projectedResult = projects.reduce((total: number, project: any) => {
    const projections = project.projecoes_financeiras || {};
    const revenue = Number(projections.venda) || 0;
    const expenses = Object.entries(projections)
      .filter(([key]) => key !== "venda")
      .reduce((sum, [, value]) => sum + (Number(value) || 0), 0);
    return total + revenue - expenses;
  }, 0);
  const today = new Intl.DateTimeFormat("pt-BR", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  }).format(new Date());

  return (
    <AppLayout
      title="Dashboard Executivo"
      subtitle={`${today.charAt(0).toUpperCase()}${today.slice(1)} · ${organization?.name || "Empresa"}`}
    >
      <div className="grid gap-5 lg:grid-cols-3">
        <div className="surface-card p-5 lg:col-span-2">
          <div className="mb-4 flex items-center gap-2">
            <AlertTriangle className="size-4.5 text-destructive" />
            <h3 className="text-base font-semibold">Alertas do dia</h3>
          </div>
          <p className="rounded-lg border border-dashed border-border px-4 py-5 text-sm text-muted-foreground">
            Nenhum alerta para hoje.
          </p>
        </div>

        <div className="surface-card p-5">
          <div className="mb-4 flex items-center gap-2">
            <CircleCheckBig className="size-4.5 text-success" />
            <h3 className="text-base font-semibold">Resumo do dia</h3>
          </div>
          <dl className="space-y-3 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Tarefas vencendo hoje</dt>
              <dd className="font-semibold">0</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Concluídas na semana</dt>
              <dd className="font-semibold">0</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Novos documentos</dt>
              <dd className="font-semibold">0</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Movimentações financeiras</dt>
              <dd className="font-semibold">{formatBRL(0)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Aportes recebidos</dt>
              <dd className="font-semibold text-success">{formatBRL(0)}</dd>
            </div>
          </dl>
        </div>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <KpiCard label="Projetos ativos" value={projects.filter((project: any) => project.status !== "concluido").length} icon={FolderKanban} />
        <KpiCard label="Regularizações" value={countStage(["regulariza"])} icon={FileCheck} tone="info" />
        <KpiCard label="Pendências" value={0} icon={AlertTriangle} tone="danger" />
        <KpiCard label="Posse pendente" value={countStage(["posse"])} icon={KeyRound} tone="warning" />
        <KpiCard label="Reformas" value={countStage(["obra", "reforma"])} icon={Hammer} tone="warning" />
        <KpiCard label="Imóveis à venda" value={countStage(["venda"])} icon={Store} tone="info" />
        <KpiCard label="Capital investido" value={formatBRL(capitalInvested)} icon={Wallet} />
        <KpiCard label="Honorários" value={formatBRL(fees)} icon={BadgeDollarSign} tone="success" />
        <KpiCard
          label="Resultado projetado"
          value={formatBRL(projectedResult)}
          icon={TrendingUp}
          tone="success"
        />
        <KpiCard
          label="Resultado realizado"
          value={formatBRL(0)}
          icon={TrendingUp}
          tone="success"
        />
      </div>

      <section className="mt-8">
        <h2 className="mb-4 text-lg font-semibold">Pipeline de projetos</h2>
        <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-5">
          {pipelineStages.map((stage) => {
            const stageProjects = projects.filter((project: any) => String(project.etapa || "").toLowerCase().includes(stage.toLowerCase()));
            return (
            <div key={stage} className="rounded-xl border border-border bg-muted/40 p-3">
              <div className="mb-3 flex items-center justify-between px-1">
                <span className="text-sm font-semibold">{stage}</span>
                <span className="rounded-full bg-card px-2 py-0.5 text-xs text-muted-foreground">
                  {stageProjects.length}
                </span>
              </div>
              {stageProjects.length ? <div className="space-y-2">
                {stageProjects.map((project: any) => (
                  <Link key={project.id} to="/projetos/$id" params={{ id: project.id }} className="block rounded-lg bg-card p-3 shadow-sm">
                    <p className="text-xs text-muted-foreground">{project.codigo}</p>
                    <p className="mt-0.5 text-sm font-medium leading-snug">{project.nome}</p>
                  </Link>
                ))}
              </div> : <p className="py-3 text-center text-xs text-muted-foreground">Nenhum projeto</p>}
            </div>
          )})}
        </div>
      </section>

      <div className="mt-8 grid gap-5 lg:grid-cols-3">
        <div className="surface-card p-5">
          <div className="mb-4 flex items-center gap-2">
            <CalendarDays className="size-4.5 text-brand" />
            <h3 className="text-base font-semibold">Calendário de vencimentos</h3>
          </div>
          <p className="rounded-lg border border-dashed border-border px-4 py-5 text-sm text-muted-foreground">
            Nenhum vencimento agendado.
          </p>
        </div>

        <div className="surface-card p-5">
          <h3 className="mb-4 text-base font-semibold">Tarefas do dia</h3>
          <p className="rounded-lg border border-dashed border-border px-4 py-5 text-sm text-muted-foreground">
            Nenhuma tarefa para hoje.
          </p>
        </div>

        <div className="surface-card p-5">
          <div className="mb-4 flex items-center gap-2">
            <Activity className="size-4.5 text-brand" />
            <h3 className="text-base font-semibold">Últimas movimentações</h3>
          </div>
          <p className="rounded-lg border border-dashed border-border px-4 py-5 text-sm text-muted-foreground">
            Nenhuma movimentação registrada.
          </p>
          <Link
            to="/projetos"
            className="mt-4 inline-block text-sm font-medium text-brand hover:underline"
          >
            Ver todos os projetos →
          </Link>
        </div>
      </div>
    </AppLayout>
  );
}

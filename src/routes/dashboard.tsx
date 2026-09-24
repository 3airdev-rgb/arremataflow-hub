import { createFileRoute, Link, redirect } from "@tanstack/react-router";
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
  Activity,
} from "lucide-react";
import { AppLayout } from "@/components/app-layout";
import { KpiCard, KpiValue } from "@/components/kpi-card";
import { getOrganizationSettings } from "@/lib/organization-settings";
import { countProjectSalesStatuses } from "@/lib/commercial";
import {
  countCompletedRegularizations,
  countProjectPossessions,
  countProjectsWithPendingIndicators,
  countProjectWorks,
  listProjects,
} from "@/lib/projects";
import { getDashboardDailySummary, listRecentProjectAudit, listUpcomingTasks } from "@/lib/tasks";
import { formatBRL } from "@/lib/format-currency";
import { getCurrentOrganizationUser } from "@/lib/organization-users";
import { homePathForRole, isAdminRole } from "@/lib/role-home";

export const Route = createFileRoute("/dashboard")({
  beforeLoad: async () => {
    const user = await getCurrentOrganizationUser();
    if (!isAdminRole(user.role)) throw redirect({ to: homePathForRole(user.role) });
  },
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

function Dashboard() {
  const { data: organization } = useQuery({
    queryKey: ["active-organization"],
    queryFn: () => getOrganizationSettings(),
  });
  const { data: projects = [] } = useQuery({
    queryKey: ["projects"],
    queryFn: () => listProjects(),
  });
  const { data: upcomingTasks = [] } = useQuery({
    queryKey: ["upcoming-tasks"],
    queryFn: () => listUpcomingTasks(),
  });
  const { data: recentProjectAudit = [] } = useQuery({
    queryKey: ["recent-project-audit", "24-hours"],
    queryFn: () => listRecentProjectAudit(),
  });
  const { data: completedRegularizations = 0 } = useQuery({
    queryKey: ["completed-regularizations"],
    queryFn: () => countCompletedRegularizations(),
  });
  const { data: projectWorks = { completed: 0, inProgress: 0 } } = useQuery({
    queryKey: ["project-works-count"],
    queryFn: () => countProjectWorks(),
  });
  const { data: projectPossessions = { completed: 0, inProgress: 0 } } = useQuery({
    queryKey: ["project-possessions-count"],
    queryFn: () => countProjectPossessions(),
  });
  const { data: projectsWithPendingIndicators = 0 } = useQuery({
    queryKey: ["projects-with-pending-indicators"],
    queryFn: () => countProjectsWithPendingIndicators(),
  });
  const { data: projectSalesStatuses = { forSale: 0, sold: 0 } } = useQuery({
    queryKey: ["project-sales-statuses"],
    queryFn: () => countProjectSalesStatuses(),
  });
  const {
    data: dailySummary = {
      tasksDueToday: 0,
      tasksCompletedLast7Days: 0,
      documentsLast3Days: 0,
      financialMovementsLast7Days: 0,
    },
  } = useQuery({
    queryKey: ["dashboard-daily-summary"],
    queryFn: () => getDashboardDailySummary(),
  });
  const capitalInvested = projects.reduce(
    (total, project) => total + (Number(project.valor_aquisicao) || 0),
    0,
  );
  const fees = projects.reduce(
    (total, project) => total + (Number(project.valor_honorarios) || 0),
    0,
  );
  const projectedResult = projects.reduce((total, project) => {
    const projections = project.projecoes_financeiras || {};
    const revenue = Number(projections.venda) || 0;
    const expenses = Object.entries(projections)
      .filter(([key]) => key !== "venda")
      .reduce((sum, [, value]) => sum + (Number(value) || 0), 0);
    return total + revenue - expenses;
  }, 0);
  const today = new Intl.DateTimeFormat("pt-BR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
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
            <h3 className="text-base font-semibold">Alertas dos próximos dias</h3>
          </div>
          {upcomingTasks.length ? (
            <ul className="divide-y divide-border rounded-lg border">
              {upcomingTasks.map((task) => (
                <li
                  key={task.id}
                  className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
                >
                  <div>
                    <p className="text-sm font-medium">{task.title}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {task.projectCode} · {task.projectName} · {task.category}
                    </p>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-sm font-medium">
                      {task.dueDate?.split("-").reverse().join("/")}
                    </span>
                    <Link
                      to="/projetos/$id/tarefas"
                      params={{ id: task.projectId }}
                      className="text-sm font-medium text-brand hover:underline"
                    >
                      Acessar tarefa →
                    </Link>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="rounded-lg border border-dashed border-border px-4 py-5 text-sm text-muted-foreground">
              Nenhuma tarefa programada para os próximos dias.
            </p>
          )}
        </div>

        <div className="surface-card p-5">
          <div className="mb-4 flex items-center gap-2">
            <CircleCheckBig className="size-4.5 text-success" />
            <h3 className="text-base font-semibold">Resumo do dia</h3>
          </div>
          <dl className="space-y-3 text-sm">
            <div className="flex flex-wrap justify-between gap-x-3 gap-y-1">
              <dt className="text-muted-foreground">Tarefas vencendo hoje</dt>
              <dd className="shrink-0 whitespace-nowrap font-semibold">
                {dailySummary.tasksDueToday}
              </dd>
            </div>
            <div className="flex flex-wrap justify-between gap-x-3 gap-y-1">
              <dt className="text-muted-foreground">Concluídas na semana</dt>
              <dd className="shrink-0 whitespace-nowrap font-semibold">
                {dailySummary.tasksCompletedLast7Days}
              </dd>
            </div>
            <div className="flex flex-wrap justify-between gap-x-3 gap-y-1">
              <dt className="text-muted-foreground">Novos documentos</dt>
              <dd className="shrink-0 whitespace-nowrap font-semibold">
                {dailySummary.documentsLast3Days}
              </dd>
            </div>
            <div className="flex flex-wrap justify-between gap-x-3 gap-y-1">
              <dt className="text-muted-foreground">Movimentações financeiras</dt>
              <dd className="shrink-0 whitespace-nowrap font-semibold">
                {formatBRL(dailySummary.financialMovementsLast7Days)}
              </dd>
            </div>
            <div className="flex flex-wrap justify-between gap-x-3 gap-y-1">
              <dt className="text-muted-foreground">Aportes recebidos</dt>
              <dd className="shrink-0 whitespace-nowrap font-semibold text-success">
                {formatBRL(0)}
              </dd>
            </div>
          </dl>
        </div>
      </div>

      <div className="kpi-grid mt-6">
        <div className="surface-card kpi-group p-5">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-sm text-muted-foreground">Projetos</p>
            <span className="grid size-10 place-items-center rounded-full bg-primary-soft text-primary">
              <FolderKanban className="size-5" />
            </span>
          </div>
          <div className="grid grid-cols-2 divide-x divide-border [&>div]:min-w-0 [&>div]:@container [&>div>p]:min-h-8 [&_a>p]:min-h-8">
            <div className="pr-4">
              <Link
                to="/projetos"
                search={{ visao: "projetos-finalizados" }}
                className="block rounded-sm hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <p className="text-xs font-medium text-green-700">Projetos finalizados</p>
                <KpiValue
                  className="mt-1 text-foreground"
                  value={projects.filter((project) => project.status === "concluido").length}
                />
              </Link>
            </div>
            <div className="pl-4">
              <Link
                to="/projetos"
                search={{ visao: "projetos-ativos" }}
                className="block rounded-sm hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <p className="text-xs font-medium text-primary">Projetos ativos</p>
                <KpiValue
                  className="mt-1 text-foreground"
                  value={projects.filter((project) => project.status !== "concluido").length}
                />
              </Link>
            </div>
          </div>
        </div>
        <div className="surface-card kpi-group p-5">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-sm text-muted-foreground">Regularizações</p>
            <span className="grid size-10 place-items-center rounded-full bg-primary-soft text-primary">
              <FileCheck className="size-5" />
            </span>
          </div>
          <div className="grid grid-cols-2 divide-x divide-border [&>div]:min-w-0 [&>div]:@container [&>div>p]:min-h-8 [&_a>p]:min-h-8">
            <div className="pr-4">
              <Link
                to="/projetos"
                search={{ visao: "regularizacoes-finalizadas" }}
                className="block rounded-sm hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <p className="text-xs font-medium text-green-700">Finalizadas</p>
                <KpiValue className="mt-1 text-foreground" value={completedRegularizations} />
              </Link>
            </div>
            <div className="pl-4">
              <Link
                to="/projetos"
                search={{ visao: "regularizacoes-nao-finalizadas" }}
                className="block rounded-sm hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <p className="text-xs font-medium text-amber-700">Não finalizadas</p>
                <KpiValue
                  className="mt-1 text-foreground"
                  value={Math.max(projects.length - completedRegularizations, 0)}
                />
              </Link>
            </div>
          </div>
        </div>
        <KpiCard
          label="Pendências"
          value={projectsWithPendingIndicators}
          icon={AlertTriangle}
          tone="danger"
        />
        <div className="surface-card kpi-group p-5">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-sm text-muted-foreground">Posse de imóveis</p>
            <span className="grid size-10 place-items-center rounded-full bg-amber-100 text-amber-700">
              <KeyRound className="size-5" />
            </span>
          </div>
          <div className="grid grid-cols-2 divide-x divide-border [&>div]:min-w-0 [&>div]:@container [&>div>p]:min-h-8 [&_a>p]:min-h-8">
            <div className="pr-4">
              <p className="text-xs font-medium text-green-700">Finalizadas</p>
              <KpiValue className="mt-1" value={projectPossessions.completed} />
            </div>
            <div className="pl-4">
              <p className="text-xs font-medium text-amber-700">Em andamento</p>
              <KpiValue className="mt-1" value={projectPossessions.inProgress} />
            </div>
          </div>
        </div>
        <div className="surface-card kpi-group p-5">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-sm text-muted-foreground">Obras</p>
            <span className="grid size-10 place-items-center rounded-full bg-amber-100 text-amber-700">
              <Hammer className="size-5" />
            </span>
          </div>
          <div className="grid grid-cols-2 divide-x divide-border [&>div]:min-w-0 [&>div]:@container [&>div>p]:min-h-8 [&_a>p]:min-h-8">
            <div className="pr-4">
              <Link
                to="/projetos"
                search={{ visao: "obras-finalizadas" }}
                className="block rounded-sm hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <p className="text-xs font-medium text-green-700">Finalizadas</p>
                <KpiValue className="mt-1 text-foreground" value={projectWorks.completed} />
              </Link>
            </div>
            <div className="pl-4">
              <Link
                to="/projetos"
                search={{ visao: "obras-em-andamento" }}
                className="block rounded-sm hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <p className="text-xs font-medium text-amber-700">Em andamento</p>
                <KpiValue className="mt-1 text-foreground" value={projectWorks.inProgress} />
              </Link>
            </div>
          </div>
        </div>
        <div className="surface-card kpi-group p-5">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-sm text-muted-foreground">Imóveis</p>
            <span className="grid size-10 place-items-center rounded-full bg-highlight-soft text-brand">
              <Store className="size-5" />
            </span>
          </div>
          <div className="grid grid-cols-2 divide-x divide-border [&>div]:min-w-0 [&>div]:@container [&>div>p]:min-h-8 [&_a>p]:min-h-8">
            <div className="pr-4">
              <p className="text-xs font-medium text-brand">Imóveis à venda</p>
              <KpiValue className="mt-1 text-foreground" value={projectSalesStatuses.forSale} />
            </div>
            <div className="pl-4">
              <p className="text-xs font-medium text-green-700">Imóveis vendidos</p>
              <KpiValue className="mt-1 text-foreground" value={projectSalesStatuses.sold} />
            </div>
          </div>
        </div>
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

      <div className="mt-8">
        <div className="surface-card p-5">
          <div className="mb-4 flex items-center gap-2">
            <Activity className="size-4.5 text-brand" />
            <h3 className="text-base font-semibold">Últimas movimentações</h3>
          </div>
          {recentProjectAudit.length ? (
            <ol className="divide-y divide-border rounded-lg border">
              {recentProjectAudit.map((event) => (
                <li
                  key={event.id}
                  className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
                >
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium">
                        {event.category}
                      </span>
                      <p className="text-sm font-medium">
                        {event.userName} {event.action}
                      </p>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {event.projectCode} · {event.projectName}
                    </p>
                  </div>
                  <time className="text-xs text-muted-foreground" dateTime={event.createdAt}>
                    {new Intl.DateTimeFormat("pt-BR", {
                      dateStyle: "short",
                      timeStyle: "short",
                    }).format(new Date(event.createdAt))}
                  </time>
                </li>
              ))}
            </ol>
          ) : (
            <p className="rounded-lg border border-dashed border-border px-4 py-5 text-sm text-muted-foreground">
              Nenhuma movimentação registrada nas últimas 24 horas.
            </p>
          )}
        </div>
      </div>
    </AppLayout>
  );
}

import { useEffect, useMemo, useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import {
  Activity,
  AlertOctagon,
  AlertTriangle,
  Building2,
  Info,
  LifeBuoy,
  RefreshCw,
  Wallet,
} from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { getDeveloperOverview } from "@/lib/developer";
import type { DashboardAlert } from "@/lib/developer-metrics";
import { cn } from "@/lib/utils";
import { Badge, Empty, Metric, Panel, Trend } from "./shared";
import { brl, compactBrl, formatMinutes, relativeTime, type DeveloperTab } from "./format";

const RANGES = [7, 30, 90] as const;
const palette = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
];
const monthLabel = (key: string) =>
  new Date(`${key}-01T00:00:00Z`).toLocaleDateString("pt-BR", {
    month: "short",
    year: "2-digit",
    timeZone: "UTC",
  });
const dayLabel = (key: string) => `${key.slice(8, 10)}/${key.slice(5, 7)}`;

const severityIcon = {
  critical: <AlertOctagon className="size-4 shrink-0 text-red-600" aria-hidden="true" />,
  warning: <AlertTriangle className="size-4 shrink-0 text-amber-600" aria-hidden="true" />,
  info: <Info className="size-4 shrink-0 text-sky-600" aria-hidden="true" />,
} as const;
const severityLabel = { critical: "Críticos", warning: "Atenção", info: "Informativos" } as const;
const activityIcon = {
  company: <Building2 className="size-4" aria-hidden="true" />,
  ticket: <LifeBuoy className="size-4" aria-hidden="true" />,
  payment: <Wallet className="size-4" aria-hidden="true" />,
  audit: <Activity className="size-4" aria-hidden="true" />,
} as const;
const priorityLabels: Record<string, string> = {
  urgent: "Urgente",
  high: "Alta",
  normal: "Média",
  low: "Baixa",
};

function useNow(intervalMs = 1000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(timer);
  }, [intervalMs]);
  return now;
}

export function DashboardTab({
  onNavigate,
}: {
  onNavigate: (tab: DeveloperTab, focus?: string) => void;
}) {
  const [range, setRange] = useState<(typeof RANGES)[number]>(30);
  const [live, setLive] = useState(true);
  const [severityFilter, setSeverityFilter] = useState<DashboardAlert["severity"] | "all">("all");
  const [hiddenSeries, setHiddenSeries] = useState<string[]>([]);
  const now = useNow();
  const { data, isPending, isFetching, refetch, dataUpdatedAt, error } = useQuery({
    queryKey: ["developer-overview", range],
    queryFn: () => getDeveloperOverview({ data: { rangeDays: range } }),
    refetchInterval: live ? 15_000 : false,
    placeholderData: keepPreviousData,
  });

  const alerts = useMemo(
    () =>
      (data?.alerts ?? []).filter(
        (alert) => severityFilter === "all" || alert.severity === severityFilter,
      ),
    [data, severityFilter],
  );

  if (isPending) return <p className="p-4 text-muted-foreground">Carregando indicadores…</p>;
  if (error || !data) return <Empty>Não foi possível carregar o dashboard. Tente atualizar.</Empty>;

  const { kpis, series, distributions } = data;
  const alertCounts = {
    critical: data.alerts.filter((alert) => alert.severity === "critical").length,
    warning: data.alerts.filter((alert) => alert.severity === "warning").length,
    info: data.alerts.filter((alert) => alert.severity === "info").length,
  };
  const storageRatio = kpis.storage.capacityBytes
    ? kpis.storage.bytes / kpis.storage.capacityBytes
    : 0;
  const secondsAgo = Math.max(0, Math.round((now - dataUpdatedAt) / 1000));
  const mb = (bytes: number) =>
    (bytes / 1_048_576).toLocaleString("pt-BR", { maximumFractionDigits: 1 });
  const toggleSeries = (key: string) =>
    setHiddenSeries((current) =>
      current.includes(key) ? current.filter((item) => item !== key) : [...current, key],
    );

  const revenueData = series.months.map((key, index) => ({
    label: monthLabel(key),
    Recebido: series.receivedRevenue[index] ?? 0,
    Empresas: series.newCompanies[index] ?? 0,
  }));
  const dayData = series.days.map((key, index) => ({
    label: dayLabel(key),
    Abertos: series.ticketsOpened[index] ?? 0,
    Resolvidos: series.ticketsResolved[index] ?? 0,
    "Novos projetos": series.newProjects[index] ?? 0,
  }));
  const tickInterval = Math.max(0, Math.ceil(dayData.length / 8) - 1);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div
          role="group"
          aria-label="Período"
          className="inline-flex rounded-lg border bg-card p-1 text-sm"
        >
          {RANGES.map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setRange(option)}
              aria-pressed={range === option}
              className={cn(
                "min-h-9 rounded-md px-3 font-medium transition-colors",
                range === option
                  ? "bg-brand text-brand-foreground"
                  : "text-muted-foreground hover:bg-accent",
              )}
            >
              {option} dias
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <span className="inline-flex items-center gap-2" aria-live="polite">
            <span
              className={cn(
                "size-2.5 rounded-full",
                live ? "animate-pulse bg-emerald-500" : "bg-muted-foreground/50",
              )}
              aria-hidden="true"
            />
            {live ? "Ao vivo" : "Pausado"} · atualizado há {secondsAgo}s
          </span>
          <label className="inline-flex items-center gap-2">
            <Switch checked={live} onCheckedChange={setLive} aria-label="Atualização automática" />
            Automático (15 s)
          </label>
          <Button variant="outline" size="sm" onClick={() => void refetch()} disabled={isFetching}>
            <RefreshCw className={cn("size-4", isFetching && "animate-spin")} aria-hidden="true" />{" "}
            Atualizar
          </Button>
        </div>
      </div>

      <section
        aria-label="Indicadores principais"
        className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"
      >
        <Metric
          title="Receita recorrente (MRR)"
          value={brl(kpis.revenue.mrr)}
          hint={`ARR projetado ${compactBrl(kpis.revenue.arr)}`}
          onClick={() => onNavigate("financeiro")}
        />
        <Metric
          title={`Recebido em ${range} dias`}
          value={brl(kpis.revenue.receivedInRange)}
          hint={
            <Trend
              current={kpis.revenue.receivedInRange}
              previous={kpis.revenue.receivedPrevious}
            />
          }
          onClick={() => onNavigate("financeiro")}
        />
        <Metric
          title="Em atraso"
          value={kpis.subscriptions.byStatus.past_due}
          tone={kpis.subscriptions.byStatus.past_due > 0 ? "danger" : "good"}
          hint={`${brl(kpis.revenue.atRiskMrr)}/mês em risco · ${kpis.subscriptions.byStatus.expired} vencida(s)`}
          onClick={() => onNavigate("financeiro")}
        />
        <Metric
          title="Testes em andamento"
          value={kpis.subscriptions.byStatus.trialing}
          hint={`Potencial de ${brl(kpis.revenue.trialPotentialMrr)}/mês`}
          onClick={() => onNavigate("financeiro")}
        />
        <Metric
          title="Empresas ativas"
          value={kpis.companies.active}
          hint={
            <>
              {kpis.companies.newInRange} nova(s) no período ·{" "}
              <Trend current={kpis.companies.newInRange} previous={kpis.companies.newPrevious} />
            </>
          }
          onClick={() => onNavigate("financeiro")}
        />
        <Metric
          title="Usuários ativos"
          value={kpis.users.total}
          hint={<Trend current={kpis.users.newInRange} previous={kpis.users.newPrevious} />}
        />
        <Metric
          title="Projetos em andamento"
          value={kpis.projects.inProgress}
          hint={`${kpis.projects.total} no total · capital sob gestão ${compactBrl(kpis.projects.investedCapital)}`}
        />
        <Metric
          title="Chamados abertos"
          value={kpis.tickets.open}
          tone={
            kpis.tickets.breached > 0 ? "danger" : kpis.tickets.urgent > 0 ? "warning" : "default"
          }
          hint={`${kpis.tickets.urgent} urgente(s) · ${kpis.tickets.breached} com prazo vencido · 1ª resposta ${formatMinutes(kpis.tickets.averageFirstResponseMinutes)}`}
          onClick={() => onNavigate("helpdesk")}
        />
      </section>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <Panel
          title="Alertas e pendências"
          description="Regras avaliadas a cada atualização. Clique para ir ao ponto de ação."
          actions={
            <div className="flex flex-wrap gap-1 text-xs" role="group" aria-label="Filtrar alertas">
              {(["all", "critical", "warning", "info"] as const).map((key) => (
                <button
                  key={key}
                  type="button"
                  aria-pressed={severityFilter === key}
                  onClick={() => setSeverityFilter(key)}
                  className={cn(
                    "rounded-full border px-2.5 py-1 font-medium",
                    severityFilter === key
                      ? "border-brand bg-brand text-brand-foreground"
                      : "hover:bg-accent",
                  )}
                >
                  {key === "all"
                    ? `Todos (${data.alerts.length})`
                    : `${severityLabel[key]} (${alertCounts[key]})`}
                </button>
              ))}
            </div>
          }
        >
          {alerts.length === 0 ? (
            <Empty>
              {data.alerts.length === 0
                ? "Tudo em ordem: nenhum alerta no momento."
                : "Nenhum alerta neste filtro."}
            </Empty>
          ) : (
            <ul className="max-h-80 space-y-2 overflow-y-auto pr-1">
              {alerts.map((alert) => (
                <li key={alert.id}>
                  <button
                    type="button"
                    onClick={() => onNavigate(alert.tab, alert.organizationId)}
                    className="flex w-full items-start gap-3 rounded-lg border p-3 text-left transition-colors hover:bg-accent focus-visible:outline-2 focus-visible:outline-ring"
                  >
                    {severityIcon[alert.severity]}
                    <span className="min-w-0">
                      <span className="block break-words text-sm font-medium">{alert.title}</span>
                      <span className="block text-xs text-muted-foreground">{alert.detail}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel
          title="Atividade recente"
          description="Empresas, chamados, pagamentos e alterações do painel."
        >
          {data.activity.length === 0 ? (
            <Empty>Sem atividade registrada.</Empty>
          ) : (
            <ul className="max-h-80 space-y-3 overflow-y-auto pr-1">
              {data.activity.map((item) => (
                <li key={item.id} className="flex items-start gap-3 text-sm">
                  <span className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-full bg-primary-soft text-brand">
                    {activityIcon[item.kind]}
                  </span>
                  <span className="min-w-0">
                    <span className="block break-words">{item.text}</span>
                    <span className="text-xs text-muted-foreground">
                      {relativeTime(item.at, now)}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel
          title="Receita recebida (6 meses)"
          description="Pagamentos confirmados, Stripe e lançamentos manuais."
        >
          <div className="h-64" role="img" aria-label="Gráfico de receita recebida por mês">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={revenueData}>
                <defs>
                  <linearGradient id="revenueFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--chart-1)" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="var(--chart-1)" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="label" tickLine={false} axisLine={false} />
                <YAxis
                  tickFormatter={(value: number) => compactBrl(value)}
                  width={72}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip formatter={(value) => brl(Number(value))} />
                <Area
                  type="monotone"
                  dataKey="Recebido"
                  stroke="var(--chart-1)"
                  fill="url(#revenueFill)"
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Panel>
        <Panel title="Novas empresas por mês" description="Crescimento da base de clientes.">
          <div className="h-64" role="img" aria-label="Gráfico de novas empresas por mês">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={revenueData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="label" tickLine={false} axisLine={false} />
                <YAxis allowDecimals={false} width={32} tickLine={false} axisLine={false} />
                <Tooltip />
                <Bar dataKey="Empresas" fill="var(--chart-2)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Panel>
        <Panel
          title={`Chamados nos últimos ${range} dias`}
          description="Clique na legenda para mostrar ou ocultar uma série."
        >
          <div
            className="h-64"
            role="img"
            aria-label="Gráfico de chamados abertos e resolvidos por dia"
          >
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={dayData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="label" interval={tickInterval} tickLine={false} axisLine={false} />
                <YAxis allowDecimals={false} width={32} tickLine={false} axisLine={false} />
                <Tooltip />
                <Legend onClick={(entry) => toggleSeries(String(entry.dataKey))} />
                <Line
                  type="monotone"
                  dataKey="Abertos"
                  stroke="var(--chart-3)"
                  strokeWidth={2}
                  dot={false}
                  hide={hiddenSeries.includes("Abertos")}
                />
                <Line
                  type="monotone"
                  dataKey="Resolvidos"
                  stroke="var(--chart-2)"
                  strokeWidth={2}
                  dot={false}
                  hide={hiddenSeries.includes("Resolvidos")}
                />
                <Line
                  type="monotone"
                  dataKey="Novos projetos"
                  stroke="var(--chart-4)"
                  strokeWidth={2}
                  dot={false}
                  hide={hiddenSeries.includes("Novos projetos")}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Panel>
        <Panel
          title="Assinaturas por plano e status"
          description="Distribuição da carteira de clientes."
        >
          {distributions.byPlan.length === 0 ? (
            <Empty>Nenhuma assinatura cadastrada.</Empty>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="h-52" role="img" aria-label="Gráfico de assinaturas por plano">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={distributions.byPlan}
                      dataKey="value"
                      nameKey="name"
                      innerRadius={45}
                      outerRadius={80}
                      paddingAngle={2}
                    >
                      {distributions.byPlan.map((entry, index) => (
                        <Cell key={entry.name} fill={palette[index % palette.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="space-y-4">
                <ul className="space-y-1 text-sm">
                  {distributions.byPlan.map((entry, index) => (
                    <li key={entry.name} className="flex items-center gap-2">
                      <span
                        className="size-3 shrink-0 rounded-sm"
                        style={{ background: palette[index % palette.length] }}
                        aria-hidden="true"
                      />
                      <span className="min-w-0 flex-1 break-words">{entry.name}</span>
                      <strong>{entry.value}</strong>
                    </li>
                  ))}
                </ul>
                <div className="flex flex-wrap gap-1.5">
                  {distributions.byStatus.map((entry) => (
                    <Badge
                      key={entry.status}
                      tone={
                        entry.status === "active"
                          ? "good"
                          : entry.status === "past_due" || entry.status === "expired"
                            ? "danger"
                            : entry.status === "trialing"
                              ? "info"
                              : "muted"
                      }
                    >
                      {entry.label}: {entry.value}
                    </Badge>
                  ))}
                </div>
              </div>
            </div>
          )}
        </Panel>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <Panel
          title="Uso dos limites dos planos"
          description="Empresas mais próximas do limite (oportunidades de upgrade). O administrador não conta."
        >
          {data.usage.length === 0 ? (
            <Empty>Nenhuma empresa com limite definido.</Empty>
          ) : (
            <ul className="space-y-3">
              {data.usage.map((row) => (
                <li key={`${row.organizationId}-${row.label}`}>
                  <button
                    type="button"
                    onClick={() => onNavigate("planos", row.organizationId)}
                    className="block w-full rounded-lg p-2 text-left hover:bg-accent focus-visible:outline-2 focus-visible:outline-ring"
                  >
                    <span className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
                      <span className="min-w-0 break-words font-medium">
                        {row.company}{" "}
                        <span className="font-normal text-muted-foreground">· {row.planName}</span>
                      </span>
                      <span className="tabular-nums">
                        {row.used}/{row.limit} {row.label} ({row.percent}%)
                      </span>
                    </span>
                    <span
                      role="progressbar"
                      aria-valuenow={Math.min(100, row.percent ?? 0)}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      className="mt-1 block h-2 overflow-hidden rounded-full bg-muted"
                    >
                      <span
                        className={cn(
                          "block h-full",
                          row.level === "critical"
                            ? "bg-red-500"
                            : row.level === "warning"
                              ? "bg-amber-500"
                              : "bg-emerald-500",
                        )}
                        style={{ width: `${Math.min(100, row.percent ?? 0)}%` }}
                      />
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <div className="space-y-4">
          <Panel title="Armazenamento de mídias">
            <p className="text-sm">
              {(kpis.storage.bytes / 1024 ** 3).toLocaleString("pt-BR", {
                maximumFractionDigits: 2,
              })}{" "}
              GB de {(kpis.storage.capacityBytes / 1024 ** 3).toLocaleString("pt-BR")} GB ·{" "}
              {Math.round(storageRatio * 100)}%
            </p>
            <div
              role="progressbar"
              aria-valuenow={Math.min(100, storageRatio * 100)}
              aria-valuemin={0}
              aria-valuemax={100}
              className="mt-2 h-3 overflow-hidden rounded-full bg-muted"
            >
              <div
                className={cn(
                  "h-full",
                  storageRatio > 0.85
                    ? "bg-red-500"
                    : storageRatio >= 0.7
                      ? "bg-amber-500"
                      : "bg-emerald-500",
                )}
                style={{ width: `${Math.min(100, storageRatio * 100)}%` }}
              />
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              Documentos {mb(kpis.storage.byCategory.documents)} MB · Fotos{" "}
              {mb(kpis.storage.byCategory.photos)} MB · Anexos {mb(kpis.storage.byCategory.support)}{" "}
              MB
            </p>
          </Panel>
          <Panel title="Fila de suporte" description="Chamados abertos por prioridade.">
            <div className="grid grid-cols-4 gap-2 text-center">
              {distributions.ticketsByPriority.map((item) => (
                <button
                  key={item.priority}
                  type="button"
                  onClick={() => onNavigate("helpdesk")}
                  className="rounded-lg border p-2 hover:bg-accent focus-visible:outline-2 focus-visible:outline-ring"
                >
                  <span className="block text-xl font-semibold tabular-nums">{item.value}</span>
                  <span className="block text-xs text-muted-foreground">
                    {priorityLabels[item.priority]}
                  </span>
                </button>
              ))}
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              Solução média {formatMinutes(kpis.tickets.averageResolutionMinutes)} ·{" "}
              {kpis.tickets.resolvedInRange} resolvido(s) em {range} dias
            </p>
          </Panel>
        </div>
      </div>
    </div>
  );
}

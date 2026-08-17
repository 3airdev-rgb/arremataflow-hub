import { createFileRoute, Link } from "@tanstack/react-router";
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
import { StatusBadge } from "@/components/status-badge";
import {
  kpis,
  tarefas,
  pipeline,
  alertasCriticos,
  movimentacoesRecentes,
  formatBRL,
  projetos,
} from "@/lib/mock-data";

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

const vencimentos = [
  { dia: "17", mes: "AGO", titulo: "Averbação — Vila Mariana", tipo: "Cartório" },
  { dia: "18", mes: "AGO", titulo: "Vistoria de posse — Jd. Botânico", tipo: "Posse" },
  { dia: "20", mes: "AGO", titulo: "Orçamento hidráulica — Boa Viagem", tipo: "Obra" },
  { dia: "31", mes: "AGO", titulo: "Relatório mensal a investidores", tipo: "Financeiro" },
];

function Dashboard() {
  const hoje = tarefas.filter((t) => t.prazo === "Hoje");

  return (
    <AppLayout
      title="Dashboard Executivo"
      subtitle="Domingo, 16 de agosto de 2026 · Arremata Capital LTDA"
    >
      <div className="grid gap-5 lg:grid-cols-3">
        <div className="surface-card p-5 lg:col-span-2">
          <div className="mb-4 flex items-center gap-2">
            <AlertTriangle className="size-4.5 text-destructive" />
            <h3 className="text-base font-semibold">Alertas do dia</h3>
          </div>
          <ul className="space-y-3">
            {alertasCriticos.map((a) => {
              const projeto = projetos.find((p) => p.codigo === a.projeto);
              return (
                <li key={a.id}>
                  <Link
                    to="/projetos/$id"
                    params={{ id: projeto?.id || "" }}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-muted/40 px-4 py-3 transition-colors hover:bg-muted/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">{a.texto}</p>
                      <div className="mt-1 flex flex-col gap-0.5">
                        <p className="text-xs font-semibold text-muted-foreground">
                          {projeto?.nome || `Projeto ${a.projeto}`}
                        </p>
                        {projeto?.investidores && projeto.investidores.length > 0 && (
                          <div className="flex flex-col">
                            {projeto.investidores.map((investidor, idx) => (
                              <p key={idx} className="text-[10px] text-muted-foreground/80">
                                {investidor}
                              </p>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                    <StatusBadge status={a.nivel} />
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>

        <div className="surface-card p-5">
          <div className="mb-4 flex items-center gap-2">
            <CircleCheckBig className="size-4.5 text-success" />
            <h3 className="text-base font-semibold">Resumo do dia</h3>
          </div>
          <dl className="space-y-3 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Tarefas vencendo hoje</dt>
              <dd className="font-semibold">{hoje.length}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Concluídas na semana</dt>
              <dd className="font-semibold">14</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Novos documentos</dt>
              <dd className="font-semibold">6</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Movimentações financeiras</dt>
              <dd className="font-semibold">{formatBRL(128740)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Aportes recebidos</dt>
              <dd className="font-semibold text-success">{formatBRL(250000)}</dd>
            </div>
          </dl>
        </div>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <KpiCard label="Projetos ativos" value={kpis.projetosAtivos} icon={FolderKanban} hint="+3 no mês" />
        <KpiCard label="Regularizações" value={kpis.regularizacoes} icon={FileCheck} tone="info" />
        <KpiCard label="Pendências" value={kpis.pendencias} icon={AlertTriangle} tone="danger" hint="2 críticas" />
        <KpiCard label="Posse pendente" value={kpis.possePendente} icon={KeyRound} tone="warning" />
        <KpiCard label="Reformas" value={kpis.reformas} icon={Hammer} tone="warning" />
        <KpiCard label="Imóveis à venda" value={kpis.aVenda} icon={Store} tone="info" />
        <KpiCard label="Capital investido" value={formatBRL(kpis.capitalInvestido)} icon={Wallet} />
        <KpiCard label="Honorários" value={formatBRL(kpis.honorarios)} icon={BadgeDollarSign} tone="success" />
        <KpiCard
          label="Resultado projetado"
          value={formatBRL(kpis.resultadoProjetado)}
          icon={TrendingUp}
          tone="success"
        />
        <KpiCard
          label="Resultado realizado"
          value={formatBRL(kpis.resultadoRealizado)}
          icon={TrendingUp}
          tone="success"
          hint="Exercício 2026"
        />
      </div>

      <section className="mt-8">
        <h2 className="mb-4 text-lg font-semibold">Pipeline de projetos</h2>
        <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-5">
          {pipeline.map((col) => (
            <div key={col.etapa} className="rounded-xl border border-border bg-muted/40 p-3">
              <div className="mb-3 flex items-center justify-between px-1">
                <span className="text-sm font-semibold">{col.etapa}</span>
                <span className="rounded-full bg-card px-2 py-0.5 text-xs text-muted-foreground">
                  {col.itens.length}
                </span>
              </div>
              <div className="space-y-2">
                {col.itens.map((i) => (
                  <div key={i.codigo} className="surface-card p-3">
                    <p className="text-xs text-muted-foreground">{i.codigo}</p>
                    <p className="mt-0.5 text-sm font-medium leading-snug">{i.nome}</p>
                    <StatusBadge status={i.status} className="mt-2" />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      <div className="mt-8 grid gap-5 lg:grid-cols-3">
        <div className="surface-card p-5">
          <div className="mb-4 flex items-center gap-2">
            <CalendarDays className="size-4.5 text-brand" />
            <h3 className="text-base font-semibold">Calendário de vencimentos</h3>
          </div>
          <ul className="space-y-3">
            {vencimentos.map((v) => (
              <li key={v.titulo} className="flex items-center gap-3">
                <div className="grid size-11 shrink-0 place-items-center rounded-lg bg-primary-soft text-brand">
                  <span className="text-sm font-bold leading-none">{v.dia}</span>
                  <span className="text-[10px] font-medium">{v.mes}</span>
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{v.titulo}</p>
                  <p className="text-xs text-muted-foreground">{v.tipo}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <div className="surface-card p-5">
          <h3 className="mb-4 text-base font-semibold">Tarefas do dia</h3>
          <ul className="space-y-3">
            {tarefas.slice(0, 5).map((t) => (
              <li key={t.id} className="border-b border-border pb-3 last:border-0 last:pb-0">
                <p className="text-sm font-medium leading-snug">{t.titulo}</p>
                <div className="mt-1.5 flex items-center gap-2">
                  <StatusBadge status={t.status} />
                  <span className="text-xs text-muted-foreground">
                    {t.responsavel} · {t.prazo}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <div className="surface-card p-5">
          <div className="mb-4 flex items-center gap-2">
            <Activity className="size-4.5 text-brand" />
            <h3 className="text-base font-semibold">Últimas movimentações</h3>
          </div>
          <ul className="space-y-3">
            {movimentacoesRecentes.map((m) => (
              <li key={m.id} className="text-sm">
                <p className="leading-snug">{m.texto}</p>
                <p className="text-xs text-muted-foreground">
                  {m.projeto} · {m.quando}
                </p>
              </li>
            ))}
          </ul>
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

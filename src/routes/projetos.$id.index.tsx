import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { MapPin, Wallet, TrendingUp, BadgeDollarSign, ExternalLink, Pencil, Calculator } from "lucide-react";
import { toast } from "sonner";
import { AppLayout } from "@/components/app-layout";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { RegularizacaoTab } from "@/components/regularizacao-tab-form";
import { PosseTab } from "@/components/posse-tab-form";
import { ServiceProvidersCard } from "@/components/service-providers-card";
import { getCurrentOrganizationUser } from "@/lib/organization-users";
import { getProject } from "@/lib/projects";
import { listFinancialMovements } from "@/lib/financial";
import { listProjectDocuments } from "@/lib/documents";
import { listProjectAudit, listProjectTasks } from "@/lib/tasks";
import { NewFinancialMovementDialog } from "@/components/new-financial-movement-dialog";
import { SalesPortfolioCard } from "@/components/sales-portfolio-card";
import { SalesProposalsCard } from "@/components/sales-proposals-card";
import { COMMERCIAL_DATA_UPDATED, calculateDistribution as calculateDistributionOnServer, getCommercialData } from "@/lib/commercial";
import {
  ComprovantesFinanceiros,
  DemonstrativoResultado,
  type Movimentacao,
} from "@/routes/projetos.$id.financeiro";
import { formatBRL, formatBRLWithCents } from "@/lib/format-currency";

export const Route = createFileRoute("/projetos/$id/")({
  validateSearch: (search: Record<string, unknown>): {
    aba?: string;
    categoria?: string;
    novaMovimentacao?: string;
    descricao?: string;
  } => ({
    ...(typeof search["aba"] === "string" ? { aba: search["aba"] } : {}),
    ...(typeof search["categoria"] === "string" ? { categoria: search["categoria"] } : {}),
    ...(search["novaMovimentacao"] === "1" || search["novaMovimentacao"] === 1 || search["novaMovimentacao"] === true
      ? { novaMovimentacao: "1" }
      : {}),
    ...(typeof search["descricao"] === "string" ? { descricao: search["descricao"] } : {}),
  }),
  loader: async ({ params }) => {
    const projeto = await getProject({ data: { id: params.id } });
    if (!projeto) throw notFound();
    return { projeto };
  },
  head: ({ loaderData }) => {
    if (!loaderData) {
      return { meta: [{ title: "Projeto indisponível | ArremataFlow" }, { name: "robots", content: "noindex" }] };
    }
    const { projeto } = loaderData;
    return {
      meta: [
        { title: `${projeto.nome} | ArremataFlow` },
        {
          name: "description",
          content: `Ficha central do projeto ${projeto.codigo}: regularização, posse, financeiro, documentos, obra, venda e resultado.`,
        },
        { property: "og:title", content: `${projeto.nome} | ArremataFlow` },
        { property: "og:description", content: `${projeto.endereco} — ${projeto.modalidade}` },
        { property: "og:image", content: projeto.foto },
        { name: "twitter:image", content: projeto.foto },
      ],
    };
  },
  component: FichaProjeto,
});

const abas = [
  "Visão Geral",
  "Regularização",
  "Posse",
  "Financeiro",
  "Documentos",
  "Tarefas",
  "Obra",
  "Venda",
  "Resultado",
  "Distribuição de Resultados",
  "Histórico",
];

const slug = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, "-");

type DistributionParticipant = { nome: string; percentual: number; valor: number };
type DistributionSnapshot = {
  result: number;
  advisoryShare: number;
  investorShare: number;
  investors: DistributionParticipant[];
  assessors: DistributionParticipant[];
  calculatedAt: string;
};


function Bloco({ titulo, itens }: { titulo: string; itens: { label: string; valor: string }[] }) {
  return (
    <div className="surface-card p-5">
      <h3 className="mb-4 text-base font-semibold">{titulo}</h3>
      <dl className="space-y-3 text-sm">
        {itens.map((i) => (
          <div key={i.label} className="flex justify-between gap-4">
            <dt className="text-muted-foreground">{i.label}</dt>
            <dd className="text-right font-medium">{i.valor}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function FinancialProjectTab({
  projetoId,
  openNewMovement,
  defaultCategory,
  defaultDescription,
}: {
  projetoId: string;
  openNewMovement?: boolean;
  defaultCategory?: string;
  defaultDescription?: string;
}) {
  const { data: movimentacoes = [], refetch } = useQuery({
    queryKey: ["financial-movements", projetoId],
    queryFn: () => listFinancialMovements({ data: { projectId: projetoId } }),
  });

  const receitasProjeto = movimentacoes.filter((movement) => movement.tipo === "receita");
  const despesasProjeto = movimentacoes.filter((movement) => movement.tipo === "despesa");
  const totalReceitas = receitasProjeto.reduce((total, movement) => total + movement.valor, 0);
  const totalDespesas = despesasProjeto.reduce((total, movement) => total + movement.valor, 0);
  const saldo = totalReceitas - totalDespesas;

  return (
    <div>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-lg font-semibold">Financeiro do Projeto</h3>
          <p className="text-sm text-muted-foreground">Receitas, despesas e comprovantes deste projeto.</p>
        </div>
        <NewFinancialMovementDialog
          projetoId={projetoId}
          {...(openNewMovement !== undefined ? { defaultOpen: openNewMovement } : {})}
          {...(defaultCategory ? { defaultCategory } : {})}
          {...(defaultDescription ? { defaultDescription } : {})}
          onSaved={async () => { await refetch(); }}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="surface-card p-4">
          <p className="text-sm text-muted-foreground">Total de receitas</p>
          <p className="mt-1 text-xl font-semibold text-success">{formatBRL(totalReceitas)}</p>
        </div>
        <div className="surface-card p-4">
          <p className="text-sm text-muted-foreground">Total de despesas</p>
          <p className="mt-1 text-xl font-semibold text-destructive">{formatBRL(totalDespesas)}</p>
        </div>
        <div className="surface-card p-4">
          <p className="text-sm text-muted-foreground">Saldo do projeto</p>
          <p className={`mt-1 text-xl font-semibold ${saldo >= 0 ? "text-success" : "text-destructive"}`}>
            {formatBRL(saldo)}
          </p>
        </div>
      </div>

      <DemonstrativoResultado receitas={receitasProjeto} despesas={despesasProjeto} />
      <ComprovantesFinanceiros movimentacoes={movimentacoes} />
    </div>
  );
}

function ProjectAuditHistory({ projetoId }: { projetoId: string }) {
  const { data: events = [] } = useQuery({
    queryKey: ["project-audit", projetoId],
    queryFn: () => listProjectAudit({ data: { projectId: projetoId } }),
  });

  const formatAuditDate = (value: string) => new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "medium",
  }).format(new Date(value));

  return (
    <div className="surface-card p-5">
      <h3 className="text-base font-semibold">Auditoria de movimentações</h3>
      <p className="mt-1 text-sm text-muted-foreground">
        Inclusões, edições, exclusões, documentos, relatórios e impressões realizados neste projeto.
      </p>
      {events.length ? (
        <ol className="relative mt-5 space-y-5 border-l border-border pl-6">
          {events.map((event) => (
            <li key={event.id}>
              <span className="absolute -left-1.5 mt-1.5 size-3 rounded-full bg-brand" />
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium">{event.category}</span>
                <p className="text-sm font-medium">{event.userName} {event.action}</p>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">{formatAuditDate(event.createdAt)}</p>
            </li>
          ))}
        </ol>
      ) : (
        <p className="mt-5 rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
          Nenhuma movimentação registrada neste projeto.
        </p>
      )}
    </div>
  );
}

function SalesIndicator({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "muted" | "brand" | "success" | "danger";
}) {
  const styles = {
    muted: "border-slate-200 bg-slate-50 text-slate-800",
    brand: "border-sky-200 bg-sky-50 text-brand",
    success: "border-emerald-200 bg-emerald-50 text-emerald-700",
    danger: "border-red-200 bg-red-50 text-red-700",
  };

  return (
    <div className={`rounded-xl border p-4 ${styles[tone]}`}>
      <p className="text-xs font-semibold uppercase tracking-wide opacity-75">{label}</p>
      <p className="mt-2 text-2xl font-bold">{value}</p>
    </div>
  );
}

function FichaProjeto() {
  const { projeto } = Route.useLoaderData();
  const { aba, categoria, novaMovimentacao, descricao } = Route.useSearch();
  const [activeTab, setActiveTab] = useState(aba || "visao-geral");
  const [projectAdvisoryMode, setProjectAdvisoryMode] = useState(projeto.modalidade);
  const [financialSummary, setFinancialSummary] = useState({
    investedCapital: projeto.valorAquisicao,
    acquisitionValue: projeto.valorAquisicao,
    advisoryFees: projeto.honorarios,
    projectedResult: 0,
  });
  const [salesIndicators, setSalesIndicators] = useState({
    minimum: 0,
    estimated: 0,
    maximum: 0,
    isAvailable: false,
    isSold: false,
  });
  const [salesSettlement, setSalesSettlement] = useState({
    hasAcceptedProposal: false,
    finalSaleValue: 0,
    taxValue: 0,
    commissionValue: 0,
  });
  const [distribution, setDistribution] = useState<DistributionSnapshot | null>(null);
  const { data: projectFinancialMovements = [] } = useQuery({
    queryKey: ["financial-movements", projeto.id],
    queryFn: () => listFinancialMovements({ data: { projectId: projeto.id } }),
  });
  const { data: projectDocuments = [] } = useQuery({
    queryKey: ["project-documents", projeto.id],
    queryFn: () => listProjectDocuments({ data: { projectId: projeto.id } }),
  });
  const { data: tarefasProjeto = [] } = useQuery({
    queryKey: ["project-tasks", projeto.id],
    queryFn: () => listProjectTasks({ data: { projectId: projeto.id } }),
  });
  const { data: authenticatedUser } = useQuery({ queryKey: ["current-organization-user"], queryFn: () => getCurrentOrganizationUser() });
  const { data: commercialData, refetch: refetchCommercial } = useQuery({ queryKey: ["commercial-data", projeto.id], queryFn: () => getCommercialData({ data: { projectId: projeto.id } }) });
  useEffect(() => { const refresh = (event: Event) => { const id = (event as CustomEvent<{ projectId?: string }>).detail?.projectId; if (!id || id === projeto.id) void refetchCommercial(); }; window.addEventListener(COMMERCIAL_DATA_UPDATED, refresh); return () => window.removeEventListener(COMMERCIAL_DATA_UPDATED, refresh); }, [projeto.id, refetchCommercial]);
  const canEdit = ["owner", "admin"].includes(authenticatedUser?.role || "");
  const normalizedAdvisoryMode = projectAdvisoryMode
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
  const isCompleteAdvisory = normalizedAdvisoryMode === "completa"
    || normalizedAdvisoryMode === "assessoria completa";
  const visibleTabs = abas.filter((tab) => isCompleteAdvisory
    ? tab !== "Resultado"
    : tab !== "Distribuição de Resultados"
  );

  useEffect(() => {
    if (aba) setActiveTab(aba);
  }, [aba]);

  useEffect(() => {
    const refreshFinancialSummary = () => {
      const acquisitionValue = Number(projeto.valorAquisicao) || 0;
      const advisoryFees = isCompleteAdvisory
        ? 0
        : Number(projeto.honorarios) || 0;
      const projections = (projeto.projecoes_financeiras || {}) as Record<string, unknown>;
      const projectedRevenue = Number(projections["venda"]) || 0;
      const projectedExpenses = Object.entries(projections)
        .filter(([field]) => field !== "venda" && !(isCompleteAdvisory && field === "assessoria"))
        .reduce((total, [, value]) => total + (Number(value) || 0), 0);
      const actualExpenses = projectFinancialMovements
        .filter((movement) => movement.tipo === "despesa")
        .reduce((total, movement) => total + (Number(movement.valor) || 0), 0);

      setFinancialSummary({
        investedCapital: acquisitionValue + actualExpenses,
        acquisitionValue,
        advisoryFees,
        projectedResult: projectedRevenue - projectedExpenses,
      });
    };

    const handleFinancialUpdate = (event: Event) => {
      const detail = (event as CustomEvent<{ projectId?: string }>).detail;
      if (!detail?.projectId || detail.projectId === projeto.id) refreshFinancialSummary();
    };

    refreshFinancialSummary();
    window.addEventListener("storage", refreshFinancialSummary);
    window.addEventListener("focus", refreshFinancialSummary);
    return () => {
      window.removeEventListener("storage", refreshFinancialSummary);
      window.removeEventListener("focus", refreshFinancialSummary);
    };
  }, [projeto.id, projeto.valorAquisicao, projeto.honorarios, isCompleteAdvisory, projectFinancialMovements]);

  useEffect(() => { setProjectAdvisoryMode(String(projeto.modalidade)); }, [projeto.modalidade]);

  useEffect(() => {
    const tabIsVisible = visibleTabs.some((tab) => slug(tab) === activeTab);
    if (!tabIsVisible) setActiveTab("visao-geral");
  }, [activeTab, isCompleteAdvisory]);

  useEffect(() => {
    const refreshSalesIndicators = () => {
      const portfolio = (commercialData?.portfolio || []) as any[];
      const proposals = (commercialData?.proposals || []) as any[];
      const advertisedValues = portfolio
        .map((entry) => Number(entry.advertisedValue) || 0)
        .filter((value) => value > 0);
      const projections = projeto.projecoes_financeiras as { venda?: unknown } | undefined;
      const isAvailable = portfolio
        .some((entry) => entry.isPropertyAvailable ?? true);
      const acceptedProposal = [...proposals]
        .filter((proposal) => proposal.status === "Aceita")
        .sort((a, b) => b.number - a.number)[0];
      const isSold = Boolean(acceptedProposal);
      const broker = acceptedProposal
        ? portfolio.find((entry) => entry.id === acceptedProposal.originId)
        : undefined;

      setSalesSettlement({
        hasAcceptedProposal: Boolean(acceptedProposal),
        finalSaleValue: Number(acceptedProposal?.finalSaleValue) || 0,
        taxValue: Number(acceptedProposal?.taxValue) || 0,
        commissionValue: Number(broker?.commissionValue) || 0,
      });

      setSalesIndicators({
        minimum: advertisedValues.length ? Math.min(...advertisedValues) : 0,
        estimated: Number(projections?.venda) || 0,
        maximum: advertisedValues.length ? Math.max(...advertisedValues) : 0,
        isAvailable,
        isSold,
      });
    };

    refreshSalesIndicators();
  }, [commercialData, projeto.projecoes_financeiras]);

  useEffect(() => {
    setDistribution((commercialData?.distributions?.[0] as DistributionSnapshot | undefined) || null);
  }, [commercialData]);

  const calculateDistribution = async () => {
    if (!salesSettlement.hasAcceptedProposal) return;
    try { const snapshot = await calculateDistributionOnServer({ data: { projectId: projeto.id } }); setDistribution(snapshot as DistributionSnapshot); await refetchCommercial(); toast.success("Resultados apurados com sucesso."); }
    catch (error) { toast.error(error instanceof Error ? error.message : "Não foi possível apurar os resultados."); }
  };

  const projectedVsAdvertised = salesIndicators.estimated > 0
    ? ((salesIndicators.maximum - salesIndicators.estimated) / salesIndicators.estimated) * 100
    : 0;
  const commercializationStatus = salesIndicators.isSold
    ? { label: "Imóvel Vendido", className: "bg-emerald-600" }
    : salesIndicators.isAvailable
      ? { label: "Imóvel disponibilizado para venda", className: "bg-brand" }
      : { label: "Imóvel não disponibilizado para venda", className: "bg-red-600" };

  return (
    <AppLayout title={projeto.nome} subtitle={`${projeto.codigo} · ${projeto.modalidade}`}>
      <div className="surface-card overflow-hidden">
        <div className="relative h-52 sm:h-64">
          <img
            src={projeto.foto}
            alt={`Foto principal do imóvel ${projeto.nome}`}
            className="size-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-primary/85 to-primary/10" />
          <div className="absolute inset-x-0 bottom-0 p-6 text-primary-foreground flex flex-col md:flex-row md:items-end md:justify-between gap-4">
            <div>
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="rounded-full bg-white/20 px-2.5 py-1 font-medium">
                  {projeto.codigo}
                </span>
                <span className="rounded-full bg-white/20 px-2.5 py-1 font-medium">
                  {projeto.modalidade}
                </span>
                <StatusBadge status={projeto.status} className="bg-white/90" />
              </div>
              <h2 className="mt-2 text-2xl font-semibold text-white">{projeto.nome}</h2>
              <a 
                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${projeto.endereco}, ${projeto.cidade}`)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-sm text-white/85 hover:text-white hover:underline transition-colors w-fit"
              >
                <MapPin className="size-4" /> {projeto.endereco} — {projeto.cidade}
              </a>
            </div>
            
            {canEdit ? (
              <Button asChild className="bg-white text-brand hover:bg-white/90 font-medium">
                <Link to="/projetos/$id/editar" params={{ id: projeto.id }}>
                  <Pencil className="mr-2 size-4" />
                  Editar Projeto
                </Link>
              </Button>
            ) : null}
          </div>
        </div>
        <div className="grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-5">
          <div>
            <p className="text-xs text-muted-foreground">Investidores</p>
            <p className="text-sm font-medium">{projeto.investidores.length > 0 ? projeto.investidores.join(", ") : "Nenhum investidor vinculado"}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Assessores</p>
            <p className="text-sm font-medium">{projeto.assessores.length > 0 ? projeto.assessores.join(", ") : "Nenhum assessor vinculado"}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Responsáveis</p>
            <p className="text-sm font-medium">{projeto.responsavel || "Nenhum responsável"}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Etapa atual</p>
            <p className="text-sm font-medium">{projeto.etapa}</p>
          </div>
          <div>
            <p className="mb-1 text-xs text-muted-foreground">Progresso {projeto.progresso}%</p>
            <Progress value={projeto.progresso} />
          </div>
        </div>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { l: "Capital investido", v: formatBRLWithCents(financialSummary.investedCapital), i: Wallet },
          { l: "Valor de aquisição", v: formatBRLWithCents(financialSummary.acquisitionValue), i: BadgeDollarSign },
          ...(!isCompleteAdvisory ? [{ l: "Honorários", v: formatBRLWithCents(financialSummary.advisoryFees), i: BadgeDollarSign }] : []),
          { l: "Resultado projetado", v: formatBRLWithCents(financialSummary.projectedResult), i: TrendingUp },
        ].map((k) => (
          <div key={k.l} className="surface-card p-4">
            <p className="text-sm text-muted-foreground">{k.l}</p>
            <p className="mt-1 text-xl font-semibold">{k.v}</p>
          </div>
        ))}
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-8">
        {!canEdit ? (
          <div className="mb-4 rounded-lg border border-brand/20 bg-primary-soft px-4 py-3 text-sm text-brand">
            Modo de visualização: você pode consultar todo o projeto e utilizar somente as ações permitidas ao seu perfil.
          </div>
        ) : null}
        <TabsList className="h-auto w-full bg-transparent p-0 flex flex-col gap-2">
          {/* Primeira linha (6 botões) */}
          <div className="grid w-full grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2">
            {visibleTabs.slice(0, 6).map((a) => (
              <TabsTrigger
                key={a}
                value={slug(a)}
                className="w-full h-11 px-4 py-2 text-sm font-semibold rounded-lg border border-border bg-white transition-all hover:bg-muted/50 data-[state=active]:bg-brand data-[state=active]:text-white data-[state=active]:shadow-md data-[state=active]:border-brand"
              >
                {a}
              </TabsTrigger>
            ))}
          </div>
          {/* Segunda linha (5 botões) */}
          <div className="grid w-full grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
            {visibleTabs.slice(6).map((a) => (
              <TabsTrigger
                key={a}
                value={slug(a)}
                className="w-full min-h-11 h-auto px-4 py-2 text-sm leading-tight whitespace-normal font-semibold rounded-lg border border-border bg-white transition-all hover:bg-muted/50 data-[state=active]:bg-brand data-[state=active]:text-white data-[state=active]:shadow-md data-[state=active]:border-brand"
              >
                {a === "Distribuição de Resultados" ? (
                  <span className="flex flex-col items-center">
                    <span>Distribuição de</span>
                    <span>Resultados</span>
                  </span>
                ) : a}
              </TabsTrigger>
            ))}
          </div>
        </TabsList>

        <TabsContent value="visao-geral" className="mt-5 grid gap-5 lg:grid-cols-2">
          <Bloco
            titulo="Imóvel"
            itens={[
              { label: "Endereço", valor: projeto.endereco },
              { label: "Cidade", valor: projeto.cidade },
              { label: "Área Privativa", valor: projeto.area || "-" },
              { label: "Área do Terreno", valor: projeto.land_area ? `${projeto.land_area.toLocaleString('pt-BR')} m²` : "-" },
              { label: "Área Construída", valor: projeto.built_area ? `${projeto.built_area.toLocaleString('pt-BR')} m²` : "-" },
              { label: "Área Total", valor: projeto.total_area ? `${projeto.total_area.toLocaleString('pt-BR')} m²` : "-" },
              { label: "Matrícula", valor: projeto.matricula },
            ]}
          />
          <Bloco
            titulo="Aquisição"
            itens={[
              { label: "Data", valor: projeto.dataAquisicao },
              { label: "Valor", valor: formatBRL(projeto.valorAquisicao) },
              { label: "Modalidade", valor: projeto.modalidade },
              { label: "Responsável", valor: projeto.responsavel },
            ]}
          />
          <div className="surface-card p-5 lg:col-span-2">
            <h3 className="mb-4 text-base font-semibold">Galeria do imóvel</h3>
            <div className="flex gap-3 overflow-x-auto pb-1">
              {(projeto.fotos as string[]).map((f: string, i: number) => (
                <img
                  key={f}
                  src={f}
                  alt={`Imagem ${i + 1} do imóvel ${projeto.nome}`}
                  loading="lazy"
                  className="h-32 w-48 shrink-0 rounded-lg object-cover"
                />
              ))}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="regularizacao">
          <fieldset disabled={!canEdit}>
            <RegularizacaoTab projetoId={projeto.id} />
          </fieldset>
        </TabsContent>

        <TabsContent value="posse">
          <fieldset disabled={!canEdit}>
            <PosseTab projetoId={projeto.id} />
          </fieldset>
        </TabsContent>

        <TabsContent value="financeiro" className="mt-5">
          <FinancialProjectTab
            projetoId={projeto.id}
            openNewMovement={novaMovimentacao === "1"}
            {...(categoria ? { defaultCategory: categoria } : {})}
            {...(descricao ? { defaultDescription: descricao } : {})}
          />
        </TabsContent>

        <TabsContent value="documentos" className="mt-5">
          <div className="surface-card p-5">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-base font-semibold">Documentos recentes</h3>
              <Button asChild variant="outline" size="sm">
                <Link
                  to="/projetos/$id/documentos"
                  params={{ id: projeto.id }}
                  search={{ categoria: undefined, retorno: `/projetos/${projeto.id}?aba=documentos` }}
                >
                  Gestão documental <ExternalLink className="size-4" />
                </Link>
              </Button>
            </div>
            <ul className="divide-y divide-border text-sm">
              {projectDocuments.slice(0, 5).map((d) => (
                <li key={d.id} className="flex justify-between py-2.5">
                  <a href={d.url} className="font-medium text-brand hover:underline">{d.nome}</a>
                  <span className="text-muted-foreground">
                    {d.categoria} · {d.versao} · {d.data}
                  </span>
                </li>
              ))}
              {projectDocuments.length === 0 ? <li className="py-5 text-sm text-muted-foreground">Nenhum documento enviado.</li> : null}
            </ul>
          </div>
        </TabsContent>

        <TabsContent value="tarefas" className="mt-5">
          <div className="surface-card p-5">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-base font-semibold">Tarefas do projeto</h3>
              {canEdit ? (
                <Button asChild variant="outline" size="sm">
                  <Link to="/projetos/$id/tarefas" params={{ id: projeto.id }}>
                    Gerenciar tarefas <ExternalLink className="size-4" />
                  </Link>
                </Button>
              ) : null}
            </div>
            <ul className="divide-y divide-border">
              {tarefasProjeto.slice(0, 3).map((t) => (
                <li key={t.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
                  <div>
                    <p className="text-sm font-medium">{t.titulo}</p>
                    <p className="text-xs text-muted-foreground">
                      {t.responsavel} · vence {t.prazo}
                    </p>
                  </div>
                  <StatusBadge status={t.status as "atrasado" | "pendente" | "aguardando" | "andamento" | "nao_iniciado" | "concluido"} />
                </li>
              ))}
              {tarefasProjeto.length === 0 ? <li className="py-5 text-sm text-muted-foreground">Nenhuma tarefa cadastrada.</li> : null}
            </ul>
          </div>
        </TabsContent>

        <TabsContent value="obra" className="mt-5 grid gap-5 lg:grid-cols-2">
          <fieldset disabled={!canEdit} className="contents">
            <ServiceProvidersCard projectId={projeto.id} />
          </fieldset>
        </TabsContent>

        <TabsContent value="venda" className="mt-5 grid gap-5 lg:grid-cols-2">
          <div className="surface-card overflow-hidden border-brand/30 shadow-md lg:col-span-2">
            <div className={`${commercializationStatus.className} px-5 py-4 text-white`}>
              <p className="text-sm font-medium text-white/80">Comercialização</p>
              <h3 className="mt-1 text-xl font-semibold">{commercializationStatus.label}</h3>
            </div>
            <div className="grid gap-4 p-5 sm:grid-cols-2 xl:grid-cols-4">
              <SalesIndicator label="Menor Valor Anunciado" value={formatBRL(salesIndicators.minimum)} tone="muted" />
              <SalesIndicator label="Valor Estimado de Venda" value={formatBRL(salesIndicators.estimated)} tone="brand" />
              <SalesIndicator label="Maior Valor Anunciado" value={formatBRL(salesIndicators.maximum)} tone="success" />
              <SalesIndicator
                label="Variação Projetado x Anunciado"
                value={`${projectedVsAdvertised > 0 ? "+" : ""}${projectedVsAdvertised.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`}
                tone={projectedVsAdvertised >= 0 ? "success" : "danger"}
              />
            </div>
          </div>
          <SalesProposalsCard projectId={projeto.id} />
          <fieldset disabled={!canEdit} className="contents">
            <SalesPortfolioCard projectId={projeto.id} />
          </fieldset>
        </TabsContent>

        {!isCompleteAdvisory ? <TabsContent value="resultado" className="mt-5 grid gap-5 lg:grid-cols-2">
          <Bloco
            titulo="Apuração"
            itens={[
              { label: "Receita bruta", valor: formatBRL(0) },
              { label: "Custos totais", valor: formatBRL(0) },
              { label: "Tributos", valor: formatBRL(0) },
              { label: "Resultado líquido", valor: formatBRL(0) },
            ]}
          />
          <Bloco
            titulo="Distribuição"
            itens={[]}
          />
        </TabsContent> : null}

        {isCompleteAdvisory ? <TabsContent value="distribuicao-de-resultados" className="mt-5 space-y-5">
          <div className="surface-card p-6">
            <h3 className="mb-6 text-lg font-semibold">Cálculo de Distribuição</h3>
            
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4 mb-8">
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground font-medium">Resultado Líquido</p>
                <p className="text-2xl font-bold text-brand">{formatBRL(distribution?.result || 0)}</p>
                <p className="text-xs text-muted-foreground">Venda final menos impostos, comissão e capital investido</p>
              </div>
              <div className="space-y-1 border-l pl-6">
                <p className="text-sm text-muted-foreground font-medium">Parcela da Assessoria (50%)</p>
                <p className="text-2xl font-bold text-brand">{formatBRL(distribution?.advisoryShare || 0)}</p>
                <p className="text-xs text-muted-foreground">Regra: Assessoria Completa</p>
              </div>
              <div className="space-y-1 border-l pl-6">
                <p className="text-sm text-muted-foreground font-medium">Parcela dos Investidores (50%)</p>
                <p className="text-2xl font-bold text-brand">{formatBRL(distribution?.investorShare || 0)}</p>
                <p className="text-xs text-muted-foreground">Divisão proporcional às cotas</p>
              </div>
              <div className="space-y-1 border-l pl-6">
                <p className="text-sm text-muted-foreground font-medium">Status da Operação</p>
                <div className="pt-1">
                  <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${distribution ? "bg-success/10 text-success ring-success/20" : "bg-destructive/10 text-destructive ring-destructive/20"}`}>
                    {distribution ? "Apurado" : "Não apurado"}
                  </span>
                </div>
                <Button
                  type="button"
                  size="sm"
                  className="mt-3 h-8 gap-1.5"
                  disabled={!salesSettlement.hasAcceptedProposal}
                  onClick={calculateDistribution}
                  title={salesSettlement.hasAcceptedProposal ? "Apurar resultados" : "É necessário possuir uma proposta aceita"}
                >
                  <Calculator className="size-4" />
                  Apurar resultados
                </Button>
              </div>
            </div>

            <div className="grid gap-8 lg:grid-cols-2">
              <div className="space-y-4">
                <h4 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Repasse aos Investidores (Cotas)</h4>
                <div className="space-y-3">
                  {(distribution?.investors || []).map((inv) => (
                    <div key={inv.nome} className="flex items-center justify-between p-3 rounded-lg border bg-muted/30">
                      <div>
                        <p className="font-medium">{inv.nome}</p>
                        <p className="text-xs text-muted-foreground">Participação: {inv.percentual.toLocaleString("pt-BR")}%</p>
                      </div>
                      <p className="font-semibold text-brand">{formatBRL(inv.valor)}</p>
                    </div>
                  ))}
                  {!distribution && <p className="text-sm text-muted-foreground">Aguardando apuração dos resultados.</p>}
                </div>
              </div>

              <div className="space-y-4">
                <h4 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Honorários dos Assessores</h4>
                <div className="space-y-3">
                  {(distribution?.assessors || []).map((ass) => (
                    <div key={ass.nome} className="flex items-center justify-between p-3 rounded-lg border bg-muted/30">
                      <div>
                        <p className="font-medium">{ass.nome}</p>
                        <p className="text-xs text-muted-foreground">Participação: {ass.percentual.toLocaleString("pt-BR")}%</p>
                      </div>
                      <p className="font-semibold text-brand">{formatBRL(ass.valor)}</p>
                    </div>
                  ))}
                  {!distribution && <p className="text-sm text-muted-foreground">Aguardando apuração dos resultados.</p>}
                </div>
              </div>
            </div>

            <div className="mt-8 pt-6 border-t">
               <h4 className="mb-4 text-sm font-semibold uppercase tracking-wider text-muted-foreground">Histórico da Distribuição</h4>
               <div className="text-sm text-muted-foreground">
                 {distribution ? (
                   <div className="flex gap-4 py-2">
                     <span className="w-24">{new Intl.DateTimeFormat("pt-BR").format(new Date(distribution.calculatedAt))}</span>
                     <span className="font-medium text-foreground">Distribuição processada por {authenticatedUser?.name || "usuário autenticado"}</span>
                   </div>
                 ) : (
                   <p>Nenhuma apuração realizada.</p>
                 )}
               </div>
            </div>
          </div>
        </TabsContent> : null}

        <TabsContent value="historico" className="mt-5">
          <ProjectAuditHistory projetoId={projeto.id} />
        </TabsContent>
      </Tabs>
    </AppLayout>
  );
}

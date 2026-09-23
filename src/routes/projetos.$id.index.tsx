import { KpiCard } from "@/components/kpi-card";
import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { MapPin, Wallet, TrendingUp, BadgeDollarSign, Pencil, Calculator } from "lucide-react";
import { toast } from "sonner";
import { AppLayout } from "@/components/app-layout";
import { AuthenticatedImage } from "@/components/authenticated-image";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
  type CarouselApi,
} from "@/components/ui/carousel";
import { Progress } from "@/components/ui/progress";
import { RegularizacaoTab } from "@/components/regularizacao-tab-form";
import { PosseTab } from "@/components/posse-tab-form";
import { ServiceProvidersCard } from "@/components/service-providers-card";
import { getCurrentOrganizationUser } from "@/lib/organization-users";
import { getActivePlan } from "@/lib/developer";
import { getProject, getProjectMilestoneProgress, getCurrentProjectRole } from "@/lib/projects";
import { listFinancialMovements } from "@/lib/financial";
import { ProjectDocumentManagement } from "@/components/project-document-management";
import { listProjectAudit } from "@/lib/tasks";
import { NewFinancialMovementDialog } from "@/components/new-financial-movement-dialog";
import { SalesPortfolioCard } from "@/components/sales-portfolio-card";
import { SalesProposalsCard } from "@/components/sales-proposals-card";
import {
  COMMERCIAL_DATA_UPDATED,
  calculateDistribution as calculateDistributionOnServer,
  getCommercialData,
} from "@/lib/commercial";
import {
  ComprovantesFinanceiros,
  DemonstrativoResultado,
  type Movimentacao,
} from "@/routes/projetos.$id.financeiro";
import { formatBRL, formatBRLWithCents } from "@/lib/format-currency";
import { cn } from "@/lib/utils";
import { ProjectContracts } from "@/components/project-contracts";
import { ProjectTasksPanel } from "@/routes/projetos.$id.tarefas";

export const Route = createFileRoute("/projetos/$id/")({
  validateSearch: (
    search: Record<string, unknown>,
  ): {
    aba?: string;
    categoria?: string;
    novaMovimentacao?: string;
    descricao?: string;
  } => ({
    ...(typeof search["aba"] === "string" ? { aba: search["aba"] } : {}),
    ...(typeof search["categoria"] === "string" ? { categoria: search["categoria"] } : {}),
    ...(search["novaMovimentacao"] === "1" ||
    search["novaMovimentacao"] === 1 ||
    search["novaMovimentacao"] === true
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
      return {
        meta: [
          { title: "Projeto indisponível | ArremataFlow" },
          { name: "robots", content: "noindex" },
        ],
      };
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
  "Contratos",
  "Distribuição de Resultados",
  "Histórico",
];

const slug = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, "-");

const capitalizeInitial = (value: string) =>
  value ? `${value.charAt(0).toLocaleUpperCase("pt-BR")}${value.slice(1)}` : "Não definida";

const acquisitionOriginLabels: Record<string, string> = {
  "leilao-judicial": "Leilão judicial",
  "leilao-extra": "Leilão extrajudicial",
  "venda-direta": "Venda direta bancária",
  particular: "Aquisição particular",
};

const paymentMethodLabels: Record<string, string> = {
  avista: "À vista",
  parcelado: "Parcelado",
  financiado: "Financiado",
};

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

function ProjectGallery({ images, projectName }: { images: string[]; projectName: string }) {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [carouselApi, setCarouselApi] = useState<CarouselApi>();

  useEffect(() => {
    if (!carouselApi) return;
    const updateIndex = () => setCurrentIndex(carouselApi.selectedScrollSnap());
    updateIndex();
    carouselApi.on("select", updateIndex);
    carouselApi.on("reInit", updateIndex);
    return () => {
      carouselApi.off("select", updateIndex);
      carouselApi.off("reInit", updateIndex);
    };
  }, [carouselApi]);

  return (
    <>
      <div className="flex gap-3 overflow-x-auto pb-1">
        {images.map((image, index) => (
          <button
            key={`${image}-${index}`}
            type="button"
            className="shrink-0 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
            onClick={() => {
              setCurrentIndex(index);
              setSelectedIndex(index);
            }}
            aria-label={`Abrir imagem ${index + 1} de ${images.length} do imóvel ${projectName}`}
          >
            <AuthenticatedImage
              src={image}
              alt={`Imagem ${index + 1} do imóvel ${projectName}`}
              loading="lazy"
              className="h-32 w-48 rounded-lg object-cover"
            />
          </button>
        ))}
      </div>

      <Dialog
        open={selectedIndex !== null}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedIndex(null);
            setCarouselApi(undefined);
          }
        }}
      >
        <DialogContent className="w-[calc(100vw-1rem)] max-w-6xl overflow-hidden border-0 bg-black/95 p-3 text-white sm:p-6">
          <DialogTitle className="sr-only">Galeria do imóvel {projectName}</DialogTitle>
          <DialogDescription className="sr-only">
            Use as setas para navegar entre as imagens da galeria.
          </DialogDescription>
          {selectedIndex !== null ? (
            <Carousel
              key={selectedIndex}
              setApi={setCarouselApi}
              opts={{ startIndex: selectedIndex }}
              className="mx-auto w-full max-w-5xl px-11 sm:px-14"
              aria-label={`Galeria do imóvel ${projectName}`}
            >
              <CarouselContent>
                {images.map((image, index) => (
                  <CarouselItem
                    key={`${image}-${index}`}
                    aria-label={`${index + 1} de ${images.length}`}
                  >
                    <div className="flex h-[min(78vh,760px)] items-center justify-center">
                      <AuthenticatedImage
                        src={image}
                        alt={`Imagem ${index + 1} do imóvel ${projectName}`}
                        loading={index === selectedIndex ? "eager" : "lazy"}
                        className="max-h-full max-w-full object-contain"
                      />
                    </div>
                  </CarouselItem>
                ))}
              </CarouselContent>
              <CarouselPrevious
                aria-label="Imagem anterior"
                className="left-0 size-10 border-white/30 bg-black/60 text-white hover:bg-black/80 hover:text-white sm:left-1"
              />
              <CarouselNext
                aria-label="Próxima imagem"
                className="right-0 size-10 border-white/30 bg-black/60 text-white hover:bg-black/80 hover:text-white sm:right-1"
              />
              <p className="mt-2 text-center text-sm text-white/80" aria-live="polite">
                {currentIndex + 1} de {images.length}
              </p>
            </Carousel>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}

function FinancialProjectTab({
  projetoId,
  openNewMovement,
  defaultCategory,
  defaultDescription,
  movementRequestId = 0,
  onMovementDialogOpenChange,
  onMovementSaved,
}: {
  projetoId: string;
  openNewMovement?: boolean;
  defaultCategory?: string;
  defaultDescription?: string;
  movementRequestId?: number;
  onMovementDialogOpenChange?: (open: boolean) => void;
  onMovementSaved?: () => void | Promise<void>;
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
          <p className="text-sm text-muted-foreground">
            Receitas, despesas e comprovantes deste projeto.
          </p>
        </div>
        <NewFinancialMovementDialog
          key={`new-financial-movement-${movementRequestId}`}
          projetoId={projetoId}
          {...(openNewMovement !== undefined ? { defaultOpen: openNewMovement } : {})}
          {...(defaultCategory ? { defaultCategory } : {})}
          {...(defaultDescription ? { defaultDescription } : {})}
          {...(onMovementDialogOpenChange ? { onOpenChange: onMovementDialogOpenChange } : {})}
          onSaved={async () => {
            await refetch();
            await onMovementSaved?.();
          }}
        />
      </div>

      <div className="kpi-grid">
        <KpiCard
          label="Total de receitas"
          value={formatBRLWithCents(totalReceitas)}
          valueClassName="text-success"
        />
        <KpiCard
          label="Total de despesas"
          value={formatBRLWithCents(totalDespesas)}
          valueClassName="text-destructive"
        />
        <KpiCard
          label="Saldo do projeto"
          value={formatBRLWithCents(saldo)}
          valueClassName={saldo >= 0 ? "text-success" : "text-destructive"}
        />
      </div>

      <DemonstrativoResultado
        receitas={receitasProjeto}
        despesas={despesasProjeto}
        projetoId={projetoId}
        onUpdated={async () => {
          await refetch();
        }}
      />
      <ComprovantesFinanceiros movimentacoes={movimentacoes} />
    </div>
  );
}

function ProjectAuditHistory({ projetoId }: { projetoId: string }) {
  const { data: events = [] } = useQuery({
    queryKey: ["project-audit", projetoId],
    queryFn: () => listProjectAudit({ data: { projectId: projetoId } }),
  });

  const formatAuditDate = (value: string) =>
    new Intl.DateTimeFormat("pt-BR", {
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
                <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium">
                  {event.category}
                </span>
                <p className="text-sm font-medium">
                  {event.userName} {event.action}
                </p>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {formatAuditDate(event.createdAt)}
              </p>
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
    muted: "border-border bg-muted text-foreground",
    brand: "border-brand/25 bg-highlight-soft text-brand",
    success: "border-emerald-200 bg-emerald-50 text-emerald-700",
    danger: "border-red-200 bg-red-50 text-red-700",
  };

  return (
    <KpiCard
      label={label}
      value={value}
      className={styles[tone]}
      labelClassName="text-xs font-semibold uppercase tracking-wide text-inherit opacity-75"
      valueClassName="font-bold"
    />
  );
}

function FichaProjeto() {
  const { projeto } = Route.useLoaderData();
  const { data: activePlan } = useQuery({
    queryKey: ["active-plan"],
    queryFn: () => getActivePlan(),
  });
  const { aba, categoria, novaMovimentacao, descricao } = Route.useSearch();
  const [activeTab, setActiveTab] = useState(aba || "visao-geral");
  const [financialMovementRequest, setFinancialMovementRequest] = useState({
    id: 0,
    open: novaMovimentacao === "1",
    category: categoria || "",
    description: descricao || "",
    returnTab: null as string | null,
  });
  const [projectAdvisoryMode, setProjectAdvisoryMode] = useState(projeto.modalidade);
  const [financialSummary, setFinancialSummary] = useState({
    investedCapital: projeto.valorAquisicao,
    acquisitionValue: projeto.valorAquisicao,
    advisoryFees: projeto.honorarios,
    currentResult: -projeto.valorAquisicao,
    currentRoi: projeto.valorAquisicao > 0 ? -100 : 0,
    projectedResult: 0,
    projectedRoi: 0,
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
  const { data: authenticatedUser } = useQuery({
    queryKey: ["current-organization-user"],
    queryFn: () => getCurrentOrganizationUser(),
  });
  const { data: commercialData, refetch: refetchCommercial } = useQuery({
    queryKey: ["commercial-data", projeto.id],
    queryFn: () => getCommercialData({ data: { projectId: projeto.id } }),
  });
  const { data: milestoneProgress, refetch: refetchMilestoneProgress } = useQuery({
    queryKey: ["project-milestone-progress", projeto.id],
    queryFn: () => getProjectMilestoneProgress({ data: { projectId: projeto.id } }),
  });
  useEffect(() => {
    const refresh = (event: Event) => {
      const id = (event as CustomEvent<{ projectId?: string }>).detail?.projectId;
      if (!id || id === projeto.id) void refetchCommercial();
    };
    window.addEventListener(COMMERCIAL_DATA_UPDATED, refresh);
    return () => window.removeEventListener(COMMERCIAL_DATA_UPDATED, refresh);
  }, [projeto.id, refetchCommercial]);
  useEffect(() => {
    const refresh = (event: Event) => {
      const id = (event as CustomEvent<{ projectId?: string }>).detail?.projectId;
      if (!id || id === projeto.id) void refetchMilestoneProgress();
    };
    const events = [
      "project-operations-updated",
      "financial-movements-updated",
      "project-documents-updated",
      COMMERCIAL_DATA_UPDATED,
    ];
    events.forEach((eventName) => window.addEventListener(eventName, refresh));
    window.addEventListener("focus", refresh);
    return () => {
      events.forEach((eventName) => window.removeEventListener(eventName, refresh));
      window.removeEventListener("focus", refresh);
    };
  }, [projeto.id, refetchMilestoneProgress]);
  const { data: currentProjectRole } = useQuery({
    queryKey: ["current-project-role", projeto.id],
    queryFn: () => getCurrentProjectRole({ data: { projectId: projeto.id } }),
  });
  const canEdit = ["owner", "admin", "project_manager"].includes(currentProjectRole || "");
  const normalizedAdvisoryMode = projectAdvisoryMode
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
  const isCompleteAdvisory =
    normalizedAdvisoryMode === "completa" || normalizedAdvisoryMode === "assessoria completa";
  const visibleTabs = abas.filter(
    (tab) =>
      (isCompleteAdvisory ? tab !== "Resultado" : tab !== "Distribuição de Resultados") &&
      (!activePlan || activePlan.projectTabs.includes(tab)),
  );

  useEffect(() => {
    if (aba) setActiveTab(aba);
  }, [aba]);

  useEffect(() => {
    const refreshFinancialSummary = () => {
      const acquisitionValue = Number(projeto.valorAquisicao) || 0;
      const advisoryFees = isCompleteAdvisory ? 0 : Number(projeto.honorarios) || 0;
      const projections = (projeto.projecoes_financeiras || {}) as Record<string, unknown>;
      const projectedRevenue = Number(projections["venda"]) || 0;
      const projectedAcquisition = Number(projections["aquisicao"]) || acquisitionValue;
      const projectedOtherExpenses = Object.entries(projections)
        .filter(
          ([field]) =>
            field !== "venda" &&
            field !== "aquisicao" &&
            !(isCompleteAdvisory && field === "assessoria"),
        )
        .reduce((total, [, value]) => total + (Number(value) || 0), 0);
      const projectedInvestment = projectedAcquisition + projectedOtherExpenses;
      const projectedResult = projectedRevenue - projectedInvestment;
      const actualExpenses = projectFinancialMovements
        .filter((movement) => movement.tipo === "despesa")
        .reduce((total, movement) => total + (Number(movement.valor) || 0), 0);
      const actualRevenue = projectFinancialMovements
        .filter((movement) => movement.tipo === "receita")
        .reduce((total, movement) => total + (Number(movement.valor) || 0), 0);
      const investedCapital = acquisitionValue + actualExpenses;
      const currentResult = actualRevenue - investedCapital;

      setFinancialSummary({
        investedCapital,
        acquisitionValue,
        advisoryFees,
        currentResult,
        currentRoi: investedCapital > 0 ? (currentResult / investedCapital) * 100 : 0,
        projectedResult,
        projectedRoi: projectedInvestment > 0 ? (projectedResult / projectedInvestment) * 100 : 0,
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
  }, [
    projeto.id,
    projeto.valorAquisicao,
    projeto.honorarios,
    projeto.projecoes_financeiras,
    isCompleteAdvisory,
    projectFinancialMovements,
  ]);

  useEffect(() => {
    setProjectAdvisoryMode(String(projeto.modalidade));
  }, [projeto.modalidade]);

  useEffect(() => {
    const tabIsVisible = visibleTabs.some((tab) => slug(tab) === activeTab);
    if (!tabIsVisible) setActiveTab("visao-geral");
  }, [activeTab, visibleTabs]);

  useEffect(() => {
    const refreshSalesIndicators = () => {
      type PortfolioEntry = {
        id: string;
        advertisedValue?: unknown;
        commissionValue?: unknown;
        isPropertyAvailable?: boolean;
      };
      type ProposalEntry = {
        status: string;
        number: number;
        originId?: string | null;
        finalSaleValue?: unknown;
        taxValue?: unknown;
      };
      const portfolio = (commercialData?.portfolio || []) as PortfolioEntry[];
      const proposals = (commercialData?.proposals || []) as ProposalEntry[];
      const advertisedValues = portfolio
        .map((entry) => Number(entry.advertisedValue) || 0)
        .filter((value) => value > 0);
      const projections = projeto.projecoes_financeiras as { venda?: unknown } | undefined;
      const isAvailable = portfolio.some((entry) => entry.isPropertyAvailable ?? true);
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
    setDistribution(
      (commercialData?.distributions?.[0] as DistributionSnapshot | undefined) || null,
    );
  }, [commercialData]);

  const calculateDistribution = async () => {
    if (!salesSettlement.hasAcceptedProposal) return;
    try {
      const snapshot = await calculateDistributionOnServer({ data: { projectId: projeto.id } });
      setDistribution(snapshot as DistributionSnapshot);
      await refetchCommercial();
      toast.success("Resultados apurados com sucesso.");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Não foi possível apurar os resultados.",
      );
    }
  };

  const projectedVsAdvertised =
    salesIndicators.estimated > 0
      ? ((salesIndicators.maximum - salesIndicators.estimated) / salesIndicators.estimated) * 100
      : 0;
  const commercializationStatus = salesIndicators.isSold
    ? { label: "Imóvel Vendido", className: "bg-emerald-600" }
    : salesIndicators.isAvailable
      ? { label: "Imóvel disponibilizado para venda", className: "bg-brand" }
      : { label: "Imóvel não disponibilizado para venda", className: "bg-red-600" };

  return (
    <AppLayout
      title={projeto.nome}
      subtitle={`${projeto.codigo} · ${capitalizeInitial(projeto.modalidade)}`}
    >
      <div className="surface-card overflow-hidden">
        <div className="relative h-52 sm:h-64">
          <AuthenticatedImage
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
                  {capitalizeInitial(projeto.modalidade)}
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
            <p className="text-sm font-medium">
              {projeto.investidores.length > 0
                ? projeto.investidores.join(", ")
                : "Nenhum investidor vinculado"}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Assessores</p>
            <p className="text-sm font-medium">
              {projeto.assessores.length > 0
                ? projeto.assessores
                    .map((assessor: string | { nome?: string }) =>
                      typeof assessor === "string" ? assessor : assessor.nome,
                    )
                    .filter(Boolean)
                    .join(", ")
                : "Nenhum assessor vinculado"}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Responsáveis</p>
            <p className="text-sm font-medium">{projeto.responsavel || "Nenhum responsável"}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Modalidade</p>
            <p className="text-sm font-medium">{capitalizeInitial(projeto.modalidade)}</p>
          </div>
          <div>
            <p className="mb-1 text-xs text-muted-foreground">
              Progresso {milestoneProgress?.percentage ?? 0}% · {milestoneProgress?.completed ?? 0}/
              {milestoneProgress?.total ?? 0} marcos
            </p>
            <Progress value={milestoneProgress?.percentage ?? 0} />
          </div>
        </div>
      </div>

      <div className="kpi-grid mt-6">
        {[
          {
            l: "Capital investido",
            v: formatBRLWithCents(financialSummary.investedCapital),
            i: Wallet,
          },
          {
            l: "Valor de aquisição",
            v: formatBRLWithCents(financialSummary.acquisitionValue),
            i: BadgeDollarSign,
          },
          ...(!isCompleteAdvisory
            ? [
                {
                  l: "Honorários",
                  v: formatBRLWithCents(financialSummary.advisoryFees),
                  i: BadgeDollarSign,
                },
              ]
            : []),
          {
            l: "Resultado Atual",
            v: formatBRLWithCents(financialSummary.currentResult),
            i: TrendingUp,
            indicator: financialSummary.currentResult,
          },
          {
            l: "Resultado Projetado",
            v: formatBRLWithCents(financialSummary.projectedResult),
            i: TrendingUp,
            indicator: financialSummary.projectedResult,
          },
          {
            l: "ROI Projetado",
            v: `${financialSummary.projectedRoi.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`,
            i: TrendingUp,
            indicator: financialSummary.projectedRoi,
          },
        ].map((k) => (
          <KpiCard
            key={k.l}
            label={k.l}
            value={k.v}
            valueClassName={cn(
              k.indicator != null && k.indicator < 0 && "text-red-600",
              k.indicator != null && k.indicator > 0 && "text-green-600",
            )}
          />
        ))}
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-8">
        {!canEdit ? (
          <div className="mb-4 rounded-lg border border-brand/20 bg-primary-soft px-4 py-3 text-sm text-brand">
            Modo de visualização: você pode consultar todo o projeto e utilizar somente as ações
            permitidas ao seu perfil.
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
                ) : (
                  a
                )}
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
              {
                label: "Área do Terreno",
                valor: projeto.land_area ? `${projeto.land_area.toLocaleString("pt-BR")} m²` : "-",
              },
              {
                label: "Área Construída",
                valor: projeto.built_area
                  ? `${projeto.built_area.toLocaleString("pt-BR")} m²`
                  : "-",
              },
              {
                label: "Área Total",
                valor: projeto.total_area
                  ? `${projeto.total_area.toLocaleString("pt-BR")} m²`
                  : "-",
              },
              {
                label: "Quartos",
                valor: projeto.bedrooms != null ? String(projeto.bedrooms) : "-",
              },
              {
                label: "Banheiros",
                valor: projeto.bathrooms != null ? String(projeto.bathrooms) : "-",
              },
              {
                label: "Vagas de Garagem",
                valor: projeto.parking_spaces != null ? String(projeto.parking_spaces) : "-",
              },
              { label: "Suítes", valor: projeto.suites != null ? String(projeto.suites) : "-" },
              { label: "Matrícula", valor: projeto.matricula },
            ]}
          />
          <div className="grid gap-5">
            <Bloco
              titulo="Aquisição"
              itens={[
                {
                  label: "Origem",
                  valor: acquisitionOriginLabels[projeto.origem] || projeto.origem || "-",
                },
                { label: "Valor de aquisição", valor: formatBRL(projeto.valorAquisicao) },
                {
                  label: "Forma de pagamento",
                  valor:
                    paymentMethodLabels[projeto.forma_pagamento] || projeto.forma_pagamento || "-",
                },
                ...(["parcelado", "financiado"].includes(projeto.forma_pagamento)
                  ? [
                      {
                        label: "Quantidade de parcelas",
                        valor: String(Number(projeto.quantidade_parcelas) || 0),
                      },
                      {
                        label: "Valor da parcela",
                        valor: formatBRL(Number(projeto.valor_parcela) || 0),
                      },
                    ]
                  : []),
              ]}
            />
            <Bloco
              titulo="Projeções Financeiras"
              itens={[
                {
                  label: "Aquisição",
                  valor: formatBRL(Number(projeto.projecoes_financeiras?.aquisicao) || 0),
                },
                {
                  label: "Cartório",
                  valor: formatBRL(Number(projeto.projecoes_financeiras?.cartorio) || 0),
                },
                {
                  label: "Prefeitura",
                  valor: formatBRL(Number(projeto.projecoes_financeiras?.prefeitura) || 0),
                },
                {
                  label: "Condomínio",
                  valor: formatBRL(Number(projeto.projecoes_financeiras?.condominio) || 0),
                },
                {
                  label: "Jurídico",
                  valor: formatBRL(Number(projeto.projecoes_financeiras?.juridico) || 0),
                },
                {
                  label: "Obra",
                  valor: formatBRL(Number(projeto.projecoes_financeiras?.obra) || 0),
                },
                ...(!isCompleteAdvisory
                  ? [
                      {
                        label: "Assessoria",
                        valor: formatBRL(Number(projeto.projecoes_financeiras?.assessoria) || 0),
                      },
                    ]
                  : []),
                {
                  label: "Estimativa de venda",
                  valor: formatBRL(Number(projeto.projecoes_financeiras?.venda) || 0),
                },
              ]}
            />
          </div>
          <div className="surface-card p-5 lg:col-span-2">
            <h3 className="mb-4 text-base font-semibold">Galeria do imóvel</h3>
            <ProjectGallery images={projeto.fotos as string[]} projectName={projeto.nome} />
          </div>
        </TabsContent>

        <TabsContent value="regularizacao">
          <fieldset disabled={!canEdit}>
            <RegularizacaoTab
              projetoId={projeto.id}
              onRequestFinancialMovement={(category, description) => {
                setFinancialMovementRequest((current) => ({
                  id: current.id + 1,
                  open: true,
                  category,
                  description,
                  returnTab: "regularizacao",
                }));
                setActiveTab("financeiro");
              }}
            />
          </fieldset>
        </TabsContent>

        <TabsContent value="posse">
          <fieldset disabled={!canEdit}>
            <PosseTab
              projetoId={projeto.id}
              onRequestFinancialMovement={(category, description) => {
                setFinancialMovementRequest((current) => ({
                  id: current.id + 1,
                  open: true,
                  category,
                  description,
                  returnTab: "posse",
                }));
                setActiveTab("financeiro");
              }}
            />
          </fieldset>
        </TabsContent>

        <TabsContent value="financeiro" className="mt-5">
          <FinancialProjectTab
            projetoId={projeto.id}
            openNewMovement={financialMovementRequest.open}
            movementRequestId={financialMovementRequest.id}
            onMovementDialogOpenChange={(open) => {
              if (!open) {
                const returnTab = financialMovementRequest.returnTab;
                setFinancialMovementRequest((current) => ({
                  ...current,
                  open: false,
                  returnTab: null,
                }));
                if (returnTab) setActiveTab(returnTab);
              }
            }}
            onMovementSaved={() => {
              if (financialMovementRequest.returnTab) {
                const returnTab = financialMovementRequest.returnTab;
                setFinancialMovementRequest((current) => ({
                  ...current,
                  open: false,
                  returnTab: null,
                }));
                setActiveTab(returnTab);
              }
            }}
            {...(financialMovementRequest.category
              ? { defaultCategory: financialMovementRequest.category }
              : {})}
            {...(financialMovementRequest.description
              ? { defaultDescription: financialMovementRequest.description }
              : {})}
          />
        </TabsContent>

        <TabsContent value="documentos" className="mt-5">
          <ProjectDocumentManagement projectId={projeto.id} />
        </TabsContent>

        <TabsContent value="tarefas" className="mt-5">
          <ProjectTasksPanel projectId={projeto.id} />
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
            <div className="kpi-grid p-5">
              <SalesIndicator
                label="Menor Valor Anunciado"
                value={formatBRL(salesIndicators.minimum)}
                tone="muted"
              />
              <SalesIndicator
                label="Valor Estimado de Venda"
                value={formatBRL(salesIndicators.estimated)}
                tone="brand"
              />
              <SalesIndicator
                label="Maior Valor Anunciado"
                value={formatBRL(salesIndicators.maximum)}
                tone="success"
              />
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

        {!isCompleteAdvisory ? (
          <TabsContent value="resultado" className="mt-5 grid gap-5 lg:grid-cols-2">
            <Bloco
              titulo="Apuração"
              itens={[
                { label: "Receita bruta", valor: formatBRL(0) },
                { label: "Custos totais", valor: formatBRL(0) },
                { label: "Tributos", valor: formatBRL(0) },
                { label: "Resultado líquido", valor: formatBRL(0) },
              ]}
            />
            <Bloco titulo="Distribuição" itens={[]} />
          </TabsContent>
        ) : null}

        {isCompleteAdvisory ? (
          <TabsContent value="distribuicao-de-resultados" className="mt-5 space-y-5">
            <div className="surface-card p-6">
              <h3 className="mb-6 text-lg font-semibold">Cálculo de Distribuição</h3>

              <div className="kpi-grid mb-8">
                <KpiCard
                  label="Resultado Líquido"
                  value={formatBRL(distribution?.result || 0)}
                  valueClassName="font-bold text-brand"
                  hint="Venda final menos impostos, comissão e capital investido"
                />
                <KpiCard
                  label="Parcela da Assessoria (50%)"
                  value={formatBRL(distribution?.advisoryShare || 0)}
                  valueClassName="font-bold text-brand"
                  hint="Regra: Assessoria Completa"
                />
                <KpiCard
                  label="Parcela dos Investidores (50%)"
                  value={formatBRL(distribution?.investorShare || 0)}
                  valueClassName="font-bold text-brand"
                  hint="Divisão proporcional às cotas"
                />
                <div className="kpi-card">
                  <p className="text-sm text-muted-foreground font-medium">Status da Operação</p>
                  <div className="pt-1">
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${distribution ? "bg-success/10 text-success ring-success/20" : "bg-destructive/10 text-destructive ring-destructive/20"}`}
                    >
                      {distribution ? "Apurado" : "Não apurado"}
                    </span>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    className="mt-3 h-8 gap-1.5"
                    disabled={!salesSettlement.hasAcceptedProposal}
                    onClick={calculateDistribution}
                    title={
                      salesSettlement.hasAcceptedProposal
                        ? "Apurar resultados"
                        : "É necessário possuir uma proposta aceita"
                    }
                  >
                    <Calculator className="size-4" />
                    Apurar resultados
                  </Button>
                </div>
              </div>

              <div className="grid gap-8 lg:grid-cols-2">
                <div className="space-y-4">
                  <h4 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                    Repasse aos Investidores (Cotas)
                  </h4>
                  <div className="space-y-3">
                    {(distribution?.investors || []).map((inv) => (
                      <div
                        key={inv.nome}
                        className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-lg border bg-muted/30"
                      >
                        <div>
                          <p className="font-medium">{inv.nome}</p>
                          <p className="text-xs text-muted-foreground">
                            Participação: {inv.percentual.toLocaleString("pt-BR")}%
                          </p>
                        </div>
                        <p className="font-semibold text-brand">{formatBRL(inv.valor)}</p>
                      </div>
                    ))}
                    {!distribution && (
                      <p className="text-sm text-muted-foreground">
                        Aguardando apuração dos resultados.
                      </p>
                    )}
                  </div>
                </div>

                <div className="space-y-4">
                  <h4 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                    Honorários dos Assessores
                  </h4>
                  <div className="space-y-3">
                    {(distribution?.assessors || []).map((ass) => (
                      <div
                        key={ass.nome}
                        className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-lg border bg-muted/30"
                      >
                        <div>
                          <p className="font-medium">{ass.nome}</p>
                          <p className="text-xs text-muted-foreground">
                            Participação: {ass.percentual.toLocaleString("pt-BR")}%
                          </p>
                        </div>
                        <p className="font-semibold text-brand">{formatBRL(ass.valor)}</p>
                      </div>
                    ))}
                    {!distribution && (
                      <p className="text-sm text-muted-foreground">
                        Aguardando apuração dos resultados.
                      </p>
                    )}
                  </div>
                </div>
              </div>

              <div className="mt-8 pt-6 border-t">
                <h4 className="mb-4 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                  Histórico da Distribuição
                </h4>
                <div className="text-sm text-muted-foreground">
                  {distribution ? (
                    <div className="flex flex-wrap gap-4 py-2">
                      <span className="w-24">
                        {new Intl.DateTimeFormat("pt-BR").format(
                          new Date(distribution.calculatedAt),
                        )}
                      </span>
                      <span className="font-medium text-foreground">
                        Distribuição processada por{" "}
                        {authenticatedUser?.name || "usuário autenticado"}
                      </span>
                    </div>
                  ) : (
                    <p>Nenhuma apuração realizada.</p>
                  )}
                </div>
              </div>
            </div>
          </TabsContent>
        ) : null}

        <TabsContent value="contratos" className="mt-5">
          <ProjectContracts
            projectId={projeto.id}
            projectName={projeto.nome}
            projectCode={projeto.codigo}
            projectAddress={`${projeto.endereco}${projeto.cidade ? ` — ${projeto.cidade}` : ""}`}
            advisors={(projeto.assessores || [])
              .map((assessor: string | { nome?: string }) =>
                typeof assessor === "string" ? assessor : assessor.nome || "",
              )
              .filter(Boolean)}
            canEdit={canEdit}
          />
        </TabsContent>

        <TabsContent value="historico" className="mt-5">
          <ProjectAuditHistory projetoId={projeto.id} />
        </TabsContent>
      </Tabs>
    </AppLayout>
  );
}

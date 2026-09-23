import { createFileRoute, redirect, useNavigate, useParams } from "@tanstack/react-router";
import { useState, useMemo, useEffect, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  House,
  Handshake,
  BriefcaseBusiness,
  Users,
  Save,
  UserPlus,
  Search,
  Trash2,
  CalendarIcon,
  CheckCircle2,
  UserCheck,
  Plus,
  CircleDollarSign,
} from "lucide-react";
import { SectionCard } from "@/components/project-form-section-card";
import { AppLayout } from "@/components/app-layout";
import { getActivePlan } from "@/lib/developer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { toast } from "sonner";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { formatBRL } from "@/lib/format-currency";
import { getCurrentProjectRole, getProject, saveProject } from "@/lib/projects";
import { createContact, listContacts } from "@/lib/contacts";
import { inviteOrganizationUser } from "@/lib/organization-users";
import {
  InvestorRegistrationModal,
  type UnifiedEntityData,
} from "@/components/investor-registration-modal";
import { Calendar } from "@/components/ui/calendar";
import { ImageManagementSection, type ProjetoFoto } from "@/components/image-management-section";
import { CurrencyInput } from "@/components/ui/currency-input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { AdvisoryModeInfo } from "@/components/advisory-mode-info";
import { showValidationAlert } from "@/lib/validation-feedback";
import { getOrganizationSettings } from "@/lib/organization-settings";
import { NewFinancialMovementDialog } from "@/components/new-financial-movement-dialog";

export const Route = createFileRoute("/_authenticated/projetos/$id/editar")({
  beforeLoad: async ({ params }) => {
    const role = await getCurrentProjectRole({ data: { projectId: params.id } });
    if (!["owner", "admin", "project_manager"].includes(role || ""))
      throw redirect({ to: "/projetos/$id", params: { id: params.id } });
  },
  component: EditarProjeto,
});

type LinkedPerson = {
  id?: string;
  nome?: string;
  percentual?: string | number;
};

function EditarProjeto() {
  const { id } = useParams({ from: "/_authenticated/projetos/$id/editar" });
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: usuarios = [] } = useQuery({
    queryKey: ["contacts"],
    queryFn: () => listContacts(),
  });
  const { data: organizationSettings } = useQuery({
    queryKey: ["active-organization"],
    queryFn: () => getOrganizationSettings(),
  });
  const { data: activePlan } = useQuery({
    queryKey: ["active-plan"],
    queryFn: () => getActivePlan(),
  });
  const honorariosEdited = useRef(false);
  const [hasSavedHonorarios, setHasSavedHonorarios] = useState(false);

  const [loading, setLoading] = useState(true);
  const [projeto, setProjeto] = useState<Awaited<ReturnType<typeof getProject>> | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [status, setStatus] = useState<string>("nao_iniciado");

  const [fotosUpload, setFotosUpload] = useState<ProjetoFoto[]>([]);
  const [participantes, setParticipantes] = useState<
    { id: string; nome: string; papel: string; percentual: string }[]
  >([]);
  const [assessoresVinculados, setAssessoresVinculados] = useState<
    { id: string; nome: string; papel: string; percentual: string }[]
  >([]);
  const [responsaveisVinculados, setResponsaveisVinculados] = useState<
    { id: string; nome: string }[]
  >([]);

  const [modalidade, setModalidade] = useState<string>("");
  const [valorAquisicao, setValorAquisicao] = useState<number>(0);
  const [percentualHonorarios, setPercentualHonorarios] = useState<number>(10);
  useEffect(() => {
    if (organizationSettings && !hasSavedHonorarios && !honorariosEdited.current)
      setPercentualHonorarios(organizationSettings.defaultAdvisoryFeePercent);
  }, [organizationSettings, hasSavedHonorarios]);
  const [temMinimo, setTemMinimo] = useState<string>("nao");
  const [valorMinimo, setValorMinimo] = useState<number>(0);
  const [dataAquisicao, setDataAquisicao] = useState<Date | undefined>(undefined);
  const [formaPagamento, setFormaPagamento] = useState<string>("");
  const [tipoImovel, setTipoImovel] = useState<string>("");
  const [origem, setOrigem] = useState<string>("");
  const [percentualComissao, setPercentualComissao] = useState<number>(5);
  const [leiloeiroVinculado, setLeiloeiroVinculado] = useState<{ id: string; nome: string } | null>(
    null,
  );
  const [valorFinanciado, setValorFinanciado] = useState<number>(0);
  const [valorEntrada, setValorEntrada] = useState<number>(0);
  const [quantidadeParcelas, setQuantidadeParcelas] = useState<number>(1);
  const [valorParcela, setValorParcela] = useState<number>(0);
  const [commissionMovementOpen, setCommissionMovementOpen] = useState(false);
  const [commissionMovementRequestId, setCommissionMovementRequestId] = useState(0);
  const [isInvestorModalOpen, setIsInvestorModalOpen] = useState(false);
  const [isAssessorModalOpen, setIsAssessorModalOpen] = useState(false);
  const [isResponsibleModalOpen, setIsResponsibleModalOpen] = useState(false);
  const [isLeiloeiroModalOpen, setIsLeiloeiroModalOpen] = useState(false);
  const [projecoesFinanceiras, setProjecoesFinanceiras] = useState({
    aquisicao: 0,
    cartorio: 0,
    prefeitura: 0,
    condominio: 0,
    juridico: 0,
    obra: 0,
    assessoria: 0,
    venda: 0,
  });

  useEffect(() => {
    async function init() {
      const d = await getProject({ data: { id } });

      if (d) {
        setProjeto(d);
        const modalidadeNormalizada: Record<string, string> = {
          "Assessoria Completa": "completa",
          "Assessoria Parcial": "parcial",
          "Assessoria Jurídica": "juridica",
          "Assessoria Operacional": "operacional",
          "Consultoria Específica": "consultiva",
          "Sem Assessoria": "nenhuma",
        };
        setModalidade(modalidadeNormalizada[d.modalidade] || d.modalidade || "");
        setValorAquisicao(Number(d.valor_aquisicao));
        setHasSavedHonorarios(d.percentual_honorarios != null);
        if (!honorariosEdited.current)
          setPercentualHonorarios((current) =>
            d.percentual_honorarios == null ? current : Number(d.percentual_honorarios),
          );
        setTemMinimo(d.tem_minimo ? "sim" : "nao");
        setValorMinimo(Number(d.valor_minimo));
        setDataAquisicao(d.data_aquisicao ? parseISO(d.data_aquisicao) : undefined);
        setFormaPagamento(d.forma_pagamento || "");
        setTipoImovel(d.tipo_imovel || "");
        setOrigem(d.origem || "");
        setStatus(d.status || "nao_iniciado");
        setPercentualComissao(Number(d.percentual_comissao));
        setValorFinanciado(Number(d.valor_parcelado));
        setValorEntrada(Number(d.valor_entrada) || 0);
        setQuantidadeParcelas(Number(d.quantidade_parcelas));
        setValorParcela(Number(d.valor_parcela));
        setLeiloeiroVinculado(
          d.leiloeiro_id ? { id: d.leiloeiro_id, nome: d.leiloeiro_nome || "" } : null,
        );
        setProjecoesFinanceiras({
          aquisicao: Number(d.valor_aquisicao) || 0,
          cartorio: Number(d.projecoes_financeiras?.cartorio) || 0,
          prefeitura: Number(d.projecoes_financeiras?.prefeitura) || 0,
          condominio: Number(d.projecoes_financeiras?.condominio) || 0,
          juridico: Number(d.projecoes_financeiras?.juridico) || 0,
          obra: Number(d.projecoes_financeiras?.obra) || 0,
          assessoria: Number(d.projecoes_financeiras?.assessoria) || 0,
          venda: Number(d.projecoes_financeiras?.venda) || 0,
        });

        const investorEntries = (
          Array.isArray(d.participantes) ? d.participantes : []
        ) as LinkedPerson[];
        setParticipantes(
          investorEntries.map((item) => ({
            id: item.id || "",
            nome: item.nome || "",
            papel: "Investidor",
            percentual: String(item.percentual || ""),
          })),
        );
        const assessorEntries = (Array.isArray(d.assessores) ? d.assessores : []) as LinkedPerson[];
        setAssessoresVinculados(
          assessorEntries
            .filter((item) => typeof item === "object")
            .map((item) => ({
              id: item.id || "",
              nome: item.nome || "",
              papel: "Assessor",
              percentual: String(item.percentual || ""),
            })),
        );
        const responsibleEntries = (
          Array.isArray(d.responsaveis) ? d.responsaveis : []
        ) as LinkedPerson[];
        setResponsaveisVinculados(
          responsibleEntries.map((item) => ({ id: item.id || "", nome: item.nome || "" })),
        );
        setFotosUpload(Array.isArray(d.projectImages) ? d.projectImages : []);
      }
      setLoading(false);
    }
    void init().catch((error) => {
      toast.error(error instanceof Error ? error.message : "Não foi possível carregar o projeto.");
      setLoading(false);
    });
  }, [id]);

  useEffect(() => {
    setProjecoesFinanceiras((current) =>
      current.aquisicao === valorAquisicao ? current : { ...current, aquisicao: valorAquisicao },
    );
  }, [valorAquisicao]);

  const honorarioCalculado = useMemo(() => {
    const calc = valorAquisicao * (percentualHonorarios / 100);
    return temMinimo === "sim" ? Math.max(calc, valorMinimo) : calc;
  }, [valorAquisicao, percentualHonorarios, temMinimo, valorMinimo]);
  const valorAssessoriaProjetada =
    modalidade !== "" && modalidade !== "completa" && modalidade !== "nenhuma"
      ? honorarioCalculado
      : 0;

  useEffect(() => {
    setProjecoesFinanceiras((current) =>
      current.assessoria === valorAssessoriaProjetada
        ? current
        : { ...current, assessoria: valorAssessoriaProjetada },
    );
  }, [valorAssessoriaProjetada]);

  const comissaoCalculada = valorAquisicao * (percentualComissao / 100);

  const investidoresDisponiveis = usuarios.filter((u) => u.tipo === "Investidor");
  const assessoresDisponiveis = usuarios.filter(
    (u) => u.tipo === "Assessor" || u.perfil === "Administrador" || u.perfil === "Jurídico",
  );
  const responsaveisDisponiveis = usuarios.filter(
    (u) =>
      u.tipo === "Assessor" ||
      u.tipo === "Responsável" ||
      u.perfil === "Administrador" ||
      u.perfil === "Jurídico",
  );
  const leiloeirosDisponiveis = usuarios.filter((u) => u.tipo === "Leiloeiro");

  async function salvarPessoa(
    data: UnifiedEntityData,
    tipo: "Investidor" | "Assessor" | "Responsável" | "Leiloeiro",
  ) {
    if (tipo !== "Leiloeiro") {
      const invited = await inviteOrganizationUser({
        data: {
          name: data.nome,
          email: data.email,
          role:
            tipo === "Responsável"
              ? "project_manager"
              : tipo === "Assessor"
                ? "advisor"
                : "investor",
          contactData: { ...data, type: tipo },
        },
      });
      if (!invited.contact) throw new Error("Não foi possível cadastrar o participante.");
      await queryClient.invalidateQueries({ queryKey: ["contacts"] });
      if (invited.invitationUrl) {
        await navigator.clipboard.writeText(invited.invitationUrl);
        toast.success("Participante cadastrado. Link de convite copiado; expira em 30 minutos.");
      } else toast.success("Participante vinculado ao usuário existente.");
      return invited.contact;
    }
    const newPerson = await createContact({ data: { ...data, type: tipo } });
    await queryClient.invalidateQueries({ queryKey: ["contacts"] });
    toast.success(`${tipo} cadastrado com sucesso!`);
    return newPerson;
  }

  if (loading || !projeto) return <div className="p-8">Carregando...</div>;

  return (
    <AppLayout title="Editar Projeto" subtitle={projeto?.nome || "Projeto"}>
      <form
        className="grid gap-6"
        onSubmit={async (e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          setSalvando(true);
          try {
            const parcelado = formaPagamento === "parcelado" || formaPagamento === "financiado";
            const address = (fd.get("end") as string) || "Endereço não informado";
            const mainImage =
              fotosUpload.find((f) => f.is_main)?.url || fotosUpload[0]?.url || null;
            const projectData = {
              ...projeto,
              investidores: participantes.map((p) => p.nome),
              foto: mainImage,
              cep: fd.get("cep") as string,
              area: Math.round(Number(fd.get("area"))) || 0,
              land_area: Math.round(Number(fd.get("land_area"))) || null,
              built_area: Math.round(Number(fd.get("built_area"))) || null,
              total_area: Math.round(Number(fd.get("total_area"))) || null,
              bedrooms: Math.round(Number(fd.get("bedrooms"))) || 0,
              bathrooms: Math.round(Number(fd.get("bathrooms"))) || 0,
              parking_spaces: Math.round(Number(fd.get("parking_spaces"))) || 0,
              suites: Math.round(Number(fd.get("suites"))) || 0,
              matricula: fd.get("mat") as string,
              tipo_imovel: tipoImovel || null,
              iptu: fd.get("iptu") as string,
              observacoes: fd.get("obs") as string,
              fotos: fotosUpload.map((f) => f.url),
              origem: origem || null,
              modalidade: modalidade || null,
              valor_aquisicao: valorAquisicao,
              data_aquisicao: dataAquisicao ? format(dataAquisicao, "yyyy-MM-dd") : null,
              forma_pagamento: formaPagamento || null,
              leiloeiro_nome: leiloeiroVinculado?.nome ?? null,
              percentual_comissao: percentualComissao,
              valor_comissao: comissaoCalculada,
              credor: parcelado ? (fd.get("credor") as string) : null,
              valor_entrada: parcelado ? valorEntrada : undefined,
              valor_parcelado: parcelado ? valorFinanciado : 0,
              quantidade_parcelas: parcelado ? quantidadeParcelas : 1,
              valor_parcela: parcelado ? valorParcela : 0,
              percentual_honorarios:
                modalidade === "nenhuma" || modalidade === "completa" ? 0 : percentualHonorarios,
              tem_minimo: temMinimo === "sim",
              valor_minimo: valorMinimo,
              valor_honorarios:
                modalidade === "nenhuma" || modalidade === "completa" ? 0 : honorarioCalculado,
              participantes,
              assessores: assessoresVinculados,
              responsaveis: responsaveisVinculados,
              projecoes_financeiras: {
                ...projecoesFinanceiras,
                assessoria: valorAssessoriaProjetada,
              },
            };
            await saveProject({
              data: {
                id,
                name: address,
                address,
                city: (fd.get("cidade") as string) || "",
                stage: modalidade || projeto.etapa || "Aquisição",
                status: status as
                  | "nao_iniciado"
                  | "pendente"
                  | "andamento"
                  | "aguardando"
                  | "concluido"
                  | "atrasado",
                responsible: responsaveisVinculados[0]?.nome || "Não atribuído",
                mainImage,
                data: projectData,
                links: [
                  ...participantes
                    .filter((item) => item.id)
                    .map((item) => ({
                      contactId: item.id,
                      role: "investor" as const,
                      percentage: item.percentual.trim() || undefined,
                    })),
                  ...assessoresVinculados
                    .filter((item) => item.id)
                    .map((item) => ({
                      contactId: item.id,
                      role: "advisor" as const,
                      percentage: item.percentual.trim() || undefined,
                    })),
                  ...responsaveisVinculados
                    .filter((item) => item.id)
                    .map((item) => ({ contactId: item.id, role: "responsible" as const })),
                  ...(leiloeiroVinculado?.id
                    ? [{ contactId: leiloeiroVinculado.id, role: "auctioneer" as const }]
                    : []),
                ],
              },
            });

            toast.success("Projeto atualizado com sucesso!");
            navigate({ to: "/projetos" });
          } catch (err) {
            const message =
              err instanceof Error ? err.message : "Não foi possível atualizar o projeto.";
            showValidationAlert(
              message.includes("Percentual inválido")
                ? "Informe um percentual entre 0 e 100 ou deixe o campo vazio."
                : message,
            );
          } finally {
            setSalvando(false);
          }
        }}
      >
        <SectionCard icon={House} title="Imóvel" description="Dados cadastrais e localização">
          <div className="mb-6">
            <ImageManagementSection
              projetoId={id}
              initialImages={fotosUpload}
              onImagesChange={(imgs) => setFotosUpload(imgs)}
            />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="end">Endereço</Label>
              <Input
                id="end"
                name="end"
                defaultValue={projeto.endereco || ""}
                placeholder="Rua, número, complemento"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="cidade">Cidade / UF</Label>
              <Input
                id="cidade"
                name="cidade"
                defaultValue={projeto.cidade || ""}
                placeholder="São Paulo / SP"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cep">CEP</Label>
              <Input id="cep" name="cep" defaultValue={projeto.cep || ""} placeholder="00000-000" />
            </div>

            <div className="grid gap-4 sm:grid-cols-2 md:col-span-2 xl:grid-cols-4">
              <div className="space-y-2">
                <Label htmlFor="area">Área Privativa</Label>
                <div className="relative">
                  <Input
                    id="area"
                    name="area"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    defaultValue={projeto.area ? Math.round(Number(projeto.area)) : ""}
                    placeholder="0"
                    className="pr-10"
                    onInput={(e) => {
                      e.currentTarget.value = e.currentTarget.value.replace(/\D/g, "");
                    }}
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                    m²
                  </span>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="land_area">Área do Terreno</Label>
                <div className="relative">
                  <Input
                    id="land_area"
                    name="land_area"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    defaultValue={projeto.land_area ? Math.round(Number(projeto.land_area)) : ""}
                    placeholder="0"
                    className="pr-10"
                    onInput={(e) => {
                      e.currentTarget.value = e.currentTarget.value.replace(/\D/g, "");
                    }}
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                    m²
                  </span>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="built_area">Área Construída</Label>
                <div className="relative">
                  <Input
                    id="built_area"
                    name="built_area"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    defaultValue={projeto.built_area ? Math.round(Number(projeto.built_area)) : ""}
                    placeholder="0"
                    className="pr-10"
                    onInput={(e) => {
                      e.currentTarget.value = e.currentTarget.value.replace(/\D/g, "");
                    }}
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                    m²
                  </span>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="total_area">Área Total</Label>
                <div className="relative">
                  <Input
                    id="total_area"
                    name="total_area"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    defaultValue={projeto.total_area ? Math.round(Number(projeto.total_area)) : ""}
                    placeholder="0"
                    className="pr-10"
                    onInput={(e) => {
                      e.currentTarget.value = e.currentTarget.value.replace(/\D/g, "");
                    }}
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                    m²
                  </span>
                </div>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 md:col-span-2 xl:grid-cols-4">
              <div className="space-y-2">
                <Label htmlFor="bedrooms">Quartos</Label>
                <Input
                  id="bedrooms"
                  name="bedrooms"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  min="0"
                  defaultValue={projeto.bedrooms ?? ""}
                  placeholder="0"
                  onInput={(e) => {
                    e.currentTarget.value = e.currentTarget.value.replace(/\D/g, "");
                  }}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="bathrooms">Banheiros</Label>
                <Input
                  id="bathrooms"
                  name="bathrooms"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  min="0"
                  defaultValue={projeto.bathrooms ?? ""}
                  placeholder="0"
                  onInput={(e) => {
                    e.currentTarget.value = e.currentTarget.value.replace(/\D/g, "");
                  }}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="parking_spaces">Vagas de Garagem</Label>
                <Input
                  id="parking_spaces"
                  name="parking_spaces"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  min="0"
                  defaultValue={projeto.parking_spaces ?? ""}
                  placeholder="0"
                  onInput={(e) => {
                    e.currentTarget.value = e.currentTarget.value.replace(/\D/g, "");
                  }}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="suites">Suítes</Label>
                <Input
                  id="suites"
                  name="suites"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  min="0"
                  defaultValue={projeto.suites ?? ""}
                  placeholder="0"
                  onInput={(e) => {
                    e.currentTarget.value = e.currentTarget.value.replace(/\D/g, "");
                  }}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="mat">Matrícula / Cartório</Label>
              <Input
                id="mat"
                name="mat"
                defaultValue={projeto.matricula || ""}
                placeholder="128.442 - 5º CRI"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="iptu">Inscrição municipal (IPTU)</Label>
              <Input
                id="iptu"
                name="iptu"
                defaultValue={projeto.iptu || ""}
                placeholder="000.000.0000-0"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="status">Status operacional</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger id="status">
                  <SelectValue placeholder="Selecione o status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="atrasado">Atrasado</SelectItem>
                  <SelectItem value="pendente">Pendente</SelectItem>
                  <SelectItem value="aguardando">Aguardando terceiro</SelectItem>
                  <SelectItem value="andamento">Em andamento</SelectItem>
                  <SelectItem value="nao_iniciado">Não iniciado</SelectItem>
                  <SelectItem value="concluido">Concluído</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="tipo">Tipo do imóvel</Label>
              <Select value={tipoImovel} onValueChange={setTipoImovel}>
                <SelectTrigger id="tipo">
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="apartamento">Apartamento</SelectItem>
                  <SelectItem value="casa">Casa</SelectItem>
                  <SelectItem value="comercial">Comercial</SelectItem>
                  <SelectItem value="terreno">Terreno</SelectItem>
                  <SelectItem value="galpao">Galpão</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="obs">Observações</Label>
              <Textarea
                id="obs"
                name="obs"
                defaultValue={projeto.observacoes || ""}
                rows={3}
                placeholder="Situação de ocupação, pendências conhecidas..."
              />
            </div>
          </div>
        </SectionCard>

        <SectionCard icon={Handshake} title="Aquisição" description="Origem, valores e pagamento">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="grid gap-4 sm:grid-cols-2 md:col-span-2 xl:grid-cols-4">
              <div className="space-y-2">
                <Label>Origem</Label>
                <Select value={origem} onValueChange={setOrigem}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="leilao-judicial">Leilão judicial</SelectItem>
                    <SelectItem value="leilao-extra">Leilão extrajudicial</SelectItem>
                    <SelectItem value="venda-direta">Venda direta bancária</SelectItem>
                    <SelectItem value="particular">Aquisição particular</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Valor de aquisição</Label>
                <CurrencyInput
                  value={valorAquisicao}
                  onValueChange={setValorAquisicao}
                  placeholder="R$ 0,00"
                />
              </div>
              <div className="space-y-2">
                <Label>Data da aquisição</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant={"outline"}
                      className={cn(
                        "relative w-full justify-end pl-9 text-right font-normal",
                        !dataAquisicao && "text-muted-foreground",
                      )}
                    >
                      <CalendarIcon className="absolute left-3 h-4 w-4" />
                      {dataAquisicao ? (
                        format(dataAquisicao, "dd/MM/yyyy")
                      ) : (
                        <span>Selecione uma data</span>
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="end">
                    <Calendar
                      mode="single"
                      selected={dataAquisicao}
                      onSelect={setDataAquisicao}
                      locale={ptBR}
                    />
                  </PopoverContent>
                </Popover>
              </div>
              <div className="space-y-2">
                <Label>Forma de pagamento</Label>
                <Select value={formaPagamento} onValueChange={setFormaPagamento}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="avista">À vista</SelectItem>
                    <SelectItem value="parcelado">Parcelado</SelectItem>
                    <SelectItem value="financiado">Financiado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {(formaPagamento === "parcelado" || formaPagamento === "financiado") && (
              <div className="space-y-4 md:col-span-2 border-t pt-4 mt-2">
                <Label className="text-brand font-semibold block">Dados do Pagamento</Label>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-12">
                  <div className="space-y-2 lg:col-span-4">
                    <Label htmlFor="credor">Nome do Credor</Label>
                    <Input
                      id="credor"
                      name="credor"
                      defaultValue={projeto.credor}
                      placeholder="Informe o nome do credor"
                    />
                  </div>
                  <div className="space-y-2 lg:col-span-2">
                    <Label>Valor de Entrada</Label>
                    <CurrencyInput
                      value={valorEntrada}
                      onValueChange={setValorEntrada}
                      placeholder="R$ 0,00"
                    />
                  </div>
                  <div className="space-y-2 lg:col-span-2">
                    <Label>Valor da Parcela</Label>
                    <CurrencyInput
                      value={valorParcela}
                      onValueChange={setValorParcela}
                      placeholder="R$ 0,00"
                    />
                  </div>
                  <div className="space-y-2 lg:col-span-2">
                    <Label htmlFor="quantidade-parcelas">Qtde. Parcelas</Label>
                    <Input
                      id="quantidade-parcelas"
                      type="number"
                      min="1"
                      value={quantidadeParcelas}
                      onChange={(e) => setQuantidadeParcelas(parseInt(e.target.value) || 1)}
                    />
                  </div>
                  <div className="space-y-2 lg:col-span-2">
                    <Label>
                      Valor {formaPagamento === "parcelado" ? "Parcelado" : "Financiado"}
                    </Label>
                    <CurrencyInput
                      value={valorFinanciado}
                      onValueChange={setValorFinanciado}
                      placeholder="R$ 0,00"
                    />
                  </div>
                </div>
              </div>
            )}

            <div className="space-y-4 md:col-span-2 border-t pt-4 mt-2">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Leiloeiro / Comitente</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" role="combobox" className="w-full justify-between">
                        {leiloeiroVinculado ? leiloeiroVinculado.nome : "Vincular Leiloeiro..."}
                        <Search className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[300px] p-0" align="start">
                      <Command>
                        <CommandInput placeholder="Pesquisar leiloeiro..." />
                        <CommandList>
                          <CommandEmpty>Nenhum leiloeiro encontrado.</CommandEmpty>
                          <CommandGroup>
                            {leiloeirosDisponiveis.map((leiloeiro) => (
                              <CommandItem
                                key={leiloeiro.id}
                                onSelect={() =>
                                  setLeiloeiroVinculado({ id: leiloeiro.id, nome: leiloeiro.nome })
                                }
                              >
                                <CheckCircle2
                                  className={cn(
                                    "mr-2 h-4 w-4",
                                    leiloeiroVinculado?.id === leiloeiro.id
                                      ? "opacity-100"
                                      : "opacity-0",
                                  )}
                                />
                                {leiloeiro.nome}
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs px-0 text-brand"
                    onClick={() => setIsLeiloeiroModalOpen(true)}
                  >
                    <UserPlus className="mr-1 size-3" /> Cadastrar novo leiloeiro
                  </Button>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Comissão (%)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={percentualComissao}
                      onChange={(e) => setPercentualComissao(parseFloat(e.target.value) || 0)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="block text-xs whitespace-nowrap sm:text-sm">
                      Valor da Comissão (R$)
                    </Label>
                    <div className="flex items-center gap-2">
                      <Input
                        value={formatBRL(comissaoCalculada)}
                        disabled
                        className="min-w-0 flex-1 bg-muted"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        aria-label="Lançar comissão do leiloeiro"
                        title="Lançar comissão do leiloeiro"
                        disabled={comissaoCalculada <= 0}
                        onClick={() => {
                          setCommissionMovementRequestId((current) => current + 1);
                          setCommissionMovementOpen(true);
                        }}
                      >
                        <Plus className="size-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </SectionCard>

        <SectionCard
          icon={BriefcaseBusiness}
          title="Modalidade de Assessoria"
          description="Escopo e honorários"
        >
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="modalidade">Modalidade</Label>
              <Select value={modalidade} onValueChange={setModalidade}>
                <SelectTrigger id="modalidade">
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {(!activePlan ||
                    activePlan.advisoryModalities.includes("completa") ||
                    modalidade === "completa") && (
                    <SelectItem value="completa">Assessoria Completa</SelectItem>
                  )}
                  {(!activePlan ||
                    activePlan.advisoryModalities.includes("parcial") ||
                    modalidade === "parcial") && (
                    <SelectItem value="parcial">Assessoria Parcial</SelectItem>
                  )}
                  {(!activePlan ||
                    activePlan.advisoryModalities.includes("juridica") ||
                    modalidade === "juridica") && (
                    <SelectItem value="juridica">Assessoria Jurídica</SelectItem>
                  )}
                  {(!activePlan ||
                    activePlan.advisoryModalities.includes("operacional") ||
                    modalidade === "operacional") && (
                    <SelectItem value="operacional">Assessoria Operacional</SelectItem>
                  )}
                  {(!activePlan ||
                    activePlan.advisoryModalities.includes("consultiva") ||
                    modalidade === "consultiva") && (
                    <SelectItem value="consultiva">Consultoria Específica</SelectItem>
                  )}
                  {(!activePlan ||
                    activePlan.advisoryModalities.includes("nenhuma") ||
                    modalidade === "nenhuma") && (
                    <SelectItem value="nenhuma">Sem Assessoria</SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>

            {(modalidade === "parcial" ||
              modalidade === "juridica" ||
              modalidade === "operacional" ||
              modalidade === "consultiva") && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="honorario">Percentual de Honorários (%)</Label>
                  <Input
                    id="honorario"
                    type="number"
                    value={percentualHonorarios}
                    onChange={(e) => {
                      honorariosEdited.current = true;
                      setPercentualHonorarios(parseFloat(e.target.value) || 0);
                    }}
                  />
                </div>

                <div className="space-y-3">
                  <Label>Há valor mínimo de honorários?</Label>
                  <RadioGroup
                    value={temMinimo}
                    onValueChange={setTemMinimo}
                    className="flex items-center gap-4"
                  >
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="sim" id="edit-min-sim" />
                      <Label htmlFor="edit-min-sim" className="cursor-pointer">
                        Sim
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="nao" id="edit-min-nao" />
                      <Label htmlFor="edit-min-nao" className="cursor-pointer">
                        Não
                      </Label>
                    </div>
                  </RadioGroup>
                </div>

                {temMinimo === "sim" && (
                  <div className="space-y-2">
                    <Label htmlFor="edit-val-min">Valor Mínimo de Honorários</Label>
                    <CurrencyInput
                      id="edit-val-min"
                      value={valorMinimo}
                      onValueChange={setValorMinimo}
                      placeholder="R$ 0,00"
                    />
                  </div>
                )}

                <div className="space-y-2">
                  <Label>Valor devido calculado</Label>
                  <div className="h-10 flex items-center px-3 rounded-md border bg-muted font-medium">
                    {formatBRL(honorarioCalculado)}
                  </div>
                </div>
              </>
            )}

            <AdvisoryModeInfo mode={modalidade} />

            {modalidade === "nenhuma" && (
              <div className="md:col-span-2 space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="edit-fixo-zero">Valor dos honorários</Label>
                    <Input id="edit-fixo-zero" value="R$ 0,00" disabled />
                  </div>
                </div>
              </div>
            )}

            {modalidade !== "nenhuma" && modalidade !== "" && (
              <div className="md:col-span-2 space-y-6 pt-4 border-t">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <h4 className="text-sm font-semibold">Assessores</h4>
                    <p className="text-xs text-muted-foreground">
                      Vincule os assessores e defina suas participações
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setIsAssessorModalOpen(true)}
                  >
                    <UserPlus className="mr-2 h-4 w-4" />
                    Cadastrar novo assessor
                  </Button>
                </div>
                <div className="space-y-2">
                  <Label>Vincular assessor existente</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" role="combobox" className="w-full justify-between">
                        Procurar por nome...
                        <Search className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[400px] p-0" align="start">
                      <Command>
                        <CommandInput placeholder="Digite o nome do assessor..." />
                        <CommandList>
                          <CommandEmpty>Nenhum assessor encontrado.</CommandEmpty>
                          <CommandGroup>
                            {assessoresDisponiveis.map((assessor) => (
                              <CommandItem
                                key={assessor.id}
                                value={assessor.nome}
                                onSelect={() => {
                                  if (!assessoresVinculados.find((item) => item.id === assessor.id))
                                    setAssessoresVinculados([
                                      ...assessoresVinculados,
                                      {
                                        id: assessor.id,
                                        nome: assessor.nome,
                                        papel: "Assessor",
                                        percentual: "",
                                      },
                                    ]);
                                  else toast.error("Assessor já adicionado.");
                                }}
                              >
                                <CheckCircle2 className="mr-2 h-4 w-4" />
                                {assessor.nome} ({assessor.email})
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </div>
                <div className="space-y-3">
                  {assessoresVinculados.map((assessor, index) => (
                    <div
                      key={index}
                      className="flex items-end gap-3 rounded-lg border bg-muted/30 p-3"
                    >
                      <div className="flex-1 space-y-1">
                        <Label className="text-xs text-muted-foreground">Nome</Label>
                        <div className="h-10 flex items-center px-3 rounded-md bg-white border font-medium">
                          {assessor.nome}
                        </div>
                      </div>
                      <div className="w-32 space-y-1">
                        <Label className="text-xs text-muted-foreground">% Participação</Label>
                        <Input
                          type="number"
                          placeholder="0"
                          value={assessor.percentual}
                          onChange={(e) => {
                            const next = [...assessoresVinculados];
                            if (next[index]) next[index].percentual = e.target.value;
                            setAssessoresVinculados(next);
                          }}
                        />
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="text-destructive hover:text-destructive hover:bg-destructive/10"
                        onClick={() =>
                          setAssessoresVinculados(
                            assessoresVinculados.filter((_, itemIndex) => itemIndex !== index),
                          )
                        }
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </SectionCard>

        <SectionCard icon={Users} title="Investidores" description="Participantes do projeto">
          <div className="space-y-6">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h4 className="text-sm font-semibold">Investidores</h4>
                <p className="text-xs text-muted-foreground">
                  Vincule os investidores e defina suas participações
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsInvestorModalOpen(true)}
              >
                <UserPlus className="mr-2 h-4 w-4" /> Cadastrar novo investidor
              </Button>
            </div>

            <div className="space-y-2">
              <Label>Vincular investidor existente</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    role="combobox"
                    className="w-full justify-between"
                  >
                    Procurar por nome...
                    <Search className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[400px] p-0" align="start">
                  <Command>
                    <CommandInput placeholder="Digite o nome do investidor..." />
                    <CommandList>
                      <CommandEmpty>Nenhum investidor encontrado.</CommandEmpty>
                      <CommandGroup>
                        {investidoresDisponiveis.map((investidor) => (
                          <CommandItem
                            key={investidor.id}
                            value={`${investidor.nome} ${investidor.email}`}
                            onSelect={() => {
                              if (!participantes.some((item) => item.id === investidor.id)) {
                                setParticipantes((current) => [
                                  ...current,
                                  {
                                    id: investidor.id,
                                    nome: investidor.nome,
                                    papel: "Investidor",
                                    percentual: "",
                                  },
                                ]);
                                toast.success(`${investidor.nome} adicionado.`);
                              } else {
                                toast.error("Investidor já adicionado.");
                              }
                            }}
                          >
                            <CheckCircle2 className="mr-2 h-4 w-4" />
                            {investidor.nome} ({investidor.email})
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-3">
              {participantes.map((p, i) => (
                <div key={i} className="flex items-end gap-3 rounded-lg border bg-muted/30 p-3">
                  <div className="flex-1 space-y-1">
                    <Label className="text-xs text-muted-foreground">Nome</Label>
                    <div className="h-10 flex items-center px-3 rounded-md bg-white border font-medium">
                      {p.nome}
                    </div>
                  </div>
                  <div className="w-32 space-y-1">
                    <Label className="text-xs text-muted-foreground">% Participação</Label>
                    <Input
                      type="number"
                      min="0"
                      max="100"
                      step="0.01"
                      placeholder="0"
                      value={p.percentual}
                      onChange={(e) => {
                        const newP = [...participantes];
                        const item = newP[i];
                        if (item) {
                          item.percentual = e.target.value;
                          setParticipantes(newP);
                        }
                      }}
                    />
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="text-destructive hover:text-destructive hover:bg-destructive/10"
                    aria-label="Remover investidor"
                    onClick={() => setParticipantes(participantes.filter((_, idx) => idx !== i))}
                  >
                    <Trash2 className="size-4 text-destructive" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        </SectionCard>

        <SectionCard icon={UserCheck} title="Gestor do Projeto" description="Gestores vinculados">
          <div className="space-y-6">
            <div className="space-y-2">
              <Label>Selecionar assessor ou responsável cadastrado</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    role="combobox"
                    className="w-full justify-between"
                  >
                    Procurar por nome...
                    <Search className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[400px] p-0" align="start">
                  <Command>
                    <CommandInput placeholder="Pesquisar assessor ou responsável..." />
                    <CommandList>
                      <CommandEmpty>Nenhuma pessoa encontrada.</CommandEmpty>
                      <CommandGroup>
                        {responsaveisDisponiveis.map((person) => (
                          <CommandItem
                            key={person.id}
                            value={person.nome}
                            onSelect={() => {
                              if (!responsaveisVinculados.some((item) => item.id === person.id)) {
                                setResponsaveisVinculados((current) => [
                                  ...current,
                                  { id: person.id, nome: person.nome },
                                ]);
                                toast.success(`${person.nome} vinculado como responsável.`);
                              } else {
                                toast.error("Responsável já vinculado.");
                              }
                            }}
                          >
                            <CheckCircle2 className="mr-2 h-4 w-4" />
                            {person.nome} ({person.email})
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>

            <div className="flex flex-wrap gap-2">
              {responsaveisVinculados.map((r, i) => (
                <div
                  key={i}
                  className="flex items-center gap-2 px-3 py-1 border rounded-full bg-muted/50"
                >
                  {r.nome}
                  <button
                    type="button"
                    onClick={() =>
                      setResponsaveisVinculados(
                        responsaveisVinculados.filter((_, idx) => idx !== i),
                      )
                    }
                  >
                    <Trash2 className="size-3" />
                  </button>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between border-t pt-4">
              <p className="text-sm font-medium">Cadastrar uma nova pessoa como gestor</p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsResponsibleModalOpen(true)}
              >
                <UserPlus className="mr-2 h-4 w-4" /> Cadastrar novo gestor
              </Button>
            </div>
          </div>
        </SectionCard>

        <SectionCard
          icon={CircleDollarSign}
          title="Projeções Financeiras"
          description="Estimativa de despesas e receitas do projeto"
        >
          <div className="grid gap-6 md:grid-cols-2">
            <div className="space-y-4 rounded-xl border bg-muted/20 p-4">
              <h3 className="font-semibold">Despesas</h3>
              {(
                [
                  ["aquisicao", "Aquisição"],
                  ["cartorio", "Cartório"],
                  ["prefeitura", "Prefeitura"],
                  ["condominio", "Condomínio"],
                  ["juridico", "Jurídico"],
                  ["obra", "Obra / Reforma"],
                  ["assessoria", "Assessoria"],
                ] as const
              )
                .filter(([field]) => modalidade !== "completa" || field !== "assessoria")
                .map(([field, label]) => (
                  <div key={field} className="space-y-2">
                    <Label htmlFor={`edit-projecao-${field}`}>{label}</Label>
                    <CurrencyInput
                      id={`edit-projecao-${field}`}
                      value={projecoesFinanceiras[field]}
                      wholeReais
                      inputMode="numeric"
                      readOnly={field === "aquisicao" || field === "assessoria"}
                      className={
                        field === "aquisicao" || field === "assessoria"
                          ? "cursor-not-allowed bg-muted"
                          : undefined
                      }
                      onValueChange={(value) =>
                        setProjecoesFinanceiras((current) => ({ ...current, [field]: value }))
                      }
                    />
                  </div>
                ))}
            </div>

            <div className="space-y-4 rounded-xl border bg-muted/20 p-4">
              <h3 className="font-semibold">Receitas</h3>
              <div className="space-y-2">
                <Label htmlFor="edit-projecao-venda">Estimativa de Venda</Label>
                <CurrencyInput
                  id="edit-projecao-venda"
                  value={projecoesFinanceiras.venda}
                  wholeReais
                  inputMode="numeric"
                  maxValue={99999999.99}
                  onValueChange={(value) =>
                    setProjecoesFinanceiras((current) => ({ ...current, venda: value }))
                  }
                />
              </div>
            </div>
          </div>
        </SectionCard>

        <InvestorRegistrationModal
          open={isInvestorModalOpen}
          onOpenChange={setIsInvestorModalOpen}
          onSave={async (data) => {
            const created = await salvarPessoa(data, "Investidor");
            setParticipantes((prev) => [
              ...prev,
              { id: created.id, nome: created.nome, papel: "Investidor", percentual: "" },
            ]);
          }}
          type="Investidor"
        />
        <InvestorRegistrationModal
          open={isAssessorModalOpen}
          onOpenChange={setIsAssessorModalOpen}
          onSave={async (data) => {
            const created = await salvarPessoa(data, "Assessor");
            setAssessoresVinculados((prev) => [
              ...prev,
              { id: created.id, nome: created.nome, papel: "Assessor", percentual: "" },
            ]);
          }}
          type="Assessor"
        />
        <InvestorRegistrationModal
          open={isResponsibleModalOpen}
          onOpenChange={setIsResponsibleModalOpen}
          onSave={async (data) => {
            const created = await salvarPessoa(data, "Responsável");
            setResponsaveisVinculados((prev) => [...prev, { id: created.id, nome: created.nome }]);
          }}
          type="Responsável"
        />
        <InvestorRegistrationModal
          open={isLeiloeiroModalOpen}
          onOpenChange={setIsLeiloeiroModalOpen}
          onSave={async (data) => {
            const created = await salvarPessoa(data, "Leiloeiro");
            setLeiloeiroVinculado({ id: created.id, nome: created.nome });
          }}
          type="Leiloeiro"
        />

        <div className="flex flex-wrap justify-end gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={() => navigate({ to: `/projetos/${id}` })}
          >
            Cancelar
          </Button>
          <Button type="submit" disabled={salvando}>
            <Save className="size-4 mr-2" /> Salvar
          </Button>
        </div>
      </form>
      <NewFinancialMovementDialog
        key={`commission-movement-${commissionMovementRequestId}`}
        projetoId={id}
        defaultOpen={commissionMovementOpen}
        defaultCategory="Aquisição"
        defaultDescription="Comissão do Leiloeiro"
        defaultAmount={comissaoCalculada}
        showTrigger={false}
        onOpenChange={setCommissionMovementOpen}
        onSaved={async () => {
          await queryClient.invalidateQueries({ queryKey: ["financial-movements", id] });
        }}
      />
    </AppLayout>
  );
}

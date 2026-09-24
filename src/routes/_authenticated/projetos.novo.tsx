import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, useMemo, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  House,
  Handshake,
  BriefcaseBusiness,
  Users,
  Plus,
  Trash2,
  Save,
  UserPlus,
  Search,
  CalendarIcon,
  CheckCircle2,
  UserCheck,
  CircleDollarSign,
} from "lucide-react";
import { SectionCard } from "@/components/project-form-section-card";
import { AppLayout } from "@/components/app-layout";
import { getActivePlan } from "@/lib/developer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
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
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { formatBRL } from "@/lib/format-currency";
import {
  InvestorRegistrationModal,
  type ExtraProfileType,
  type UnifiedEntityData,
} from "@/components/investor-registration-modal";
import { ImageManagementSection, type ProjetoFoto } from "@/components/image-management-section";
import { uploadPendingProjectImages } from "@/lib/project-image-client";
import { CurrencyInput } from "@/components/ui/currency-input";
import { AdvisoryModeInfo } from "@/components/advisory-mode-info";
import { saveProject } from "@/lib/projects";
import { createContact, listContacts } from "@/lib/contacts";
import { getCurrentOrganizationUser, inviteOrganizationUser } from "@/lib/organization-users";
import { showValidationAlert } from "@/lib/validation-feedback";
import { getOrganizationSettings } from "@/lib/organization-settings";

export const Route = createFileRoute("/_authenticated/projetos/novo")({
  beforeLoad: async () => {
    const user = await getCurrentOrganizationUser();
    if (!["owner", "admin", "project_manager"].includes(user.role))
      throw redirect({ to: "/projetos" });
  },
  head: () => ({
    meta: [
      { title: "Novo Projeto | ArremataFlow" },
      {
        name: "description",
        content:
          "Cadastre um novo projeto com dados do imóvel, fotos, aquisição, modalidade de assessoria e participantes.",
      },
      { property: "og:title", content: "Cadastro de Projeto | ArremataFlow" },
      {
        property: "og:description",
        content: "Registre imóvel, aquisição, assessoria e participantes em um único formulário.",
      },
    ],
  }),
  component: NovoProjeto,
});
function NovoProjeto() {
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
  const [fotosUpload, setFotosUpload] = useState<ProjetoFoto[]>([]);
  const [isInvestorModalOpen, setIsInvestorModalOpen] = useState(false);
  const [isAssessorModalOpen, setIsAssessorModalOpen] = useState(false);
  const [isResponsibleModalOpen, setIsResponsibleModalOpen] = useState(false);
  const [isLeiloeiroModalOpen, setIsLeiloeiroModalOpen] = useState(false);
  const [participantes, setParticipantes] = useState<
    Array<{ id: string; nome: string; papel: string; percentual: string }>
  >([]);
  const [assessoresVinculados, setAssessoresVinculados] = useState<
    Array<{ id: string; nome: string; papel: string; percentual: string }>
  >([]);
  const [responsaveisVinculados, setResponsaveisVinculados] = useState<
    { id: string; nome: string }[]
  >([]);
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

  // States for new logic
  const [modalidade, setModalidade] = useState<string>("");
  const [valorAquisicao, setValorAquisicao] = useState<number>(0);
  const [percentualHonorarios, setPercentualHonorarios] = useState<number>(10);
  useEffect(() => {
    if (organizationSettings && !honorariosEdited.current)
      setPercentualHonorarios(organizationSettings.defaultAdvisoryFeePercent);
  }, [organizationSettings]);
  const [temMinimo, setTemMinimo] = useState<string>("nao");
  const [valorMinimo, setValorMinimo] = useState<number>(0);
  const [dataAquisicao, setDataAquisicao] = useState<Date | undefined>(undefined);
  const [formaPagamento, setFormaPagamento] = useState<string>("");
  const [tipoImovel, setTipoImovel] = useState<string>("");
  const [origem, setOrigem] = useState<string>("");
  const [status, setStatus] = useState<string>("nao_iniciado");
  const [salvando, setSalvando] = useState(false);

  // Leiloeiro states
  const [leiloeiroVinculado, setLeiloeiroVinculado] = useState<{ id: string; nome: string } | null>(
    null,
  );
  const [percentualComissao, setPercentualComissao] = useState<number>(5);

  // Financiamento states
  const [valorFinanciado, setValorFinanciado] = useState<number>(0);
  const [valorEntrada, setValorEntrada] = useState<number>(0);
  const [quantidadeParcelas, setQuantidadeParcelas] = useState<number>(1);
  const [valorParcela, setValorParcela] = useState<number>(0);

  const honorarioCalculado = useMemo(() => {
    const calculado = valorAquisicao * (percentualHonorarios / 100);
    if (temMinimo === "sim") {
      return Math.max(calculado, valorMinimo);
    }
    return calculado;
  }, [valorAquisicao, percentualHonorarios, temMinimo, valorMinimo]);
  const valorAssessoriaProjetada =
    modalidade !== "" && modalidade !== "completa" && modalidade !== "nenhuma"
      ? honorarioCalculado
      : 0;

  useEffect(() => {
    setProjecoesFinanceiras((current) =>
      current.aquisicao === valorAquisicao ? current : { ...current, aquisicao: valorAquisicao },
    );
  }, [valorAquisicao]);

  useEffect(() => {
    setProjecoesFinanceiras((current) =>
      current.assessoria === valorAssessoriaProjetada
        ? current
        : { ...current, assessoria: valorAssessoriaProjetada },
    );
  }, [valorAssessoriaProjetada]);

  const comissaoCalculada = useMemo(() => {
    return valorAquisicao * (percentualComissao / 100);
  }, [valorAquisicao, percentualComissao]);

  const investidoresDisponiveis = usuarios.filter((u) => u.perfil === "Investidor");
  const assessoresDisponiveis = usuarios.filter(
    (u) => u.perfil === "Assessor" || u.perfil === "Administrador" || u.perfil === "Jurídico",
  );
  const responsaveisDisponiveis = usuarios.filter(
    (u) =>
      u.perfil === "Assessor" ||
      u.perfil === "Responsável" ||
      u.perfil === "Administrador" ||
      u.perfil === "Jurídico",
  );
  const leiloeirosDisponiveis = usuarios.filter((u) => u.perfil === "Leiloeiro");

  async function salvarPessoa(
    data: UnifiedEntityData,
    tipo: "Investidor" | "Assessor" | "Responsável" | "Leiloeiro",
    extraTipos: ExtraProfileType[] = [],
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
          alsoContactTypes: extraTipos,
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
    const created = await createContact({ data: { ...data, type: tipo } });
    await queryClient.invalidateQueries({ queryKey: ["contacts"] });
    toast.success(`${tipo} cadastrado com sucesso!`);
    return created;
  }

  return (
    <AppLayout title="Cadastro de Projeto" subtitle="Novo projeto imobiliário">
      <form
        className="grid gap-6"
        onSubmit={async (e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          const txt = (k: string) => {
            const v = fd.get(k);
            return typeof v === "string" && v.trim() !== "" ? v.trim() : null;
          };
          const num = (k: string) => {
            const v = fd.get(k);
            if (typeof v !== "string") return null;
            const val = parseFloat(v.replace(/[^\d.,]/g, "").replace(",", "."));
            return isNaN(val) ? null : val;
          };
          const integer = (k: string) => {
            const value = num(k);
            return value === null ? null : Math.round(value);
          };
          setSalvando(true);
          try {
            const parcelado = formaPagamento === "parcelado" || formaPagamento === "financiado";
            const address = txt("end") ?? "Endereço não informado";
            const projectData = {
              cep: txt("cep"),
              area: integer("area"),
              land_area: integer("land_area"),
              built_area: integer("built_area"),
              total_area: integer("total_area"),
              matricula: txt("mat"),
              bedrooms: integer("bedrooms"),
              bathrooms: integer("bathrooms"),
              parking_spaces: integer("parking_spaces"),
              suites: integer("suites"),
              tipo_imovel: tipoImovel || null,
              iptu: txt("iptu"),
              observacoes: txt("obs"),
              fotos: [],
              origem: origem || null,
              modalidade: modalidade || null,
              valor_aquisicao: valorAquisicao,
              data_aquisicao: dataAquisicao ? format(dataAquisicao, "yyyy-MM-dd") : null,
              forma_pagamento: formaPagamento || null,
              leiloeiro_nome: leiloeiroVinculado?.nome ?? null,
              percentual_comissao: percentualComissao,
              valor_comissao: comissaoCalculada,
              credor: parcelado ? txt("credor") : null,
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
              investidores: participantes.map((participant) => participant.nome),
              foto: null,
            };
            const savedProject = await saveProject({
              data: {
                name: address,
                address,
                city: txt("cidade") ?? "",
                stage: modalidade || "Aquisição",
                status: status as
                  | "nao_iniciado"
                  | "pendente"
                  | "andamento"
                  | "aguardando"
                  | "concluido"
                  | "atrasado",
                responsible: responsaveisVinculados[0]?.nome || "Não atribuído",
                mainImage: null,
                data: projectData,
                links: [
                  ...participantes.map((item) => ({
                    contactId: item.id,
                    role: "investor" as const,
                    percentage: item.percentual.trim() || undefined,
                  })),
                  ...assessoresVinculados.map((item) => ({
                    contactId: item.id,
                    role: "advisor" as const,
                    percentage: item.percentual.trim() || undefined,
                  })),
                  ...responsaveisVinculados.map((item) => ({
                    contactId: item.id,
                    role: "responsible" as const,
                  })),
                  ...(leiloeiroVinculado
                    ? [{ contactId: leiloeiroVinculado.id, role: "auctioneer" as const }]
                    : []),
                ],
              },
            });
            await uploadPendingProjectImages(savedProject.id, fotosUpload);

            toast.success("Projeto salvo com sucesso!");
            navigate({ to: "/projetos" });
          } catch (err) {
            const message =
              err instanceof Error ? err.message : "Não foi possível salvar o projeto.";
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
            <ImageManagementSection onImagesChange={(imgs) => setFotosUpload(imgs)} />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="end">Endereço</Label>
              <Input id="end" name="end" placeholder="Rua, número, complemento" />
            </div>

            <div className="space-y-2">
              <Label htmlFor="cidade">Cidade / UF</Label>
              <Input id="cidade" name="cidade" placeholder="São Paulo / SP" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cep">CEP</Label>
              <Input id="cep" name="cep" placeholder="00000-000" />
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
                  placeholder="0"
                  onInput={(e) => {
                    e.currentTarget.value = e.currentTarget.value.replace(/\D/g, "");
                  }}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="mat">Matrícula / Cartório</Label>
              <Input id="mat" name="mat" placeholder="128.442 - 5º CRI" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="iptu">Inscrição municipal (IPTU)</Label>
              <Input id="iptu" name="iptu" placeholder="000.000.0000-0" />
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
                <Label htmlFor="origem">Origem</Label>
                <Select value={origem} onValueChange={setOrigem}>
                  <SelectTrigger id="origem">
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
                <Label htmlFor="valor">Valor de aquisição</Label>
                <CurrencyInput
                  id="valor"
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
                <Label htmlFor="pagamento">Forma de pagamento</Label>
                <Select onValueChange={setFormaPagamento}>
                  <SelectTrigger id="pagamento">
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
                <Label className="text-brand font-semibold block">
                  Dados do {formaPagamento === "parcelado" ? "Parcelamento" : "Financiamento"}
                </Label>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-12">
                  <div className="space-y-2 lg:col-span-4">
                    <Label htmlFor="credor">Nome do Credor</Label>
                    <Input id="credor" name="credor" placeholder="Informe o nome do credor" />
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
                  <Label htmlFor="leiloeiro-select">Leiloeiro / Comitente</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        id="leiloeiro-select"
                        variant="outline"
                        role="combobox"
                        className="w-full justify-between"
                      >
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
                                onSelect={() => {
                                  setLeiloeiroVinculado({ id: leiloeiro.id, nome: leiloeiro.nome });
                                }}
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
                  <div className="pt-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs px-0 hover:bg-transparent text-brand"
                      onClick={() => setIsLeiloeiroModalOpen(true)}
                    >
                      <UserPlus className="mr-1 size-3" />
                      Cadastrar novo leiloeiro
                    </Button>
                  </div>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Comissão (%)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={percentualComissao}
                      onChange={(e) => setPercentualComissao(parseFloat(e.target.value) || 0)}
                      className="w-full"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="[overflow-wrap:anywhere] block">Valor da Comissão (R$)</Label>
                    <Input
                      value={formatBRL(comissaoCalculada)}
                      disabled
                      className="bg-muted w-full"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </SectionCard>

        <SectionCard
          icon={BriefcaseBusiness}
          title="Modalidade de Assessoria"
          description="Escopo contratado e honorários"
        >
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="modalidade">Modalidade</Label>
              <Select onValueChange={setModalidade} required>
                <SelectTrigger id="modalidade">
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {(!activePlan || activePlan.advisoryModalities.includes("completa")) && (
                    <SelectItem value="completa">Assessoria Completa</SelectItem>
                  )}
                  {(!activePlan || activePlan.advisoryModalities.includes("parcial")) && (
                    <SelectItem value="parcial">Assessoria Parcial</SelectItem>
                  )}
                  {(!activePlan || activePlan.advisoryModalities.includes("juridica")) && (
                    <SelectItem value="juridica">Assessoria Jurídica</SelectItem>
                  )}
                  {(!activePlan || activePlan.advisoryModalities.includes("operacional")) && (
                    <SelectItem value="operacional">Assessoria Operacional</SelectItem>
                  )}
                  {(!activePlan || activePlan.advisoryModalities.includes("consultiva")) && (
                    <SelectItem value="consultiva">Consultoria Específica</SelectItem>
                  )}
                  {(!activePlan || activePlan.advisoryModalities.includes("nenhuma")) && (
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
                      <RadioGroupItem value="sim" id="min-sim" />
                      <Label htmlFor="min-sim" className="cursor-pointer">
                        Sim
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="nao" id="min-nao" />
                      <Label htmlFor="min-nao" className="cursor-pointer">
                        Não
                      </Label>
                    </div>
                  </RadioGroup>
                </div>

                {temMinimo === "sim" && (
                  <div className="space-y-2">
                    <Label htmlFor="val-min">Valor Mínimo de Honorários</Label>
                    <CurrencyInput
                      id="val-min"
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
                    <Label htmlFor="fixo-zero">Valor dos honorários</Label>
                    <Input id="fixo-zero" value="R$ 0,00" disabled />
                  </div>
                </div>
              </div>
            )}

            {modalidade !== "nenhuma" && modalidade !== "" && (
              <div className="md:col-span-2 space-y-6 pt-4 border-t">
                <div className="flex items-center justify-between">
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

                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Vincular assessor existente</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
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
                          <CommandInput placeholder="Digite o nome do assessor..." />
                          <CommandList>
                            <CommandEmpty>Nenhum assessor encontrado.</CommandEmpty>
                            <CommandGroup>
                              {assessoresDisponiveis.map((assessor) => (
                                <CommandItem
                                  key={assessor.id}
                                  value={assessor.nome}
                                  onSelect={() => {
                                    if (
                                      !assessoresVinculados.find((p) => p.nome === assessor.nome)
                                    ) {
                                      setAssessoresVinculados([
                                        ...assessoresVinculados,
                                        {
                                          id: assessor.id,
                                          nome: assessor.nome,
                                          papel: "Assessor",
                                          percentual: "",
                                        },
                                      ]);
                                      toast.success(`${assessor.nome} adicionado.`);
                                    } else {
                                      toast.error("Assessor já adicionado.");
                                    }
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
                              const newAssessores = [...assessoresVinculados];
                              if (newAssessores[index]) {
                                newAssessores[index].percentual = e.target.value;
                                setAssessoresVinculados(newAssessores);
                              }
                            }}
                          />
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="text-destructive hover:text-destructive hover:bg-destructive/10"
                          onClick={() => {
                            setAssessoresVinculados(
                              assessoresVinculados.filter((_, i) => i !== index),
                            );
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </SectionCard>

        <SectionCard
          icon={Users}
          title="Investidores"
          description="Investidores e cotas do projeto"
        >
          <div className="space-y-6">
            <div className="space-y-2">
              <Label>Vincular investidor existente</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" role="combobox" className="w-full justify-between">
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
                            value={investidor.nome}
                            onSelect={() => {
                              if (!participantes.find((p) => p.id === investidor.id)) {
                                setParticipantes([
                                  ...participantes,
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
                <div key={i} className="grid gap-3 md:grid-cols-[2fr_140px_auto] items-end">
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Nome</Label>
                    <div className="h-10 flex items-center px-3 rounded-md border bg-muted font-medium text-sm">
                      {p.nome}
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">% Participação</Label>
                    <Input
                      value={p.percentual}
                      placeholder="00"
                      onChange={(e) =>
                        setParticipantes((prev) =>
                          prev.map((x, idx) =>
                            idx === i ? { ...x, percentual: e.target.value } : x,
                          ),
                        )
                      }
                    />
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="mb-0.5"
                    aria-label="Remover investidor"
                    onClick={() => setParticipantes((prev) => prev.filter((_, idx) => idx !== i))}
                  >
                    <Trash2 className="size-4 text-destructive" />
                  </Button>
                </div>
              ))}
            </div>

            <div className="flex flex-wrap gap-3">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="border-brand text-brand hover:bg-brand/5"
                onClick={() => setIsInvestorModalOpen(true)}
              >
                <Plus className="size-4" /> Cadastrar novo investidor
              </Button>
            </div>
          </div>
        </SectionCard>

        <SectionCard
          icon={UserCheck}
          title="Gestor do Projeto"
          description="Nome do(s) responsável(eis)"
        >
          <div className="space-y-6">
            <div className="space-y-2">
              <Label>Selecionar assessor ou responsável cadastrado</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" role="combobox" className="w-full justify-between">
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
                        {responsaveisDisponiveis.map((assessor) => (
                          <CommandItem
                            key={assessor.id}
                            value={assessor.nome}
                            onSelect={() => {
                              if (!responsaveisVinculados.find((r) => r.id === assessor.id)) {
                                setResponsaveisVinculados([
                                  ...responsaveisVinculados,
                                  { id: assessor.id, nome: assessor.nome },
                                ]);
                                toast.success(`${assessor.nome} vinculado como responsável.`);
                              } else {
                                toast.error("Responsável já vinculado.");
                              }
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

            <div className="flex flex-wrap gap-2">
              {responsaveisVinculados.map((resp, index) => (
                <div
                  key={resp.id}
                  className="flex items-center gap-2 rounded-full border bg-muted/50 px-3 py-1 text-sm font-medium"
                >
                  {resp.nome}
                  <button
                    type="button"
                    onClick={() => {
                      setResponsaveisVinculados(
                        responsaveisVinculados.filter((_, i) => i !== index),
                      );
                    }}
                    className="text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="size-3" />
                  </button>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between border-t pt-4">
              <div>
                <p className="text-sm font-medium">Cadastrar novo gestor</p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="border-brand text-brand hover:bg-brand/5"
                onClick={() => setIsResponsibleModalOpen(true)}
              >
                <Plus className="size-4" />
                Cadastrar novo gestor
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
                .filter(([campo]) => modalidade !== "completa" || campo !== "assessoria")
                .map(([campo, rotulo]) => (
                  <div key={campo} className="space-y-2">
                    <Label htmlFor={`projecao-${campo}`}>{rotulo}</Label>
                    <CurrencyInput
                      id={`projecao-${campo}`}
                      value={projecoesFinanceiras[campo]}
                      wholeReais
                      readOnly={campo === "aquisicao" || campo === "assessoria"}
                      className={
                        campo === "aquisicao" || campo === "assessoria"
                          ? "cursor-not-allowed bg-muted"
                          : undefined
                      }
                      onValueChange={(value) =>
                        setProjecoesFinanceiras((current) => ({ ...current, [campo]: value }))
                      }
                      inputMode="numeric"
                    />
                  </div>
                ))}
            </div>

            <div className="space-y-4 rounded-xl border bg-muted/20 p-4">
              <h3 className="font-semibold">Receitas</h3>
              <div className="space-y-2">
                <Label htmlFor="projecao-venda">Venda</Label>
                <CurrencyInput
                  id="projecao-venda"
                  value={projecoesFinanceiras.venda}
                  wholeReais
                  maxValue={99999999.99}
                  onValueChange={(value) =>
                    setProjecoesFinanceiras((current) => ({ ...current, venda: value }))
                  }
                  inputMode="numeric"
                />
              </div>
            </div>
          </div>
        </SectionCard>

        <InvestorRegistrationModal
          open={isInvestorModalOpen}
          onOpenChange={setIsInvestorModalOpen}
          onSave={async (data, alsoTypes) => {
            const created = await salvarPessoa(data, "Investidor", alsoTypes);
            setParticipantes((prev) => [
              ...prev,
              { id: created.id, nome: created.nome, papel: "Investidor", percentual: "" },
            ]);
            toast.success(`Investidor ${data.nome} cadastrado e adicionado!`);
          }}
          type="Investidor"
        />

        <InvestorRegistrationModal
          open={isAssessorModalOpen}
          onOpenChange={setIsAssessorModalOpen}
          onSave={async (data, alsoTypes) => {
            const created = await salvarPessoa(data, "Assessor", alsoTypes);
            setAssessoresVinculados((prev) => [
              ...prev,
              { id: created.id, nome: created.nome, papel: "Assessor", percentual: "" },
            ]);
            toast.success(`Assessor ${data.nome} cadastrado e adicionado!`);
          }}
          type="Assessor"
        />

        <InvestorRegistrationModal
          open={isResponsibleModalOpen}
          onOpenChange={setIsResponsibleModalOpen}
          onSave={async (data, alsoTypes) => {
            const created = await salvarPessoa(data, "Responsável", alsoTypes);
            setResponsaveisVinculados((prev) => [...prev, { id: created.id, nome: created.nome }]);
            toast.success(`Responsável ${data.nome} cadastrado e vinculado!`);
          }}
          type="Responsável"
        />

        <InvestorRegistrationModal
          open={isLeiloeiroModalOpen}
          onOpenChange={setIsLeiloeiroModalOpen}
          onSave={async (data) => {
            const created = await salvarPessoa(data, "Leiloeiro");
            setLeiloeiroVinculado({ id: created.id, nome: created.nome });
            toast.success(`Leiloeiro ${data.nome} cadastrado e vinculado!`);
          }}
          type="Leiloeiro"
        />
        {/* Removido o fechamento extra do SectionCard aqui */}

        <div className="flex flex-wrap justify-end gap-3 pb-4">
          <Button type="button" variant="outline" onClick={() => navigate({ to: "/projetos" })}>
            Cancelar
          </Button>
          <Button type="submit" disabled={salvando}>
            <Save className="size-4" /> {salvando ? "Salvando..." : "Salvar projeto"}
          </Button>
        </div>
      </form>
    </AppLayout>
  );
}

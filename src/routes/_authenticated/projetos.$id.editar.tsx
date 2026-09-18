import { createFileRoute, useNavigate, useParams } from "@tanstack/react-router";
import { useState, useMemo, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { House, Handshake, BriefcaseBusiness, Users, Save, UserPlus, Search, Trash2, CalendarIcon, CheckCircle2, UserCheck, Plus, CircleDollarSign } from "lucide-react";
import { SectionCard } from "@/components/project-form-section-card";
import { AppLayout } from "@/components/app-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { toast } from "sonner";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { formatBRL } from "@/lib/format-currency";
import { getProject, saveProject } from "@/lib/projects";
import { createContact, listContacts } from "@/lib/contacts";
import { InvestorRegistrationModal, type UnifiedEntityData } from "@/components/investor-registration-modal";
import { Calendar } from "@/components/ui/calendar";
import { ImageManagementSection, type ProjetoFoto } from "@/components/image-management-section";
import { CurrencyInput } from "@/components/ui/currency-input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { AdvisoryModeInfo } from "@/components/advisory-mode-info";

export const Route = createFileRoute("/_authenticated/projetos/$id/editar")({
  component: EditarProjeto,
});

function EditarProjeto() {
  const { id } = useParams({ from: "/_authenticated/projetos/$id/editar" });
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: usuarios = [] } = useQuery({ queryKey: ["contacts"], queryFn: () => listContacts() });
  
  const [loading, setLoading] = useState(true);
  const [projeto, setProjeto] = useState<any>(null);
  const [salvando, setSalvando] = useState(false);
  const [status, setStatus] = useState<string>("nao_iniciado");
  
  const [fotosUpload, setFotosUpload] = useState<ProjetoFoto[]>([]);
  const [participantes, setParticipantes] = useState<{ id: string; nome: string; papel: string; percentual: string }[]>([]);
  const [assessoresVinculados, setAssessoresVinculados] = useState<{ id: string; nome: string; papel: string; percentual: string }[]>([]);
  const [responsaveisVinculados, setResponsaveisVinculados] = useState<{ id: string; nome: string }[]>([]);
  
  const [modalidade, setModalidade] = useState<string>("");
  const [valorAquisicao, setValorAquisicao] = useState<number>(0);
  const [percentualHonorarios, setPercentualHonorarios] = useState<number>(10);
  const [temMinimo, setTemMinimo] = useState<string>("nao");
  const [valorMinimo, setValorMinimo] = useState<number>(0);
  const [dataAquisicao, setDataAquisicao] = useState<Date | undefined>(undefined);
  const [formaPagamento, setFormaPagamento] = useState<string>("");
  const [tipoImovel, setTipoImovel] = useState<string>("");
  const [origem, setOrigem] = useState<string>("");
  const [percentualComissao, setPercentualComissao] = useState<number>(5);
  const [leiloeiroVinculado, setLeiloeiroVinculado] = useState<{ id: string; nome: string } | null>(null);
  const [valorFinanciado, setValorFinanciado] = useState<number>(0);
  const [quantidadeParcelas, setQuantidadeParcelas] = useState<number>(1);
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
      const d: any = await getProject({ data: { id } });

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
        setPercentualHonorarios(Number(d.percentual_honorarios));
        setTemMinimo(d.tem_minimo ? "sim" : "nao");
        setValorMinimo(Number(d.valor_minimo));
        setDataAquisicao(d.data_aquisicao ? parseISO(d.data_aquisicao) : undefined);
        setFormaPagamento(d.forma_pagamento || "");
        setTipoImovel(d.tipo_imovel || "");
        setOrigem(d.origem || "");
        setStatus(d.status || "nao_iniciado");
        setPercentualComissao(Number(d.percentual_comissao));
        setValorFinanciado(Number(d.valor_parcelado));
        setQuantidadeParcelas(Number(d.quantidade_parcelas));
        setLeiloeiroVinculado(d.leiloeiro_id ? { id: d.leiloeiro_id, nome: d.leiloeiro_nome || "" } : null);
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

        const investorEntries = Array.isArray(d.participantes) ? d.participantes : [];
        setParticipantes(investorEntries.map((item: any) => ({ id: item.id || "", nome: item.nome, papel: "Investidor", percentual: String(item.percentual || "") })));
        const assessorEntries = Array.isArray(d.assessores) ? d.assessores : [];
        setAssessoresVinculados(assessorEntries.filter((item: any) => typeof item === "object").map((item: any) => ({ id: item.id || "", nome: item.nome, papel: "Assessor", percentual: String(item.percentual || "") })));
        const responsibleEntries = Array.isArray(d.responsaveis) ? d.responsaveis : [];
        setResponsaveisVinculados(responsibleEntries.map((item: any) => ({ id: item.id || "", nome: item.nome })));
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
    setProjecoesFinanceiras((current) => current.aquisicao === valorAquisicao
      ? current
      : { ...current, aquisicao: valorAquisicao }
    );
  }, [valorAquisicao]);

  const honorarioCalculado = useMemo(() => {
    const calc = valorAquisicao * (percentualHonorarios / 100);
    return temMinimo === "sim" ? Math.max(calc, valorMinimo) : calc;
  }, [valorAquisicao, percentualHonorarios, temMinimo, valorMinimo]);

  const comissaoCalculada = valorAquisicao * (percentualComissao / 100);
  const valorParcelaCalculado = quantidadeParcelas > 0 ? valorFinanciado / quantidadeParcelas : 0;

  const investidoresDisponiveis = usuarios.filter(u => u.tipo === "Investidor");
  const assessoresDisponiveis = usuarios.filter(u => u.tipo === "Assessor" || u.perfil === "Administrador" || u.perfil === "Jurídico");
  const leiloeirosDisponiveis = usuarios.filter(u => u.tipo === "Leiloeiro");

  async function salvarPessoa(data: UnifiedEntityData, tipo: "Investidor" | "Assessor" | "Leiloeiro") {
    const newPerson = await createContact({ data: { ...data, type: tipo } });
    await queryClient.invalidateQueries({ queryKey: ["contacts"] });
    toast.success(`${tipo} cadastrado com sucesso!`);
    return newPerson;
  }

  if (loading || !projeto) return <div className="p-8">Carregando...</div>;

  return (
    <AppLayout title="Editar Projeto" subtitle={projeto?.nome || "Projeto"}>
      <form className="grid gap-6" onSubmit={async (e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          setSalvando(true);
          try {
            const parcelado = formaPagamento === "parcelado" || formaPagamento === "financiado";
            const address = (fd.get("end") as string) || "Endereço não informado";
            const mainImage = fotosUpload.find(f => f.is_main)?.url || fotosUpload[0]?.url || null;
            const projectData = {
              ...projeto,
              investidores: participantes.map(p => p.nome),
              foto: mainImage,
              cep: fd.get("cep") as string,
              area: fd.get("area") as string,
              land_area: parseFloat((fd.get("land_area") as string)?.replace(/[^\d.,]/g, "").replace(",", ".")) || null,
              built_area: parseFloat((fd.get("built_area") as string)?.replace(/[^\d.,]/g, "").replace(",", ".")) || null,
              total_area: parseFloat((fd.get("total_area") as string)?.replace(/[^\d.,]/g, "").replace(",", ".")) || null,
              matricula: fd.get("mat") as string,
              tipo_imovel: tipoImovel || null,
              iptu: fd.get("iptu") as string,
              observacoes: fd.get("obs") as string,
              fotos: fotosUpload.map(f => f.url),
              origem: origem || null,
              valor_aquisicao: valorAquisicao,
              data_aquisicao: dataAquisicao ? format(dataAquisicao, "yyyy-MM-dd") : null,
              forma_pagamento: formaPagamento || null,
              leiloeiro_nome: leiloeiroVinculado?.nome ?? null,
              percentual_comissao: percentualComissao,
              valor_comissao: comissaoCalculada,
              credor: parcelado ? fd.get("credor") as string : null,
              valor_parcelado: parcelado ? valorFinanciado : 0,
              quantidade_parcelas: parcelado ? quantidadeParcelas : 1,
              valor_parcela: parcelado ? valorParcelaCalculado : 0,
              percentual_honorarios: modalidade === "nenhuma" || modalidade === "completa" ? 0 : percentualHonorarios,
              tem_minimo: temMinimo === "sim",
              valor_minimo: valorMinimo,
              valor_honorarios: modalidade === "nenhuma" || modalidade === "completa" ? 0 : honorarioCalculado,
              participantes,
              assessores: assessoresVinculados,
              projecoes_financeiras: modalidade === "completa"
                ? { ...projecoesFinanceiras, assessoria: 0 }
                : projecoesFinanceiras,
            };
            await saveProject({ data: {
              id,
              name: address,
              address,
              city: (fd.get("cidade") as string) || "",
              stage: modalidade || projeto.etapa || "Aquisição",
                status: status as "nao_iniciado" | "pendente" | "andamento" | "aguardando" | "concluido" | "atrasado",
              responsible: responsaveisVinculados[0]?.nome || "Não atribuído",
              mainImage,
              data: projectData,
              links: [
                ...participantes.filter((item) => item.id).map((item) => ({ contactId: item.id, role: "investor" as const, percentage: item.percentual })),
                ...assessoresVinculados.filter((item) => item.id).map((item) => ({ contactId: item.id, role: "advisor" as const, percentage: item.percentual })),
                ...responsaveisVinculados.filter((item) => item.id).map((item) => ({ contactId: item.id, role: "responsible" as const })),
                ...(leiloeiroVinculado?.id ? [{ contactId: leiloeiroVinculado.id, role: "auctioneer" as const }] : []),
              ],
            } });

            toast.success("Projeto atualizado com sucesso!");
            navigate({ to: "/projetos" });
          } catch (err: any) { toast.error(err.message); } finally { setSalvando(false); }
        }}>
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
              <Input id="end" name="end" defaultValue={projeto.endereco || ""} placeholder="Rua, número, complemento" />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="cidade">Cidade / UF</Label>
              <Input id="cidade" name="cidade" defaultValue={projeto.cidade || ""} placeholder="São Paulo / SP" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cep">CEP</Label>
              <Input id="cep" name="cep" defaultValue={projeto.cep || ""} placeholder="00000-000" />
            </div>

            <div className="space-y-2">
              <Label htmlFor="area">Área Privativa</Label>
              <div className="relative">
                <Input id="area" name="area" defaultValue={projeto.area || ""} placeholder="0,00" />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">m²</span>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="land_area">Área do Terreno</Label>
              <div className="relative">
                <Input 
                  id="land_area" 
                  name="land_area" 
                  type="text"
                  inputMode="decimal"
                  defaultValue={projeto.land_area ? parseFloat(projeto.land_area.toString()).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : ""}
                  placeholder="0,00" 
                  onBlur={(e) => {
                    const val = e.target.value.replace(/[^\d.,]/g, "").replace(",", ".");
                    if (val) e.target.value = parseFloat(val).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                  }}
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">m²</span>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="built_area">Área Construída</Label>
              <div className="relative">
                <Input 
                  id="built_area" 
                  name="built_area" 
                  type="text"
                  inputMode="decimal"
                  defaultValue={projeto.built_area ? parseFloat(projeto.built_area.toString()).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : ""}
                  placeholder="0,00" 
                  onBlur={(e) => {
                    const val = e.target.value.replace(/[^\d.,]/g, "").replace(",", ".");
                    if (val) e.target.value = parseFloat(val).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                  }}
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">m²</span>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="total_area">Área Total</Label>
              <div className="relative">
                <Input 
                  id="total_area" 
                  name="total_area" 
                  type="text"
                  inputMode="decimal"
                  defaultValue={projeto.total_area ? parseFloat(projeto.total_area.toString()).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : ""}
                  placeholder="0,00" 
                  onBlur={(e) => {
                    const val = e.target.value.replace(/[^\d.,]/g, "").replace(",", ".");
                    if (val) e.target.value = parseFloat(val).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                  }}
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">m²</span>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="mat">Matrícula / Cartório</Label>
              <Input id="mat" name="mat" defaultValue={projeto.matricula || ""} placeholder="128.442 - 5º CRI" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="iptu">Inscrição municipal (IPTU)</Label>
              <Input id="iptu" name="iptu" defaultValue={projeto.iptu || ""} placeholder="000.000.0000-0" />
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
              <Textarea id="obs" name="obs" defaultValue={projeto.observacoes || ""} rows={3} placeholder="Situação de ocupação, pendências conhecidas..." />
            </div>
          </div>
        </SectionCard>

        <SectionCard icon={Handshake} title="Aquisição" description="Origem, valores e pagamento">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Origem</Label>
              <Select value={origem} onValueChange={setOrigem}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
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
                      !dataAquisicao && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="absolute left-3 h-4 w-4" />
                    {dataAquisicao ? format(dataAquisicao, "dd/MM/yyyy") : <span>Selecione uma data</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="end">
                  <Calendar mode="single" selected={dataAquisicao} onSelect={setDataAquisicao} locale={ptBR} />
                </PopoverContent>
              </Popover>
            </div>
            <div className="space-y-2">
              <Label>Forma de pagamento</Label>
              <Select value={formaPagamento} onValueChange={setFormaPagamento}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="avista">À vista</SelectItem>
                  <SelectItem value="parcelado">Parcelado</SelectItem>
                  <SelectItem value="financiado">Financiado</SelectItem>
                </SelectContent>
              </Select>
            </div>

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
                            {leiloeirosDisponiveis.map((leiloeiro: any) => (
                              <CommandItem
                                key={leiloeiro.id}
                                onSelect={() => setLeiloeiroVinculado({ id: leiloeiro.id, nome: leiloeiro.nome })}
                              >
                                <CheckCircle2 className={cn("mr-2 h-4 w-4", leiloeiroVinculado?.id === leiloeiro.id ? "opacity-100" : "opacity-0")} />
                                {leiloeiro.nome}
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                  <Button type="button" variant="ghost" size="sm" className="h-7 text-xs px-0 text-brand" onClick={() => setIsLeiloeiroModalOpen(true)}>
                    <UserPlus className="mr-1 size-3" /> Cadastrar novo leiloeiro
                  </Button>
                </div>
                <div className="grid gap-4 grid-cols-2">
                  <div className="space-y-2">
                    <Label>Comissão (%)</Label>
                    <Input type="number" step="0.01" value={percentualComissao} onChange={(e) => setPercentualComissao(parseFloat(e.target.value) || 0)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Valor da Comissão (R$)</Label>
                    <Input value={formatBRL(comissaoCalculada)} disabled className="bg-muted" />
                  </div>
                </div>
              </div>
            </div>

            {(formaPagamento === "parcelado" || formaPagamento === "financiado") && (
              <div className="space-y-2 md:col-span-2 border-t pt-4 mt-2">
                <Label className="text-brand font-semibold mb-2 block">Dados do Pagamento</Label>
                <div className="grid gap-4 md:grid-cols-4">
                  <Input name="credor" defaultValue={projeto.credor} placeholder="Credor" />
                  <div className="space-y-1">
                    <Label className="text-[10px]">Valor</Label>
                    <CurrencyInput value={valorFinanciado} onValueChange={setValorFinanciado} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px]">Parcelas</Label>
                    <Input type="number" value={quantidadeParcelas} onChange={(e) => setQuantidadeParcelas(parseInt(e.target.value) || 1)} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px]">Vlr. Parcela</Label>
                    <Input value={formatBRL(valorParcelaCalculado)} disabled className="bg-muted" />
                  </div>
                </div>
              </div>
            )}
          </div>
        </SectionCard>

        <SectionCard icon={BriefcaseBusiness} title="Modalidade de Assessoria" description="Escopo e honorários">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="modalidade">Modalidade</Label>
              <Select value={modalidade} onValueChange={setModalidade}>
                <SelectTrigger id="modalidade"><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="completa">Assessoria Completa</SelectItem>
                  <SelectItem value="parcial">Assessoria Parcial</SelectItem>
                  <SelectItem value="juridica">Assessoria Jurídica</SelectItem>
                  <SelectItem value="operacional">Assessoria Operacional</SelectItem>
                  <SelectItem value="consultiva">Consultoria Específica</SelectItem>
                  <SelectItem value="nenhuma">Sem Assessoria</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {(modalidade === "parcial" || modalidade === "juridica" || modalidade === "operacional" || modalidade === "consultiva") && <>
              <div className="space-y-2">
                <Label htmlFor="honorario">Percentual de Honorários (%)</Label>
                <Input id="honorario" type="number" value={percentualHonorarios} onChange={(e) => setPercentualHonorarios(parseFloat(e.target.value) || 0)} />
              </div>

              <div className="space-y-3">
                <Label>Há valor mínimo de honorários?</Label>
                <RadioGroup value={temMinimo} onValueChange={setTemMinimo} className="flex items-center gap-4">
                  <div className="flex items-center space-x-2"><RadioGroupItem value="sim" id="edit-min-sim" /><Label htmlFor="edit-min-sim" className="cursor-pointer">Sim</Label></div>
                  <div className="flex items-center space-x-2"><RadioGroupItem value="nao" id="edit-min-nao" /><Label htmlFor="edit-min-nao" className="cursor-pointer">Não</Label></div>
                </RadioGroup>
              </div>

              {temMinimo === "sim" && <div className="space-y-2">
                <Label htmlFor="edit-val-min">Valor Mínimo de Honorários</Label>
                <CurrencyInput id="edit-val-min" value={valorMinimo} onValueChange={setValorMinimo} placeholder="R$ 0,00" />
              </div>}

              <div className="space-y-2">
                <Label>Valor devido calculado</Label>
                <div className="h-10 flex items-center px-3 rounded-md border bg-muted font-medium">{formatBRL(honorarioCalculado)}</div>
              </div>
            </>}

            <AdvisoryModeInfo mode={modalidade} />

            {modalidade === "nenhuma" && <div className="md:col-span-2 space-y-4">
              <div className="grid gap-4 md:grid-cols-2"><div className="space-y-2"><Label htmlFor="edit-fixo-zero">Valor dos honorários</Label><Input id="edit-fixo-zero" value="R$ 0,00" disabled /></div></div>
            </div>}

            {modalidade !== "nenhuma" && modalidade !== "" && <div className="md:col-span-2 space-y-6 pt-4 border-t">
              <div className="flex items-center justify-between gap-4">
                <div><h4 className="text-sm font-semibold">Assessores</h4><p className="text-xs text-muted-foreground">Vincule os assessores e defina suas participações</p></div>
                <Button type="button" variant="outline" size="sm" onClick={() => setIsAssessorModalOpen(true)}><UserPlus className="mr-2 h-4 w-4" />Cadastrar novo assessor</Button>
              </div>
              <div className="space-y-2">
                <Label>Vincular assessor existente</Label>
                <Popover><PopoverTrigger asChild><Button variant="outline" role="combobox" className="w-full justify-between">Procurar por nome...<Search className="ml-2 h-4 w-4 shrink-0 opacity-50" /></Button></PopoverTrigger>
                  <PopoverContent className="w-[400px] p-0" align="start"><Command><CommandInput placeholder="Digite o nome do assessor..." /><CommandList><CommandEmpty>Nenhum assessor encontrado.</CommandEmpty><CommandGroup>
                    {assessoresDisponiveis.map((assessor) => <CommandItem key={assessor.id} value={assessor.nome} onSelect={() => {
                      if (!assessoresVinculados.find((item) => item.id === assessor.id)) setAssessoresVinculados([...assessoresVinculados, { id: assessor.id, nome: assessor.nome, papel: "Assessor", percentual: "" }]);
                      else toast.error("Assessor já adicionado.");
                    }}><CheckCircle2 className="mr-2 h-4 w-4" />{assessor.nome} ({assessor.email})</CommandItem>)}
                  </CommandGroup></CommandList></Command></PopoverContent>
                </Popover>
              </div>
              <div className="space-y-3">{assessoresVinculados.map((assessor, index) => <div key={index} className="flex items-end gap-3 rounded-lg border bg-muted/30 p-3">
                <div className="flex-1 space-y-1"><Label className="text-xs text-muted-foreground">Nome</Label><div className="h-10 flex items-center px-3 rounded-md bg-white border font-medium">{assessor.nome}</div></div>
                <div className="w-32 space-y-1"><Label className="text-xs text-muted-foreground">% Participação</Label><Input type="number" placeholder="0" value={assessor.percentual} onChange={(e) => {
                  const next = [...assessoresVinculados]; if (next[index]) next[index].percentual = e.target.value; setAssessoresVinculados(next);
                }} /></div>
                <Button type="button" variant="ghost" size="icon" className="text-destructive hover:text-destructive hover:bg-destructive/10" onClick={() => setAssessoresVinculados(assessoresVinculados.filter((_, itemIndex) => itemIndex !== index))}><Trash2 className="h-4 w-4" /></Button>
              </div>)}</div>
            </div>}
          </div>
        </SectionCard>

        <SectionCard icon={Users} title="Investidores" description="Participantes do projeto">
            <div className="space-y-4">
              {participantes.map((p, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className="flex-1 p-2 border rounded bg-muted/50">{p.nome}</div>
                  <Input 
                    className="w-24" 
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
                  <Button type="button" variant="ghost" size="icon" onClick={() => setParticipantes(participantes.filter((_, idx) => idx !== i))}>
                    <Trash2 className="size-4 text-destructive" />
                  </Button>
                </div>
              ))}
              <Button type="button" variant="outline" size="sm" onClick={() => setIsInvestorModalOpen(true)}>
                <UserPlus className="size-4 mr-2" /> Adicionar Investidor
              </Button>
            </div>
        </SectionCard>

        <SectionCard icon={UserCheck} title="Responsável pelo Projeto" description="Gestores vinculados">
            <div className="flex flex-wrap gap-2">
              {responsaveisVinculados.map((r, i) => (
                <div key={i} className="flex items-center gap-2 px-3 py-1 border rounded-full bg-muted/50">
                  {r.nome}
                  <button type="button" onClick={() => setResponsaveisVinculados(responsaveisVinculados.filter((_, idx) => idx !== i))}>
                    <Trash2 className="size-3" />
                  </button>
                </div>
              ))}
              <Button type="button" variant="outline" size="sm" onClick={() => setIsResponsibleModalOpen(true)}>Vincular Responsável</Button>
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
              {([
                ["aquisicao", "Aquisição"],
                ["cartorio", "Cartório"],
                ["prefeitura", "Prefeitura"],
                ["condominio", "Condomínio"],
                ["juridico", "Jurídico"],
                ["obra", "Obra"],
                ["assessoria", "Assessoria"],
              ] as const).map(([field, label]) => (
                <div key={field} className="space-y-2">
                  <Label htmlFor={`edit-projecao-${field}`}>{label}</Label>
                  <CurrencyInput
                    id={`edit-projecao-${field}`}
                    value={projecoesFinanceiras[field]}
                    wholeReais
                    inputMode="numeric"
                    readOnly={field === "aquisicao"}
                    className={field === "aquisicao" ? "cursor-not-allowed bg-muted" : undefined}
                    onValueChange={(value) => setProjecoesFinanceiras((current) => ({ ...current, [field]: value }))}
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
                  onValueChange={(value) => setProjecoesFinanceiras((current) => ({ ...current, venda: value }))}
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
            setParticipantes((prev) => [...prev, { id: created.id, nome: created.nome, papel: "Investidor", percentual: "" }]);
          }}
          type="Investidor"
        />
        <InvestorRegistrationModal
          open={isAssessorModalOpen}
          onOpenChange={setIsAssessorModalOpen}
          onSave={async (data) => {
            const created = await salvarPessoa(data, "Assessor");
            setAssessoresVinculados((prev) => [...prev, { id: created.id, nome: created.nome, papel: "Assessor", percentual: "" }]);
          }}
          type="Assessor"
        />
        <InvestorRegistrationModal
          open={isResponsibleModalOpen}
          onOpenChange={setIsResponsibleModalOpen}
          onSave={async (data) => {
            const created = await salvarPessoa(data, "Assessor");
            setResponsaveisVinculados((prev) => [...prev, { id: created.id, nome: created.nome }]);
          }}
          type="Assessor"
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

        <div className="flex justify-end gap-3">
          <Button type="button" variant="outline" onClick={() => navigate({ to: `/projetos/${id}` })}>Cancelar</Button>
          <Button type="submit" disabled={salvando}><Save className="size-4 mr-2" /> Salvar</Button>
        </div>
      </form>
    </AppLayout>
  );
}

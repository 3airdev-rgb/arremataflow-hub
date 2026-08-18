import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { House, Handshake, BriefcaseBusiness, Users, Plus, Trash2, Save, UserPlus, Search, CalendarIcon, CheckCircle2, UserCheck } from "lucide-react";
import { AppLayout } from "@/components/app-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
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
import { projetos, usuarios, formatBRL } from "@/lib/mock-data";
import { InvestorRegistrationModal, type UnifiedEntityData } from "@/components/investor-registration-modal";
import { ImageManagementSection, type ProjetoFoto } from "@/components/image-management-section";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/projetos/novo")({
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

function SectionCard({
  icon: Icon,
  title,
  description,
  children,
}: {
  icon: typeof House;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="surface-card p-6">
      <div className="mb-5 flex items-start gap-3">
        <span className="grid size-10 place-items-center rounded-xl bg-primary-soft text-brand">
          <Icon className="size-5" strokeWidth={1.75} />
        </span>
        <div>
          <h3 className="text-base font-semibold">{title}</h3>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
      </div>
      {children}
    </section>
  );
}



async function salvarPessoa(data: UnifiedEntityData, tipo: "Investidor" | "Assessor" | "Leiloeiro") {
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) return;
  const { error } = await supabase.from("pessoas").insert({
    user_id: userId,
    tipo,
    nome: data.nome,
    documento: data.documento || null,
    email: data.email || null,
    celulares: data.celulares ?? [],
    data_nascimento: data.dataNascimento || null,
    estado_civil: data.estadoCivil || null,
    endereco: data.endereco || null,
    banco: data.banco || null,
    agencia: data.agencia || null,
    conta: data.conta || null,
    website: data.website || null,
    cidade: data.cidade || null,
    estado: data.estado || null,
  });
  if (error) toast.error(`Não foi possível salvar ${tipo.toLowerCase()}: ${error.message}`);
}

function NovoProjeto() {
  const navigate = useNavigate();
  const [fotosUpload, setFotosUpload] = useState<ProjetoFoto[]>([]);
  const [isInvestorModalOpen, setIsInvestorModalOpen] = useState(false);
  const [isAssessorModalOpen, setIsAssessorModalOpen] = useState(false);
  const [isResponsibleModalOpen, setIsResponsibleModalOpen] = useState(false);
  const [isLeiloeiroModalOpen, setIsLeiloeiroModalOpen] = useState(false);
  const [participantes, setParticipantes] = useState([
    { nome: "Marcos Ribeiro", papel: "Investidor", percentual: "45" },
  ]);
  const [assessoresVinculados, setAssessoresVinculados] = useState([
    { nome: "Camila Andrade", papel: "Assessor", percentual: "100" },
  ]);
  const [responsaveisVinculados, setResponsaveisVinculados] = useState<{id: string, nome: string}[]>([]);
  
  // States for new logic
  const [modalidade, setModalidade] = useState<string>("");
  const [valorAquisicao, setValorAquisicao] = useState<number>(0);
  const [percentualHonorarios, setPercentualHonorarios] = useState<number>(10);
  const [temMinimo, setTemMinimo] = useState<string>("nao");
  const [valorMinimo, setValorMinimo] = useState<number>(0);
  const [dataAquisicao, setDataAquisicao] = useState<Date | undefined>(undefined);
  const [formaPagamento, setFormaPagamento] = useState<string>("");
  const [tipoImovel, setTipoImovel] = useState<string>("");
  const [origem, setOrigem] = useState<string>("");
  const [salvando, setSalvando] = useState(false);
  
  // Leiloeiro states
  const [leiloeiroVinculado, setLeiloeiroVinculado] = useState<{id: string, nome: string} | null>(null);
  const [percentualComissao, setPercentualComissao] = useState<number>(5);

  // Financiamento states
  const [valorFinanciado, setValorFinanciado] = useState<number>(0);
  const [quantidadeParcelas, setQuantidadeParcelas] = useState<number>(1);

  const honorarioCalculado = useMemo(() => {
    const calculado = valorAquisicao * (percentualHonorarios / 100);
    if (temMinimo === "sim") {
      return Math.max(calculado, valorMinimo);
    }
    return calculado;
  }, [valorAquisicao, percentualHonorarios, temMinimo, valorMinimo]);

  const comissaoCalculada = useMemo(() => {
    return valorAquisicao * (percentualComissao / 100);
  }, [valorAquisicao, percentualComissao]);

  const valorParcelaCalculado = useMemo(() => {
    if (quantidadeParcelas <= 0) return 0;
    return valorFinanciado / quantidadeParcelas;
  }, [valorFinanciado, quantidadeParcelas]);

  const investidoresDisponiveis = usuarios.filter(u => u.perfil === "Investidor");
  const assessoresDisponiveis = usuarios.filter(u => u.perfil === "Assessor" || u.perfil === "Administrador" || u.perfil === "Jurídico");
  const leiloeirosDisponiveis = usuarios.filter(u => u.perfil === "Leiloeiro");

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
          setSalvando(true);
          try {
            const { data: userData } = await supabase.auth.getUser();
            const userId = userData.user?.id;
            if (!userId) throw new Error("Sessão expirada. Entre novamente.");

            let leiloeiroId: string | null = null;
            if (leiloeiroVinculado) {
              const { data: pessoa, error: pessoaError } = await supabase
                .from("pessoas")
                .insert({ user_id: userId, tipo: "Leiloeiro", nome: leiloeiroVinculado.nome })
                .select("id")
                .single();
              if (pessoaError) throw pessoaError;
              leiloeiroId = pessoa.id;
            }

            const parcelado = formaPagamento === "parcelado" || formaPagamento === "financiado";
            const { data: projeto, error: projetoError } = await supabase
              .from("projetos")
              .insert({
                user_id: userId,
                nome: txt("end") ?? "Novo projeto",
                endereco: txt("end"),
                cidade: txt("cidade"),
                cep: txt("cep"),
                area: txt("area"),
                land_area: num("land_area"),
                built_area: num("built_area"),
                total_area: num("total_area"),
                matricula: txt("mat"),
                tipo_imovel: tipoImovel || null,
                iptu: txt("iptu"),
                observacoes: txt("obs"),
                fotos: fotosUpload.map(f => f.url),
                foto_principal: fotosUpload.find(f => f.is_main)?.url || null,
                origem: origem || null,
                valor_aquisicao: valorAquisicao,
                data_aquisicao: dataAquisicao ? format(dataAquisicao, "yyyy-MM-dd") : null,
                forma_pagamento: formaPagamento || null,
                leiloeiro_id: leiloeiroId,
                leiloeiro_nome: leiloeiroVinculado?.nome ?? null,
                percentual_comissao: percentualComissao,
                valor_comissao: comissaoCalculada,
                credor: parcelado ? txt("credor") : null,
                valor_parcelado: parcelado ? valorFinanciado : 0,
                quantidade_parcelas: parcelado ? quantidadeParcelas : 1,
                valor_parcela: parcelado ? valorParcelaCalculado : 0,
                modalidade: modalidade || null,
                percentual_honorarios: modalidade === "nenhuma" ? 0 : percentualHonorarios,
                tem_minimo: temMinimo === "sim",
                valor_minimo: valorMinimo,
                valor_honorarios: modalidade === "nenhuma" ? 0 : honorarioCalculado,
              })
              .select("id")
              .single();
            if (projetoError) throw projetoError;

            const vinculos = [
              ...participantes.map((p) => ({
                projeto_id: projeto.id,
                nome: p.nome,
                papel: "Investidor",
                percentual: parseFloat(p.percentual) || 0,
              })),
              ...assessoresVinculados.map((a) => ({
                projeto_id: projeto.id,
                nome: a.nome,
                papel: "Assessor",
                percentual: parseFloat(a.percentual) || 0,
              })),
            ];
            if (vinculos.length > 0) {
              const { error: vinculoError } = await supabase
                .from("projeto_participantes")
                .insert(vinculos);
              if (vinculoError) throw vinculoError;
            }
            
            // Salvar responsáveis (project_managers)
            if (responsaveisVinculados.length > 0) {
              const managers = responsaveisVinculados.map((r) => ({
                project_id: projeto.id,
                assessor_id: r.id,
                user_id: userId
              }));
              const { error: managerError } = await supabase
                .from("project_managers")
                .insert(managers);
              if (managerError) throw managerError;
            }

            // Salvar metadados das fotos
            if (fotosUpload.length > 0) {
              const fotosMetadata = fotosUpload.map((f, idx) => ({
                projeto_id: projeto.id,
                file_path: f.file_path,
                file_name: f.file_name,
                display_order: idx,
                is_main: f.is_main,
                user_id: userId
              }));
              
              const { error: fotosError } = await supabase
                .from("projeto_fotos")
                .insert(fotosMetadata);
                
              if (fotosError) console.error("Erro ao salvar metadados das fotos:", fotosError);
            }

            toast.success("Projeto salvo no banco com sucesso!");
            navigate({ to: "/projetos" });
          } catch (err) {
            toast.error(err instanceof Error ? err.message : "Não foi possível salvar o projeto.");
          } finally {
            setSalvando(false);
          }
        }}
      >
        <SectionCard icon={House} title="Imóvel" description="Dados cadastrais e localização">
          <div className="mb-6">
            <ImageManagementSection 
              onImagesChange={(imgs) => setFotosUpload(imgs)}
            />
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

            <div className="space-y-2">
              <Label htmlFor="area">Área Privativa</Label>
              <div className="relative">
                <Input id="area" name="area" placeholder="0,00" />
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
              <Input id="mat" name="mat" placeholder="128.442 - 5º CRI" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="iptu">Inscrição municipal (IPTU)</Label>
              <Input id="iptu" name="iptu" placeholder="000.000.0000-0" />
            </div>

            <div className="space-y-2 md:col-span-2">
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
              <Textarea id="obs" name="obs" rows={3} placeholder="Situação de ocupação, pendências conhecidas..." />
            </div>
          </div>
        </SectionCard>

        <SectionCard icon={Handshake} title="Aquisição" description="Origem, valores e pagamento">
          <div className="grid gap-4 md:grid-cols-2">
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
              <Input 
                id="valor" 
                placeholder="R$ 0,00" 
                onChange={(e) => {
                  const val = parseFloat(e.target.value.replace(/[^0-9]/g, "")) || 0;
                  setValorAquisicao(val);
                }}
              />
            </div>
            <div className="space-y-2">
              <Label>Data da aquisição</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant={"outline"}
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !dataAquisicao && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dataAquisicao ? (
                      format(dataAquisicao, "dd/MM/yyyy")
                    ) : (
                      <span>Selecione uma data</span>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
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
                                    leiloeiroVinculado?.id === leiloeiro.id ? "opacity-100" : "opacity-0"
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
                <div className="grid gap-4 grid-cols-2">
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
                    <Label className="truncate block">Valor da Comissão (R$)</Label>
                    <Input value={formatBRL(comissaoCalculada)} disabled className="bg-muted w-full" />
                  </div>
                </div>
              </div>
            </div>

            {(formaPagamento === "parcelado" || formaPagamento === "financiado") && (
              <div className="space-y-2 md:col-span-2 border-t pt-4 mt-2">
                <Label className="text-brand font-semibold mb-2 block">
                  Dados do {formaPagamento === "parcelado" ? "Parcelamento" : "Financiamento"}
                </Label>
                <div className="grid gap-4 md:grid-cols-4">
                  <div className="space-y-2">
                    <Label>Credor</Label>
                    <Input name="credor" placeholder="Nome do credor" />
                  </div>
                  <div className="space-y-2">
                    <Label>Valor {formaPagamento === "parcelado" ? "Parcelado" : "Financiado"}</Label>
                    <Input 
                      placeholder="R$ 0,00" 
                      onChange={(e) => {
                        const val = parseFloat(e.target.value.replace(/[^0-9]/g, "")) || 0;
                        setValorFinanciado(val);
                      }}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Qtd. de Parcelas</Label>
                    <Input 
                      type="number" 
                      min="1" 
                      value={quantidadeParcelas}
                      onChange={(e) => setQuantidadeParcelas(parseInt(e.target.value) || 1)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Valor da Parcela (R$)</Label>
                    <Input value={formatBRL(valorParcelaCalculado)} disabled className="bg-muted" />
                  </div>
                </div>
              </div>
            )}
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
                  <SelectItem value="completa">Assessoria Completa</SelectItem>
                  <SelectItem value="parcial">Assessoria Parcial</SelectItem>
                  <SelectItem value="juridica">Assessoria Jurídica</SelectItem>
                  <SelectItem value="operacional">Assessoria Operacional</SelectItem>
                  <SelectItem value="consultiva">Consultoria Específica</SelectItem>
                  <SelectItem value="nenhuma">Sem Assessoria</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {(modalidade === "parcial" || modalidade === "juridica" || modalidade === "operacional" || modalidade === "consultiva") && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="honorario">Percentual de Honorários (%)</Label>
                  <Input 
                    id="honorario" 
                    type="number"
                    value={percentualHonorarios}
                    onChange={(e) => setPercentualHonorarios(parseFloat(e.target.value) || 0)}
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
                      <Label htmlFor="min-sim" className="cursor-pointer">Sim</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="nao" id="min-nao" />
                      <Label htmlFor="min-nao" className="cursor-pointer">Não</Label>
                    </div>
                  </RadioGroup>
                </div>

                {temMinimo === "sim" && (
                  <div className="space-y-2">
                    <Label htmlFor="val-min">Valor Mínimo de Honorários</Label>
                    <Input 
                      id="val-min" 
                      placeholder="R$ 0,00"
                      onChange={(e) => {
                        const val = parseFloat(e.target.value.replace(/[^0-9]/g, "")) || 0;
                        setValorMinimo(val);
                      }}
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

            {modalidade === "completa" && (
              <div className="md:col-span-2 rounded-lg bg-primary-soft p-4 border border-brand/20">
                <p className="text-sm font-medium text-brand">Regra de Assessoria Completa</p>
                <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                  Honorários apurados sobre o Resultado Líquido (Venda - Despesas).
                  Distribuição: 50% Assessoria / 50% Investidores.
                </p>
              </div>
            )}

            {modalidade === "nenhuma" && (
              <div className="md:col-span-2 space-y-4">
                <div className="rounded-lg bg-muted p-4 border border-border">
                  <p className="text-sm font-medium">Sem Assessoria</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Nenhum cálculo de honorários ou distribuição será realizado para assessoria.
                  </p>
                </div>
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
                    <p className="text-xs text-muted-foreground">Vincule os assessores e defina suas participações</p>
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
                                    if (!assessoresVinculados.find(p => p.nome === assessor.nome)) {
                                      setAssessoresVinculados([...assessoresVinculados, { nome: assessor.nome, papel: "Assessor", percentual: "" }]);
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
                      <div key={index} className="flex items-end gap-3 rounded-lg border bg-muted/30 p-3">
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
                            setAssessoresVinculados(assessoresVinculados.filter((_, i) => i !== index));
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

        <SectionCard icon={Users} title="Investidores" description="Investidores e cotas do projeto">
          <div className="space-y-6">
            <div className="space-y-2">
              <Label>Vincular investidor existente</Label>
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
                    <CommandInput placeholder="Digite o nome do investidor..." />
                    <CommandList>
                      <CommandEmpty>Nenhum investidor encontrado.</CommandEmpty>
                      <CommandGroup>
                        {investidoresDisponiveis.map((investidor) => (
                          <CommandItem
                            key={investidor.id}
                            value={investidor.nome}
                            onSelect={() => {
                              if (!participantes.find(p => p.nome === investidor.nome)) {
                                setParticipantes([...participantes, { nome: investidor.nome, papel: "Investidor", percentual: "" }]);
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
                          prev.map((x, idx) => (idx === i ? { ...x, percentual: e.target.value } : x)),
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
        
        <SectionCard icon={UserCheck} title="Responsável pelo Projeto" description="Nome do(s) responsável(eis)">
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-sm font-semibold">Responsável pelo Projeto</h4>
                <p className="text-xs text-muted-foreground">Nome do(s) responsável(eis)</p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsResponsibleModalOpen(true)}
              >
                <UserPlus className="mr-2 h-4 w-4" />
                Cadastrar novo assessor
              </Button>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Vincular responsável existente</Label>
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
                      <CommandInput placeholder="Pesquisar assessor para vincular..." />
                      <CommandList>
                        <CommandEmpty>Nenhum assessor encontrado.</CommandEmpty>
                        <CommandGroup>
                          {assessoresDisponiveis.map((assessor) => (
                            <CommandItem
                              key={assessor.id}
                              value={assessor.nome}
                              onSelect={() => {
                                if (!responsaveisVinculados.find(r => r.id === assessor.id)) {
                                  setResponsaveisVinculados([...responsaveisVinculados, { id: assessor.id, nome: assessor.nome }]);
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
                  <div key={resp.id} className="flex items-center gap-2 rounded-full border bg-muted/50 px-3 py-1 text-sm font-medium">
                    {resp.nome}
                    <button
                      type="button"
                      onClick={() => {
                        setResponsaveisVinculados(responsaveisVinculados.filter((_, i) => i !== index));
                      }}
                      className="text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="size-3" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </SectionCard>

          <InvestorRegistrationModal
            open={isInvestorModalOpen}
            onOpenChange={setIsInvestorModalOpen}
            onSave={async (data) => {
              setParticipantes((prev) => [
                ...prev,
                { nome: data.nome, papel: "Investidor", percentual: "" },
              ]);
              await salvarPessoa(data, "Investidor");
              toast.success(`Investidor ${data.nome} cadastrado e adicionado!`);
            }}
            type="Investidor"
          />

          <InvestorRegistrationModal
            open={isAssessorModalOpen}
            onOpenChange={setIsAssessorModalOpen}
            onSave={async (data) => {
              setAssessoresVinculados((prev) => [
                ...prev,
                { nome: data.nome, papel: "Assessor", percentual: "" },
              ]);
              await salvarPessoa(data, "Assessor");
              toast.success(`Assessor ${data.nome} cadastrado e adicionado!`);
            }}
            type="Assessor"
          />

          <InvestorRegistrationModal
            open={isResponsibleModalOpen}
            onOpenChange={setIsResponsibleModalOpen}
            onSave={async (data) => {
              // Create a temporary ID for the UI
              const tempId = Math.random().toString();
              setResponsaveisVinculados((prev) => [
                ...prev,
                { id: tempId, nome: data.nome },
              ]);
              await salvarPessoa(data, "Assessor");
              toast.success(`Assessor ${data.nome} cadastrado e vinculado como responsável!`);
            }}
            type="Assessor"
          />

          <InvestorRegistrationModal
            open={isLeiloeiroModalOpen}
            onOpenChange={setIsLeiloeiroModalOpen}
            onSave={async (data) => {
              setLeiloeiroVinculado({ id: Math.random().toString(), nome: data.nome });
              await salvarPessoa(data, "Leiloeiro");
              toast.success(`Leiloeiro ${data.nome} cadastrado e vinculado!`);
            }}
            type="Leiloeiro"
          />
        {/* Removido o fechamento extra do SectionCard aqui */}

        <div className="flex justify-end gap-3 pb-4">
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

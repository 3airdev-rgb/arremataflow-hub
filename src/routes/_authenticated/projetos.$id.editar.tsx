import { createFileRoute, useNavigate, useParams } from "@tanstack/react-router";
import { useState, useMemo, useEffect } from "react";
import { House, Handshake, BriefcaseBusiness, Users, Save, UserPlus, Search, Trash2, CalendarIcon, CheckCircle2, UserCheck, Plus } from "lucide-react";
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
import { formatBRL } from "@/lib/mock-data";
import { supabase } from "@/integrations/supabase/client";
import { InvestorRegistrationModal, type UnifiedEntityData } from "@/components/investor-registration-modal";
import { Calendar } from "@/components/ui/calendar";
import { ImageManagementSection, type ProjetoFoto } from "@/components/image-management-section";
import { CurrencyInput } from "@/components/ui/currency-input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

export const Route = createFileRoute("/_authenticated/projetos/$id/editar")({
  component: EditarProjeto,
});

function EditarProjeto() {
  const { id } = useParams({ from: "/_authenticated/projetos/$id/editar" });
  const navigate = useNavigate();
  
  const [loading, setLoading] = useState(true);
  const [projeto, setProjeto] = useState<any>(null);
  const [salvando, setSalvando] = useState(false);
  const [status, setStatus] = useState<string>("nao_iniciado");
  
  const [fotosUpload, setFotosUpload] = useState<ProjetoFoto[]>([]);
  const [participantes, setParticipantes] = useState<{ nome: string; papel: string; percentual: string }[]>([]);
  const [assessoresVinculados, setAssessoresVinculados] = useState<{ nome: string; papel: string; percentual: string }[]>([]);
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
  const [usuarios, setUsuarios] = useState<any[]>([]);
  const [isInvestorModalOpen, setIsInvestorModalOpen] = useState(false);
  const [isResponsibleModalOpen, setIsResponsibleModalOpen] = useState(false);
  const [isLeiloeiroModalOpen, setIsLeiloeiroModalOpen] = useState(false);

  useEffect(() => {
    async function init() {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return;

      const [pRes, uRes] = await Promise.all([
        supabase.from("projetos").select("*").eq("id", id).single(),
        supabase.from("pessoas").select("*")
      ]);

      if (pRes.data) {
        const d = pRes.data;
        setProjeto(d);
        setModalidade(d.modalidade || "");
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

        const [partRes, manRes, photoRes] = await Promise.all([
          supabase.from("projeto_participantes").select("*").eq("projeto_id", id),
          supabase.from("project_managers").select("assessor_id, pessoas(nome)").eq("project_id", id),
          supabase.from("projeto_fotos").select("*").eq("projeto_id", id).order("display_order")
        ]);

        if (partRes.data) {
          setParticipantes(partRes.data.filter(p => p.papel === "Investidor").map(p => ({ nome: p.nome, papel: "Investidor", percentual: p.percentual.toString() })));
          setAssessoresVinculados(partRes.data.filter(p => p.papel === "Assessor").map(p => ({ nome: p.nome, papel: "Assessor", percentual: p.percentual.toString() })));
        }
        if (manRes.data) setResponsaveisVinculados(manRes.data.map(m => ({ id: m.assessor_id, nome: (m.pessoas as any)?.nome || "Assessor" })));
        if (photoRes.data) {
          setFotosUpload(photoRes.data.map(f => ({
            id: f.id,
            url: `${import.meta.env["VITE_SUPABASE_URL"]}/storage/v1/object/public/projetos/${f.file_path}`,
            file_path: f.file_path,
            file_name: f.file_name,
            display_order: f.display_order,
            is_main: f.is_main
          })));
        }
      }
      if (uRes.data) setUsuarios(uRes.data);
      setLoading(false);
    }
    init();
  }, [id]);

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
    const { data: userData } = await supabase.auth.getUser();
    const userId = userData.user?.id;
    if (!userId) return;

    // Check for duplicate document
    if (data.documento) {
      const { data: existing } = await supabase
        .from("pessoas")
        .select("id")
        .eq("documento", data.documento)
        .maybeSingle();
      
      if (existing) {
        toast.error("Investidor já Cadastrado", {
          description: "Um registro com este CPF ou CNPJ já existe na base de dados."
        });
        return;
      }
    }

    const { data: newPessoa, error } = await supabase.from("pessoas").insert({
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
    }).select("*").single();

    if (error) {
      toast.error(`Não foi possível salvar ${tipo.toLowerCase()}: ${error.message}`);
    } else {
      toast.success(`${tipo} cadastrado com sucesso!`);
      setUsuarios(prev => [...prev, newPessoa]);
    }
  }

  if (loading || !projeto) return <div className="p-8">Carregando...</div>;

  return (
    <AppLayout title="Editar Projeto" subtitle={projeto?.nome || "Projeto"}>
      <form className="grid gap-6" onSubmit={async (e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          setSalvando(true);
          try {
            const { data: u } = await supabase.auth.getUser();
            if (!u.user) throw new Error("Sessão expirada.");

            let leiloeiroId = leiloeiroVinculado?.id || null;
            if (leiloeiroVinculado && leiloeiroVinculado.id.includes("temp-")) {
                const { data: p } = await supabase.from("pessoas").insert({ user_id: u.user!.id, tipo: "Leiloeiro", nome: leiloeiroVinculado.nome }).select("id").single();
                if (p) leiloeiroId = p.id;
            }
            const parcelado = formaPagamento === "parcelado" || formaPagamento === "financiado";
            
            const { error: projetoError } = await supabase.from("projetos").update({
              nome: fd.get("end") as string,
              status: status,
              endereco: fd.get("end") as string,
              cidade: fd.get("cidade") as string,
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
              foto_principal: fotosUpload.find(f => f.is_main)?.url || null,
              origem: origem || null,
              valor_aquisicao: valorAquisicao,
              data_aquisicao: dataAquisicao ? format(dataAquisicao, "yyyy-MM-dd") : null,
              forma_pagamento: formaPagamento || null,
              leiloeiro_id: leiloeiroId || null,
              leiloeiro_nome: leiloeiroVinculado?.nome ?? null,
              percentual_comissao: percentualComissao,
              valor_comissao: comissaoCalculada,
              credor: parcelado ? fd.get("credor") as string : null,
              valor_parcelado: parcelado ? valorFinanciado : 0,
              quantidade_parcelas: parcelado ? quantidadeParcelas : 1,
              valor_parcela: parcelado ? valorParcelaCalculado : 0,
              modalidade: modalidade || null,
              percentual_honorarios: modalidade === "nenhuma" ? 0 : percentualHonorarios,
              tem_minimo: temMinimo === "sim",
              valor_minimo: valorMinimo,
              valor_honorarios: modalidade === "nenhuma" ? 0 : honorarioCalculado,
            }).eq("id", id);
            
            if (projetoError) throw projetoError;

            // Sync participants
            await supabase.from("projeto_participantes").delete().eq("projeto_id", id);
            const vinculos = [
              ...participantes.map(p => ({ projeto_id: id, nome: p.nome, papel: "Investidor", percentual: parseFloat(p.percentual) || 0 })),
              ...assessoresVinculados.map(a => ({ projeto_id: id, nome: a.nome, papel: "Assessor", percentual: parseFloat(a.percentual) || 0 }))
            ];
            const filteredVinculos = vinculos.filter(v => v.nome && !v.nome.includes("temp-"));
            if (filteredVinculos.length > 0) await supabase.from("projeto_participantes").insert(filteredVinculos);

            // Sync managers
            await supabase.from("project_managers").delete().eq("project_id", id);
            if (responsaveisVinculados.length > 0) {
              const managersToInsert = await Promise.all(responsaveisVinculados.map(async r => {
                let assessorId = r.id;
                if (r.id.includes("temp-")) {
                  const { data: p } = await supabase.from("pessoas").insert({ user_id: u.user!.id, tipo: "Assessor", nome: r.nome }).select("id").single();
                  if (p) assessorId = p.id;
                }
                return { project_id: id, assessor_id: assessorId, user_id: u.user!.id };
              }));
              await supabase.from("project_managers").insert(managersToInsert);
            }

            // Sync photos metadata
            await supabase.from("projeto_fotos").delete().eq("projeto_id", id);
            if (fotosUpload.length > 0) {
              await supabase.from("projeto_fotos").insert(fotosUpload.map((f, idx) => ({
                projeto_id: id,
                file_path: f.file_path,
                file_name: f.file_name,
                display_order: idx,
                is_main: f.is_main,
                user_id: u.user!.id
              })));
            }

            toast.success("Projeto atualizado!");
            navigate({ to: `/projetos/${id}` });
          } catch (err: any) { toast.error(err.message); } finally { setSalvando(false); }
        }}>
        <SectionCard icon={House} title="Imóvel" description="Dados cadastrais e localização">
          <div className="mb-6">
            <ImageManagementSection 
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
              <Input 
                placeholder="R$ 0,00" 
                defaultValue={valorAquisicao}
                onChange={(e) => setValorAquisicao(parseFloat(e.target.value.replace(/[^0-9]/g, "")) || 0)}
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
                    {dataAquisicao ? format(dataAquisicao, "dd/MM/yyyy") : <span>Selecione uma data</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
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
                    <Input defaultValue={valorFinanciado} onChange={(e) => setValorFinanciado(parseFloat(e.target.value.replace(/[^0-9]/g, "")) || 0)} />
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
              <Label>Modalidade</Label>
              <Select value={modalidade} onValueChange={setModalidade}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="completa">Assessoria Completa</SelectItem>
                  <SelectItem value="parcial">Assessoria Parcial</SelectItem>
                  <SelectItem value="juridica">Assessoria Jurídica</SelectItem>
                  <SelectItem value="nenhuma">Sem Assessoria</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {modalidade !== "nenhuma" && modalidade !== "completa" && (
              <div className="space-y-2">
                <Label>Percentual de Honorários (%)</Label>
                <Input type="number" value={percentualHonorarios} onChange={(e) => setPercentualHonorarios(parseFloat(e.target.value) || 0)} />
              </div>
            )}
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

        <InvestorRegistrationModal
          open={isInvestorModalOpen}
          onOpenChange={setIsInvestorModalOpen}
          onSave={async (data) => {
            setParticipantes((prev) => [...prev, { nome: data.nome, papel: "Investidor", percentual: "" }]);
            await salvarPessoa(data, "Investidor");
          }}
          type="Investidor"
        />
        <InvestorRegistrationModal
          open={isResponsibleModalOpen}
          onOpenChange={setIsResponsibleModalOpen}
          onSave={async (data) => {
            const tempId = `temp-${Math.random()}`;
            setResponsaveisVinculados((prev) => [...prev, { id: tempId, nome: data.nome }]);
            await salvarPessoa(data, "Assessor");
          }}
          type="Assessor"
        />
        <InvestorRegistrationModal
          open={isLeiloeiroModalOpen}
          onOpenChange={setIsLeiloeiroModalOpen}
          onSave={async (data) => {
            const tempId = `temp-${Math.random()}`;
            setLeiloeiroVinculado({ id: tempId, nome: data.nome });
            await salvarPessoa(data, "Leiloeiro");
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

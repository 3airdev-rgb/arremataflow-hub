import { useNavigate } from "@tanstack/react-router";
import { useState, useEffect, useMemo } from "react";
import { Plus, Trash2, FileText, CalendarIcon, Info, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CurrencyInput } from "@/components/ui/currency-input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { formatBRL, despesas } from "@/lib/mock-data";

type JudicialAction = {
  id?: string;
  tipo_acao: string;
  vara: string;
  ultima_movimentacao: string | null;
};

export function RegularizacaoTab({ projetoId }: { projetoId: string }) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [salvando, setSalvando] = useState(false);
  
  // Project data state
  const [formData, setFormData] = useState({
    carta_arrematacao_status: "",
    averbacao_status: "",
    protocolo_cartorio: "",
    iptu_status: "",
    iptu_responsabilidade: "",
    iptu_valor: 0,
    transferencia_cadastral_status: "",
    itbi_valor: 0,
    tem_condominio: false,
    condominio_debitos_anteriores: 0,
    condominio_debitos_status: "",
    condominio_responsabilidade: "",
    condominio_taxa_mensal: 0,
  });

  const [acoesJudiciais, setAcoesJudiciais] = useState<JudicialAction[]>([]);

  // Load data
  useEffect(() => {
    async function loadData() {
      // Don't attempt to load from Supabase if the ID is not a valid UUID (e.g. mock IDs like "1", "2", "3")
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(projetoId);
      
      if (!isUuid) {
        setLoading(false);
        return;
      }

      try {
        const { data: projData, error: projError } = await supabase
          .from("projetos")
          .select("*")
          .eq("id", projetoId)
          .single();

        if (projError) throw projError;

        if (projData) {
          setFormData({
            carta_arrematacao_status: (projData as any).carta_arrematacao_status || "",
            averbacao_status: (projData as any).averbacao_status || "",
            protocolo_cartorio: (projData as any).protocolo_cartorio || "",
            iptu_status: (projData as any).iptu_status || "",
            iptu_responsabilidade: (projData as any).iptu_responsabilidade || "",
            iptu_valor: Number((projData as any).iptu_valor) || 0,
            transferencia_cadastral_status: (projData as any).transferencia_cadastral_status || "",
            itbi_valor: Number((projData as any).itbi_valor) || 0,
            tem_condominio: (projData as any).tem_condominio || false,
            condominio_debitos_anteriores: Number((projData as any).condominio_debitos_anteriores) || 0,
            condominio_debitos_status: (projData as any).condominio_debitos_status || "",
            condominio_responsabilidade: (projData as any).condominio_responsabilidade || "",
            condominio_taxa_mensal: Number((projData as any).condominio_taxa_mensal) || 0,
          });
        }

        const { data: acoesData } = await supabase
          .from("judicial_actions")
          .select("*")
          .eq("projeto_id", projetoId);

        if (acoesData) {
          setAcoesJudiciais(acoesData as any[]);
        }
      } catch (err: any) {
        toast.error("Erro ao carregar dados: " + err.message);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [projetoId]);

  // Auto-calculated Cartório Costs (from mock despesas for now as instructed, but could be DB if integrated)
  const custosCartorio = useMemo(() => {
    return despesas
      .filter((d) => d.categoria === "Cartório")
      .reduce((acc, curr) => acc + curr.valor, 0);
  }, []);

  const handleSave = async () => {
    setSalvando(true);
    try {
      // Check if project is mock
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(projetoId);
      
      if (!isUuid) {
        toast.info("A persistência no banco de dados não está disponível para projetos de demonstração.");
        setSalvando(false);
        return;
      }

      // Update projects table
      const { error: projError } = await supabase
        .from("projetos")
        .update({
          carta_arrematacao_status: formData.carta_arrematacao_status,
          averbacao_status: formData.averbacao_status,
          protocolo_cartorio: formData.protocolo_cartorio,
          iptu_status: formData.iptu_status,
          iptu_responsabilidade: formData.iptu_responsabilidade,
          iptu_valor: formData.iptu_valor,
          transferencia_cadastral_status: formData.transferencia_cadastral_status,
          itbi_valor: formData.itbi_valor,
          tem_condominio: formData.tem_condominio,
          condominio_debitos_anteriores: formData.condominio_debitos_anteriores,
          condominio_debitos_status: formData.condominio_debitos_status,
          condominio_responsabilidade: formData.condominio_responsabilidade,
          condominio_taxa_mensal: formData.condominio_taxa_mensal,
        } as any)
        .eq("id", projetoId);

      if (projError) throw projError;

      // Sync judicial actions
      // Simple approach: delete all and re-insert for this turn (or handle diff)
      await supabase.from("judicial_actions").delete().eq("projeto_id", projetoId);
      
      if (acoesJudiciais.length > 0) {
        const { error: acoesError } = await supabase
          .from("judicial_actions")
          .insert(
            acoesJudiciais.map(acao => ({
              projeto_id: projetoId,
              tipo_acao: acao.tipo_acao,
              vara: acao.vara,
              ultima_movimentacao: acao.ultima_movimentacao,
            }))
          );
        if (acoesError) throw acoesError;
      }

      toast.success("Alterações salvas com sucesso.");
    } catch (err: any) {
      toast.error("Erro ao salvar: " + err.message);
    } finally {
      setSalvando(false);
    }
  };

  const addAcao = () => {
    setAcoesJudiciais([...acoesJudiciais, { tipo_acao: "", vara: "", ultima_movimentacao: null }]);
  };

  const removeAcao = (index: number) => {
    setAcoesJudiciais(acoesJudiciais.filter((_, i) => i !== index));
  };

  const updateAcao = (index: number, field: keyof JudicialAction, value: any) => {
    const newAcoes = [...acoesJudiciais];
    const updatedAcao = { ...newAcoes[index], [field]: value };
    newAcoes[index] = updatedAcao as JudicialAction;
    setAcoesJudiciais(newAcoes);
  };

  const navigateToDocuments = (category: string, type?: string) => {
    const params = new URLSearchParams();
    params.set("categoria", category);
    if (type) params.set("tipo", type);
    navigate({ to: `/projetos/${projetoId}/documentos`, search: Object.fromEntries(params.entries()) });
  };

  if (loading) return <div className="p-8 text-center">Carregando dados da regularização...</div>;

  return (
    <div className="space-y-6 mt-5">
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Cartório Section */}
        <div className="surface-card p-5 space-y-4">
          <h3 className="text-base font-semibold border-b pb-2">Cartório</h3>
          <div className="grid gap-4">
            <div className="space-y-2">
              <Label>Carta de Arrematação</Label>
              <Select 
                value={formData.carta_arrematacao_status} 
                onValueChange={(v) => setFormData(prev => ({ ...prev, carta_arrematacao_status: v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Não emitida">Não emitida</SelectItem>
                  <SelectItem value="Em andamento">Em andamento</SelectItem>
                  <SelectItem value="Emitida">Emitida</SelectItem>
                  <SelectItem value="Registrada">Registrada</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Averbação</Label>
              <Select 
                value={formData.averbacao_status} 
                onValueChange={(v) => setFormData(prev => ({ ...prev, averbacao_status: v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Iniciada">Iniciada</SelectItem>
                  <SelectItem value="Em andamento">Em andamento</SelectItem>
                  <SelectItem value="Com pendências">Com pendências</SelectItem>
                  <SelectItem value="Finalizada">Finalizada</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Protocolo</Label>
              <Input 
                value={formData.protocolo_cartorio} 
                onChange={(e) => setFormData(prev => ({ ...prev, protocolo_cartorio: e.target.value }))}
                placeholder="Nº do protocolo"
              />
            </div>
            <div className="pt-2 border-t flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="text-muted-foreground">Custos de Cartório</Label>
                <div className="flex items-center gap-2">
                  <span className="text-lg font-semibold">{formatBRL(custosCartorio)}</span>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-8 w-8 text-brand"
                          onClick={() => navigateToDocuments("Cartório", "Financeiro")}
                        >
                          <FileText className="size-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Comprovantes</TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Prefeitura Section */}
        <div className="surface-card p-5 space-y-4">
          <h3 className="text-base font-semibold border-b pb-2">Prefeitura</h3>
          <div className="grid gap-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>IPTU</Label>
                <Select 
                  value={formData.iptu_status} 
                  onValueChange={(v) => setFormData(prev => ({ ...prev, iptu_status: v }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Em aberto">Em aberto</SelectItem>
                    <SelectItem value="Quitado">Quitado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Responsabilidade</Label>
                <Select 
                  value={formData.iptu_responsabilidade} 
                  onValueChange={(v) => setFormData(prev => ({ ...prev, iptu_responsabilidade: v }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Responsável" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Arrematante">Arrematante</SelectItem>
                    <SelectItem value="Comprador">Comprador</SelectItem>
                    <SelectItem value="Proprietário">Proprietário</SelectItem>
                    <SelectItem value="Vendedor">Vendedor</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Valor do IPTU</Label>
              <CurrencyInput 
                value={formData.iptu_valor} 
                onValueChange={(val) => setFormData(prev => ({ ...prev, iptu_valor: val }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Transferência Cadastral</Label>
              <Select 
                value={formData.transferencia_cadastral_status} 
                onValueChange={(v) => setFormData(prev => ({ ...prev, transferencia_cadastral_status: v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Iniciada">Iniciada</SelectItem>
                  <SelectItem value="Em andamento">Em andamento</SelectItem>
                  <SelectItem value="Com pendências">Com pendências</SelectItem>
                  <SelectItem value="Finalizada">Finalizada</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Valor do ITBI</Label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Input 
                    className="text-right"
                    value={new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(formData.itbi_valor)} 
                    onChange={(e) => {
                      const val = e.target.value.replace(/\D/g, "");
                      setFormData(prev => ({ ...prev, itbi_valor: Number(val) / 100 }));
                    }}
                  />
                </div>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button 
                        variant="outline" 
                        size="icon" 
                        className="shrink-0 text-brand"
                        onClick={() => navigateToDocuments("Prefeitura")}
                      >
                        <FileText className="size-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Comprovantes</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
            </div>
          </div>
        </div>

        {/* Condomínio Section */}
        <div className="surface-card p-5 space-y-4">
          <div className="flex items-center justify-between border-b pb-2">
            <h3 className="text-base font-semibold">Condomínio</h3>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">{formData.tem_condominio ? "Sim" : "Não"}</span>
              <Switch 
                checked={formData.tem_condominio} 
                onCheckedChange={(checked) => setFormData(prev => ({ ...prev, tem_condominio: checked }))}
              />
            </div>
          </div>
          
          {formData.tem_condominio ? (
            <div className="grid gap-4 animate-in fade-in slide-in-from-top-2 duration-300">
              <div className="space-y-2">
                <Label>Débitos Anteriores</Label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Input 
                      className="text-right"
                      value={new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(formData.condominio_debitos_anteriores)} 
                      onChange={(e) => {
                        const val = e.target.value.replace(/\D/g, "");
                        setFormData(prev => ({ ...prev, condominio_debitos_anteriores: Number(val) / 100 }));
                      }}
                    />
                  </div>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button 
                          variant="outline" 
                          size="icon" 
                          className="shrink-0 text-brand"
                          onClick={() => navigateToDocuments("Condomínio")}
                        >
                          <FileText className="size-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Comprovantes</TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Status dos Débitos</Label>
                  <Select 
                    value={formData.condominio_debitos_status} 
                    onValueChange={(v) => setFormData(prev => ({ ...prev, condominio_debitos_status: v }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Em aberto">Em aberto</SelectItem>
                      <SelectItem value="Quitado">Quitado</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Responsabilidade</Label>
                  <Select 
                    value={formData.condominio_responsabilidade} 
                    onValueChange={(v) => setFormData(prev => ({ ...prev, condominio_responsabilidade: v }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Responsável" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Arrematante">Arrematante</SelectItem>
                      <SelectItem value="Comprador">Comprador</SelectItem>
                      <SelectItem value="Proprietário">Proprietário</SelectItem>
                      <SelectItem value="Vendedor">Vendedor</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Taxa Mensal</Label>
                <div className="relative">
                  <Input 
                    className="text-right"
                    value={new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(formData.condominio_taxa_mensal)} 
                    onChange={(e) => {
                      const val = e.target.value.replace(/\D/g, "");
                      setFormData(prev => ({ ...prev, condominio_taxa_mensal: Number(val) / 100 }));
                    }}
                  />
                </div>
              </div>
            </div>
          ) : (
            <div className="py-8 text-center text-sm text-muted-foreground italic">
              Não se aplica condomínio para este imóvel.
            </div>
          )}
        </div>

        {/* Jurídico Section */}
        <div className="surface-card p-5 space-y-4">
          <div className="flex items-center justify-between border-b pb-2">
            <h3 className="text-base font-semibold">Jurídico</h3>
            <Button variant="outline" size="sm" onClick={addAcao} className="h-8 gap-1">
              <Plus className="size-4" /> Adicionar Ação
            </Button>
          </div>

          <div className="space-y-6 max-h-[400px] overflow-y-auto pr-2">
            {acoesJudiciais.length === 0 ? (
              <div className="py-8 text-center text-sm text-muted-foreground italic">
                Nenhuma ação judicial cadastrada.
              </div>
            ) : (
              acoesJudiciais.map((acao, index) => (
                <div key={index} className="relative grid gap-4 p-4 rounded-lg border bg-muted/30">
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="absolute top-2 right-2 h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10"
                    onClick={() => removeAcao(index)}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                  
                  <div className="space-y-2">
                    <Label>Ação</Label>
                    <Select 
                      value={acao.tipo_acao} 
                      onValueChange={(v) => updateAcao(index, "tipo_acao", v)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Tipo de ação" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Ação de Despejo">Ação de Despejo</SelectItem>
                        <SelectItem value="Ação de Reintegração de Posse">Ação de Reintegração de Posse</SelectItem>
                        <SelectItem value="Ação Anulatória de Leilão / Arrematação">Ação Anulatória de Leilão / Arrematação</SelectItem>
                        <SelectItem value="Ação Rescisória">Ação Rescisória</SelectItem>
                        <SelectItem value="Ação Pauliana">Ação Pauliana</SelectItem>
                        <SelectItem value="Embargos de Terceiro">Embargos de Terceiro</SelectItem>
                        <SelectItem value="Embargos à Arrematação">Embargos à Arrematação</SelectItem>
                        <SelectItem value="Ação de Cobrança">Ação de Cobrança</SelectItem>
                        <SelectItem value="Ação de Consignação em Pagamento">Ação de Consignação em Pagamento</SelectItem>
                        <SelectItem value="Ação de Extinção de Condomínio">Ação de Extinção de Condomínio</SelectItem>
                        <SelectItem value="Procedimento de Dúvida Registral">Procedimento de Dúvida Registral</SelectItem>
                        <SelectItem value="Ação de Retificação de Registro Imobiliário">Ação de Retificação de Registro Imobiliário</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Vara</Label>
                      <Input 
                        placeholder="Ex: 3ª Vara Cível" 
                        value={acao.vara} 
                        onChange={(e) => updateAcao(index, "vara", e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Última Movimentação</Label>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant={"outline"}
                            className={cn(
                              "w-full justify-start text-left font-normal h-9",
                              !acao.ultima_movimentacao && "text-muted-foreground"
                            )}
                          >
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {acao.ultima_movimentacao ? format(parseISO(acao.ultima_movimentacao), "dd/MM/yyyy", { locale: ptBR }) : "Selecionar data"}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={acao.ultima_movimentacao ? parseISO(acao.ultima_movimentacao) : undefined}
                            onSelect={(date) => updateAcao(index, "ultima_movimentacao", date ? date.toISOString() : null)}
                          />
                        </PopoverContent>
                      </Popover>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Save Button */}
      <div className="flex justify-center pt-4">
        <Button 
          size="lg" 
          className="px-12 bg-brand hover:bg-brand/90"
          onClick={handleSave}
          disabled={salvando}
        >
          {salvando ? "Salvando..." : (
            <>
              <Save className="mr-2 size-4" /> Salvar Alterações
            </>
          )}
        </Button>
      </div>
    </div>
  );
}

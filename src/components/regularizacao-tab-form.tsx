import { useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { Plus, Trash2, FileText, CalendarIcon, Info, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CurrencyInput } from "@/components/ui/currency-input";
import { DatePickerField } from "@/components/ui/date-picker-field";
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
import { formatBRLWithCents } from "@/lib/format-currency";
import { listFinancialMovements } from "@/lib/financial";
import { getProjectOperations, saveRegularization } from "@/lib/project-operations";

type JudicialAction = { id?: string; tipo_acao: string; numero_processo: string; vara: string; ultima_movimentacao: string | null };
type FinancialMovement = { id: string; tipo: string; categoria: string; descricao: string; valor: number; data: string };

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
    condominio_vencimento: "",
    condominio_taxa_mensal: 0,
  });

  const [acoesJudiciais, setAcoesJudiciais] = useState<JudicialAction[]>([]);
  const [financialMovements, setFinancialMovements] = useState<FinancialMovement[]>([]);

  // Load data
  useEffect(() => {
    async function loadData() {
      try {
        const [operations, movements] = await Promise.all([
          getProjectOperations({ data: { projectId: projetoId } }),
          listFinancialMovements({ data: { projectId: projetoId } }),
        ]);
        setFormData((previous) => ({ ...previous, ...(operations.regularization as Partial<typeof previous>) }));
        setAcoesJudiciais(operations.regularizationActions);
        setFinancialMovements(movements);
      } catch (err: any) {
        toast.error("Erro ao carregar dados: " + err.message);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [projetoId]);

  const custosCartorio = financialMovements
    .filter((movement) => movement.tipo === "despesa" && movement.categoria === "Cartório")
    .reduce((total, movement) => total + movement.valor, 0);
  const custosItbi = financialMovements
    .filter((movement) => movement.tipo === "despesa"
      && movement.categoria === "Prefeitura"
      && movement.descricao.trim().toLocaleLowerCase("pt-BR").includes("itbi"))
    .reduce((total, movement) => total + movement.valor, 0);
  const custosIptu = financialMovements
    .filter((movement) => movement.tipo === "despesa"
      && movement.categoria === "Prefeitura"
      && movement.descricao.trim().toLocaleLowerCase("pt-BR").includes("iptu"))
    .reduce((total, movement) => total + movement.valor, 0);
  const permiteLancamentoIptu = ["Arrematante", "Comprador", "Proprietário"]
    .includes(formData.iptu_responsabilidade);
  const iptuEditavel = formData.iptu_responsabilidade === "Vendedor";
  const pagamentosCondominio = financialMovements
    .filter((movement) => movement.tipo === "despesa"
      && movement.categoria === "Condomínio"
      && movement.descricao.trim().toLocaleLowerCase("pt-BR")
        .includes("pagamento de taxa de condomínio"));

  const handleSave = async () => {
    setSalvando(true);
    try {
      await saveRegularization({ data: { projectId: projetoId, formData, actions: acoesJudiciais } });
      toast.success("Alterações salvas com sucesso.");
    } catch (err: any) {
      toast.error("Erro ao salvar: " + err.message);
    } finally {
      setSalvando(false);
    }
  };

  const addAcao = () => {
    setAcoesJudiciais([
      ...acoesJudiciais,
      { tipo_acao: "", numero_processo: "", vara: "", ultima_movimentacao: null },
    ]);
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

  const navigateToFinancial = (category: string, description?: string) => {
    navigate({
      to: "/projetos/$id",
      params: { id: projetoId },
      search: {
        aba: "financeiro",
        categoria: category,
        novaMovimentacao: "1",
        ...(description ? { descricao: description } : {}),
      },
    });
  };

  const navigateToDocuments = (category: string) => {
    navigate({
      to: "/projetos/$id/documentos",
      params: { id: projetoId },
      search: {
        categoria: category,
        retorno: `/projetos/${projetoId}?aba=regularizacao`,
      },
    });
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
                  <span className="text-lg font-semibold">{formatBRLWithCents(custosCartorio)}</span>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-8 w-8 text-brand"
                          onClick={() => navigateToFinancial("Cartório")}
                        >
                          <FileText className="size-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Ver despesas de Cartório</TooltipContent>
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
              <div className="flex gap-2">
                <CurrencyInput
                  className={iptuEditavel ? "flex-1" : "flex-1 cursor-not-allowed bg-muted"}
                  value={iptuEditavel ? formData.iptu_valor : custosIptu}
                  onValueChange={(value) => {
                    if (iptuEditavel) {
                      setFormData((previous) => ({ ...previous, iptu_valor: value }));
                    }
                  }}
                  readOnly={!iptuEditavel}
                />
                {permiteLancamentoIptu ? (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          className="shrink-0 text-brand"
                          aria-label="Lançar despesa de IPTU"
                          onClick={() => navigateToFinancial("Prefeitura", "IPTU")}
                        >
                          <FileText className="size-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Lançar despesa de IPTU</TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                ) : null}
              </div>
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
                <CurrencyInput 
                  className="flex-1 cursor-not-allowed bg-muted"
                  value={custosItbi}
                  onValueChange={() => undefined}
                  readOnly
                />
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button 
                        type="button"
                        variant="outline" 
                        size="icon" 
                        className="shrink-0 text-brand"
                        aria-label="Lançar despesa de ITBI"
                        onClick={() => navigateToFinancial("Prefeitura", "ITBI")}
                      >
                        <FileText className="size-4" />
                      </Button>
                    </TooltipTrigger>
                      <TooltipContent>Lançar despesa de ITBI</TooltipContent>
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
              <div className="grid grid-cols-2 gap-4">
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
                <div />
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
                  <Label>Débitos Anteriores</Label>
                  <div className="flex gap-2">
                    <CurrencyInput 
                      className="flex-1"
                      value={formData.condominio_debitos_anteriores} 
                      onValueChange={(val) => setFormData(prev => ({ ...prev, condominio_debitos_anteriores: val }))}
                    />
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button 
                            type="button"
                            variant="outline" 
                            size="icon" 
                            className="shrink-0 text-brand"
                            aria-label="Abrir comprovantes do condomínio"
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
                <div className="space-y-2">
                  <Label>Taxa Mensal</Label>
                  <CurrencyInput 
                    value={formData.condominio_taxa_mensal} 
                    onValueChange={(val) => setFormData(prev => ({ ...prev, condominio_taxa_mensal: val }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="condominio-vencimento">Vencimento</Label>
                  <div className="flex gap-2">
                    <DatePickerField
                      className="flex-1"
                      value={formData.condominio_vencimento}
                      aria-label="Vencimento"
                      onValueChange={(value) => setFormData((previous) => ({
                        ...previous,
                        condominio_vencimento: value,
                      }))}
                    />
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            className="shrink-0 text-brand"
                            aria-label="Lançar pagamento"
                            onClick={() => navigateToFinancial("Condomínio", "Pagamento de Taxa de Condomínio")}
                          >
                            <Plus className="size-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Lançar pagamento</TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                </div>
              </div>

              <div className="border-t border-brand/40 pt-3">
                <h4 className="text-center text-base font-semibold">Resumo de Pagamentos</h4>
                <div className="mt-3 grid grid-cols-2 gap-4 border-b pb-2 text-sm font-medium text-muted-foreground">
                  <span>Data de Pagamento</span>
                  <span className="text-right">Valor</span>
                </div>
                {pagamentosCondominio.length ? (
                  <div className="divide-y">
                    {pagamentosCondominio.map((movement) => (
                      <div key={movement.id} className="grid grid-cols-2 gap-4 py-2 text-sm">
                        <span>{movement.data}</span>
                        <span className="text-right font-medium">{formatBRLWithCents(movement.valor)}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="py-4 text-center text-sm text-muted-foreground">
                    Nenhum pagamento lançado.
                  </p>
                )}
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
                        <SelectItem value="Ação Anulatória de Leilão / Arrematação">Ação Anulatória de Leilão / Arrematação</SelectItem>
                        <SelectItem value="Ação de Cobrança">Ação de Cobrança</SelectItem>
                        <SelectItem value="Ação de Consignação em Pagamento">Ação de Consignação em Pagamento</SelectItem>
                        <SelectItem value="Ação de Despejo">Ação de Despejo</SelectItem>
                        <SelectItem value="Ação de Extinção de Condomínio">Ação de Extinção de Condomínio</SelectItem>
                        <SelectItem value="Ação de Imissão na Posse">Ação de Imissão na Posse</SelectItem>
                        <SelectItem value="Ação de Reintegração de Posse">Ação de Reintegração de Posse</SelectItem>
                        <SelectItem value="Ação de Retificação de Registro Imobiliário">Ação de Retificação de Registro Imobiliário</SelectItem>
                        <SelectItem value="Ação Pauliana">Ação Pauliana</SelectItem>
                        <SelectItem value="Ação Rescisória">Ação Rescisória</SelectItem>
                        <SelectItem value="Embargos à Arrematação">Embargos à Arrematação</SelectItem>
                        <SelectItem value="Embargos de Terceiro">Embargos de Terceiro</SelectItem>
                        <SelectItem value="Procedimento de Dúvida Registral">Procedimento de Dúvida Registral</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid gap-4 md:grid-cols-3">
                    <div className="space-y-2">
                      <Label>Número do Processo</Label>
                      <Input
                        placeholder="Ex: 0000000-00.0000.0.00.0000"
                        value={acao.numero_processo}
                        onChange={(e) => updateAcao(index, "numero_processo", e.target.value)}
                      />
                    </div>
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
                              "relative h-9 w-full justify-end pl-9 text-right font-normal",
                              !acao.ultima_movimentacao && "text-muted-foreground"
                            )}
                          >
                            <CalendarIcon className="absolute left-3 h-4 w-4" />
                            {acao.ultima_movimentacao ? format(parseISO(acao.ultima_movimentacao), "dd/MM/yyyy", { locale: ptBR }) : "Selecionar data"}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="end">
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

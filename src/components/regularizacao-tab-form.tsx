import { useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { Plus, Trash2, FileText, CalendarIcon, Info, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CurrencyInput } from "@/components/ui/currency-input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { showValidationAlert } from "@/lib/validation-feedback";
import { cn } from "@/lib/utils";
import { formatBRLWithCents } from "@/lib/format-currency";
import { listFinancialMovements } from "@/lib/financial";
import { getProjectOperations, saveRegularization } from "@/lib/project-operations";

type JudicialMovement = { data: string; situacao: string };
type JudicialAction = {
  id?: string;
  scope?: "regularization" | "possession";
  tipo_acao: string;
  numero_processo: string;
  vara: string;
  ultima_movimentacao: string | null;
  movimentacoes: JudicialMovement[];
};
type FinancialMovement = {
  id: string;
  tipo: string;
  categoria: string;
  descricao: string;
  valor: number;
  data: string;
};

const errorMessage = (error: unknown) =>
  error instanceof Error ? error.message : "Erro desconhecido.";

export function RegularizacaoTab({
  projetoId,
  onRequestFinancialMovement,
}: {
  projetoId: string;
  onRequestFinancialMovement?: (category: string, description: string) => void;
}) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [reloadToken, setReloadToken] = useState(0);
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
        const previousCondominiumDebt = movements
          .filter(
            (movement) =>
              movement.tipo === "despesa" &&
              movement.categoria === "Condomínio" &&
              movement.descricao.trim().toLocaleLowerCase("pt-BR").includes("anteriores"),
          )
          .reduce((total, movement) => total + movement.valor, 0);
        setFormData((previous) => ({
          ...previous,
          ...(operations.regularization as Partial<typeof previous>),
          condominio_debitos_anteriores: previousCondominiumDebt,
        }));
        setAcoesJudiciais(operations.regularizationActions);
        setFinancialMovements(movements);
      } catch (err: unknown) {
        toast.error("Erro ao carregar dados: " + errorMessage(err));
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [projetoId, reloadToken]);

  useEffect(() => {
    const refresh = (event: Event) => {
      const updatedProjectId = (event as CustomEvent<{ projectId?: string }>).detail?.projectId;
      if (!updatedProjectId || updatedProjectId === projetoId)
        setReloadToken((current) => current + 1);
    };
    window.addEventListener("project-operations-updated", refresh);
    return () => window.removeEventListener("project-operations-updated", refresh);
  }, [projetoId]);

  const custosCartorio = financialMovements
    .filter((movement) => movement.tipo === "despesa" && movement.categoria === "Cartório")
    .reduce((total, movement) => total + movement.valor, 0);
  const custosItbi = financialMovements
    .filter(
      (movement) =>
        movement.tipo === "despesa" &&
        movement.categoria === "Prefeitura" &&
        movement.descricao.trim().toLocaleLowerCase("pt-BR").includes("itbi"),
    )
    .reduce((total, movement) => total + movement.valor, 0);
  const custosIptu = financialMovements
    .filter(
      (movement) =>
        movement.tipo === "despesa" &&
        movement.categoria === "Prefeitura" &&
        movement.descricao.trim().toLocaleLowerCase("pt-BR").includes("iptu"),
    )
    .reduce((total, movement) => total + movement.valor, 0);
  const permiteLancamentoIptu = ["Arrematante", "Comprador", "Proprietário"].includes(
    formData.iptu_responsabilidade,
  );
  const iptuEditavel = formData.iptu_responsabilidade === "Vendedor";
  const pagamentosCondominio = financialMovements.filter(
    (movement) =>
      movement.tipo === "despesa" &&
      movement.categoria === "Condomínio" &&
      movement.descricao
        .trim()
        .toLocaleLowerCase("pt-BR")
        .includes("pagamento de taxa de condomínio"),
  );
  const debitosAnterioresCondominio = pagamentosCondominio
    .filter((movement) =>
      movement.descricao.trim().toLocaleLowerCase("pt-BR").includes("anteriores"),
    )
    .reduce((total, movement) => total + movement.valor, 0);

  const monthlyCondominiumDescription = () => {
    const reference = new Intl.DateTimeFormat("pt-BR", {
      month: "2-digit",
      year: "numeric",
    }).format(new Date());
    return `Pagamento de Taxa de Condomínio – Mês Ref. ${reference}`;
  };

  const handleSave = async () => {
    setSalvando(true);
    try {
      await saveRegularization({
        data: { projectId: projetoId, formData, actions: acoesJudiciais },
      });
      toast.success("Alterações salvas com sucesso.");
    } catch (err: unknown) {
      showValidationAlert(
        err,
        "Não foi possível salvar a regularização. Revise os campos informados.",
      );
    } finally {
      setSalvando(false);
    }
  };

  const addAcao = () => {
    setAcoesJudiciais([
      ...acoesJudiciais,
      {
        tipo_acao: "",
        numero_processo: "",
        vara: "",
        ultima_movimentacao: null,
        movimentacoes: [],
      },
    ]);
  };

  const removeAcao = (index: number) => {
    setAcoesJudiciais(acoesJudiciais.filter((_, i) => i !== index));
  };

  const updateAcao = (
    index: number,
    field: keyof JudicialAction,
    value: JudicialAction[keyof JudicialAction],
  ) => {
    const newAcoes = [...acoesJudiciais];
    const updatedAcao = { ...newAcoes[index], [field]: value };
    newAcoes[index] = updatedAcao as JudicialAction;
    setAcoesJudiciais(newAcoes);
  };

  const addMovimentacao = (actionIndex: number) => {
    const next = [...acoesJudiciais];
    const action = next[actionIndex];
    if (!action) return;
    next[actionIndex] = {
      ...action,
      movimentacoes: [...action.movimentacoes, { data: "", situacao: "" }],
    };
    setAcoesJudiciais(next);
  };

  const updateMovimentacao = (
    actionIndex: number,
    movementIndex: number,
    field: keyof JudicialMovement,
    value: string,
  ) => {
    const next = [...acoesJudiciais];
    const action = next[actionIndex];
    const movement = action?.movimentacoes[movementIndex];
    if (!action || !movement) return;
    const movements = [...action.movimentacoes];
    movements[movementIndex] = { ...movement, [field]: value };
    const dates = movements
      .map((movement) => movement.data)
      .filter(Boolean)
      .sort();
    next[actionIndex] = {
      ...action,
      movimentacoes: movements,
      ultima_movimentacao: dates.at(-1) || action.ultima_movimentacao,
    };
    setAcoesJudiciais(next);
  };

  const removeMovimentacao = (actionIndex: number, movementIndex: number) => {
    const next = [...acoesJudiciais];
    const action = next[actionIndex];
    if (!action) return;
    const movements = action.movimentacoes.filter((_, index) => index !== movementIndex);
    const dates = movements
      .map((movement) => movement.data)
      .filter(Boolean)
      .sort();
    next[actionIndex] = {
      ...action,
      movimentacoes: movements,
      ultima_movimentacao: dates.at(-1) || null,
    };
    setAcoesJudiciais(next);
  };

  const navigateToFinancial = (category: string, description?: string) => {
    if (onRequestFinancialMovement) {
      onRequestFinancialMovement(category, description || "");
      return;
    }
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

  if (loading) return <div className="p-8 text-center">Carregando dados da regularização...</div>;

  return (
    <div className="space-y-6 mt-5">
      <div className="grid gap-6 xl:grid-cols-2">
        {/* Cartório Section */}
        <div className="surface-card p-5 space-y-4">
          <h3 className="text-base font-semibold border-b pb-2">Cartório</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Carta de Arrematação</Label>
              <Select
                value={formData.carta_arrematacao_status}
                onValueChange={(v) =>
                  setFormData((prev) => ({ ...prev, carta_arrematacao_status: v }))
                }
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
                onValueChange={(v) => setFormData((prev) => ({ ...prev, averbacao_status: v }))}
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
              <Label>Protocolo cartório</Label>
              <Input
                value={formData.protocolo_cartorio}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, protocolo_cartorio: e.target.value }))
                }
                placeholder="Nº do protocolo"
              />
            </div>
            <div className="space-y-2">
              <div className="space-y-0.5">
                <Label className="text-muted-foreground">Custos de Cartório</Label>
                <div className="flex items-center gap-2">
                  <span className="text-lg font-semibold">
                    {formatBRLWithCents(custosCartorio)}
                  </span>
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
          <div className="grid gap-4 sm:grid-cols-6">
            <div className="space-y-2 sm:col-span-2">
              <Label>IPTU</Label>
              <Select
                value={formData.iptu_status}
                onValueChange={(v) => setFormData((prev) => ({ ...prev, iptu_status: v }))}
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
            <div className="space-y-2 sm:col-span-2">
              <Label>Responsabilidade</Label>
              <Select
                value={formData.iptu_responsabilidade}
                onValueChange={(v) =>
                  setFormData((prev) => ({ ...prev, iptu_responsabilidade: v }))
                }
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
            <div className="space-y-2 sm:col-span-2">
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
            <div className="space-y-2 sm:col-span-3">
              <Label>Transferência Prefeitura</Label>
              <Select
                value={formData.transferencia_cadastral_status}
                onValueChange={(v) =>
                  setFormData((prev) => ({ ...prev, transferencia_cadastral_status: v }))
                }
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
            <div className="space-y-2 sm:col-span-3">
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
              <span className="text-sm text-muted-foreground">
                {formData.tem_condominio ? "Sim" : "Não"}
              </span>
              <Switch
                checked={formData.tem_condominio}
                onCheckedChange={(checked) =>
                  setFormData((prev) => ({ ...prev, tem_condominio: checked }))
                }
              />
            </div>
          </div>

          {formData.tem_condominio ? (
            <div className="grid gap-4 animate-in fade-in slide-in-from-top-2 duration-300">
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Responsabilidade</Label>
                  <Select
                    value={formData.condominio_responsabilidade}
                    onValueChange={(v) =>
                      setFormData((prev) => ({ ...prev, condominio_responsabilidade: v }))
                    }
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
                    onValueChange={(v) =>
                      setFormData((prev) => ({ ...prev, condominio_debitos_status: v }))
                    }
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
                      className="flex-1 cursor-not-allowed bg-muted"
                      value={debitosAnterioresCondominio}
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
                            aria-label="Lançar pagamento de débitos anteriores do condomínio"
                            onClick={() =>
                              navigateToFinancial(
                                "Condomínio",
                                "Pagamento de Taxa de Condomínio – Anteriores",
                              )
                            }
                          >
                            <Plus className="size-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Lançar pagamento de débitos anteriores</TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Taxa Mensal</Label>
                  <CurrencyInput
                    value={formData.condominio_taxa_mensal}
                    onValueChange={(val) =>
                      setFormData((prev) => ({ ...prev, condominio_taxa_mensal: val }))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Pagamento mensal</Label>
                  <div>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            className="shrink-0 text-brand"
                            aria-label="Lançar pagamento"
                            onClick={() =>
                              navigateToFinancial("Condomínio", monthlyCondominiumDescription())
                            }
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
                <div className="mt-3 grid grid-cols-[auto_minmax(0,1fr)_auto] gap-4 border-b pb-2 text-sm font-medium text-muted-foreground">
                  <span>Data de Pagamento</span>
                  <span>Descrição</span>
                  <span className="text-right">Valor</span>
                </div>
                {pagamentosCondominio.length ? (
                  <div className="divide-y">
                    {pagamentosCondominio.map((movement) => (
                      <div
                        key={movement.id}
                        className="grid grid-cols-[auto_minmax(0,1fr)_auto] gap-4 py-2 text-sm"
                      >
                        <span>{movement.data}</span>
                        <span>{movement.descricao}</span>
                        <span className="text-right font-medium">
                          {formatBRLWithCents(movement.valor)}
                        </span>
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
                  {acao.scope !== "possession" ? (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="absolute top-2 right-2 h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10"
                      onClick={() => removeAcao(index)}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  ) : null}

                  <div className="space-y-2">
                    <Label>Ação</Label>
                    <Select
                      value={acao.tipo_acao}
                      onValueChange={(v) => updateAcao(index, "tipo_acao", v)}
                      disabled={acao.scope === "possession"}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Tipo de ação" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Ação Anulatória de Leilão / Arrematação">
                          Ação Anulatória de Leilão / Arrematação
                        </SelectItem>
                        <SelectItem value="Ação de Cobrança">Ação de Cobrança</SelectItem>
                        <SelectItem value="Ação de Consignação em Pagamento">
                          Ação de Consignação em Pagamento
                        </SelectItem>
                        <SelectItem value="Ação de Despejo">Ação de Despejo</SelectItem>
                        <SelectItem value="Ação de Extinção de Condomínio">
                          Ação de Extinção de Condomínio
                        </SelectItem>
                        <SelectItem value="Ação de Imissão na Posse">
                          Ação de Imissão na Posse
                        </SelectItem>
                        <SelectItem value="Ação de Reintegração de Posse">
                          Ação de Reintegração de Posse
                        </SelectItem>
                        <SelectItem value="Ação de Retificação de Registro Imobiliário">
                          Ação de Retificação de Registro Imobiliário
                        </SelectItem>
                        <SelectItem value="Ação Pauliana">Ação Pauliana</SelectItem>
                        <SelectItem value="Ação Rescisória">Ação Rescisória</SelectItem>
                        <SelectItem value="Embargos à Arrematação">
                          Embargos à Arrematação
                        </SelectItem>
                        <SelectItem value="Embargos de Terceiro">Embargos de Terceiro</SelectItem>
                        <SelectItem value="Procedimento de Dúvida Registral">
                          Procedimento de Dúvida Registral
                        </SelectItem>
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
                              !acao.ultima_movimentacao && "text-muted-foreground",
                            )}
                          >
                            <CalendarIcon className="absolute left-3 h-4 w-4" />
                            {acao.ultima_movimentacao
                              ? format(parseISO(acao.ultima_movimentacao), "dd/MM/yyyy", {
                                  locale: ptBR,
                                })
                              : "Selecionar data"}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="end">
                          <Calendar
                            mode="single"
                            selected={
                              acao.ultima_movimentacao
                                ? parseISO(acao.ultima_movimentacao)
                                : undefined
                            }
                            onSelect={(date) =>
                              updateAcao(
                                index,
                                "ultima_movimentacao",
                                date ? date.toISOString() : null,
                              )
                            }
                          />
                        </PopoverContent>
                      </Popover>
                    </div>
                  </div>

                  <div className="space-y-3 border-t pt-4">
                    <div className="flex items-center justify-between gap-3">
                      <Label>Histórico de movimentações</Label>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => addMovimentacao(index)}
                      >
                        <Plus className="mr-1 size-4" /> Nova movimentação
                      </Button>
                    </div>
                    {acao.movimentacoes.length ? (
                      <div className="space-y-3">
                        {acao.movimentacoes.map((movimentacao, movementIndex) => (
                          <div
                            key={movementIndex}
                            className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,2fr)_auto] sm:items-end"
                          >
                            <div className="space-y-2">
                              <Label>Data da movimentação</Label>
                              <Input
                                type="date"
                                value={movimentacao.data}
                                onChange={(event) =>
                                  updateMovimentacao(
                                    index,
                                    movementIndex,
                                    "data",
                                    event.target.value,
                                  )
                                }
                              />
                            </div>
                            <div className="space-y-2">
                              <Label>Situação</Label>
                              <Input
                                value={movimentacao.situacao}
                                onChange={(event) =>
                                  updateMovimentacao(
                                    index,
                                    movementIndex,
                                    "situacao",
                                    event.target.value,
                                  )
                                }
                                placeholder="Descreva a movimentação do processo"
                              />
                            </div>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="text-destructive"
                              aria-label="Excluir movimentação"
                              onClick={() => removeMovimentacao(index, movementIndex)}
                            >
                              <Trash2 className="size-4" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        Nenhuma movimentação registrada.
                      </p>
                    )}
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
          className="bg-brand px-12 text-brand-foreground hover:bg-brand-hover"
          onClick={handleSave}
          disabled={salvando}
        >
          {salvando ? (
            "Salvando..."
          ) : (
            <>
              <Save className="mr-2 size-4" /> Salvar Alterações
            </>
          )}
        </Button>
      </div>
    </div>
  );
}

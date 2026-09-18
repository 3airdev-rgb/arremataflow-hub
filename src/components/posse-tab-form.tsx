import { useState, useEffect } from "react";
import { Save, CalendarIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CurrencyInput } from "@/components/ui/currency-input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format, parseISO } from "date-fns";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { getProjectOperations, savePossession } from "@/lib/project-operations";

type JudicialAction = { id?: string; tipo_acao: string; numero_processo: string; vara: string; ultima_movimentacao: string | null };

// formatCurrency and parseCurrency removed in favor of CurrencyInput component

export function PosseTab({ projetoId }: { projetoId: string }) {
  const [loading, setLoading] = useState(true);
  const [salvando, setSalvando] = useState(false);
  
  const [formData, setFormData] = useState({
    occupancy_status: "",
    possession_action_required: false,
    expected_possession_date: null as string | null,
    possession_completed_date: null as string | null,
    legal_costs: 0,
    bailiff_costs: 0,
    locksmith_security_costs: 0,
    settlement_costs: 0,
  });
  const [imissaoAction, setImissaoAction] = useState<JudicialAction | null>(null);

  const emptyImissaoAction = (): JudicialAction => ({
    tipo_acao: "Ação de Imissão na Posse",
    numero_processo: "",
    vara: "",
    ultima_movimentacao: null,
  });

  useEffect(() => {
    async function loadData() {
      try {
        const operations = await getProjectOperations({ data: { projectId: projetoId } });
        setFormData((previous) => ({ ...previous, ...(operations.possession as Partial<typeof previous>) }));
        setImissaoAction(operations.possessionAction);
      } catch (err: any) {
        toast.error("Erro ao carregar dados da posse: " + err.message);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [projetoId]);

  const handleSave = async () => {
    setSalvando(true);
    try {
      await savePossession({ data: { projectId: projetoId, formData, action: imissaoAction } });
      toast.success("Alterações salvas com sucesso.");
    } catch (err: any) {
      toast.error("Erro ao salvar: " + err.message);
    } finally {
      setSalvando(false);
    }
  };

  if (loading) return <div className="p-8 text-center">Carregando dados da posse...</div>;

  return (
    <div className="space-y-6 mt-5">
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Situação da Posse Section */}
        <div className="surface-card p-5 space-y-4">
          <h3 className="text-base font-semibold border-b pb-2">Situação da Posse</h3>
          <div className="grid gap-4">
            <div className="space-y-2">
              <Label>Ocupação</Label>
              <Select 
                value={formData.occupancy_status} 
                onValueChange={(v) => setFormData(prev => ({ ...prev, occupancy_status: v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a ocupação" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Desocupada">Desocupada</SelectItem>
                  <SelectItem value="Ocupada pelo ex-proprietário">Ocupada pelo ex-proprietário</SelectItem>
                  <SelectItem value="Ocupada por terceiros">Ocupada por terceiros</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label>Ação de Imissão</Label>
              <Select 
                value={formData.possession_action_required ? "Sim" : "Não"} 
                onValueChange={(v) => {
                  const required = v === "Sim";
                  setFormData(prev => ({ ...prev, possession_action_required: required }));
                  if (required && !imissaoAction) setImissaoAction(emptyImissaoAction());
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Necessário ação?" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Sim">Sim</SelectItem>
                  <SelectItem value="Não">Não</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {formData.possession_action_required && imissaoAction && (
              <div className="rounded-lg border bg-muted/20 p-4 space-y-4">
                <div>
                  <h4 className="font-medium">Ação de Imissão na Posse</h4>
                  <p className="text-sm text-muted-foreground">
                    {imissaoAction.id ? "Ação cadastrada no Jurídico." : "Preencha os dados para cadastrar a ação."}
                  </p>
                </div>
                <div className="grid gap-4">
                  <div className="space-y-2">
                    <Label>Número do Processo</Label>
                    <Input
                      placeholder="Ex: 0000000-00.0000.0.00.0000"
                      value={imissaoAction.numero_processo}
                      onChange={(event) => setImissaoAction(prev => prev ? ({ ...prev, numero_processo: event.target.value }) : prev)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Vara</Label>
                    <Input
                      placeholder="Ex: 3ª Vara Cível"
                      value={imissaoAction.vara}
                      onChange={(event) => setImissaoAction(prev => prev ? ({ ...prev, vara: event.target.value }) : prev)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Última Movimentação</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className={cn("relative w-full justify-end pl-9 text-right font-normal", !imissaoAction.ultima_movimentacao && "text-muted-foreground")}
                        >
                          <CalendarIcon className="absolute left-3 h-4 w-4" />
                          {imissaoAction.ultima_movimentacao
                            ? format(parseISO(imissaoAction.ultima_movimentacao), "dd/MM/yyyy")
                            : "Selecionar data"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="end">
                        <Calendar
                          mode="single"
                          selected={imissaoAction.ultima_movimentacao ? parseISO(imissaoAction.ultima_movimentacao) : undefined}
                          onSelect={(date) => setImissaoAction(prev => prev ? ({ ...prev, ultima_movimentacao: date ? format(date, "yyyy-MM-dd") : null }) : prev)}
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label>Data prevista da posse</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant={"outline"}
                    className={cn(
                      "relative w-full justify-end pl-9 text-right font-normal",
                      !formData.expected_possession_date && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="absolute left-3 h-4 w-4" />
                    {formData.expected_possession_date ? (
                      format(parseISO(formData.expected_possession_date), "dd/MM/yyyy")
                    ) : (
                      <span>Selecione a data</span>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="end">
                  <Calendar
                    mode="single"
                    selected={formData.expected_possession_date ? parseISO(formData.expected_possession_date) : undefined}
                    onSelect={(date) => 
                      setFormData(prev => ({ 
                        ...prev, 
                        expected_possession_date: date ? format(date, "yyyy-MM-dd") : null 
                      }))
                    }
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2">
              <Label>Data da posse realizada</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant={"outline"}
                    className={cn(
                      "relative w-full justify-end pl-9 text-right font-normal",
                      !formData.possession_completed_date && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="absolute left-3 h-4 w-4" />
                    {formData.possession_completed_date ? (
                      format(parseISO(formData.possession_completed_date), "dd/MM/yyyy")
                    ) : (
                      <span>Selecione a data</span>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="end">
                  <Calendar
                    mode="single"
                    selected={formData.possession_completed_date ? parseISO(formData.possession_completed_date) : undefined}
                    onSelect={(date) => 
                      setFormData(prev => ({ 
                        ...prev, 
                        possession_completed_date: date ? format(date, "yyyy-MM-dd") : null 
                      }))
                    }
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>
        </div>

        {/* Custos da Posse Section */}
        <div className="surface-card p-5 space-y-4">
          <h3 className="text-base font-semibold border-b pb-2">Custos da Posse</h3>
          <div className="grid gap-4">
            <div className="space-y-2">
              <Label>Custas Processuais</Label>
              <CurrencyInput 
                value={formData.legal_costs} 
                onValueChange={(val) => setFormData(prev => ({ ...prev, legal_costs: val }))}
              />
            </div>
            
            <div className="space-y-2">
              <Label>Oficial de Justiça</Label>
              <CurrencyInput 
                value={formData.bailiff_costs} 
                onValueChange={(val) => setFormData(prev => ({ ...prev, bailiff_costs: val }))}
              />
            </div>

            <div className="space-y-2">
              <Label>Chaveiro e Segurança</Label>
              <CurrencyInput 
                value={formData.locksmith_security_costs} 
                onValueChange={(val) => setFormData(prev => ({ ...prev, locksmith_security_costs: val }))}
              />
            </div>

            <div className="space-y-2">
              <Label>Indenização / Acordo</Label>
              <CurrencyInput 
                value={formData.settlement_costs} 
                onValueChange={(val) => setFormData(prev => ({ ...prev, settlement_costs: val }))}
              />
            </div>
          </div>
        </div>
      </div>

      <div className="flex justify-center pt-4">
        <Button 
          onClick={handleSave} 
          disabled={salvando}
          className="bg-brand hover:bg-brand/90 text-white px-12 h-11"
        >
          {salvando ? "Salvando..." : (
            <>
              <Save className="mr-2 size-4" />
              Salvar Alterações
            </>
          )}
        </Button>
      </div>
    </div>
  );
}

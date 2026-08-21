import { useState, useEffect } from "react";
import { Save, FileText, CalendarIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { formatBRL } from "@/lib/mock-data";

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
};

const parseCurrency = (value: string) => {
  return Number(value.replace(/\D/g, "")) / 100;
};

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

  useEffect(() => {
    async function loadData() {
      // Don't attempt to load from Supabase if the ID is not a valid UUID (e.g. mock IDs like "1", "2", "3")
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(projetoId);
      
      if (!isUuid) {
        setLoading(false);
        return;
      }

      try {
        const { data, error } = await supabase
          .from("projetos")
          .select("occupancy_status, possession_action_required, expected_possession_date, possession_completed_date, legal_costs, bailiff_costs, locksmith_security_costs, settlement_costs")
          .eq("id", projetoId)
          .single();

        if (error) throw error;

        if (data) {
          setFormData({
            occupancy_status: data.occupancy_status || "",
            possession_action_required: data.possession_action_required || false,
            expected_possession_date: data.expected_possession_date || null,
            possession_completed_date: data.possession_completed_date || null,
            legal_costs: Number(data.legal_costs) || 0,
            bailiff_costs: Number(data.bailiff_costs) || 0,
            locksmith_security_costs: Number(data.locksmith_security_costs) || 0,
            settlement_costs: Number(data.settlement_costs) || 0,
          });
        }
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
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(projetoId);
      
      if (!isUuid) {
        toast.info("A persistência no banco de dados não está disponível para projetos de demonstração.");
        setSalvando(false);
        return;
      }

      const { error } = await supabase
        .from("projetos")
        .update({
          occupancy_status: formData.occupancy_status,
          possession_action_required: formData.possession_action_required,
          expected_possession_date: formData.expected_possession_date,
          possession_completed_date: formData.possession_completed_date,
          legal_costs: formData.legal_costs,
          bailiff_costs: formData.bailiff_costs,
          locksmith_security_costs: formData.locksmith_security_costs,
          settlement_costs: formData.settlement_costs,
        })
        .eq("id", projetoId);

      if (error) throw error;
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
                onValueChange={(v) => setFormData(prev => ({ ...prev, possession_action_required: v === "Sim" }))}
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

            <div className="space-y-2">
              <Label>Data prevista da posse</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant={"outline"}
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !formData.expected_possession_date && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {formData.expected_possession_date ? (
                      format(parseISO(formData.expected_possession_date), "dd/MM/yyyy")
                    ) : (
                      <span>Selecione a data</span>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
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
                      "w-full justify-start text-left font-normal",
                      !formData.possession_completed_date && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {formData.possession_completed_date ? (
                      format(parseISO(formData.possession_completed_date), "dd/MM/yyyy")
                    ) : (
                      <span>Selecione a data</span>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
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
              <div className="relative">
                <Input 
                  className="text-right"
                  value={formatCurrency(formData.legal_costs)} 
                  onChange={(e) => setFormData(prev => ({ ...prev, legal_costs: parseCurrency(e.target.value) }))}
                />
              </div>
            </div>
            
            <div className="space-y-2">
              <Label>Oficial de Justiça</Label>
              <div className="relative">
                <Input 
                  className="text-right"
                  value={formatCurrency(formData.bailiff_costs)} 
                  onChange={(e) => setFormData(prev => ({ ...prev, bailiff_costs: parseCurrency(e.target.value) }))}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Chaveiro e Segurança</Label>
              <div className="relative">
                <Input 
                  className="text-right"
                  value={formatCurrency(formData.locksmith_security_costs)} 
                  onChange={(e) => setFormData(prev => ({ ...prev, locksmith_security_costs: parseCurrency(e.target.value) }))}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Indenização / Acordo</Label>
              <div className="relative">
                <Input 
                  className="text-right"
                  value={formatCurrency(formData.settlement_costs)} 
                  onChange={(e) => setFormData(prev => ({ ...prev, settlement_costs: parseCurrency(e.target.value) }))}
                />
              </div>
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

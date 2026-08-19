import { createFileRoute, useNavigate, useParams } from "@tanstack/react-router";
import { useState, useMemo, useEffect } from "react";
import { Plus, Trash2, Save, FileText, CalendarIcon } from "lucide-react";
import { AppLayout } from "@/components/app-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format } from "date-fns";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";

// This is a stub for the Regularizacao form component to be used inside the tab
export function RegularizacaoTab({ projetoId, initialData }: { projetoId: string, initialData: any }) {
  const [data, setData] = useState(initialData || {});
  const [temCondominio, setTemCondominio] = useState(initialData?.tem_condominio || false);
  const [acoesJudiciais, setAcoesJudiciais] = useState(initialData?.acoes || []);
  const [salvando, setSalvando] = useState(false);

  const navigate = useNavigate();

  const handleSave = async () => {
    setSalvando(true);
    // Persist logic here...
    toast.success("Alterações salvas com sucesso.");
    setSalvando(false);
  };

  const addAcao = () => {
    setAcoesJudiciais([...acoesJudiciais, { id: Date.now(), tipo: "", vara: "", data: null }]);
  };

  const removeAcao = (index: number) => {
    setAcoesJudiciais(acoesJudiciais.filter((_: any, i: number) => i !== index));
  };

  return (
    <div className="space-y-8 p-6 surface-card">
      {/* Sections for Cartório, Prefeitura, etc would be rendered here */}
      <div className="flex justify-center mt-8">
        <Button onClick={handleSave} disabled={salvando}>
          {salvando ? "Salvando..." : "Salvar Alterações"}
        </Button>
      </div>
    </div>
  );
}

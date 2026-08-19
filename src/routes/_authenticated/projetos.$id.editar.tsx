import { createFileRoute, useNavigate, useParams } from "@tanstack/react-router";
import { useState, useMemo, useEffect } from "react";
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
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { usuarios, formatBRL } from "@/lib/mock-data";
import { InvestorRegistrationModal, type UnifiedEntityData } from "@/components/investor-registration-modal";
import { ImageManagementSection, type ProjetoFoto } from "@/components/image-management-section";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/projetos/$id/editar")({
  component: EditarProjeto,
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

function EditarProjeto() {
  const { id } = useParams({ from: "/_authenticated/projetos/$id/editar" });
  const navigate = useNavigate();
  
  // States - initialization will happen in useEffect based on DB fetch
  const [loading, setLoading] = useState(true);
  const [projeto, setProjeto] = useState<any>(null);

  // Reusing existing states from NovoProjeto (simplified for the edit view)
  const [fotosUpload, setFotosUpload] = useState<ProjetoFoto[]>([]);
  const [isInvestorModalOpen, setIsInvestorModalOpen] = useState(false);
  const [isAssessorModalOpen, setIsAssessorModalOpen] = useState(false);
  const [isResponsibleModalOpen, setIsResponsibleModalOpen] = useState(false);
  const [isLeiloeiroModalOpen, setIsLeiloeiroModalOpen] = useState(false);
  
  const [participantes, setParticipantes] = useState<any[]>([]);
  const [assessoresVinculados, setAssessoresVinculados] = useState<any[]>([]);
  const [responsaveisVinculados, setResponsaveisVinculados] = useState<{id: string, nome: string}[]>([]);
  
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
  
  const [leiloeiroVinculado, setLeiloeiroVinculado] = useState<{id: string, nome: string} | null>(null);
  const [percentualComissao, setPercentualComissao] = useState<number>(5);
  const [valorFinanciado, setValorFinanciado] = useState<number>(0);
  const [quantidadeParcelas, setQuantidadeParcelas] = useState<number>(1);

  useEffect(() => {
    async function loadProjeto() {
        const { data, error } = await supabase.from("projetos").select("*").eq("id", id).single();
        if (data) {
            setProjeto(data);
            setModalidade(data.modalidade || "");
            setValorAquisicao(Number(data.valor_aquisicao));
            setPercentualHonorarios(Number(data.percentual_honorarios));
            setTemMinimo(data.tem_minimo ? "sim" : "nao");
            setValorMinimo(Number(data.valor_minimo));
            setDataAquisicao(data.data_aquisicao ? parseISO(data.data_aquisicao) : undefined);
            setFormaPagamento(data.forma_pagamento || "");
            setTipoImovel(data.tipo_imovel || "");
            setOrigem(data.origem || "");
            setPercentualComissao(Number(data.percentual_comissao));
            setValorFinanciado(Number(data.valor_parcelado));
            setQuantidadeParcelas(Number(data.quantidade_parcelas));
            setLeiloeiroVinculado(data.leiloeiro_id ? { id: data.leiloeiro_id, nome: data.leiloeiro_nome } : null);
            setLoading(false);
        }
    }
    loadProjeto();
  }, [id]);

  if (loading) return <div>Carregando...</div>;

  return (
    <AppLayout title="Editar Projeto" subtitle={projeto.nome}>
        <form
            className="grid gap-6"
            onSubmit={async (e) => {
                e.preventDefault();
                setSalvando(true);
                // Implementation for update
                toast.success("Atualização não implementada ainda.");
                setSalvando(false);
            }}
        >
            <p>Formulário de edição para {projeto.nome} aqui.</p>
             <div className="flex justify-end gap-3 pb-4">
                <Button type="button" variant="outline" onClick={() => navigate({ to: "/projetos" })}>
                    Cancelar
                </Button>
                <Button type="submit" disabled={salvando}>
                    <Save className="size-4" /> {salvando ? "Salvando..." : "Salvar alterações"}
                </Button>
            </div>
        </form>
    </AppLayout>
  );
}

import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect, useMemo } from "react";
import { Edit2, Plus, CalendarIcon, Video, Clock, Users, Link as LinkIcon } from "lucide-react";
import { AppLayout } from "@/components/app-layout";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import { MultiSelect } from "@/components/ui/multi-select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { statusLabels, type StatusKey } from "@/lib/mock-data";
import { supabase } from "@/integrations/supabase/client";

const CATEGORIAS = [
  "Aquisição",
  "Cartório",
  "Prefeitura",
  "Condomínio",
  "Jurídico",
  "Obra",
  "Financeiro",
  "Venda",
];


export const Route = createFileRoute("/projetos/$id/tarefas")({
  head: () => ({
    meta: [
      { title: "Tarefas do Projeto | ArremataFlow" },
      {
        name: "description",
        content: "Gerencie o pipeline operacional do projeto: prazos, responsáveis e status das tarefas.",
      },
      { property: "og:title", content: "Gestão de Tarefas | ArremataFlow" },
      { property: "og:description", content: "Pipeline de tarefas com filtros por status e responsável." },
    ],
  }),
  component: TarefasProjeto,
});

function TarefasProjeto() {
  const { id: projetoId } = Route.useParams();
  const [lista, setLista] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtro, setFiltro] = useState<"todos" | StatusKey>("todos");
  const [open, setOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<any | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [dataSelecionada, setDataSelecionada] = useState<Date | undefined>(undefined);
  const [editDataSelecionada, setEditDataSelecionada] = useState<Date | undefined>(undefined);
  
  // Novos estados para reunião online
  const [isOnlineMeeting, setIsOnlineMeeting] = useState("nao");
  const [participantesSelecionados, setParticipantesSelecionados] = useState<string[]>([]);
  const [participantesProjeto, setParticipantesProjeto] = useState<{label: string, value: string, type: string}[]>([]);

  const loadData = async () => {
    setLoading(true);
    try {
      const { data: tasks, error } = await supabase
        .from("tarefas")
        .select("*")
        .eq("projeto_id", projetoId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setLista(tasks || []);

      // Carregar participantes do projeto (investidores e assessores)
      const { data: parts, error: partsError } = await supabase
        .from("projeto_participantes")
        .select("pessoa_id, nome, papel")
        .eq("projeto_id", projetoId);
      
      const { data: managers, error: managersError } = await supabase
        .from("project_managers")
        .select("assessor_id, pessoas(nome)")
        .eq("project_id", projetoId);

      if (partsError || managersError) throw partsError || managersError;

      const allParticipants = [
        ...(parts?.map(p => ({ label: p.nome, value: p.pessoa_id, type: p.papel || "Investidor" })) || []),
        ...(managers?.map(m => ({ label: (m.pessoas as any)?.nome, value: m.assessor_id, type: "Assessor" })) || [])
      ].filter((v, i, a) => a.findIndex(t => t.value === v.value) === i); // Unique

      setParticipantesProjeto(allParticipants.filter(p => p.value !== null) as any);

    } catch (error) {
      console.error("Erro ao carregar tarefas:", error);
      toast.error("Erro ao carregar dados");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (projetoId && projetoId.length > 5) { // Check if UUID
      loadData();
    } else {
      setLoading(false);
    }
  }, [projetoId]);

  const visiveis = filtro === "todos" ? lista : lista.filter((t) => t.status === filtro);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    
    const taskData = {
      projeto_id: projetoId,
      titulo: String(fd.get("titulo")),
      responsavel: String(fd.get("resp")),
      prazo: dataSelecionada ? format(dataSelecionada, "dd/MM/yyyy") : null,
      category: String(fd.get("category")),
      descricao: String(fd.get("desc")),
      is_online_meeting: isOnlineMeeting === "sim",
      meeting_url: isOnlineMeeting === "sim" ? String(fd.get("meeting_url")) : null,
      meeting_time: isOnlineMeeting === "sim" ? String(fd.get("meeting_time")) : null,
      status: "nao_iniciado",
    };

    if (taskData.is_online_meeting && participantesSelecionados.length === 0) {
      toast.error("Selecione pelo menos um participante para a reunião online.");
      return;
    }

    try {
      const { data, error } = await supabase
        .from("tarefas")
        .insert(taskData)
        .select()
        .single();

      if (error) throw error;

      if (isOnlineMeeting === "sim" && participantesSelecionados.length > 0) {
        const participantData = participantesSelecionados.map(pid => {
          const p = participantesProjeto.find(opt => opt.value === pid);
          return {
            task_id: data.id,
            participant_id: pid,
            participant_type: p?.type || "Vinculado",
          };
        });
        
        const { error: pError } = await supabase
          .from("task_meeting_participants")
          .insert(participantData);
        
        if (pError) throw pError;
      }

      toast.success("Tarefa criada!");
      setOpen(false);
      setDataSelecionada(undefined);
      setIsOnlineMeeting("nao");
      setParticipantesSelecionados([]);
      loadData();
    } catch (error) {
      console.error("Erro ao criar tarefa:", error);
      toast.error("Erro ao criar tarefa");
    }
  };

  return (
    <AppLayout
      title="Gestão de Tarefas"
      subtitle="Pipeline operacional do projeto"
      actions={
        <Dialog open={open} onOpenChange={(val) => {
          setOpen(val);
          if (!val) {
            setDataSelecionada(undefined);
            setIsOnlineMeeting("nao");
            setParticipantesSelecionados([]);
          }
        }}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="size-4" /> Nova tarefa
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl overflow-y-auto max-h-[90vh]">
            <DialogHeader>
              <DialogTitle>Nova tarefa</DialogTitle>
              <DialogDescription>Defina responsável, prazo e categoria.</DialogDescription>
            </DialogHeader>
            <form className="space-y-4" onSubmit={handleSubmit}>
              <div className="space-y-2">
                <Label htmlFor="category">Categoria</Label>
                <Select name="category" required>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione a categoria" />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIAS.map(cat => (
                      <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="titulo">Título</Label>
                <Input id="titulo" name="titulo" placeholder="Ex.: Protocolar averbação" required />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="resp">Responsável</Label>
                  <Select name="resp" required disabled={participantesProjeto.length === 0}>
                    <SelectTrigger>
                      <SelectValue placeholder={participantesProjeto.length === 0 ? "Nenhum participante vinculado" : "Selecione o responsável"} />
                    </SelectTrigger>
                    <SelectContent>
                      {participantesProjeto.map(p => (
                        <SelectItem key={p.value} value={p.value}>
                          {p.label} <span className="text-[10px] opacity-50 ml-1">({p.type})</span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {participantesProjeto.length === 0 && (
                    <p className="text-[10px] text-destructive mt-1">
                      Não existem assessores ou investidores vinculados a este projeto. Cadastre ou vincule um participante antes de criar uma tarefa.
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label>Prazo</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant={"outline"}
                        className={cn(
                          "w-full justify-start text-left font-normal",
                          !dataSelecionada && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {dataSelecionada ? (
                          format(dataSelecionada, "dd/MM/yyyy")
                        ) : (
                          <span>Selecione uma data</span>
                        )}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={dataSelecionada}
                        onSelect={setDataSelecionada}
                        locale={ptBR}
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>

              <div className="space-y-3 pt-2 border-t border-border">
                <Label>Esta tarefa é uma reunião online?</Label>
                <RadioGroup 
                  defaultValue="nao" 
                  className="flex gap-4"
                  onValueChange={setIsOnlineMeeting}
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="sim" id="r-sim" />
                    <Label htmlFor="r-sim" className="font-normal">Sim</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="nao" id="r-nao" />
                    <Label htmlFor="r-nao" className="font-normal">Não</Label>
                  </div>
                </RadioGroup>
              </div>

              {isOnlineMeeting === "sim" && (
                <div className="space-y-4 p-4 rounded-lg bg-muted/30 border border-border animate-in fade-in zoom-in duration-200">
                  <h4 className="font-medium text-sm flex items-center gap-2">
                    <Video className="size-4 text-primary" /> Informações da Reunião
                  </h4>
                  
                  <div className="space-y-2">
                    <Label htmlFor="meeting_url" className="flex items-center gap-1">
                      <LinkIcon className="size-3" /> Link da Reunião
                    </Label>
                    <Input 
                      id="meeting_url" 
                      name="meeting_url" 
                      type="url" 
                      placeholder="https://meet.google.com/..." 
                      required={isOnlineMeeting === "sim"}
                    />
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="meeting_time" className="flex items-center gap-1">
                        <Clock className="size-3" /> Horário
                      </Label>
                      <Input 
                        id="meeting_time" 
                        name="meeting_time" 
                        type="time" 
                        required={isOnlineMeeting === "sim"}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="flex items-center gap-1">
                        <Users className="size-3" /> Participantes
                      </Label>
                      <MultiSelect
                        options={participantesProjeto}
                        selected={participantesSelecionados}
                        onChange={setParticipantesSelecionados}
                        placeholder={participantesProjeto.length === 0 ? "Nenhum participante disponível" : "Buscar participantes..."}
                      />
                      {isOnlineMeeting === "sim" && participantesSelecionados.length === 0 && (
                        <p className="text-[10px] text-destructive mt-1">
                          Selecione pelo menos um participante para a reunião.
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="desc">Descrição</Label>
                <Textarea id="desc" name="desc" rows={3} />
              </div>
              <DialogFooter>
                <Button type="submit">Criar tarefa</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      }
    >
      <Dialog
        open={editOpen}
        onOpenChange={async (val) => {
          setEditOpen(val);
          if (val && editingTask) {
            const parts = editingTask.prazo?.split("/");
            if (parts && parts.length === 3) {
              const year = parts[2] ? parseInt(parts[2]) : 2026;
              const month = parts[1] ? parseInt(parts[1]) - 1 : 0;
              const day = parts[0] ? parseInt(parts[0]) : 1;
              const d = new Date(year, month, day);
              setEditDataSelecionada(d);
            } else {
              setEditDataSelecionada(undefined);
            }

            // Carregar participantes vinculados à tarefa
            setIsOnlineMeeting(editingTask.is_online_meeting ? "sim" : "nao");
            const { data: pData } = await supabase
              .from("task_meeting_participants")
              .select("participant_id")
              .eq("task_id", editingTask.id);
            
            if (pData) {
              setParticipantesSelecionados(pData.map(p => p.participant_id).filter(Boolean) as string[]);
            } else {
              setParticipantesSelecionados([]);
            }
          } else if (!val) {
            setIsOnlineMeeting("nao");
            setParticipantesSelecionados([]);
          }
        }}
      >
        <DialogContent className="max-w-2xl overflow-y-auto max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>Editar tarefa</DialogTitle>
            <DialogDescription>Altere as informações da tarefa selecionada.</DialogDescription>
          </DialogHeader>
          {editingTask && (
            <form
              className="space-y-4"
              onSubmit={async (e) => {
                e.preventDefault();
                const fd = new FormData(e.currentTarget);
                
                const taskData = {
                  titulo: String(fd.get("titulo")),
                  responsavel: String(fd.get("resp")),
                  prazo: editDataSelecionada ? format(editDataSelecionada, "dd/MM/yyyy") : editingTask.prazo,
                  category: String(fd.get("category")),
                  status: fd.get("status") as StatusKey,
                  descricao: String(fd.get("desc")),
                  is_online_meeting: fd.get("is_online_meeting") === "sim",
                  meeting_url: fd.get("is_online_meeting") === "sim" ? String(fd.get("meeting_url")) : null,
                  meeting_time: fd.get("is_online_meeting") === "sim" ? String(fd.get("meeting_time")) : null,
                };

                 try {
                  const { error } = await supabase
                    .from("tarefas")
                    .update(taskData)
                    .eq("id", editingTask.id);

                  if (error) throw error;

                  // Atualizar participantes da reunião
                  await supabase
                    .from("task_meeting_participants")
                    .delete()
                    .eq("task_id", editingTask.id);

                  if (taskData.is_online_meeting && participantesSelecionados.length > 0) {
                    const participantData = participantesSelecionados.map(pid => {
                      const p = participantesProjeto.find(opt => opt.value === pid);
                      return {
                        task_id: editingTask.id,
                        participant_id: pid,
                        participant_type: p?.type || "Vinculado",
                      };
                    });
                    
                    await supabase
                      .from("task_meeting_participants")
                      .insert(participantData);
                  }
                  
                  toast.success("Tarefa atualizada!");
                  setEditOpen(false);
                  loadData();
                } catch (error) {
                  console.error("Erro ao atualizar tarefa:", error);
                  toast.error("Erro ao atualizar tarefa");
                }
              }}
            >
              <div className="space-y-2">
                <Label htmlFor="edit-category">Categoria</Label>
                <Select name="category" defaultValue={editingTask.category}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIAS.map((cat) => (
                      <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-titulo">Título</Label>
                <Input
                  id="edit-titulo"
                  name="titulo"
                  defaultValue={editingTask.titulo}
                  required
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="edit-resp">Responsável</Label>
                  <Select name="resp" defaultValue={editingTask.responsavel || undefined} required disabled={participantesProjeto.length === 0}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o responsável" />
                    </SelectTrigger>
                    <SelectContent>
                      {participantesProjeto.map(p => (
                        <SelectItem key={p.value} value={p.value}>
                          {p.label} <span className="text-[10px] opacity-50 ml-1">({p.type})</span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Prazo</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant={"outline"}
                        className={cn(
                          "w-full justify-start text-left font-normal",
                          !editDataSelecionada && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {editDataSelecionada ? (
                          format(editDataSelecionada, "dd/MM/yyyy")
                        ) : (
                          <span>Selecione uma data</span>
                        )}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={editDataSelecionada}
                        onSelect={setEditDataSelecionada}
                        locale={ptBR}
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>

               <div className="space-y-3 pt-2 border-t border-border">
                <Label>Esta tarefa é uma reunião online?</Label>
                <RadioGroup 
                  value={isOnlineMeeting} 
                  className="flex gap-4"
                  onValueChange={setIsOnlineMeeting}
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="sim" id="edit-r-sim" />
                    <Label htmlFor="edit-r-sim" className="font-normal">Sim</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="nao" id="edit-r-nao" />
                    <Label htmlFor="edit-r-nao" className="font-normal">Não</Label>
                  </div>
                </RadioGroup>
              </div>

              {isOnlineMeeting === "sim" && (
                <div className="space-y-4 p-4 rounded-lg bg-muted/30 border border-border animate-in fade-in zoom-in duration-200">
                  <h4 className="font-medium text-sm flex items-center gap-2">
                    <Video className="size-4 text-primary" /> Informações da Reunião
                  </h4>
                  
                  <div className="space-y-2">
                    <Label htmlFor="edit-meeting_url" className="flex items-center gap-1">
                      <LinkIcon className="size-3" /> Link da Reunião
                    </Label>
                    <Input 
                      id="edit-meeting_url" 
                      name="meeting_url" 
                      type="url" 
                      defaultValue={editingTask.meeting_url || ""}
                      placeholder="https://meet.google.com/..." 
                      required={isOnlineMeeting === "sim"}
                    />
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="edit-meeting_time" className="flex items-center gap-1">
                        <Clock className="size-3" /> Horário
                      </Label>
                      <Input 
                        id="edit-meeting_time" 
                        name="meeting_time" 
                        type="time" 
                        defaultValue={editingTask.meeting_time || ""}
                        required={isOnlineMeeting === "sim"}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="flex items-center gap-1">
                        <Users className="size-3" /> Participantes
                      </Label>
                      <MultiSelect
                        options={participantesProjeto}
                        selected={participantesSelecionados}
                        onChange={setParticipantesSelecionados}
                        placeholder={participantesProjeto.length === 0 ? "Nenhum participante disponível" : "Buscar participantes..."}
                      />
                    </div>
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="edit-status">Status</Label>
                <Select name="status" defaultValue={editingTask.status}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(statusLabels) as StatusKey[]).map((s) => (
                      <SelectItem key={s} value={s}>
                        {statusLabels[s]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-desc">Descrição</Label>
                <Textarea id="edit-desc" name="desc" defaultValue={editingTask.descricao} rows={3} />
              </div>

              <DialogFooter>
                <Button type="submit">Salvar alterações</Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      
      <div className="surface-card">
        <div className="flex flex-wrap items-center gap-3 border-b border-border p-4">
          <Label className="text-sm text-muted-foreground">Filtrar por status</Label>
          <Select value={filtro} onValueChange={(v) => setFiltro(v as typeof filtro)}>
            <SelectTrigger className="w-56">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os status</SelectItem>
              {(Object.keys(statusLabels) as StatusKey[]).map((s) => (
                <SelectItem key={s} value={s}>
                  {statusLabels[s]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <span className="ml-auto text-sm text-muted-foreground">{visiveis.length} tarefas</span>
        </div>
        <ul className="divide-y divide-border">
          {visiveis.map((t) => (
            <li key={t.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
              <div className="flex items-center gap-3">
                {t.is_online_meeting && <Video className="size-5 text-primary" />}
                <div>
                  <p className="font-medium">{t.titulo}</p>
                  <p className="text-xs text-muted-foreground">
                    {t.category} · {participantesProjeto.find(p => p.value === t.responsavel)?.label || t.responsavel} · vence {t.prazo || "N/A"}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <StatusBadge status={t.status} />
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 gap-1 text-xs font-normal"
                  onClick={() => {
                    setEditingTask(t);
                    setEditOpen(true);
                  }}
                >
                  <Edit2 className="size-3" />
                  Editar
                </Button>
              </div>
            </li>
          ))}
          {visiveis.length === 0 && !loading ? (
            <li className="p-10 text-center text-muted-foreground">Nenhuma tarefa encontrada.</li>
          ) : null}
          {loading && (
             <li className="p-10 text-center text-muted-foreground">Carregando tarefas...</li>
          )}
        </ul>
      </div>
    </AppLayout>
  );
}


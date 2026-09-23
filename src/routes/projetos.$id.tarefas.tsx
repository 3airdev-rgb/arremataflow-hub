import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Clock, Edit2, ExternalLink, Plus, Video } from "lucide-react";
import { toast } from "sonner";
import { AppLayout } from "@/components/app-layout";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MultiSelect } from "@/components/ui/multi-select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { StatusBadge } from "@/components/status-badge";
import { Textarea } from "@/components/ui/textarea";
import { financialCategories } from "@/lib/financial-categories";
import { getCurrentProjectRole } from "@/lib/projects";
import { listProjectTaskContacts, listProjectTasks, saveTask } from "@/lib/tasks";
import { showValidationAlert } from "@/lib/validation-feedback";
type StatusKey = "nao_iniciado" | "andamento" | "aguardando" | "pendente" | "concluido";

export const Route = createFileRoute("/projetos/$id/tarefas")({ component: TarefasProjeto });
type Task = Awaited<ReturnType<typeof listProjectTasks>>[number];
const statusOptions: Array<{ value: StatusKey; label: string }> = [
  { value: "nao_iniciado", label: "Não iniciado" },
  { value: "andamento", label: "Em andamento" },
  { value: "aguardando", label: "Aguardando terceiro" },
  { value: "pendente", label: "Pendente" },
  { value: "concluido", label: "Concluído" },
];

function TarefasProjeto() {
  const { id: projectId } = Route.useParams();
  return (
    <AppLayout title="Gestão de Tarefas" subtitle="Prazos, responsáveis e reuniões do projeto">
      <ProjectTasksPanel projectId={projectId} />
    </AppLayout>
  );
}

export function ProjectTasksPanel({ projectId }: { projectId: string }) {
  const [filter, setFilter] = useState("todos"),
    [open, setOpen] = useState(false),
    [editing, setEditing] = useState<Task | null>(null);
  const tasksQuery = useQuery({
    queryKey: ["project-tasks", projectId],
    queryFn: () => listProjectTasks({ data: { projectId } }),
    refetchInterval: 30_000,
  });
  const contactsQuery = useQuery({
    queryKey: ["project-task-contacts", projectId],
    queryFn: () => listProjectTaskContacts({ data: { projectId } }),
  });
  const roleQuery = useQuery({
    queryKey: ["current-project-role", projectId],
    queryFn: () => getCurrentProjectRole({ data: { projectId } }),
  });
  const canEdit = ["owner", "admin", "project_manager"].includes(roleQuery.data || "");
  const visible = (tasksQuery.data || []).filter(
    (task) => filter === "todos" || task.status === filter,
  );
  const close = () => {
    setOpen(false);
    setEditing(null);
  };

  return (
    <div className="surface-card overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b p-4">
        <div>
          <h3 className="font-semibold">Gestão de Tarefas</h3>
          <p className="text-sm text-muted-foreground">{tasksQuery.data?.length || 0} tarefa(s)</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={filter} onValueChange={setFilter}>
            <SelectTrigger className="w-52">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os status</SelectItem>
              {statusOptions.map((s) => (
                <SelectItem key={s.value} value={s.value}>
                  {s.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {canEdit ? (
            <Dialog
              open={open}
              onOpenChange={(next) => {
                setOpen(next);
                if (!next) setEditing(null);
              }}
            >
              <DialogTrigger asChild>
                <Button onClick={() => setEditing(null)}>
                  <Plus className="size-4" /> Nova tarefa
                </Button>
              </DialogTrigger>
              <TaskDialog
                projectId={projectId}
                task={editing}
                contacts={contactsQuery.data || []}
                onClose={close}
                onSaved={() => tasksQuery.refetch()}
              />
            </Dialog>
          ) : null}
        </div>
      </div>
      <ul className="divide-y">
        {visible.map((task) => (
          <li key={task.id} className="space-y-4 p-4">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="font-medium">{task.titulo}</h3>
                  {task.is_online_meeting ? <Video className="size-4 text-brand" /> : null}
                </div>
                <p className="text-xs text-muted-foreground">
                  {task.category} · {task.responsavel || "Sem responsável"} · vence {task.prazo}
                </p>
                {task.is_online_meeting ? (
                  <div className="mt-2 flex flex-wrap items-center gap-3 text-xs">
                    <span className="flex items-center gap-1">
                      <Clock className="size-3.5" /> {task.prazo} às {task.meeting_time}
                    </span>
                    <a
                      href={task.meeting_url || "#"}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 font-medium text-brand hover:underline"
                    >
                      Entrar na reunião <ExternalLink className="size-3" />
                    </a>
                  </div>
                ) : null}
              </div>
              <div className="flex items-center gap-2">
                <StatusBadge status={task.status as StatusKey} />
                {canEdit ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setEditing(task);
                      setOpen(true);
                    }}
                  >
                    <Edit2 className="size-3.5" /> Editar
                  </Button>
                ) : null}
              </div>
            </div>
            {task.is_online_meeting && task.meetingResponses.length ? (
              <div className="rounded-lg border bg-muted/30 p-3">
                <p className="mb-2 text-sm font-medium">Respostas dos participantes</p>
                <div className="space-y-2">
                  {task.meetingResponses.map((response) => (
                    <div
                      key={response.recipientEmail}
                      className="flex flex-wrap items-center justify-between gap-2 text-sm"
                    >
                      <span>
                        {response.recipientName}{" "}
                        <span className="text-xs text-muted-foreground">
                          ({response.recipientEmail})
                        </span>
                      </span>
                      <span
                        className={
                          response.response === "confirmado"
                            ? "font-medium text-green-700"
                            : response.response === "recusado"
                              ? "font-medium text-red-700"
                              : "text-muted-foreground"
                        }
                      >
                        {response.response === "confirmado"
                          ? "Confirmou participação"
                          : response.response === "recusado"
                            ? "Não poderá participar"
                            : "Aguardando resposta"}
                        {response.respondedAt
                          ? ` · ${new Date(response.respondedAt).toLocaleString("pt-BR")}`
                          : ""}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </li>
        ))}
        {!tasksQuery.isPending && !visible.length ? (
          <li className="p-10 text-center text-sm text-muted-foreground">
            Nenhuma tarefa encontrada.
          </li>
        ) : null}
      </ul>
    </div>
  );
}

function TaskDialog({
  projectId,
  task,
  contacts,
  onClose,
  onSaved,
}: {
  projectId: string;
  task: Task | null;
  contacts: Array<{ label: string; value: string; type: string }>;
  onClose: () => void;
  onSaved: () => Promise<unknown>;
}) {
  const [assignees, setAssignees] = useState<string[]>([]),
    [participants, setParticipants] = useState<string[]>([]);
  const [online, setOnline] = useState(false),
    [category, setCategory] = useState(""),
    [status, setStatus] = useState<StatusKey>("nao_iniciado");
  useEffect(() => {
    setAssignees(task?.assignees || []);
    setParticipants(task?.participants || []);
    setOnline(Boolean(task?.is_online_meeting));
    setCategory(task?.category || "");
    setStatus((task?.status as StatusKey) || "nao_iniciado");
  }, [task]);
  return (
    <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
      <DialogHeader>
        <DialogTitle>{task ? "Editar tarefa" : "Nova tarefa"}</DialogTitle>
        <DialogDescription>Defina responsáveis, prazo e informações da reunião.</DialogDescription>
      </DialogHeader>
      <form
        className="space-y-4"
        onSubmit={async (event) => {
          event.preventDefault();
          const f = new FormData(event.currentTarget);
          if (!assignees.length) {
            showValidationAlert("Selecione ao menos um responsável.");
            return;
          }
          try {
            const result = await saveTask({
              data: {
                ...(task?.id ? { id: task.id } : {}),
                projectId,
                title: String(f.get("title")),
                description: String(f.get("description") || ""),
                category,
                dueDate: String(f.get("dueDate") || "") || null,
                status,
                assignees,
                isOnlineMeeting: online,
                meetingUrl: online ? String(f.get("meetingUrl") || "") : null,
                meetingTime: online ? String(f.get("meetingTime") || "") : null,
                participants: online ? participants : [],
              },
            });
            await onSaved();
            onClose();
            if (!task && result.emailDelivery.failed > 0)
              toast.warning(
                `Tarefa criada, mas ${result.emailDelivery.failed} e-mail(s) não puderam ser enviados.`,
              );
            else
              toast.success(
                task
                  ? "Tarefa atualizada."
                  : `Tarefa criada e ${result.emailDelivery.sent} e-mail(s) enviado(s).`,
              );
          } catch (error) {
            showValidationAlert(
              error,
              "Não foi possível salvar a tarefa. Revise os campos informados.",
            );
          }
        }}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Categoria</Label>
            <Select value={category} onValueChange={setCategory} required>
              <SelectTrigger>
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
                {financialCategories.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Status</Label>
            <Select value={status} onValueChange={(v) => setStatus(v as StatusKey)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {statusOptions.map((s) => (
                  <SelectItem key={s.value} value={s.value}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="task-title">Título</Label>
          <Input id="task-title" name="title" defaultValue={task?.title} required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="task-description">Descrição</Label>
          <Textarea id="task-description" name="description" defaultValue={task?.description} />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Responsáveis</Label>
            <MultiSelect
              options={contacts}
              selected={assignees}
              onChange={setAssignees}
              placeholder="Selecione"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="task-due">Prazo</Label>
            <Input id="task-due" name="dueDate" type="date" defaultValue={task?.dueDate || ""} />
          </div>
        </div>
        <div className="space-y-2 border-t pt-4">
          <Label>É uma reunião online?</Label>
          <RadioGroup
            value={online ? "sim" : "nao"}
            onValueChange={(v) => setOnline(v === "sim")}
            className="flex gap-4"
          >
            <label className="flex items-center gap-2">
              <RadioGroupItem value="sim" /> Sim
            </label>
            <label className="flex items-center gap-2">
              <RadioGroupItem value="nao" /> Não
            </label>
          </RadioGroup>
        </div>
        {online ? (
          <div className="grid gap-4 rounded-lg border bg-muted/30 p-4 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="meeting-url">Link da reunião</Label>
              <Input
                id="meeting-url"
                name="meetingUrl"
                type="url"
                placeholder="https://meet.google.com/..."
                defaultValue={task?.meeting_url || ""}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="meeting-time">Horário</Label>
              <Input
                id="meeting-time"
                name="meetingTime"
                type="time"
                defaultValue={task?.meeting_time || ""}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Participantes</Label>
              <MultiSelect
                options={contacts}
                selected={participants}
                onChange={setParticipants}
                placeholder="Selecione"
              />
            </div>
          </div>
        ) : null}
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit">Salvar</Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}

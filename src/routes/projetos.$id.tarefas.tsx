import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Edit2, Plus } from "lucide-react";
import { AppLayout } from "@/components/app-layout";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import { tarefas as tarefasMock, statusLabels, type StatusKey } from "@/lib/mock-data";

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
  const [lista, setLista] = useState(tarefasMock);
  const [filtro, setFiltro] = useState<"todos" | StatusKey>("todos");
  const [open, setOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<(typeof tarefasMock)[0] | null>(null);
  const [editOpen, setEditOpen] = useState(false);

  const visiveis = filtro === "todos" ? lista : lista.filter((t) => t.status === filtro);

  return (
    <AppLayout
      title="Gestão de Tarefas"
      subtitle="Pipeline operacional do projeto"
      actions={
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="size-4" /> Nova tarefa
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Nova tarefa</DialogTitle>
              <DialogDescription>Defina responsável, prazo e categoria.</DialogDescription>
            </DialogHeader>
            <form
              className="space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                const fd = new FormData(e.currentTarget);
                setLista((prev) => [
                  {
                    id: `t${Date.now()}`,
                    titulo: String(fd.get("titulo") || "Nova tarefa"),
                    projeto: "AF-2026-018",
                    responsavel: String(fd.get("resp") || "Camila Andrade"),
                    prazo: String(fd.get("prazo") || "Hoje"),
                    status: "nao_iniciado",
                    categoria: "Geral",
                  },
                  ...prev,
                ]);
                setOpen(false);
                toast.success("Tarefa criada!");
              }}
            >
              <div className="space-y-2">
                <Label htmlFor="titulo">Título</Label>
                <Input id="titulo" name="titulo" placeholder="Ex.: Protocolar averbação" required />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="resp">Responsável</Label>
                  <Input id="resp" name="resp" defaultValue="Camila Andrade" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="prazo">Prazo</Label>
                  <Input id="prazo" name="prazo" placeholder="20/08/2026" />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="desc">Descrição</Label>
                <Textarea id="desc" rows={3} />
              </div>
              <DialogFooter>
                <Button type="submit">Criar tarefa</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      }
    >
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar tarefa</DialogTitle>
            <DialogDescription>Altere as informações da tarefa selecionada.</DialogDescription>
          </DialogHeader>
          {editingTask && (
            <form
              className="space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                const fd = new FormData(e.currentTarget);
                setLista((prev) =>
                  prev.map((t) =>
                    t.id === editingTask.id
                      ? {
                          ...t,
                          titulo: String(fd.get("titulo")),
                          responsavel: String(fd.get("resp")),
                          prazo: String(fd.get("prazo")),
                          status: fd.get("status") as StatusKey,
                        }
                      : t
                  )
                );
                setEditOpen(false);
                toast.success("Tarefa atualizada!");
              }}
            >
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
                  <Input id="edit-resp" name="resp" defaultValue={editingTask.responsavel} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-prazo">Prazo</Label>
                  <Input id="edit-prazo" name="prazo" defaultValue={editingTask.prazo} />
                </div>
              </div>
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
              <div>
                <p className="font-medium">{t.titulo}</p>
                <p className="text-xs text-muted-foreground">
                  {t.categoria} · {t.responsavel} · vence {t.prazo}
                </p>
              </div>
              <div className="flex items-center gap-3">
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
                  Editar tarefa
                </Button>
                <StatusBadge status={t.status} />
              </div>
            </li>
          ))}
          {visiveis.length === 0 ? (
            <li className="p-10 text-center text-muted-foreground">Nenhuma tarefa nesse status.</li>
          ) : null}
        </ul>
      </div>
    </AppLayout>
  );
}

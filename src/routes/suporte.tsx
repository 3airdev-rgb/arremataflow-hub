import { createFileRoute, redirect } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { AppLayout } from "@/components/app-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getSystemRole } from "@/lib/developer";
import { listProjects } from "@/lib/projects";
import {
  createSupportTicket,
  getSupportThread,
  listSupportTickets,
  replySupportTicket,
  supportPriorityLabels,
  supportStatusLabels,
  supportCategories,
} from "@/lib/support";

export const Route = createFileRoute("/suporte")({
  beforeLoad: async () => {
    if ((await getSystemRole()) === "developer") throw redirect({ to: "/desenvolvedor" });
  },
  component: SupportPage,
});

function SupportPage() {
  const queryClient = useQueryClient();
  const { data: tickets = [] } = useQuery({
    queryKey: ["support-tickets"],
    queryFn: () => listSupportTickets(),
  });
  const [selected, setSelected] = useState<string | null>(() =>
    typeof window === "undefined"
      ? null
      : new URLSearchParams(window.location.search).get("ticket"),
  );
  const { data: projects = [] } = useQuery({
    queryKey: ["support-projects"],
    queryFn: () => listProjects(),
  });
  const [files, setFiles] = useState<FileList | null>(null);
  const [replyFiles, setReplyFiles] = useState<FileList | null>(null);
  const uploadFiles = async (ticketId: string, selectedFiles: FileList | null) => {
    for (const file of Array.from(selectedFiles || [])) {
      const form = new FormData();
      form.set("ticketId", ticketId);
      form.set("file", file);
      const response = await fetch("/api/support-attachments/upload", {
        method: "POST",
        body: form,
      });
      if (!response.ok) throw new Error(await response.text());
    }
  };
  const { data: thread } = useQuery({
    queryKey: ["support-thread", selected],
    queryFn: () => getSupportThread({ data: { ticketId: selected! } }),
    enabled: !!selected,
  });
  const [error, setError] = useState("");
  return (
    <AppLayout title="Suporte / Meus Chamados" subtitle="Abra e acompanhe seus chamados">
      <div className="grid gap-6 xl:grid-cols-2">
        <form
          className="space-y-4 rounded-xl border bg-card p-5"
          onSubmit={async (event) => {
            event.preventDefault();
            setError("");
            const form = event.currentTarget;
            const values = new FormData(form);
            try {
              const ticket = await createSupportTicket({
                data: {
                  subject: String(values.get("subject")),
                  category: String(values.get("category")) as (typeof supportCategories)[number],
                  description: String(values.get("description")),
                  priority: String(values.get("priority")) as "low" | "normal" | "high" | "urgent",
                  projectId: String(values.get("projectId") || "") || undefined,
                },
              });
              await uploadFiles(ticket.id, files);
              form.reset();
              setFiles(null);
              setSelected(ticket.id);
              await queryClient.invalidateQueries({ queryKey: ["support-tickets"] });
            } catch (cause) {
              setError(cause instanceof Error ? cause.message : "Erro ao abrir chamado.");
            }
          }}
        >
          <h2 className="text-lg font-semibold">Novo chamado</h2>
          <div className="space-y-1">
            <Label htmlFor="subject">Assunto</Label>
            <Input id="subject" name="subject" required minLength={3} maxLength={160} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="category">Categoria</Label>
            <select
              id="category"
              name="category"
              required
              className="w-full rounded-md border bg-background p-2"
            >
              <option value="">Selecione</option>
              {supportCategories.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="projectId">Projeto (opcional)</Label>
            <select
              id="projectId"
              name="projectId"
              className="w-full rounded-md border bg-background p-2"
            >
              <option value="">Nenhum</option>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="priority">Prioridade</Label>
            <select
              id="priority"
              name="priority"
              className="w-full rounded-md border bg-background p-2"
            >
              <option value="low">Baixa</option>
              <option value="normal">Média</option>
              <option value="high">Alta</option>
              <option value="urgent">Urgente</option>
            </select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="description">Descrição</Label>
            <textarea
              id="description"
              name="description"
              required
              minLength={10}
              className="min-h-32 w-full rounded-md border bg-background p-2"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="attachments">Anexos (PDF ou imagem, até 10 MB cada)</Label>
            <Input
              id="attachments"
              type="file"
              multiple
              accept=".pdf,.jpg,.jpeg,.png,.webp"
              onChange={(event) => setFiles(event.target.files)}
            />
          </div>
          <Button>Abrir chamado</Button>
          {error && (
            <p role="alert" className="text-destructive">
              {error}
            </p>
          )}
        </form>
        <section className="space-y-4 rounded-xl border bg-card p-5">
          <h2 className="text-lg font-semibold">Meus chamados</h2>
          {tickets.length ? (
            tickets.map((ticket) => (
              <button
                key={ticket.id}
                type="button"
                onClick={() => setSelected(ticket.id)}
                className="block w-full rounded border p-3 text-left hover:bg-accent focus-visible:outline-2 focus-visible:outline-ring"
              >
                <strong>{ticket.controlNumber}</strong> · {ticket.subject}
                <br />
                <small>
                  {supportStatusLabels[ticket.status] ?? ticket.status} ·{" "}
                  {new Date(ticket.createdAt).toLocaleString("pt-BR")}
                </small>
              </button>
            ))
          ) : (
            <p>Nenhum chamado aberto.</p>
          )}
        </section>
        {thread && (
          <section className="space-y-3 rounded-xl border bg-card p-5 xl:col-span-2">
            <h2 className="text-lg font-semibold">
              {thread.ticket.controlNumber} · {thread.ticket.subject}
            </h2>
            <p className="text-sm">
              Status: {supportStatusLabels[thread.ticket.status] ?? thread.ticket.status} ·
              Prioridade: {supportPriorityLabels[thread.ticket.priority] ?? thread.ticket.priority}{" "}
              · Responsável: {thread.assigneeName ?? "Não atribuído"}
            </p>
            <p className="text-sm">
              Primeira resposta prevista:{" "}
              {new Date(thread.ticket.firstResponseDueAt).toLocaleString("pt-BR")} · Solução
              prevista: {new Date(thread.ticket.resolutionDueAt).toLocaleString("pt-BR")}
            </p>
            <p className="text-sm">
              Categoria: {thread.ticket.category}
              {thread.ticket.projectId
                ? ` · Projeto: ${projects.find((project) => project.id === thread.ticket.projectId)?.name ?? thread.ticket.projectId}`
                : ""}
            </p>
            <h3 className="font-medium">Linha do tempo</h3>
            {thread.history.map((entry) => (
              <p key={entry.id} className="text-sm">
                {new Date(entry.createdAt).toLocaleString("pt-BR")} · {entry.actorName}:{" "}
                {supportStatusLabels[entry.toStatus] ?? entry.toStatus}
              </p>
            ))}
            {thread.attachments.map((attachment) => (
              <p key={attachment.id}>
                <a className="underline" href={`/api/support-attachments/${attachment.id}`}>
                  {attachment.originalName}
                </a>
              </p>
            ))}
            {thread.messages.map((entry) => (
              <div key={entry.id} className="rounded border p-3">
                <strong>{entry.authorName}</strong> ·{" "}
                {new Date(entry.createdAt).toLocaleString("pt-BR")}
                <p className="whitespace-pre-wrap">{entry.body}</p>
              </div>
            ))}
            <form
              className="space-y-2"
              onSubmit={async (event) => {
                event.preventDefault();
                const form = event.currentTarget;
                const body = String(new FormData(form).get("reply"));
                await replySupportTicket({ data: { ticketId: thread.ticket.id, body } });
                await uploadFiles(thread.ticket.id, replyFiles);
                form.reset();
                setReplyFiles(null);
                await queryClient.invalidateQueries({ queryKey: ["support-thread", selected] });
              }}
            >
              <Label htmlFor="reply">Nova mensagem</Label>
              <textarea
                id="reply"
                name="reply"
                required
                className="min-h-24 w-full rounded border bg-background p-2"
              />
              <Button>Enviar mensagem</Button>
              <Input
                aria-label="Anexos da resposta"
                type="file"
                multiple
                accept=".pdf,.jpg,.jpeg,.png,.webp"
                onChange={(event) => setReplyFiles(event.target.files)}
              />
            </form>
          </section>
        )}
      </div>
    </AppLayout>
  );
}

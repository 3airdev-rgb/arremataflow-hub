import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getHelpDesk } from "@/lib/developer";
import type { SlaState } from "@/lib/developer-metrics";
import {
  getSupportThread,
  replySupportTicket,
  supportPriorityLabels,
  supportStatusLabels,
} from "@/lib/support";
import { cn } from "@/lib/utils";
import { Badge, Empty, Metric, Panel } from "./shared";
import { formatDateTime, formatMinutes, relativeTime, selectClass } from "./format";

type Ticket = Awaited<ReturnType<typeof getHelpDesk>>["tickets"][number];
type ReplyStatus = "open" | "in_progress" | "waiting" | "resolved" | "closed";
const priorityTone = { urgent: "danger", high: "warning", normal: "info", low: "muted" } as const;
const slaOrder: SlaState[] = ["breached", "at_risk", "ok", "done"];
const slaText = {
  breached: "Prazo vencido",
  at_risk: "Prazo se esgotando",
  ok: "No prazo",
  done: "Cumprido",
} as const;
const slaTone = { breached: "danger", at_risk: "warning", ok: "good", done: "muted" } as const;

const worstSla = (ticket: Ticket): SlaState =>
  slaOrder.find((state) => ticket.sla.firstResponse === state || ticket.sla.resolution === state) ??
  "ok";

export function HelpDeskTab() {
  const queryClient = useQueryClient();
  const { data, isPending, isFetching, error, refetch } = useQuery({
    queryKey: ["developer-helpdesk"],
    queryFn: () => getHelpDesk(),
    refetchInterval: 30_000,
  });
  const [selected, setSelected] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("open-only");
  const [priorityFilter, setPriorityFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [slaFilter, setSlaFilter] = useState("");
  const [reply, setReply] = useState("");
  const [replyStatus, setReplyStatus] = useState<ReplyStatus>("in_progress");
  const [files, setFiles] = useState<FileList | null>(null);

  const { data: thread } = useQuery({
    queryKey: ["developer-thread", selected],
    queryFn: () => getSupportThread({ data: { ticketId: selected! } }),
    enabled: Boolean(selected),
  });

  const send = useMutation({
    mutationFn: async () => {
      await replySupportTicket({ data: { ticketId: selected!, body: reply, status: replyStatus } });
      for (const file of Array.from(files || [])) {
        const form = new FormData();
        form.set("ticketId", selected!);
        form.set("file", file);
        const response = await fetch("/api/support-attachments/upload", {
          method: "POST",
          body: form,
        });
        if (!response.ok) throw new Error(await response.text());
      }
    },
    onSuccess: async () => {
      setReply("");
      setFiles(null);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["developer-thread", selected] }),
        queryClient.invalidateQueries({ queryKey: ["developer-helpdesk"] }),
        queryClient.invalidateQueries({ queryKey: ["developer-overview"] }),
      ]);
      toast.success("Resposta enviada.");
    },
    onError: (cause) =>
      toast.error(cause instanceof Error ? cause.message : "Não foi possível responder."),
  });

  const tickets = useMemo(() => {
    if (!data) return [];
    const term = search.trim().toLowerCase();
    return data.tickets.filter(
      (ticket) =>
        (!term ||
          ticket.controlNumber.toLowerCase().includes(term) ||
          ticket.subject.toLowerCase().includes(term) ||
          ticket.organizationName.toLowerCase().includes(term)) &&
        (statusFilter === "open-only"
          ? !["resolved", "closed"].includes(ticket.status)
          : !statusFilter || ticket.status === statusFilter) &&
        (!priorityFilter || ticket.priority === priorityFilter) &&
        (!categoryFilter || ticket.category === categoryFilter) &&
        (!slaFilter || worstSla(ticket) === slaFilter),
    );
  }, [data, search, statusFilter, priorityFilter, categoryFilter, slaFilter]);

  if (isPending) return <p className="p-4 text-muted-foreground">Carregando chamados…</p>;
  if (error || !data) return <Empty>Não foi possível carregar o Help Desk.</Empty>;
  const { kpis } = data;

  return (
    <div className="space-y-6">
      <section
        aria-label="Indicadores do suporte"
        className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"
      >
        <Metric
          title="Abertos"
          value={kpis.open}
          onClick={() => {
            setStatusFilter("open-only");
            setSlaFilter("");
            setPriorityFilter("");
          }}
          hint={`${kpis.waitingUser} aguardando o usuário`}
        />
        <Metric
          title="Urgentes"
          value={kpis.urgent}
          tone={kpis.urgent ? "danger" : "good"}
          onClick={() => {
            setStatusFilter("open-only");
            setPriorityFilter("urgent");
          }}
        />
        <Metric
          title="Prazos vencidos"
          value={kpis.breached}
          tone={kpis.breached ? "danger" : "good"}
          onClick={() => {
            setStatusFilter("open-only");
            setSlaFilter("breached");
          }}
          hint={`${kpis.atRisk} em risco`}
        />
        <Metric
          title="Resolvidos (7 dias)"
          value={kpis.resolvedLast7}
          hint={`1ª resposta ${formatMinutes(kpis.averageFirstResponseMinutes)} · solução ${formatMinutes(kpis.averageResolutionMinutes)}`}
        />
      </section>

      <Panel
        title="Chamados"
        description="Ordenados do mais recente ao mais antigo. Atualiza sozinho a cada 30 s."
        actions={
          <Button variant="outline" size="sm" onClick={() => void refetch()} disabled={isFetching}>
            <RefreshCw className={cn("size-4", isFetching && "animate-spin")} aria-hidden="true" />{" "}
            Atualizar
          </Button>
        }
      >
        <div className="mb-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
          <Input
            aria-label="Buscar chamado"
            placeholder="Nº, assunto ou empresa…"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          <select
            aria-label="Filtrar status"
            className={selectClass}
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
          >
            <option value="open-only">Somente abertos</option>
            <option value="">Todos os status</option>
            {Object.entries(supportStatusLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          <select
            aria-label="Filtrar prioridade"
            className={selectClass}
            value={priorityFilter}
            onChange={(event) => setPriorityFilter(event.target.value)}
          >
            <option value="">Todas as prioridades</option>
            {Object.entries(supportPriorityLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          <select
            aria-label="Filtrar categoria"
            className={selectClass}
            value={categoryFilter}
            onChange={(event) => setCategoryFilter(event.target.value)}
          >
            <option value="">Todas as categorias</option>
            {data.categories.map((category) => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </select>
          <select
            aria-label="Filtrar prazo"
            className={selectClass}
            value={slaFilter}
            onChange={(event) => setSlaFilter(event.target.value)}
          >
            <option value="">Todos os prazos</option>
            <option value="breached">Vencidos</option>
            <option value="at_risk">Se esgotando</option>
            <option value="ok">No prazo</option>
          </select>
        </div>

        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)]">
          <div className="max-h-[70vh] overflow-y-auto rounded-lg border">
            {tickets.length === 0 ? (
              <p className="p-4 text-sm text-muted-foreground">Nenhum chamado neste filtro.</p>
            ) : (
              tickets.map((ticket) => {
                const sla = worstSla(ticket);
                return (
                  <button
                    key={ticket.id}
                    type="button"
                    onClick={() => setSelected(ticket.id)}
                    aria-current={selected === ticket.id}
                    className={cn(
                      "block w-full min-w-0 break-words border-b p-3 text-left last:border-0 hover:bg-accent focus-visible:outline-2 focus-visible:outline-ring",
                      selected === ticket.id && "bg-primary-soft",
                    )}
                  >
                    <span className="flex flex-wrap items-center gap-1.5">
                      <strong className="text-sm">{ticket.controlNumber}</strong>
                      <Badge
                        tone={priorityTone[ticket.priority as keyof typeof priorityTone] ?? "muted"}
                      >
                        {supportPriorityLabels[ticket.priority] ?? ticket.priority}
                      </Badge>
                      {!["resolved", "closed"].includes(ticket.status) &&
                      (sla === "breached" || sla === "at_risk") ? (
                        <Badge tone={slaTone[sla]}>{slaText[sla]}</Badge>
                      ) : null}
                    </span>
                    <span className="mt-1 block text-sm">{ticket.subject}</span>
                    <span className="block text-xs text-muted-foreground">
                      {ticket.organizationName} ·{" "}
                      {supportStatusLabels[ticket.status] ?? ticket.status} ·{" "}
                      {relativeTime(ticket.createdAt)}
                    </span>
                  </button>
                );
              })
            )}
          </div>

          <div className="min-w-0">
            {!selected || !thread ? (
              <Empty>
                {selected
                  ? "Carregando chamado…"
                  : "Selecione um chamado para ver a conversa e responder."}
              </Empty>
            ) : (
              <div className="space-y-3 rounded-lg border p-4">
                <div>
                  <h3 className="break-words font-semibold">{thread.ticket.subject}</h3>
                  <p className="text-xs text-muted-foreground">
                    {thread.ticket.controlNumber} · {thread.ticket.category} ·{" "}
                    {data.tickets.find((ticket) => ticket.id === selected)?.organizationName}
                  </p>
                </div>
                <dl className="grid gap-x-4 gap-y-1 text-sm sm:grid-cols-2">
                  <div>
                    <dt className="inline text-muted-foreground">Prioridade: </dt>
                    <dd className="inline">
                      {supportPriorityLabels[thread.ticket.priority] ?? thread.ticket.priority}
                    </dd>
                  </div>
                  <div>
                    <dt className="inline text-muted-foreground">Status: </dt>
                    <dd className="inline">
                      {supportStatusLabels[thread.ticket.status] ?? thread.ticket.status}
                    </dd>
                  </div>
                  <div>
                    <dt className="inline text-muted-foreground">1ª resposta até: </dt>
                    <dd className="inline">
                      {formatDateTime(String(thread.ticket.firstResponseDueAt))}
                    </dd>
                  </div>
                  <div>
                    <dt className="inline text-muted-foreground">Solução até: </dt>
                    <dd className="inline">
                      {formatDateTime(String(thread.ticket.resolutionDueAt))}
                    </dd>
                  </div>
                  <div>
                    <dt className="inline text-muted-foreground">Respondido em: </dt>
                    <dd className="inline">
                      {thread.ticket.firstRespondedAt
                        ? formatDateTime(String(thread.ticket.firstRespondedAt))
                        : "Pendente"}
                    </dd>
                  </div>
                  <div>
                    <dt className="inline text-muted-foreground">Responsável: </dt>
                    <dd className="inline">{thread.assigneeName ?? "Não atribuído"}</dd>
                  </div>
                </dl>
                <div className="max-h-72 space-y-2 overflow-y-auto">
                  {thread.messages.map((entry) => (
                    <div key={entry.id} className="rounded-lg border p-3 text-sm">
                      <strong>{entry.authorName}</strong>{" "}
                      <span className="text-xs text-muted-foreground">
                        {formatDateTime(String(entry.createdAt))}
                      </span>
                      <p className="mt-1 whitespace-pre-wrap">{entry.body}</p>
                    </div>
                  ))}
                </div>
                {thread.attachments.length ? (
                  <ul className="text-sm">
                    {thread.attachments.map((attachment) => (
                      <li key={attachment.id}>
                        <a className="underline" href={`/api/support-attachments/${attachment.id}`}>
                          {attachment.originalName}
                        </a>
                      </li>
                    ))}
                  </ul>
                ) : null}
                {thread.history.length ? (
                  <details className="text-xs text-muted-foreground">
                    <summary className="cursor-pointer">Histórico de status</summary>
                    <ul className="mt-1 space-y-0.5">
                      {thread.history.map((entry) => (
                        <li key={entry.id}>
                          {formatDateTime(String(entry.createdAt))} · {entry.actorName}:{" "}
                          {supportStatusLabels[entry.toStatus] ?? entry.toStatus}
                        </li>
                      ))}
                    </ul>
                  </details>
                ) : null}
                <form
                  className="space-y-2"
                  onSubmit={(event) => {
                    event.preventDefault();
                    send.mutate();
                  }}
                >
                  <Label htmlFor="helpdesk-reply">Resposta</Label>
                  <textarea
                    id="helpdesk-reply"
                    required
                    value={reply}
                    onChange={(event) => setReply(event.target.value)}
                    className="min-h-24 w-full rounded-md border bg-background p-2 text-sm"
                  />
                  <div className="flex flex-wrap items-center gap-2">
                    <select
                      aria-label="Novo status"
                      value={replyStatus}
                      onChange={(event) => setReplyStatus(event.target.value as ReplyStatus)}
                      className={selectClass}
                    >
                      <option value="open">Aberto</option>
                      <option value="in_progress">Em análise</option>
                      <option value="waiting">Aguardando usuário</option>
                      <option value="resolved">Resolvido</option>
                      <option value="closed">Fechado</option>
                    </select>
                    <Input
                      aria-label="Anexos da resposta"
                      type="file"
                      multiple
                      accept=".pdf,.jpg,.jpeg,.png,.webp"
                      className="max-w-xs"
                      onChange={(event) => setFiles(event.target.files)}
                    />
                    <Button type="submit" disabled={send.isPending}>
                      {send.isPending ? "Enviando..." : "Responder"}
                    </Button>
                  </div>
                </form>
              </div>
            )}
          </div>
        </div>
      </Panel>
    </div>
  );
}

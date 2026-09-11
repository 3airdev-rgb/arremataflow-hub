import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Bell, AlertTriangle, FileCheck, Wallet, Mail, MailOpen } from "lucide-react";
import { AppLayout } from "@/components/app-layout";
import { StatusBadge } from "@/components/status-badge";
import { alertasCriticos, movimentacoesRecentes, projetos } from "@/lib/mock-data";
import { getLocalInvitations } from "@/lib/local-access";

export const Route = createFileRoute("/notificacoes")({
  head: () => ({
    meta: [
      { title: "Notificações | ArremataFlow" },
      {
        name: "description",
        content: "Alertas críticos, prazos vencendo e movimentações recentes da carteira de projetos.",
      },
      { property: "og:title", content: "Notificações | ArremataFlow" },
      { property: "og:description", content: "Central de alertas e avisos do ArremataFlow." },
    ],
  }),
  component: NotificacoesPage,
});

const icones = [AlertTriangle, FileCheck, Wallet];
const READ_ALERTS_KEY = "arremataflow:read-alerts";

function NotificacoesPage() {
  const invitations = getLocalInvitations();
  const [readAlerts, setReadAlerts] = useState<string[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      return JSON.parse(localStorage.getItem(READ_ALERTS_KEY) || "[]") as string[];
    } catch {
      return [];
    }
  });
  const notifications = alertasCriticos
    .map((alert) => ({
      ...alert,
      read: readAlerts.includes(alert.id),
      project: projetos.find((project) => project.codigo === alert.projeto),
    }))
    .sort((a, b) => Number(a.read) - Number(b.read) || Date.parse(b.enviadoEm) - Date.parse(a.enviadoEm));

  const markAsRead = (id: string) => {
    if (readAlerts.includes(id)) return;
    const next = [...readAlerts, id];
    setReadAlerts(next);
    localStorage.setItem(READ_ALERTS_KEY, JSON.stringify(next));
  };

  const formatAlertDate = (value: string) => new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit",
  }).format(new Date(value));

  return (
    <AppLayout title="Notificações" subtitle="Central de alertas e avisos">
      <div className="surface-card mb-5 p-5">
        <div className="mb-4 flex items-center gap-2">
          <Mail className="size-4.5 text-brand" />
          <h3 className="text-base font-semibold">Convites simulados</h3>
        </div>
        {invitations.length > 0 ? (
          <ul className="space-y-3">
            {invitations.map((invite) => (
              <li key={invite.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-4">
                <div>
                  <p className="text-sm font-medium">{invite.nome} foi convidado como {invite.perfil}</p>
                  <p className="text-xs text-muted-foreground">
                    {invite.email}{invite.projectName ? ` · Projeto: ${invite.projectName}` : " · Acesso à plataforma"}
                  </p>
                </div>
                {invite.projectId ? (
                  <Link
                    to="/projetos/$id"
                    params={{ id: invite.projectId }}
                    className="text-sm font-medium text-brand hover:underline"
                  >
                    Abrir projeto
                  </Link>
                ) : (
                  <Link to="/" className="text-sm font-medium text-brand hover:underline">Abrir login</Link>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">Nenhum convite local gerado.</p>
        )}
      </div>
      <div className="grid gap-5 lg:grid-cols-2">
        <div className="surface-card overflow-hidden">
          <div className="mb-4 flex items-center gap-2">
            <Bell className="ml-5 mt-5 size-4.5 text-brand" />
            <h3 className="mt-5 text-base font-semibold">Notificações</h3>
          </div>
          <ul className="divide-y divide-border border-t border-border">
            {notifications.map((notification) => (
              <li key={notification.id}>
                <Link
                  to="/projetos/$id"
                  params={{ id: notification.project?.id || "" }}
                  onClick={() => markAsRead(notification.id)}
                  className={`group block p-4 transition-colors hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand ${notification.read ? "bg-card" : "bg-primary-soft/45"}`}
                  aria-label={`${notification.read ? "Lida" : "Não lida"}: ${notification.texto}. Abrir projeto ${notification.project?.nome || notification.projeto}`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <StatusBadge status={notification.nivel} />
                    <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      {notification.read ? <MailOpen className="size-4" /> : <Mail className="size-4 text-brand" />}
                      {notification.read ? "Lida" : "Não lida"}
                    </span>
                  </div>
                  <p className={`mt-2 text-sm ${notification.read ? "font-normal" : "font-semibold"}`}>{notification.texto}</p>
                  <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                    <span>{notification.project?.nome || "Projeto"} · {notification.projeto}</span>
                    <time dateTime={notification.enviadoEm}>{formatAlertDate(notification.enviadoEm)}</time>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div className="surface-card p-5">
          <div className="mb-4 flex items-center gap-2">
            <Bell className="size-4.5 text-brand" />
            <h3 className="text-base font-semibold">Atividades recentes</h3>
          </div>
          <ul className="space-y-4">
            {movimentacoesRecentes.map((m, i) => {
              const Icon = icones[i % icones.length]!;
              return (
                <li key={m.id} className="flex gap-3">
                  <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary-soft text-brand">
                    <Icon className="size-4" strokeWidth={1.75} />
                  </span>
                  <div>
                    <p className="text-sm">{m.texto}</p>
                    <p className="text-xs text-muted-foreground">
                      {m.projeto} · {m.quando}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </AppLayout>
  );
}

import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, Mail, MailOpen } from "lucide-react";
import { AppLayout } from "@/components/app-layout";
import { listNotifications, markNotificationRead } from "@/lib/tasks";

export const Route = createFileRoute("/notificacoes")({
  head: () => ({
    meta: [
      { title: "Notificações | ArremataFlow" },
      { name: "description", content: "Central de notificações da sua empresa." },
    ],
  }),
  component: NotificacoesPage,
});

function NotificacoesPage() {
  const queryClient = useQueryClient();
  const { data: notifications = [] } = useQuery({
    queryKey: ["notifications"],
    queryFn: () => listNotifications(),
  });
  const formatDate = (value: Date | string) =>
    new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(
      new Date(value),
    );
  const markAsRead = async (id: string, alreadyRead: boolean) => {
    if (alreadyRead) return;
    await markNotificationRead({ data: { id } });
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["notifications"] }),
      queryClient.invalidateQueries({ queryKey: ["unread-notifications"] }),
    ]);
  };

  return (
    <AppLayout title="Notificações" subtitle="Central de alertas e avisos">
      <section className="surface-card overflow-hidden">
        <div className="flex items-center gap-2 border-b border-border p-5">
          <Bell className="size-4.5 text-brand" />
          <h2 className="text-base font-semibold">Suas notificações</h2>
        </div>
        {notifications.length ? (
          <ul className="divide-y divide-border">
            {notifications.map((notification) => (
              <li key={notification.id}>
                <a
                  href={notification.link || "/notificacoes"}
                  onClick={() => void markAsRead(notification.id, notification.read)}
                  className={`group flex gap-3 p-4 transition-colors hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand ${notification.read ? "bg-card" : "bg-primary-soft/45"}`}
                  aria-label={`${notification.read ? "Lida" : "Não lida"}: ${notification.title}`}
                >
                  <span className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-lg bg-background text-brand">
                    {notification.read ? (
                      <MailOpen className="size-4" />
                    ) : (
                      <Mail className="size-4" />
                    )}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className={notification.read ? "text-sm" : "text-sm font-semibold"}>
                        {notification.title}
                      </p>
                      <time
                        className="text-xs text-muted-foreground"
                        dateTime={new Date(notification.createdAt).toISOString()}
                      >
                        {formatDate(notification.createdAt)}
                      </time>
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">{notification.message}</p>
                    {notification.projectName ? (
                      <p className="mt-1 text-xs font-medium text-brand">
                        {notification.projectName}
                        {notification.projectCode ? ` · ${notification.projectCode}` : ""}
                      </p>
                    ) : null}
                  </div>
                </a>
              </li>
            ))}
          </ul>
        ) : (
          <div className="p-10 text-center">
            <Bell className="mx-auto size-8 text-muted-foreground/60" />
            <p className="mt-3 text-sm font-medium">Nenhuma notificação.</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Novas tarefas e avisos aparecerão aqui.
            </p>
          </div>
        )}
      </section>
    </AppLayout>
  );
}

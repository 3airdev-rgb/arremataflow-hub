import { createFileRoute } from "@tanstack/react-router";
import { Bell, AlertTriangle, FileCheck, Wallet } from "lucide-react";
import { AppLayout } from "@/components/app-layout";
import { StatusBadge } from "@/components/status-badge";
import { alertasCriticos, movimentacoesRecentes } from "@/lib/mock-data";

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

function NotificacoesPage() {
  return (
    <AppLayout title="Notificações" subtitle="Central de alertas e avisos">
      <div className="grid gap-5 lg:grid-cols-2">
        <div className="surface-card p-5">
          <div className="mb-4 flex items-center gap-2">
            <AlertTriangle className="size-4.5 text-destructive" />
            <h3 className="text-base font-semibold">Alertas críticos</h3>
          </div>
          <ul className="space-y-3">
            {alertasCriticos.map((a) => (
              <li key={a.id} className="rounded-lg border border-border bg-muted/40 p-4">
                <p className="text-sm font-medium">{a.texto}</p>
                <div className="mt-2 flex items-center gap-2">
                  <StatusBadge status={a.nivel} />
                  <span className="text-xs text-muted-foreground">{a.projeto}</span>
                </div>
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

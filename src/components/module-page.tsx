import type { LucideIcon } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { AppLayout } from "@/components/app-layout";
import { StatusBadge } from "@/components/status-badge";
import { projetos, formatBRL } from "@/lib/mock-data";

export function ModulePage({
  title,
  subtitle,
  icon: Icon,
  campo,
  descricaoModulo,
}: {
  title: string;
  subtitle: string;
  icon: LucideIcon;
  campo: "etapa" | "modalidade" | "responsavel" | "cidade";
  descricaoModulo: string;
}) {
  return (
    <AppLayout title={title} subtitle={subtitle}>
      <div className="surface-card mb-6 flex items-start gap-3 p-5">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary-soft text-brand">
          <Icon className="size-5" strokeWidth={1.75} />
        </span>
        <p className="text-sm text-muted-foreground">{descricaoModulo}</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {projetos.map((p) => (
          <Link
            key={p.id}
            to="/projetos/$id"
            params={{ id: p.id }}
            className="surface-card overflow-hidden transition-shadow hover:shadow-soft"
          >
            <img
              src={p.foto}
              alt={`Imóvel ${p.nome}`}
              loading="lazy"
              className="h-36 w-full object-cover"
            />
            <div className="p-4">
              <p className="text-xs text-muted-foreground">{p.codigo}</p>
              <p className="font-medium">{p.nome}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">{p[campo]}</p>
              <div className="mt-3 flex items-center justify-between">
                <StatusBadge status={p.status} />
                <span className="text-sm font-semibold">{formatBRL(p.capitalInvestido)}</span>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </AppLayout>
  );
}

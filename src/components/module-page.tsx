import type { LucideIcon } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AppLayout } from "@/components/app-layout";
import { AuthenticatedImage } from "@/components/authenticated-image";
import { StatusBadge } from "@/components/status-badge";
import { formatBRL } from "@/lib/format-currency";
import { listProjects } from "@/lib/projects";
import type { StatusKey } from "@/lib/project-display";

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
  const { data: projetos = [], isPending } = useQuery({
    queryKey: ["projects"],
    queryFn: () => listProjects(),
  });

  return (
    <AppLayout title={title} subtitle={subtitle}>
      <div className="surface-card mb-6 flex items-start gap-3 p-5">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary-soft text-brand">
          <Icon className="size-5" strokeWidth={1.75} />
        </span>
        <p className="text-sm text-muted-foreground">{descricaoModulo}</p>
      </div>

      {isPending ? <p className="text-sm text-muted-foreground">Carregando projetos...</p> : null}
      {!isPending && projetos.length === 0 ? (
        <div className="surface-card p-8 text-center text-sm text-muted-foreground">
          Nenhum projeto cadastrado nesta empresa.
        </div>
      ) : null}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {projetos.map((p) => (
          <Link
            key={p.id}
            to="/projetos/$id"
            params={{ id: p.id }}
            className="surface-card overflow-hidden transition-shadow hover:shadow-soft"
          >
            {p.foto ? (
              <AuthenticatedImage
                src={p.foto}
                alt={`Imóvel ${p.nome}`}
                loading="lazy"
                className="h-36 w-full object-cover"
              />
            ) : (
              <div className="h-36 bg-muted" />
            )}
            <div className="p-4">
              <p className="text-xs text-muted-foreground">{p.codigo}</p>
              <p className="font-medium">{p.nome}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">{p[campo]}</p>
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                <StatusBadge status={p.status as StatusKey} />
                <span className="text-sm whitespace-nowrap font-semibold">
                  {formatBRL(Number(p.capitalInvestido) || 0)}
                </span>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </AppLayout>
  );
}

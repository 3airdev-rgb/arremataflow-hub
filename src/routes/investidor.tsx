import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AppLayout } from "@/components/app-layout";
import { StatusBadge } from "@/components/status-badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { listParticipantProjects } from "@/lib/projects";

export const Route = createFileRoute("/investidor")({
  head: () => ({
    meta: [
      { title: "Portal do Investidor | ArremataFlow" },
      {
        name: "description",
        content:
          "Acompanhe seus projetos, andamento das etapas, posição financeira e documentos autorizados.",
      },
      { property: "og:title", content: "Portal do Investidor | ArremataFlow" },
      { property: "og:description", content: "Transparência total sobre seus investimentos imobiliários." },
    ],
  }),
  component: PortalInvestidor,
});

function PortalInvestidor() {
  const { data: meus = [], isPending } = useQuery({
    queryKey: ["participant-projects", "investor"],
    queryFn: () => listParticipantProjects({ data: { role: "investor" } }),
  });
  const [statusFilter, setStatusFilter] = useState("todos");
  const statusOrder: Record<string, number> = {
    atrasado: 1,
    pendente: 2,
    aguardando: 3,
    andamento: 4,
    concluido: 5,
    nao_iniciado: 6,
  };
  const projetosVisiveis = [...meus]
    .filter((project) => statusFilter === "todos" || project.status === statusFilter)
    .sort((a, b) => (statusOrder[a.status] || 99) - (statusOrder[b.status] || 99));
  return (
    <AppLayout title="Portal do Investidor" subtitle={`${meus.length} projeto(s) disponível(is)`}>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold">Projetos vinculados</h3>
          <p className="text-sm text-muted-foreground">Ordenados por prioridade de situação.</p>
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-56" aria-label="Filtrar projetos por status">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os status</SelectItem>
            <SelectItem value="atrasado">Atrasado</SelectItem>
            <SelectItem value="pendente">Pendente</SelectItem>
            <SelectItem value="aguardando">Aguardando terceiro</SelectItem>
            <SelectItem value="andamento">Em andamento</SelectItem>
            <SelectItem value="concluido">Concluído</SelectItem>
            <SelectItem value="nao_iniciado">Não iniciado</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-5 md:grid-cols-2">
        {projetosVisiveis.map((project) => (
          <Link
            key={project.id}
            to="/projetos/$id"
            params={{ id: project.id }}
            className="surface-card block overflow-hidden transition-shadow hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
            aria-label={`Visualizar projeto ${project.nome}`}
          >
            <img
              src={project.foto}
              alt={`Foto do imóvel ${project.nome}`}
              className="h-48 w-full object-cover"
            />
            <div className="p-5">
              <h2 className="text-xl">{project.nome}</h2>
              <p className="text-sm text-muted-foreground">
                {project.endereco} — {project.cidade}
              </p>
              <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                <StatusBadge status={project.status} />
                <p className="text-xs text-muted-foreground">
                  Etapa atual: <span className="font-medium text-foreground">{project.etapa}</span>
                </p>
              </div>
              <div className="mt-4">
                <div className="mb-1 flex justify-between text-xs text-muted-foreground">
                  <span>Evolução do projeto</span>
                  <span>{project.progresso}%</span>
                </div>
                <div className="relative h-2.5 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuenow={project.progresso} aria-valuemin={0} aria-valuemax={100}>
                  <div
                    className="absolute inset-0 rounded-full transition-[clip-path]"
                    style={{
                      background: "linear-gradient(90deg, #ef1b1b 0%, #ff6814 30%, #ffc400 58%, #08b85a 100%)",
                      clipPath: `inset(0 ${100 - Math.min(Math.max(project.progresso, 0), 100)}% 0 0)`,
                    }}
                  />
                </div>
              </div>
              <div className="mt-5 grid gap-4 sm:grid-cols-3">
                <div className="rounded-lg bg-muted p-3">
                  <p className="text-xs text-muted-foreground">Capital investido</p>
                  <p className="font-semibold">{formatBRL(project.capitalInvestido)}</p>
                </div>
                <div className="rounded-lg bg-primary-soft p-3">
                  <p className="text-xs text-brand">Resultado projetado</p>
                  <p className="font-semibold text-brand">{formatBRL(project.resultadoProjetado)}</p>
                </div>
                <div className="rounded-lg bg-success-soft p-3">
                  <p className="text-xs text-success">Minha cota</p>
                  <p className="font-semibold text-success">{project.participationPercentage == null ? "—" : `${project.participationPercentage}%`}</p>
                </div>
              </div>
            </div>
          </Link>
        ))}
      </div>

      {!isPending && projetosVisiveis.length === 0 ? (
        <div className="surface-card mt-5 p-8 text-center text-sm text-muted-foreground">
          Nenhum projeto encontrado para o status selecionado.
        </div>
      ) : null}

    </AppLayout>
  );
}

const formatBRL = (value: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value || 0);

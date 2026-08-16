import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Plus, Search } from "lucide-react";
import { AppLayout } from "@/components/app-layout";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { projetos, formatBRL } from "@/lib/mock-data";

export const Route = createFileRoute("/projetos/")({
  head: () => ({
    meta: [
      { title: "Projetos | ArremataFlow" },
      {
        name: "description",
        content:
          "Liste, busque e acompanhe todos os projetos imobiliários da empresa por etapa, responsável e status.",
      },
      { property: "og:title", content: "Gestão de Projetos | ArremataFlow" },
      {
        property: "og:description",
        content: "Todos os projetos pós-arrematação em uma tabela moderna com busca e filtros.",
      },
    ],
  }),
  component: ProjetosPage,
});

function ProjetosPage() {
  const [q, setQ] = useState("");
  const lista = projetos.filter((p) =>
    `${p.nome} ${p.endereco} ${p.codigo}`.toLowerCase().includes(q.toLowerCase()),
  );

  return (
    <AppLayout
      title="Gestão de Projetos"
      subtitle={`${projetos.length} projetos cadastrados`}
      actions={
        <Button asChild>
          <Link to="/projetos/novo">
            <Plus className="size-4" /> Novo projeto
          </Link>
        </Button>
      }
    >
      <div className="surface-card overflow-hidden">
        <div className="border-b border-border p-4">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar por nome, código ou endereço"
              className="pl-9"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/60 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">Projeto</th>
                <th className="px-4 py-3 font-medium">Etapa</th>
                <th className="px-4 py-3 font-medium">Responsável</th>
                <th className="px-4 py-3 font-medium">Capital</th>
                <th className="px-4 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {lista.map((p) => (
                <tr key={p.id} className="border-t border-border transition-colors hover:bg-muted/40">
                  <td className="px-4 py-3">
                    <Link
                      to="/projetos/$id"
                      params={{ id: p.id }}
                      className="flex items-center gap-3"
                    >
                      <img
                        src={p.foto}
                        alt={`Fachada do imóvel ${p.nome}`}
                        loading="lazy"
                        className="size-10 rounded-lg object-cover"
                      />
                      <span className="block">
                        <span className="block font-medium text-foreground hover:text-brand">
                          {p.nome}
                        </span>
                        <span className="block text-xs text-muted-foreground">
                          {p.codigo} · {p.endereco}
                        </span>
                      </span>
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{p.etapa}</td>
                  <td className="px-4 py-3 text-muted-foreground">{p.responsavel}</td>
                  <td className="px-4 py-3 font-medium">{formatBRL(p.capitalInvestido)}</td>
                  <td className="px-4 py-3">
                    <StatusBadge status={p.status} />
                  </td>
                </tr>
              ))}
              {lista.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-muted-foreground">
                    Nenhum projeto encontrado.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </AppLayout>
  );
}

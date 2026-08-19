import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState, useMemo } from "react";
import { Plus, Search, X } from "lucide-react";
import { AppLayout } from "@/components/app-layout";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { projetos, formatBRL, statusLabels, type StatusKey } from "@/lib/mock-data";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

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
  const [etapaFilter, setEtapaFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [salvos, setSalvos] = useState<Tables<"projetos">[]>([]);

  useEffect(() => {
    let ativo = true;
    (async () => {
      const { data: sessao } = await supabase.auth.getSession();
      if (!sessao.session) return;
      const { data } = await supabase
        .from("projetos")
        .select("*")
        .order("created_at", { ascending: false });
      if (ativo && data) setSalvos(data);
    })();
    return () => {
      ativo = false;
    };
  }, []);

  const todasEtapas = useMemo(() => {
    const etapas = new Set(projetos.map((p) => p.etapa));
    salvos.forEach((p) => {
      if (p.modalidade) etapas.add(p.modalidade);
    });
    return Array.from(etapas).sort();
  }, [salvos]);

  const listaFiltrada = useMemo(() => {
    return projetos.filter((p) => {
      const matchesSearch = `${p.nome} ${p.endereco} ${p.codigo}`
        .toLowerCase()
        .includes(q.toLowerCase());
      const matchesEtapa = etapaFilter === "all" || p.etapa === etapaFilter;
      const matchesStatus = statusFilter === "all" || p.status === statusFilter;
      return matchesSearch && matchesEtapa && matchesStatus;
    });
  }, [q, etapaFilter, statusFilter]);

  const salvosFiltrados = useMemo(() => {
    return salvos.filter((p) => {
      const matchesSearch = `${p.nome} ${p.endereco}`
        .toLowerCase()
        .includes(q.toLowerCase());
      const matchesEtapa = etapaFilter === "all" || p.modalidade === etapaFilter;
      const matchesStatus = statusFilter === "all" || p.modalidade === statusFilter; // Note: projects table might not have status yet, using modalidade as proxy or just all
      return matchesSearch && matchesEtapa;
    });
  }, [q, etapaFilter, salvos]);

  const clearFilters = () => {
    setQ("");
    setEtapaFilter("all");
    setStatusFilter("all");
  };

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
      {salvosFiltrados.length > 0 ? (
        <div className="surface-card mb-6 overflow-hidden">
          <div className="border-b border-border p-4">
            <h2 className="text-sm font-semibold">Projetos salvos no banco</h2>
            <p className="text-xs text-muted-foreground">
              {salvosFiltrados.length} registro(s) filtrado(s) da sua conta
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/60 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 font-medium text-[11px]">Projeto</th>
                  <th className="px-4 py-3 font-medium text-[11px]">Leiloeiro</th>
                  <th className="px-4 py-3 font-medium text-[11px]">Aquisição</th>
                  <th className="px-4 py-3 font-medium text-[11px]">Comissão</th>
                  <th className="px-4 py-3 font-medium text-[11px]">Parcelas</th>
                </tr>
              </thead>
              <tbody>
                {salvosFiltrados.map((p) => (
                  <tr key={p.id} className="border-t border-border">
                    <td className="px-4 py-3 font-medium">
                      <Link
                        to="/projetos/$id"
                        params={{ id: p.id }}
                        className="flex items-center gap-3"
                      >
                        {p.foto_principal ? (
                          <img
                            src={p.foto_principal}
                            alt={`Fachada do imóvel ${p.nome}`}
                            loading="lazy"
                            className="size-10 rounded-lg object-cover"
                          />
                        ) : (
                          <div className="size-10 rounded-lg bg-muted flex items-center justify-center">
                            <Plus className="size-4 text-muted-foreground" />
                          </div>
                        )}
                        <span className="block">
                          <span className="block font-medium text-foreground hover:text-brand">
                            {p.nome}
                          </span>
                          <span className="block text-xs text-muted-foreground">
                            {p.cidade}
                          </span>
                        </span>
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{p.leiloeiro_nome ?? "—"}</td>
                    <td className="px-4 py-3">{formatBRL(Number(p.valor_aquisicao))}</td>
                    <td className="px-4 py-3">
                      {Number(p.percentual_comissao)}% · {formatBRL(Number(p.valor_comissao))}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {p.quantidade_parcelas > 1
                        ? `${p.quantidade_parcelas}x ${formatBRL(Number(p.valor_parcela))}`
                        : "À vista"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      <div className="surface-card overflow-hidden">
        <div className="border-b border-border p-4 flex flex-col md:flex-row md:items-center gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar por nome, código ou endereço"
              className="pl-9"
            />
          </div>
          
          <div className="flex flex-wrap items-center gap-2">
            <Select value={etapaFilter} onValueChange={setEtapaFilter}>
              <SelectTrigger className="w-[160px] h-9">
                <SelectValue placeholder="Filtrar por Etapa" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as Etapas</SelectItem>
                {todasEtapas.map((etapa) => (
                  <SelectItem key={etapa} value={etapa}>
                    {etapa}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[160px] h-9">
                <SelectValue placeholder="Filtrar por Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os Status</SelectItem>
                {(Object.entries(statusLabels) as [StatusKey, string][]).map(([key, label]) => (
                  <SelectItem key={key} value={key}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {(q !== "" || etapaFilter !== "all" || statusFilter !== "all") && (
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={clearFilters}
                className="text-muted-foreground hover:text-foreground h-9"
              >
                <X className="size-4 mr-2" />
                Limpar
              </Button>
            )}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/60 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium text-[11px]">Projeto</th>
                <th className="px-4 py-3 font-medium text-[11px]">Etapa</th>
                <th className="px-4 py-3 font-medium text-[11px]">Responsável</th>
                <th className="px-4 py-3 font-medium text-[11px]">Investidores</th>
                <th className="px-4 py-3 font-medium text-[11px]">Status</th>
              </tr>
            </thead>
            <tbody>
              {listaFiltrada.map((p) => (
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
                  <td className="px-4 py-3 text-muted-foreground">
                    {p.investidores.map((inv, idx) => (
                      <span key={idx} className="block">
                        {inv}
                      </span>
                    ))}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={p.status} />
                  </td>
                </tr>
              ))}
              {listaFiltrada.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-muted-foreground">
                    Nenhum projeto encontrado para os filtros selecionados.
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

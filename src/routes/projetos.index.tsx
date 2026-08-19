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
import { projetos, formatBRL, statusLabels, statusPriority, type StatusKey } from "@/lib/mock-data";
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

type UnifiedProject = {
  id: string;
  codigo: string;
  nome: string;
  endereco: string;
  cidade: string;
  etapa: string;
  status: StatusKey;
  responsavel: string;
  investidores: string[];
  foto: string | null;
  updated_at: string;
  isReal: boolean;
};

function ProjetosPage() {
  const [q, setQ] = useState("");
  const [etapaFilter, setEtapaFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [salvos, setSalvos] = useState<(Tables<"projetos"> & { 
    projeto_participantes: Tables<"projeto_participantes">[],
    project_managers: (Tables<"project_managers"> & { pessoas: Tables<"pessoas"> })[]
  })[]>([]);

  useEffect(() => {
    let ativo = true;
    (async () => {
      const { data: sessao } = await supabase.auth.getSession();
      if (!sessao.session) return;
      
      const { data, error } = await supabase
        .from("projetos")
        .select(`
          *,
          projeto_participantes (*),
          project_managers (*, pessoas (*))
        `);
        
      if (ativo && data) {
        setSalvos(data as any);
      }
    })();
    return () => {
      ativo = false;
    };
  }, []);

  const unifiedProjects = useMemo(() => {
    const realProjects: UnifiedProject[] = salvos.map(p => ({
      id: p.id,
      codigo: p.codigo || "S/C",
      nome: p.nome || "Sem nome",
      endereco: p.endereco || "Sem endereço",
      cidade: p.cidade || "",
      etapa: p.modalidade || "Não definida",
      status: (p.status as StatusKey) || "nao_iniciado",
      responsavel: p.project_managers?.[0]?.pessoas?.nome || "Não atribuído",
      investidores: p.projeto_participantes
        ?.filter(part => part.papel === "Investidor")
        .map(part => part.nome) || [],
      foto: p.foto_principal,
      updated_at: p.updated_at,
      isReal: true
    }));

    const mockProjects: UnifiedProject[] = projetos.map(p => ({
      id: p.id,
      codigo: p.codigo,
      nome: p.nome,
      endereco: p.endereco,
      cidade: p.cidade,
      etapa: p.etapa,
      status: p.status,
      responsavel: p.responsavel,
      investidores: p.investidores,
      foto: p.foto,
      updated_at: p.updated_at,
      isReal: false
    }));

    return [...realProjects, ...mockProjects];
  }, [salvos]);

  const sortedAndFiltrada = useMemo(() => {
    return unifiedProjects
      .filter((p) => {
        const matchesSearch = `${p.nome} ${p.endereco} ${p.codigo}`
          .toLowerCase()
          .includes(q.toLowerCase());
        const matchesEtapa = etapaFilter === "all" || p.etapa === etapaFilter;
        const matchesStatus = statusFilter === "all" || p.status === statusFilter;
        return matchesSearch && matchesEtapa && matchesStatus;
      })
      .sort((a, b) => {
        // Priority order: Atrasado, Pendente, Aguardando, Andamento, Não Iniciado, Concluído
        const pA = statusPriority[a.status] || 99;
        const pB = statusPriority[b.status] || 99;
        
        if (pA !== pB) return pA - pB;
        
        // Secondary: updated_at (newest first)
        const dateA = new Date(a.updated_at).getTime();
        const dateB = new Date(b.updated_at).getTime();
        if (dateB !== dateA) return dateB - dateA;
        
        // Tertiary: code ascending
        return a.codigo.localeCompare(b.codigo);
      });
  }, [unifiedProjects, q, etapaFilter, statusFilter]);

  const todasEtapas = useMemo(() => {
    const etapas = new Set(unifiedProjects.map((p) => p.etapa));
    return Array.from(etapas).sort();
  }, [unifiedProjects]);

  const clearFilters = () => {
    setQ("");
    setEtapaFilter("all");
    setStatusFilter("all");
  };

  return (
    <AppLayout
      title="Gestão de Projetos"
      subtitle={`${unifiedProjects.length} projetos no total`}
      actions={
        <Button asChild>
          <Link to="/projetos/novo">
            <Plus className="size-4" /> Novo projeto
          </Link>
        </Button>
      }
    >
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
              {sortedAndFiltrada.map((p) => (
                <tr key={`${p.isReal ? 'real' : 'mock'}-${p.id}`} className="border-t border-border transition-colors hover:bg-muted/40">
                  <td className="px-4 py-3">
                    <Link
                      to="/projetos/$id"
                      params={{ id: p.id }}
                      className="flex items-center gap-3"
                    >
                      {p.foto ? (
                        <img
                          src={p.foto}
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
              {sortedAndFiltrada.length === 0 ? (
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

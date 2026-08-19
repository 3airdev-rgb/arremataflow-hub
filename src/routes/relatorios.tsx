import { createFileRoute } from "@tanstack/react-router";
import { AppLayout } from "@/components/app-layout";
import { 
  FileBarChart, 
  Search, 
  Filter, 
  FileText, 
  FileSpreadsheet, 
  ChevronRight,
  Calculator,
  Briefcase,
  History,
  ClipboardList,
  FolderOpen,
  Database
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/relatorios")({
  component: Relatorios,
});

const categoriasRelatorios = [
  {
    titulo: "Financeiro",
    icon: Calculator,
    cor: "text-blue-600",
    bg: "bg-blue-50",
    itens: [
      "Receitas por período",
      "Despesas por período",
      "Fluxo de caixa",
      "Honorários",
      "Distribuição de resultados",
      "Capital investido por projeto",
    ],
  },
  {
    titulo: "Operacional",
    icon: Briefcase,
    cor: "text-green-600",
    bg: "bg-green-50",
    itens: [
      "Relatório de Atividades",
      "Relatório de Tarefas",
      "Projetos em andamento",
      "Projetos encerrados",
      "Projetos por modalidade",
      "Projetos por status",
    ],
  },
  {
    titulo: "Auditoria",
    icon: History,
    cor: "text-orange-600",
    bg: "bg-orange-50",
    itens: [
      "Histórico de Ações",
      "Alterações Financeiras",
      "Alterações de Percentuais",
      "Log de Auditoria",
    ],
  },
  {
    titulo: "Contratos",
    icon: FileText,
    cor: "text-purple-600",
    bg: "bg-purple-50",
    itens: [
      "Contrato de Assessoria",
      "Contrato de Investimento",
      "Termos e documentos vinculados",
    ],
  },
  {
    titulo: "Cadastros",
    icon: Database,
    cor: "text-cyan-600",
    bg: "bg-cyan-50",
    itens: ["Usuários", "Investidores", "Assessores", "Projetos"],
  },
  {
    titulo: "Documentos",
    icon: FolderOpen,
    cor: "text-indigo-600",
    bg: "bg-indigo-50",
    itens: [
      "Relação de documentos",
      "Documentos pendentes",
      "Documentos vencidos",
      "Documentos por categoria",
    ],
  },
];

function Relatorios() {
  const [searchTerm, setSearchTerm] = useState("");

  const handleAction = (relatorio: string, type: "view" | "pdf" | "excel") => {
    const messages = {
      view: `Visualizando: ${relatorio}`,
      pdf: `Exportando PDF: ${relatorio}`,
      excel: `Exportando Excel: ${relatorio}`,
    };
    toast.info(messages[type]);
  };

  return (
    <AppLayout title="Relatórios" subtitle="Gestão analítica e exportação de dados do sistema">
      <div className="space-y-6">
        {/* Filtros Superiores */}
        <div className="surface-card p-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            <div className="md:col-span-2 xl:col-span-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Buscar relatório..."
                  className="pl-9"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>

            <Select>
              <SelectTrigger>
                <SelectValue placeholder="Categoria" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                {categoriasRelatorios.map((c) => (
                  <SelectItem key={c.titulo} value={c.titulo}>
                    {c.titulo}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select>
              <SelectTrigger>
                <SelectValue placeholder="Período" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="month">Este mês</SelectItem>
                <SelectItem value="quarter">Este trimestre</SelectItem>
                <SelectItem value="year">Este ano</SelectItem>
                <SelectItem value="custom">Personalizado</SelectItem>
              </SelectContent>
            </Select>

            <Select>
              <SelectTrigger>
                <SelectValue placeholder="Projeto" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os Projetos</SelectItem>
              </SelectContent>
            </Select>

            <Select>
              <SelectTrigger>
                <SelectValue placeholder="Participante" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os Participantes</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Grade de Relatórios */}
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {categoriasRelatorios.map((cat) => (
            <div key={cat.titulo} className="surface-card flex flex-col overflow-hidden">
              <div className="flex items-center gap-3 border-b border-border bg-muted/30 px-4 py-3">
                <div className={`rounded-lg p-2 ${cat.bg}`}>
                  <cat.icon className={`size-5 ${cat.cor}`} />
                </div>
                <h3 className="text-base font-semibold">{cat.titulo}</h3>
              </div>
              <div className="flex-1 divide-y divide-border/50">
                {cat.itens
                  .filter((item) =>
                    item.toLowerCase().includes(searchTerm.toLowerCase())
                  )
                  .map((item) => (
                    <div
                      key={item}
                      className="group flex flex-col gap-3 px-4 py-3 hover:bg-muted/30"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-foreground/80 group-hover:text-brand">
                          {item}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 opacity-0 transition-opacity group-hover:opacity-100">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2 text-xs"
                          onClick={() => handleAction(item, "view")}
                        >
                          <FileText className="mr-1 size-3" />
                          Visualizar
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2 text-xs"
                          onClick={() => handleAction(item, "pdf")}
                        >
                          <FileText className="mr-1 size-3" />
                          PDF
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2 text-xs"
                          onClick={() => handleAction(item, "excel")}
                        >
                          <FileSpreadsheet className="mr-1 size-3" />
                          Excel
                        </Button>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </AppLayout>
  );
}

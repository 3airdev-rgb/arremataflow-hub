import { createFileRoute } from "@tanstack/react-router";
import { AppLayout } from "@/components/app-layout";
import { 
  FileBarChart, 
  Filter, 
  FileText, 
  FileSpreadsheet, 
  ChevronRight,
  Calculator,
  Briefcase,
  History,
  ClipboardList,
  FolderOpen,
  Database,
  ChevronsUpDown,
  Check,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { DatePickerField } from "@/components/ui/date-picker-field";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useState } from "react";
import { toast } from "sonner";
import { formatBRL, projetos } from "@/lib/mock-data";
import { cn } from "@/lib/utils";
import { logProjectAudit } from "@/lib/local-project-audit";

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

const receitasSimuladas: Array<{
  id: string;
  data: string;
  projeto: string;
  codigo: string;
  categoria: string;
  descricao: string;
  valor: number;
}> = [];

function Relatorios() {
  const [receitasOpen, setReceitasOpen] = useState(false);
  const [projectPickerOpen, setProjectPickerOpen] = useState(false);
  const [todosProjetos, setTodosProjetos] = useState(true);
  const [projetoSelecionado, setProjetoSelecionado] = useState("");
  const [situacao, setSituacao] = useState("ativos");
  const [periodo, setPeriodo] = useState("year");
  const [dataInicial, setDataInicial] = useState("2026-01-01");
  const [dataFinal, setDataFinal] = useState("2026-08-28");
  const projetosPorSituacao = projetos.filter((projeto) => situacao === "todos"
    || (situacao === "concluidos" ? projeto.status === "concluido" : !["concluido", "nao_iniciado"].includes(projeto.status)));
  const receitasFiltradas = receitasSimuladas.filter((receita) => {
    const projeto = projetos.find((item) => item.codigo === receita.codigo);
    const atendeProjeto = todosProjetos || receita.codigo === projetoSelecionado;
    const atendeSituacao = situacao === "todos"
      || (situacao === "concluidos" ? projeto?.status === "concluido" : projeto && !["concluido", "nao_iniciado"].includes(projeto.status));
    return atendeProjeto && Boolean(atendeSituacao) && receita.data >= dataInicial && receita.data <= dataFinal;
  });
  const totalReceitas = receitasFiltradas.reduce((total, receita) => total + receita.valor, 0);

  const aplicarPeriodo = (value: string) => {
    setPeriodo(value);
    if (value === "custom") return;
    const hoje = new Date();
    const final = hoje.toISOString().slice(0, 10);
    const inicio = value === "month"
      ? new Date(hoje.getFullYear(), hoje.getMonth(), 1)
      : value === "quarter"
        ? new Date(hoje.getFullYear(), Math.floor(hoje.getMonth() / 3) * 3, 1)
        : new Date(hoje.getFullYear(), 0, 1);
    setDataInicial(inicio.toISOString().slice(0, 10));
    setDataFinal(final);
  };

  const alterarDataInicial = (value: string) => {
    if (dataFinal && value > dataFinal) {
      toast.error("A data inicial não pode ser posterior à data final.");
      return;
    }
    setDataInicial(value);
  };

  const alterarDataFinal = (value: string) => {
    if (dataInicial && value < dataInicial) {
      toast.error("A data final não pode ser anterior à data inicial.");
      return;
    }
    setDataFinal(value);
  };

  const handleAction = (relatorio: string, type: "view" | "pdf" | "excel") => {
    const affectedProjects = todosProjetos
      ? projetosPorSituacao
      : projetos.filter((project) => project.codigo === projetoSelecionado);
    const actionLabel = type === "view"
      ? `visualizou o relatório “${relatorio}”`
      : `emitiu o relatório “${relatorio}” em ${type.toUpperCase()}`;
    affectedProjects.forEach((project) => logProjectAudit(project.id, actionLabel, "Relatório"));

    if (relatorio === "Receitas por período" && type === "view") {
      setReceitasOpen(true);
      return;
    }
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
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div className="space-y-2 lg:col-span-2">
              <label className="text-sm font-medium">Projeto</label>
              <div className="flex items-center gap-3">
                <Popover open={projectPickerOpen} onOpenChange={setProjectPickerOpen}>
                  <PopoverTrigger asChild>
                    <Button variant="outline" role="combobox" disabled={todosProjetos} className="min-w-0 flex-1 justify-between font-normal">
                      <span className="truncate">{projetoSelecionado ? projetos.find((projeto) => projeto.codigo === projetoSelecionado)?.nome : "Buscar projeto..."}</span>
                      <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                    <Command>
                      <CommandInput placeholder="Digite o nome do projeto..." />
                      <CommandList><CommandEmpty>Nenhum projeto encontrado.</CommandEmpty><CommandGroup>
                        {projetosPorSituacao.map((projeto) => <CommandItem key={projeto.id} value={`${projeto.nome} ${projeto.codigo}`} onSelect={() => { setProjetoSelecionado(projeto.codigo); setProjectPickerOpen(false); }}>
                          <Check className={cn("mr-2 size-4", projetoSelecionado === projeto.codigo ? "opacity-100" : "opacity-0")} />
                          <span>{projeto.nome}</span><span className="ml-auto text-xs text-muted-foreground">{projeto.codigo}</span>
                        </CommandItem>)}
                      </CommandGroup></CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
                <label className="flex shrink-0 items-center gap-2 text-sm"><Checkbox checked={todosProjetos} onCheckedChange={(checked) => setTodosProjetos(checked === true)} />Todos</label>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Situação</label>
              <Select value={situacao} onValueChange={(value) => { setSituacao(value); setProjetoSelecionado(""); }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="ativos">Ativos</SelectItem><SelectItem value="concluidos">Concluídos</SelectItem><SelectItem value="todos">Todos</SelectItem></SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Período</label>
              <Select value={periodo} onValueChange={aplicarPeriodo}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="month">Este mês</SelectItem><SelectItem value="quarter">Este trimestre</SelectItem><SelectItem value="year">Este ano</SelectItem><SelectItem value="custom">Personalizado</SelectItem></SelectContent>
              </Select>
            </div>

            {periodo === "custom" ? <div className="grid gap-4 border-t border-border pt-4 sm:grid-cols-2 lg:col-span-2">
              <div className="space-y-2"><label className="text-sm font-medium">Data inicial</label><DatePickerField value={dataInicial} max={dataFinal} aria-label="Data inicial" onValueChange={alterarDataInicial} /></div>
              <div className="space-y-2"><label className="text-sm font-medium">Data final</label><DatePickerField value={dataFinal} min={dataInicial} aria-label="Data final" onValueChange={alterarDataFinal} /></div>
            </div> : null}
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
                {cat.itens.map((item) => (
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

      <Dialog open={receitasOpen} onOpenChange={setReceitasOpen}>
        <DialogContent className="max-h-[90vh] max-w-5xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Relatório de Receitas por Período</DialogTitle>
            <DialogDescription>Simulação consolidada das receitas registradas nos projetos.</DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 border-y border-border py-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label htmlFor="receitas-data-inicial" className="text-sm font-medium">Data inicial</label>
              <DatePickerField value={dataInicial} max={dataFinal} aria-label="Data inicial" onValueChange={setDataInicial} />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="receitas-data-final" className="text-sm font-medium">Data final</label>
              <DatePickerField value={dataFinal} min={dataInicial} aria-label="Data final" onValueChange={setDataFinal} />
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-lg bg-success-soft p-4"><p className="text-xs text-success">Total de receitas</p><p className="mt-1 text-xl font-semibold text-success">{formatBRL(totalReceitas)}</p></div>
            <div className="rounded-lg bg-muted p-4"><p className="text-xs text-muted-foreground">Lançamentos</p><p className="mt-1 text-xl font-semibold">{receitasFiltradas.length}</p></div>
            <div className="rounded-lg bg-primary-soft p-4"><p className="text-xs text-brand">Média por lançamento</p><p className="mt-1 text-xl font-semibold text-brand">{formatBRL(receitasFiltradas.length ? totalReceitas / receitasFiltradas.length : 0)}</p></div>
          </div>

          <div className="overflow-hidden rounded-lg border border-border">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/60 text-left text-xs uppercase text-muted-foreground">
                  <tr><th className="px-4 py-3">Data</th><th className="px-4 py-3">Projeto</th><th className="px-4 py-3">Categoria</th><th className="px-4 py-3">Descrição</th><th className="px-4 py-3 text-right">Valor</th></tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {receitasFiltradas.map((receita) => (
                    <tr key={receita.id}>
                      <td className="whitespace-nowrap px-4 py-3">{new Date(`${receita.data}T12:00:00`).toLocaleDateString("pt-BR")}</td>
                      <td className="px-4 py-3"><p className="font-medium">{receita.projeto}</p><p className="text-xs text-muted-foreground">{receita.codigo}</p></td>
                      <td className="px-4 py-3">{receita.categoria}</td>
                      <td className="px-4 py-3 text-muted-foreground">{receita.descricao}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-right font-semibold text-success">{formatBRL(receita.valor)}</td>
                    </tr>
                  ))}
                  {receitasFiltradas.length === 0 ? <tr><td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">Nenhuma receita encontrada no período selecionado.</td></tr> : null}
                </tbody>
                <tfoot className="border-t-2 border-border bg-success-soft/50 font-semibold"><tr><td colSpan={4} className="px-4 py-3">Total do período</td><td className="px-4 py-3 text-right text-success">{formatBRL(totalReceitas)}</td></tr></tfoot>
              </table>
            </div>
          </div>

          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="outline" onClick={() => handleAction("Receitas por período", "pdf")}><FileText className="mr-2 size-4" />Gerar PDF</Button>
            <Button variant="outline" onClick={() => handleAction("Receitas por período", "excel")}><FileSpreadsheet className="mr-2 size-4" />Exportar Excel</Button>
          </div>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}

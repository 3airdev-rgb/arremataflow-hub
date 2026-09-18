import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Calculator, Briefcase, History, FileText, Database, FolderOpen, FileSpreadsheet, Eye, Printer } from "lucide-react";
import { toast } from "sonner";
import { AppLayout } from "@/components/app-layout";
import { Button } from "@/components/ui/button";
import { DatePickerField } from "@/components/ui/date-picker-field";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { generateReport, listReportHistory, listReportProjects, reportKeys } from "@/lib/reports";

export const Route = createFileRoute("/relatorios")({ component: Relatorios });
type ReportKey = (typeof reportKeys)[number];
type Result = Awaited<ReturnType<typeof generateReport>>;

const categories: Array<{ title: string; icon: typeof Calculator; tone: string; items: Array<[ReportKey, string]> }> = [
  { title: "Financeiro", icon: Calculator, tone: "text-blue-600 bg-blue-50", items: [["revenues", "Receitas por período"], ["expenses", "Despesas por período"], ["cash_flow", "Fluxo de caixa"], ["invested_capital", "Capital investido por projeto"]] },
  { title: "Operacional", icon: Briefcase, tone: "text-green-600 bg-green-50", items: [["tasks", "Relatório de tarefas"], ["active_projects", "Projetos em andamento"], ["completed_projects", "Projetos encerrados"], ["projects_by_status", "Projetos por status"], ["projects_by_modality", "Projetos por modalidade"]] },
  { title: "Auditoria", icon: History, tone: "text-orange-600 bg-orange-50", items: [["audit", "Histórico de ações"], ["financial_changes", "Alterações financeiras"]] },
  { title: "Contratos", icon: FileText, tone: "text-purple-600 bg-purple-50", items: [["contracts", "Contratos, termos e documentos vinculados"]] },
  { title: "Cadastros", icon: Database, tone: "text-cyan-600 bg-cyan-50", items: [["users", "Usuários"], ["investors", "Investidores"], ["advisors", "Assessores"], ["projects", "Projetos"]] },
  { title: "Documentos", icon: FolderOpen, tone: "text-indigo-600 bg-indigo-50", items: [["documents", "Relação de documentos"]] },
];
const labels = Object.fromEntries(categories.flatMap((category) => category.items)) as Record<ReportKey, string>;
const today = new Date().toISOString().slice(0, 10);
const yearStart = `${new Date().getFullYear()}-01-01`;

const safeCsvCell = (value: string | number) => {
  let text = String(value ?? "");
  if (/^[=+\-@]/.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
};
const escapeHtml = (value: string | number) => String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]!);

function Relatorios() {
  const queryClient = useQueryClient();
  const [projectId, setProjectId] = useState("all"), [status, setStatus] = useState<"active" | "completed" | "all">("active");
  const [startDate, setStartDate] = useState(yearStart), [endDate, setEndDate] = useState(today);
  const [result, setResult] = useState<Result | null>(null), [activeKey, setActiveKey] = useState<ReportKey>("revenues");
  const [open, setOpen] = useState(false), [busy, setBusy] = useState<string | null>(null);
  const { data: projects = [] } = useQuery({ queryKey: ["report-projects"], queryFn: () => listReportProjects() });
  const { data: history = [] } = useQuery({ queryKey: ["report-history"], queryFn: () => listReportHistory() });

  const run = async (key: ReportKey, format: "view" | "pdf" | "csv") => {
    if (startDate > endDate) { toast.error("A data inicial não pode ser posterior à data final."); return; }
    setBusy(`${key}:${format}`);
    try {
      const data = await generateReport({ data: { reportKey: key, projectId: projectId === "all" ? null : projectId, status, startDate, endDate, format } });
      setResult(data); setActiveKey(key);
      if (format === "view") setOpen(true);
      if (format === "csv") downloadCsv(key, data);
      if (format === "pdf") printReport(key, data);
      await queryClient.invalidateQueries({ queryKey: ["report-history"] });
      toast.success(`${labels[key]} gerado com ${data.rows.length} registro(s).`);
    } catch (error) { toast.error(error instanceof Error ? error.message : "Não foi possível gerar o relatório."); }
    finally { setBusy(null); }
  };

  const downloadCsv = (key: ReportKey, data: Result) => {
    const csv = [data.columns.map(safeCsvCell).join(";"), ...data.rows.map((row) => data.columns.map((column) => safeCsvCell(row[column] ?? "")).join(";"))].join("\r\n");
    const url = URL.createObjectURL(new Blob(["\ufeff", csv], { type: "text/csv;charset=utf-8" }));
    const anchor = document.createElement("a"); anchor.href = url; anchor.download = `${key}-${today}.csv`; anchor.click(); URL.revokeObjectURL(url);
  };
  const printReport = (key: ReportKey, data: Result) => {
    const popup = window.open("", "_blank");
    if (!popup) { toast.error("Permita a abertura de janelas para gerar o PDF."); return; }
    popup.opener = null;
    const header = data.columns.map((column) => `<th>${escapeHtml(column)}</th>`).join("");
    const body = data.rows.map((row) => `<tr>${data.columns.map((column) => `<td>${escapeHtml(row[column] ?? "")}</td>`).join("")}</tr>`).join("");
    popup.document.write(`<!doctype html><html><head><title>${escapeHtml(labels[key])}</title><style>body{font-family:Arial;padding:28px;color:#10263b}h1{font-size:20px}p{color:#667085;font-size:12px}table{width:100%;border-collapse:collapse;font-size:11px;margin-top:20px}th,td{border:1px solid #ddd;padding:7px;text-align:left}th{background:#eef4f7}@media print{body{padding:0}}</style></head><body><h1>${escapeHtml(labels[key])}</h1><p>Período: ${escapeHtml(startDate)} a ${escapeHtml(endDate)} · ${data.rows.length} registro(s)</p><table><thead><tr>${header}</tr></thead><tbody>${body}</tbody></table><script>window.onload=()=>window.print()<\/script></body></html>`);
    popup.document.close();
  };

  return <AppLayout title="Relatórios" subtitle="Dados reais, exportações e histórico de emissões">
    <div className="space-y-6">
      <section className="surface-card p-4"><div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-2"><label className="text-sm font-medium">Projeto</label><Select value={projectId} onValueChange={setProjectId}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Todos os projetos autorizados</SelectItem>{projects.map((project) => <SelectItem key={project.id} value={project.id}>{project.name} · {project.code}</SelectItem>)}</SelectContent></Select></div>
        <div className="space-y-2"><label className="text-sm font-medium">Situação</label><Select value={status} onValueChange={(value) => setStatus(value as typeof status)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="active">Ativos</SelectItem><SelectItem value="completed">Concluídos</SelectItem><SelectItem value="all">Todos</SelectItem></SelectContent></Select></div>
        <div className="space-y-2"><label className="text-sm font-medium">Data inicial</label><DatePickerField value={startDate} max={endDate} onValueChange={setStartDate} aria-label="Data inicial" /></div>
        <div className="space-y-2"><label className="text-sm font-medium">Data final</label><DatePickerField value={endDate} min={startDate} onValueChange={setEndDate} aria-label="Data final" /></div>
      </div></section>

      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">{categories.map((category) => <section key={category.title} className="surface-card overflow-hidden">
        <div className="flex items-center gap-3 border-b bg-muted/30 px-4 py-3"><span className={`rounded-lg p-2 ${category.tone}`}><category.icon className="size-5" /></span><h2 className="text-base font-semibold">{category.title}</h2></div>
        <ul className="divide-y">{category.items.map(([key, label]) => <li key={key} className="p-4"><p className="text-sm font-medium">{label}</p><div className="mt-3 flex flex-wrap gap-1">
          <Button variant="ghost" size="sm" disabled={Boolean(busy)} onClick={() => void run(key, "view")}><Eye className="mr-1 size-3.5" />Visualizar</Button>
          <Button variant="ghost" size="sm" disabled={Boolean(busy)} onClick={() => void run(key, "pdf")}><Printer className="mr-1 size-3.5" />PDF</Button>
          <Button variant="ghost" size="sm" disabled={Boolean(busy)} onClick={() => void run(key, "csv")}><FileSpreadsheet className="mr-1 size-3.5" />Planilha</Button>
        </div></li>)}</ul>
      </section>)}</div>

      <section className="surface-card p-5"><h2 className="text-base font-semibold">Histórico de relatórios</h2><div className="mt-4 overflow-x-auto"><table className="w-full text-sm"><thead className="bg-muted/60 text-left text-xs uppercase text-muted-foreground"><tr><th className="px-3 py-2">Data</th><th className="px-3 py-2">Relatório</th><th className="px-3 py-2">Formato</th><th className="px-3 py-2">Registros</th><th className="px-3 py-2">Usuário</th></tr></thead><tbody className="divide-y">{history.map((item) => <tr key={item.id}><td className="px-3 py-2">{new Date(item.generatedAt).toLocaleString("pt-BR")}</td><td className="px-3 py-2">{labels[item.reportKey as ReportKey] || item.reportKey}</td><td className="px-3 py-2 uppercase">{item.format}</td><td className="px-3 py-2">{item.rowCount}</td><td className="px-3 py-2">{item.userName}</td></tr>)}{history.length === 0 ? <tr><td colSpan={5} className="px-3 py-8 text-center text-muted-foreground">Nenhum relatório emitido.</td></tr> : null}</tbody></table></div></section>
    </div>

    <Dialog open={open} onOpenChange={setOpen}><DialogContent className="max-h-[90vh] max-w-6xl overflow-y-auto"><DialogHeader><DialogTitle>{labels[activeKey]}</DialogTitle><DialogDescription>{result?.rows.length || 0} registro(s), gerado em {result ? new Date(result.generatedAt).toLocaleString("pt-BR") : ""}.</DialogDescription></DialogHeader>{result ? <div className="overflow-x-auto rounded-lg border"><table className="w-full text-sm"><thead className="bg-muted/60 text-left text-xs uppercase text-muted-foreground"><tr>{result.columns.map((column) => <th key={column} className="whitespace-nowrap px-3 py-2">{column}</th>)}</tr></thead><tbody className="divide-y">{result.rows.map((row, index) => <tr key={index}>{result.columns.map((column) => <td key={column} className="whitespace-nowrap px-3 py-2">{row[column]}</td>)}</tr>)}{result.rows.length === 0 ? <tr><td colSpan={result.columns.length || 1} className="px-3 py-8 text-center text-muted-foreground">Nenhum registro encontrado para os filtros.</td></tr> : null}</tbody></table></div> : null}</DialogContent></Dialog>
  </AppLayout>;
}

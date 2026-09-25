import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  Calculator,
  Briefcase,
  History,
  FileText,
  Database,
  FolderOpen,
  FileSpreadsheet,
  Eye,
  Printer,
} from "lucide-react";
import { toast } from "sonner";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { showValidationAlert } from "@/lib/validation-feedback";
import { AppLayout } from "@/components/app-layout";
import { Button } from "@/components/ui/button";
import { DatePickerField } from "@/components/ui/date-picker-field";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { generateReport, listReportHistory, listReportProjects, reportKeys } from "@/lib/reports";
import { formatBRL } from "@/lib/format-currency";

export const Route = createFileRoute("/relatorios")({ component: Relatorios });
type ReportKey = (typeof reportKeys)[number];
type Result = Awaited<ReturnType<typeof generateReport>>;

const categories: Array<{
  title: string;
  icon: typeof Calculator;
  tone: string;
  items: Array<[ReportKey, string]>;
}> = [
  {
    title: "Financeiro",
    icon: Calculator,
    tone: "text-primary bg-primary-soft",
    items: [
      ["cash_flow", "Fluxo de caixa"],
      ["expenses_by_category", "Despesas por categoria"],
      ["invested_capital", "Capital investido por projeto"],
    ],
  },
  {
    title: "Operacional",
    icon: Briefcase,
    tone: "text-green-600 bg-green-50",
    items: [
      ["tasks", "Relatório de tarefas"],
      ["projects_by_modality", "Projetos por modalidade"],
    ],
  },
  {
    title: "Auditoria",
    icon: History,
    tone: "text-orange-600 bg-orange-50",
    items: [
      ["audit", "Histórico de ações"],
      ["financial_changes", "Alterações financeiras"],
    ],
  },
  {
    title: "Contratos",
    icon: FileText,
    tone: "text-purple-600 bg-purple-50",
    items: [["contracts", "Contratos, termos e documentos vinculados"]],
  },
  {
    title: "Cadastros",
    icon: Database,
    tone: "text-brand bg-highlight-soft",
    items: [
      ["users", "Usuários"],
      ["investors", "Investidores"],
      ["advisors", "Assessores"],
      ["projects", "Projetos"],
    ],
  },
  {
    title: "Documentos",
    icon: FolderOpen,
    tone: "text-indigo-600 bg-indigo-50",
    items: [["documents", "Relação de documentos"]],
  },
];
const labels = Object.fromEntries(categories.flatMap((category) => category.items)) as Record<
  ReportKey,
  string
>;
const today = new Date().toISOString().slice(0, 10);
const yearStart = `${new Date().getFullYear()}-01-01`;
const chartColors = [
  "#004090",
  "#00a090",
  "#f59e0b",
  "#dc2626",
  "#7c3aed",
  "#0891b2",
  "#db2777",
  "#65a30d",
  "#ea580c",
  "#475569",
];

const safeCsvCell = (value: string | number) => {
  let text = String(value ?? "");
  if (/^[=+\-@]/.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
};
const escapeHtml = (value: string | number) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]!,
  );

function Relatorios() {
  const queryClient = useQueryClient();
  const [projectId, setProjectId] = useState("all"),
    [status, setStatus] = useState<"active" | "completed" | "all">("active");
  const [startDate, setStartDate] = useState(yearStart),
    [endDate, setEndDate] = useState(today);
  const [result, setResult] = useState<Result | null>(null),
    [activeKey, setActiveKey] = useState<ReportKey>("revenues");
  const [open, setOpen] = useState(false),
    [busy, setBusy] = useState<string | null>(null);
  const { data: projects = [] } = useQuery({
    queryKey: ["report-projects"],
    queryFn: () => listReportProjects(),
  });
  const { data: history = [] } = useQuery({
    queryKey: ["report-history"],
    queryFn: () => listReportHistory(),
  });

  const run = async (key: ReportKey, format: "view" | "pdf" | "csv") => {
    if (startDate > endDate) {
      showValidationAlert("A data inicial não pode ser posterior à data final.");
      return;
    }
    setBusy(`${key}:${format}`);
    try {
      const data = await generateReport({
        data: {
          reportKey: key,
          projectId: projectId === "all" ? null : projectId,
          status,
          startDate,
          endDate,
          format,
        },
      });
      setResult(data);
      setActiveKey(key);
      if (format === "view") setOpen(true);
      if (format === "csv") downloadCsv(key, data);
      if (format === "pdf") printReport(key, data);
      await queryClient.invalidateQueries({ queryKey: ["report-history"] });
      toast.success(`${labels[key]} gerado com ${data.rows.length} registro(s).`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível gerar o relatório.");
    } finally {
      setBusy(null);
    }
  };

  const downloadCsv = (key: ReportKey, data: Result) => {
    const summaryRows = data.summary
      ? [
          "",
          `Total de créditos;${safeCsvCell(formatBRL(data.summary.credits))}`,
          `Total de débitos;${safeCsvCell(formatBRL(data.summary.debits))}`,
          "",
          `Aquisição;${safeCsvCell(formatBRL(data.summary.acquisition))}`,
          `Capital Investido;${safeCsvCell(formatBRL(data.summary.capitalInvested))}`,
        ]
      : [];
    const csv = [
      data.columns.map(safeCsvCell).join(";"),
      ...data.rows.map((row) =>
        data.columns.map((column) => safeCsvCell(row[column] ?? "")).join(";"),
      ),
      ...summaryRows,
    ].join("\r\n");
    const url = URL.createObjectURL(new Blob(["\ufeff", csv], { type: "text/csv;charset=utf-8" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${key}-${today}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  };
  const printReport = (key: ReportKey, data: Result) => {
    const popup = window.open("", "_blank");
    if (!popup) {
      toast.error("Permita a abertura de janelas para gerar o PDF.");
      return;
    }
    popup.opener = null;
    const formatDate = (value: string) => value.split("-").reverse().join("/");
    const projectsLabel = data.reportHeader.projectNames.length
      ? data.reportHeader.projectNames.join(", ")
      : "Nenhum projeto no filtro selecionado";
    const investorsLabel = data.reportHeader.investorNames.length
      ? data.reportHeader.investorNames.join(", ")
      : "Nenhum investidor vinculado";
    const advisorsLabel = data.reportHeader.advisorNames.length
      ? data.reportHeader.advisorNames.join(", ")
      : "Nenhum assessor vinculado";
    const logoUrl = `${window.location.origin}/arremataflow-logo.jpg`;
    const header = data.columns.map((column) => `<th>${escapeHtml(column)}</th>`).join("");
    const body = data.rows
      .map(
        (row) =>
          `<tr>${data.columns.map((column) => `<td>${escapeHtml(row[column] ?? "")}</td>`).join("")}</tr>`,
      )
      .join("");
    let accumulated = 0;
    const gradient = data.chart
      .map((item, index) => {
        const start = accumulated;
        accumulated += item.percentage;
        return `${chartColors[index % chartColors.length]} ${start}% ${accumulated}%`;
      })
      .join(",");
    const chartHtml = data.chart.length
      ? `<section class="chart-wrap"><div class="pie" style="background:conic-gradient(${gradient})"></div><div class="legend">${data.chart.map((item, index) => `<div><span style="background:${chartColors[index % chartColors.length]}"></span>${escapeHtml(item.name)} — ${item.percentage.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%</div>`).join("")}</div></section>`
      : "";
    const summaryHtml = data.summary
      ? `<div class="totals"><strong>Total de créditos: ${escapeHtml(formatBRL(data.summary.credits))}</strong><strong>Total de débitos: ${escapeHtml(formatBRL(data.summary.debits))}</strong></div><div class="capital"><div class="acquisition"><span>Aquisição</span><span>${escapeHtml(formatBRL(data.summary.acquisition))}</span></div><div class="invested"><span>Capital Investido</span><span>${escapeHtml(formatBRL(data.summary.capitalInvested))}</span></div></div>`
      : "";
    popup.document.write(
      `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>${escapeHtml(labels[key])}</title><style>@page{size:A4 landscape;margin:14mm}*{box-sizing:border-box}body{font-family:Arial,sans-serif;margin:0;color:#10263b}.report-header{text-align:center;border-bottom:2px solid #1e6687;padding-bottom:16px;margin-bottom:20px}.logo{display:block;width:190px;max-height:70px;object-fit:contain;margin:0 auto 18px}.report-title{font-size:22px;line-height:1.2;margin:0;font-weight:700;color:#123e56}.period{display:inline-block;margin:9px 0 15px;padding:5px 14px;border-radius:999px;background:#eaf4f8;color:#174f68;font-size:12px;font-weight:700}.context{margin:3px 0;color:#475467;font-size:11px;line-height:1.45}.context strong{color:#10263b}.count{margin-top:8px;color:#667085;font-size:10px}table{width:100%;border-collapse:collapse;font-size:9px}thead{display:table-header-group}tr{break-inside:avoid}th,td{border:1px solid #d0d9df;padding:6px;text-align:left;vertical-align:top}th{background:#eaf1f5;color:#123e56;font-weight:700}tbody tr:nth-child(even){background:#eef3f6}.totals{display:flex;justify-content:flex-end;gap:32px;margin-top:14px;padding:12px;background:#eaf1f5}.chart-wrap{display:flex;align-items:center;justify-content:center;gap:30px;margin:18px 0 24px}.pie{width:220px;height:220px;border-radius:50%}.capital{width:40%;margin:22px 0 0 auto;break-inside:avoid}.capital div{display:flex;justify-content:space-between;gap:24px;padding:11px 14px;font-size:14px;font-weight:700;color:#10263b}.capital .acquisition{background:#dbe8f5}.capital .invested{background:#a9c9ea;margin-top:16px}.legend{font-size:10px;line-height:1.8}.legend span{display:inline-block;width:10px;height:10px;margin-right:6px;border-radius:2px}@media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact}}</style></head><body><header class="report-header"><img class="logo" src="${escapeHtml(logoUrl)}" alt="ArremataFlow"><h1 class="report-title">${escapeHtml(labels[key])}</h1><div class="period">Período: ${escapeHtml(formatDate(startDate))} a ${escapeHtml(formatDate(endDate))}</div><p class="context"><strong>Projeto(s):</strong> ${escapeHtml(projectsLabel)}</p><p class="context"><strong>Investidor(es):</strong> ${escapeHtml(investorsLabel)}</p><p class="context"><strong>Assessor(es):</strong> ${escapeHtml(advisorsLabel)}</p><p class="count">${data.rows.length} registro(s)</p></header>${chartHtml}<table><thead><tr>${header}</tr></thead><tbody>${body}</tbody></table>${summaryHtml}<script>window.onload=()=>window.print()</script></body></html>`,
    );
    popup.document.close();
  };

  return (
    <AppLayout title="Relatórios" subtitle="Dados reais, exportações e histórico de emissões">
      <div className="space-y-6">
        <section className="surface-card p-4">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Projeto</label>
              <Select value={projectId} onValueChange={setProjectId}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os projetos autorizados</SelectItem>
                  {projects.map((project) => (
                    <SelectItem key={project.id} value={project.id}>
                      {project.name} · {project.code}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Situação</label>
              <Select value={status} onValueChange={(value) => setStatus(value as typeof status)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Ativos</SelectItem>
                  <SelectItem value="completed">Concluídos</SelectItem>
                  <SelectItem value="all">Todos</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Data inicial</label>
              <DatePickerField
                value={startDate}
                max={endDate}
                onValueChange={setStartDate}
                aria-label="Data inicial"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Data final</label>
              <DatePickerField
                value={endDate}
                min={startDate}
                onValueChange={setEndDate}
                aria-label="Data final"
              />
            </div>
          </div>
        </section>

        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {categories.map((category) => (
            <section key={category.title} className="surface-card overflow-hidden">
              <div className="flex items-center gap-3 border-b bg-muted/30 px-4 py-3">
                <span className={`rounded-lg p-2 ${category.tone}`}>
                  <category.icon className="size-5" />
                </span>
                <h2 className="text-base font-semibold">{category.title}</h2>
              </div>
              <ul className="divide-y">
                {category.items.map(([key, label]) => (
                  <li key={key} className="p-4">
                    <p className="text-sm font-medium">{label}</p>
                    <div className="mt-3 flex flex-wrap gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={Boolean(busy)}
                        onClick={() => void run(key, "view")}
                      >
                        <Eye className="mr-1 size-3.5" />
                        Visualizar
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={Boolean(busy)}
                        onClick={() => void run(key, "pdf")}
                      >
                        <Printer className="mr-1 size-3.5" />
                        PDF
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={Boolean(busy)}
                        onClick={() => void run(key, "csv")}
                      >
                        <FileSpreadsheet className="mr-1 size-3.5" />
                        Planilha
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>

        <section className="surface-card p-5">
          <h2 className="text-base font-semibold">Histórico de relatórios</h2>
          <div
            tabIndex={0}
            role="region"
            aria-label="Tabela com rolagem horizontal"
            className="table-scroll mt-4 overflow-x-auto"
          >
            <table className="w-full text-sm">
              <thead className="bg-muted/60 text-left text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-3 py-2">Data</th>
                  <th className="px-3 py-2">Relatório</th>
                  <th className="px-3 py-2">Formato</th>
                  <th className="px-3 py-2">Registros</th>
                  <th className="px-3 py-2">Usuário</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {history.map((item) => (
                  <tr key={item.id}>
                    <td className="px-3 py-2">
                      {new Date(item.generatedAt).toLocaleString("pt-BR")}
                    </td>
                    <td className="px-3 py-2">
                      {labels[item.reportKey as ReportKey] || item.reportKey}
                    </td>
                    <td className="px-3 py-2 uppercase">{item.format}</td>
                    <td className="px-3 py-2">{item.rowCount}</td>
                    <td className="px-3 py-2">{item.userName}</td>
                  </tr>
                ))}
                {history.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-3 py-8 text-center text-muted-foreground">
                      Nenhum relatório emitido.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] max-w-6xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{labels[activeKey]}</DialogTitle>
            <DialogDescription>
              {result?.rows.length || 0} registro(s), gerado em{" "}
              {result ? new Date(result.generatedAt).toLocaleString("pt-BR") : ""}.
            </DialogDescription>
          </DialogHeader>
          {result ? (
            <div className="space-y-5">
              {result.chart.length ? (
                <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_280px]">
                  <div className="h-80">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={result.chart}
                          dataKey="value"
                          nameKey="name"
                          cx="50%"
                          cy="50%"
                          outerRadius="70%"
                        >
                          {result.chart.map((item, index) => (
                            <Cell key={item.name} fill={chartColors[index % chartColors.length]} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(value: number) => formatBRL(value)} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="space-y-2 self-center">
                    {result.chart.map((item, index) => (
                      <div
                        key={item.name}
                        className="flex flex-wrap items-center justify-between gap-3 text-sm"
                      >
                        <span className="flex items-center gap-2">
                          <span
                            className="size-3 rounded-sm"
                            style={{ backgroundColor: chartColors[index % chartColors.length] }}
                          />
                          {item.name}
                        </span>
                        <strong>
                          {item.percentage.toLocaleString("pt-BR", {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                          %
                        </strong>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
              <div
                tabIndex={0}
                role="region"
                aria-label="Tabela com rolagem horizontal"
                className="table-scroll overflow-x-auto rounded-lg border"
              >
                <table className="w-full text-sm">
                  <thead className="bg-muted/60 text-left text-xs uppercase text-muted-foreground">
                    <tr>
                      {result.columns.map((column) => (
                        <th key={column} className="whitespace-nowrap px-3 py-2">
                          {column}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {result.rows.map((row, index) => (
                      <tr key={index} className={index % 2 ? "bg-muted/40" : "bg-background"}>
                        {result.columns.map((column) => (
                          <td key={column} className="whitespace-nowrap px-3 py-2">
                            {row[column]}
                          </td>
                        ))}
                      </tr>
                    ))}
                    {result.rows.length === 0 ? (
                      <tr>
                        <td
                          colSpan={result.columns.length || 1}
                          className="px-3 py-8 text-center text-muted-foreground"
                        >
                          Nenhum registro encontrado para os filtros.
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
              {result.summary ? (
                <div className="flex flex-wrap justify-end gap-6 rounded-lg bg-muted/60 px-4 py-3 text-sm">
                  <span>
                    Total de créditos:{" "}
                    <strong className="text-success">{formatBRL(result.summary.credits)}</strong>
                  </span>
                  <span>
                    Total de débitos:{" "}
                    <strong className="text-destructive">{formatBRL(result.summary.debits)}</strong>
                  </span>
                </div>
              ) : null}
              {result.summary ? (
                <div className="ml-auto w-full max-w-sm space-y-3 text-sm font-semibold">
                  <div className="flex justify-between gap-6 rounded-md bg-primary-soft px-4 py-3">
                    <span>Aquisição</span>
                    <span className="tabular-nums">{formatBRL(result.summary.acquisition)}</span>
                  </div>
                  <div className="flex justify-between gap-6 rounded-md bg-primary/15 px-4 py-3">
                    <span>Capital Investido</span>
                    <span className="tabular-nums">
                      {formatBRL(result.summary.capitalInvested)}
                    </span>
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}

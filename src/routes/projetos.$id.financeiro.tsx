import { createFileRoute, Navigate, useParams } from "@tanstack/react-router";
import { useState, useRef, useEffect } from "react";
import { Plus, Paperclip, FileText, Trash2, AlertCircle, DollarSign, ArrowLeft, Eye } from "lucide-react";
import { AppLayout } from "@/components/app-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { formatBRL } from "@/lib/format-currency";
import { financialCategories as categoriasDocumentos } from "@/lib/financial-categories";
import { formatDocument, validateDocument } from "@/lib/utils-validation";
import { CurrencyInput } from "@/components/ui/currency-input";
import { DatePickerField } from "@/components/ui/date-picker-field";
import { type StatusKey } from "@/lib/project-display";
import { createFinancialMovement, deleteFinancialMovement, listFinancialMovements } from "@/lib/financial";

export type Movimentacao = {
  id: string;
  descricao: string;
  document_holder_name?: string | null;
  document_holder_type?: 'Origem' | 'Destinatário' | null;
  document_holder_document?: string | null;
  document_type?: 'CPF' | 'CNPJ' | null;
  categoria: string;
  data: string;
  valor: number;
  status: StatusKey;
  comprovanteUrl?: string | null;
  comprovanteUrls?: string[];
  tipo?: 'receita' | 'despesa';
};

export const Route = createFileRoute("/projetos/$id/financeiro")({
  validateSearch: (search: Record<string, unknown>) => ({
    categoria: typeof search["categoria"] === "string" ? search["categoria"] : "",
  }),
  head: () => ({
    meta: [
      { title: "Financeiro do Projeto | ArremataFlow" },
      {
        name: "description",
        content: "Controle receitas, despesas, tributos e a distribuição de resultados do projeto.",
      },
      { property: "og:title", content: "Financeiro do Projeto | ArremataFlow" },
      { property: "og:description", content: "Movimentações, indicadores e distribuição por participante." },
    ],
  }),
  component: FinanceiroRedirect,
});

function FinanceiroRedirect() {
  const { id } = useParams({ from: "/projetos/$id/financeiro" });
  return <Navigate to="/projetos/$id" params={{ id }} search={{ aba: "financeiro" }} replace />;
}

export function DemonstrativoResultado({
  receitas,
  despesas,
}: {
  receitas: Movimentacao[];
  despesas: Movimentacao[];
}) {
  const totalReceitas = receitas.reduce((total, movement) => total + movement.valor, 0);
  const totalDespesas = despesas.reduce((total, movement) => total + movement.valor, 0);
  const resultado = totalReceitas - totalDespesas;

  return (
    <div className="surface-card mt-6 overflow-hidden">
      <div className="border-b border-border px-5 py-4">
        <h3 className="text-base font-semibold">Demonstrativo de Resultado do Projeto</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Detalhamento consolidado de todas as movimentações financeiras do projeto.
        </p>
      </div>

      <div className="divide-y divide-border text-sm">
        <div className="flex items-center justify-between bg-success-soft/60 px-5 py-3 font-semibold text-success">
          <span>(+) Receitas</span>
          <span>{formatBRL(totalReceitas)}</span>
        </div>
        {receitas.length > 0 ? receitas.map((movement) => (
          <div key={movement.id} className="grid gap-2 px-5 py-3 sm:grid-cols-[100px_1fr_auto] sm:items-center">
            <span className="text-xs text-muted-foreground">{movement.data}</span>
            <div>
              <p className="font-medium">{movement.descricao}</p>
              <p className="text-xs text-muted-foreground">{movement.categoria}</p>
            </div>
            <span className="text-right font-medium text-success">{formatBRL(movement.valor)}</span>
          </div>
        )) : (
          <p className="px-5 py-3 text-muted-foreground">Nenhuma receita registrada.</p>
        )}

        <div className="flex items-center justify-between bg-destructive/5 px-5 py-3 font-semibold text-destructive">
          <span>(−) Despesas</span>
          <span>{formatBRL(totalDespesas)}</span>
        </div>
        {despesas.length > 0 ? despesas.map((movement) => (
          <div key={movement.id} className="grid gap-2 px-5 py-3 sm:grid-cols-[100px_1fr_auto] sm:items-center">
            <span className="text-xs text-muted-foreground">{movement.data}</span>
            <div>
              <p className="font-medium">{movement.descricao}</p>
              <p className="text-xs text-muted-foreground">{movement.categoria}</p>
            </div>
            <span className="text-right font-medium text-destructive">− {formatBRL(movement.valor)}</span>
          </div>
        )) : (
          <p className="px-5 py-3 text-muted-foreground">Nenhuma despesa registrada.</p>
        )}

        <div className="flex items-center justify-between bg-muted/50 px-5 py-4 text-base font-bold">
          <span>(=) Resultado Atual</span>
          <span className={resultado >= 0 ? "text-success" : "text-destructive"}>
            {formatBRL(resultado)}
          </span>
        </div>
      </div>
    </div>
  );
}

export function ComprovantesFinanceiros({ movimentacoes }: { movimentacoes: Movimentacao[] }) {
  const [tipoFiltro, setTipoFiltro] = useState<"todos" | "receita" | "despesa">("todos");
  const [dataInicial, setDataInicial] = useState("");
  const [dataFinal, setDataFinal] = useState("");
  const dateToIso = (date: string) => {
    const [day, month, year] = date.split("/");
    return year && month && day ? `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}` : "";
  };
  const comprovantes = movimentacoes
    .filter((movement) => Boolean(movement.comprovanteUrl) || Boolean(movement.comprovanteUrls?.length))
    .filter((movement) => tipoFiltro === "todos" || movement.tipo === tipoFiltro)
    .filter((movement) => {
      const movementDate = dateToIso(movement.data);
      return (!dataInicial || movementDate >= dataInicial) && (!dataFinal || movementDate <= dataFinal);
    })
    .sort((a, b) => {
      const parseDate = (date: string) => {
        const [day, month, year] = date.split("/").map(Number);
        return new Date(year || 0, (month || 1) - 1, day || 1).getTime();
      };
      return parseDate(b.data) - parseDate(a.data);
    });

  return (
    <div className="surface-card mt-6 overflow-hidden">
      <div className="border-b border-border px-5 py-4">
        <h3 className="text-base font-semibold">Comprovantes de Movimentação Financeira</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Documentos anexados às receitas e despesas deste projeto.
        </p>
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="comprovantes-tipo">Tipo</Label>
            <Select value={tipoFiltro} onValueChange={(value) => setTipoFiltro(value as "todos" | "receita" | "despesa")}>
              <SelectTrigger id="comprovantes-tipo"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                <SelectItem value="receita">Receita</SelectItem>
                <SelectItem value="despesa">Despesa</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="comprovantes-data-inicial">Data inicial</Label>
            <DatePickerField
              value={dataInicial}
              max={dataFinal || undefined}
              aria-label="Data inicial"
              onValueChange={(value) => {
                if (dataFinal && value > dataFinal) {
                  toast.error("A data inicial não pode ser posterior à data final.");
                  return;
                }
                setDataInicial(value);
              }}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="comprovantes-data-final">Data final</Label>
            <DatePickerField
              value={dataFinal}
              min={dataInicial || undefined}
              aria-label="Data final"
              onValueChange={(value) => {
                if (dataInicial && value < dataInicial) {
                  toast.error("A data final não pode ser anterior à data inicial.");
                  return;
                }
                setDataFinal(value);
              }}
            />
          </div>
        </div>
      </div>

      {comprovantes.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[620px] text-sm">
            <thead className="bg-muted/60 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-5 py-3 font-medium">Data</th>
                <th className="px-5 py-3 font-medium">Tipo</th>
                <th className="px-5 py-3 font-medium">Categoria</th>
                <th className="px-5 py-3 text-right font-medium">Valor</th>
              </tr>
            </thead>
            <tbody>
              {comprovantes.map((movement) => (
                <tr key={movement.id} className="border-t border-border hover:bg-muted/30">
                  <td className="px-5 py-3">{movement.data}</td>
                  <td className="px-5 py-3">
                    <span className={movement.tipo === "receita" ? "text-success" : "text-destructive"}>
                      {movement.tipo === "receita" ? "Receita" : "Despesa"}
                    </span>
                  </td>
                  <td className="px-5 py-3">{movement.categoria}</td>
                  <td className="px-5 py-3">
                    <div className="flex items-center justify-end gap-2">
                      <span className="font-medium">{formatBRL(movement.valor)}</span>
                      {(movement.comprovanteUrls?.length
                        ? movement.comprovanteUrls
                        : movement.comprovanteUrl ? [movement.comprovanteUrl] : []
                      ).map((url, index) => (
                        <Button key={`${movement.id}-receipt-${index}`} asChild variant="ghost" size="icon" className="size-8 text-brand">
                          <a
                            href={url}
                            target="_blank"
                            rel="noopener noreferrer"
                            aria-label={`Visualizar comprovante ${index + 1} de ${movement.categoria}`}
                            title={`Visualizar comprovante ${index + 1}`}
                          >
                            <Eye className="size-4" />
                          </a>
                        </Button>
                      ))}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="px-5 py-6 text-sm text-muted-foreground">
          Nenhum comprovante encontrado para os filtros selecionados.
        </p>
      )}
    </div>
  );
}

function FinanceiroProjeto() {
  const { id: projetoId } = useParams({ from: "/projetos/$id/financeiro" });
  const { categoria: categoriaFiltro } = Route.useSearch();
  const [receitas, setReceitas] = useState<Movimentacao[]>([]);
  const [despesas, setDespesas] = useState<Movimentacao[]>([]);
  const [open, setOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [movParaExcluir, setMovParaExcluir] = useState<string | null>(null);
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [tipoMov, setTipoMov] = useState<"receita" | "despesa">("despesa");
  const [documento, setDocumento] = useState("");
  const [valorMov, setValorMov] = useState(0);
  const [categoriaMov, setCategoriaMov] = useState(categoriaFiltro);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleBack = () => {
    if (window.history.length > 1) {
      window.history.back();
    } else {
      window.location.href = `/projetos/${projetoId}`;
    }
  };

  useEffect(() => {
    void listFinancialMovements({ data: { projectId: projetoId } }).then((movements) => { setReceitas(movements.filter((movement) => movement.tipo === "receita") as Movimentacao[]); setDespesas(movements.filter((movement) => movement.tipo === "despesa") as Movimentacao[]); }).catch((error) => toast.error(error.message));
  }, [projetoId]);

  useEffect(() => setCategoriaMov(categoriaFiltro), [categoriaFiltro]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const allowedTypes = ["application/pdf", "image/jpeg", "image/jpg", "image/png", "image/webp"];
    if (!allowedTypes.includes(file.type)) {
      toast.error("Formato inválido. Use PDF, JPG, PNG ou WEBP.");
      e.target.value = "";
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      toast.error("Arquivo muito grande. Limite de 2MB.");
      e.target.value = "";
      return;
    }

    setArquivo(file);
    toast.success(`Arquivo "${file.name}" anexado.`);
  };

  const handleExcluir = (id: string) => {
    setMovParaExcluir(id);
    setDeleteOpen(true);
  };

  const confirmarExclusao = async (removerDoDoc = false) => {
    if (!movParaExcluir) return;
    try { await deleteFinancialMovement({ data: { projectId: projetoId, id: movParaExcluir } }); const movements = await listFinancialMovements({ data: { projectId: projetoId } }); setReceitas(movements.filter((movement) => movement.tipo === "receita") as Movimentacao[]); setDespesas(movements.filter((movement) => movement.tipo === "despesa") as Movimentacao[]); }
    catch (error) { toast.error(error instanceof Error ? error.message : "Não foi possível excluir a movimentação."); return; }

    if (removerDoDoc) {
      toast.info("Movimentação e documento removidos.");
    } else {
      toast.success("Movimentação removida. Documento mantido.");
    }

    setDeleteOpen(false);
    setMovParaExcluir(null);
  };

  const totalR = receitas.reduce((s, i) => s + i.valor, 0);
  const totalD = despesas.reduce((s, i) => s + i.valor, 0);
  const saldo = totalR - totalD;

  return (
    <AppLayout
      title="Financeiro do Projeto"
      subtitle="Receitas, despesas, tributos e distribuição"
      actions={
        <div className="flex items-center gap-3">
          <Button
            variant="default"
            onClick={handleBack}
            className="gap-2"
            aria-label="Voltar para a tela anterior"
            title="Voltar para a tela anterior"
          >
            <ArrowLeft className="size-4" /> Voltar
          </Button>
          <Dialog open={open} onOpenChange={(val) => {
            setOpen(val);
            if (!val) {
              setDocumento("");
              setArquivo(null);
              setValorMov(0);
            }
          }}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="size-4" /> Nova movimentação
              </Button>
            </DialogTrigger>
            <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[600px]">
              <DialogHeader>
                <DialogTitle>Nova movimentação</DialogTitle>
                <DialogDescription>
                  Cadastre uma receita ou despesa vinculada a este projeto.
                </DialogDescription>
              </DialogHeader>
              <form
                className="space-y-4"
                onSubmit={async (e) => {
                  e.preventDefault();
                  const fd = new FormData(e.currentTarget);
                  const desc = String(fd.get("descricao") || "Movimentação");
                  const cat = String(fd.get("categoria") || "");
                  const val = valorMov;
                  const tipo = fd.get("tipo") as "receita" | "despesa";
                  const doc = fd.get("documento") as string;

                  if (doc && !validateDocument(doc)) {
                    toast.error("Documento (CPF/CNPJ) inválido.");
                    return;
                  }

                  const created = await createFinancialMovement({ data: { projectId: projetoId, type: tipo, description: desc, category: cat, amount: val, holderDocument: doc || undefined } });
                  if (arquivo) { const upload = new FormData(); upload.set("file", arquivo); upload.set("projectId", projetoId); upload.set("financialMovementId", created.id); upload.set("name", `Comprovante — ${desc}`); upload.set("category", cat); const response = await fetch("/api/documents/upload", { method: "POST", body: upload, credentials: "same-origin" }); if (!response.ok) throw new Error((await response.text()) || "Não foi possível enviar o comprovante."); }
                  const movements = await listFinancialMovements({ data: { projectId: projetoId } }); setReceitas(movements.filter((movement) => movement.tipo === "receita") as Movimentacao[]); setDespesas(movements.filter((movement) => movement.tipo === "despesa") as Movimentacao[]);

                  setOpen(false);
                  setArquivo(null);
                  setDocumento("");
                  setValorMov(0);
                  toast.success("Movimentação registrada!");
                }}
              >
                <div className="space-y-2">
                  <Label htmlFor="tipo">Tipo</Label>
                  <Select 
                    name="tipo" 
                    defaultValue="despesa"
                    onValueChange={(v) => setTipoMov(v as any)}
                  >
                    <SelectTrigger id="tipo">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="receita">Receita</SelectItem>
                      <SelectItem value="despesa">Despesa</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="descricao">Descrição</Label>
                  <Input id="descricao" name="descricao" required />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="documento">
                    {tipoMov === "receita" ? "Origem – CNPJ ou CPF" : "Destinatário – CNPJ ou CPF"}
                  </Label>
                  <div className="relative">
                    <Input 
                      id="documento" 
                      name="documento" 
                      value={documento}
                      onChange={(e) => setDocumento(formatDocument(e.target.value))}
                      placeholder="000.000.000-00 ou 00.000.000/0000-00"
                    />
                    {documento && !validateDocument(documento) && (
                      <AlertCircle className="absolute right-3 top-2.5 size-4 text-destructive" />
                    )}
                  </div>
                  <p className="text-[10px] text-muted-foreground">
                    O preenchimento será opcional. Documentos serão validados automaticamente.
                  </p>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="categoria">Categoria</Label>
                    <Select
                      name="categoria"
                      value={categoriaMov}
                      onValueChange={setCategoriaMov}
                      required
                    >
                      <SelectTrigger id="categoria">
                        <SelectValue placeholder="Selecione..." />
                      </SelectTrigger>
                      <SelectContent>
                        {categoriasDocumentos.map((c) => (
                          <SelectItem key={c} value={c}>
                            {c}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="valor">Valor (R$)</Label>
                    <CurrencyInput 
                      id="valor" 
                      value={valorMov} 
                      onValueChange={setValorMov} 
                      required 
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Comprovante</Label>
                  <div className="flex items-center gap-3">
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full justify-start gap-2"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <Paperclip className="size-4" />
                      {arquivo ? arquivo.name : "Anexar comprovante"}
                    </Button>
                    <input
                      type="file"
                      ref={fileInputRef}
                      className="hidden"
                      accept=".pdf,.jpg,.jpeg,.png,.webp"
                      onChange={handleFileChange}
                    />
                    {arquivo && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="text-destructive"
                        onClick={() => setArquivo(null)}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    )}
                  </div>
                  <p className="text-[10px] text-muted-foreground">
                    PDF, JPG, PNG ou WEBP até 2MB.
                  </p>
                </div>
                <DialogFooter>
                  <Button type="submit">Registrar</Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      }
    >
      <div className="grid gap-4 sm:grid-cols-3">
        {[
          { l: "Total de receitas", v: formatBRL(totalR), c: "text-success" },
          { l: "Total de despesas", v: formatBRL(totalD), c: "text-destructive" },
          { l: "Saldo do projeto", v: formatBRL(saldo), c: saldo >= 0 ? "text-success" : "text-destructive" },
        ].map((k) => (
          <div key={k.l} className="surface-card p-4">
            <p className="text-sm text-muted-foreground">{k.l}</p>
            <p className={`mt-1 text-xl font-semibold ${k.c}`}>{k.v}</p>
          </div>
        ))}
      </div>

      <DemonstrativoResultado receitas={receitas} despesas={despesas} />

      <ComprovantesFinanceiros movimentacoes={[...receitas, ...despesas]} />

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Excluir movimentação?</DialogTitle>
            <DialogDescription>
              Esta ação não pode ser desfeita. Deseja manter o comprovante na Gestão Documental?
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div className="flex flex-col gap-2">
              <Button onClick={() => confirmarExclusao(false)}>
                Excluir apenas movimentação
              </Button>
              <Button variant="destructive" onClick={() => confirmarExclusao(true)}>
                Excluir movimentação e documento
              </Button>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDeleteOpen(false)}>
              Cancelar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </AppLayout>
  );
}

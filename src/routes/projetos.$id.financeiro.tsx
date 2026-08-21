import { createFileRoute, useParams } from "@tanstack/react-router";
import { useState, useRef, useEffect } from "react";
import { Plus, Calculator, Paperclip, FileText, Trash2, AlertCircle, DollarSign } from "lucide-react";
import { AppLayout } from "@/components/app-layout";
import { StatusBadge } from "@/components/status-badge";
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
import {
  distribuicao,
  formatBRL,
  categoriasDocumentos,
} from "@/lib/mock-data";
import { supabase } from "@/integrations/supabase/client";
import { formatDocument, validateDocument } from "@/lib/utils-validation";
import { CurrencyInput } from "@/components/ui/currency-input";
import { type StatusKey } from "@/lib/mock-data";

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
  tipo?: 'receita' | 'despesa';
};

export const Route = createFileRoute("/projetos/$id/financeiro")({
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
  component: FinanceiroProjeto,
});

function Tabela({
  titulo,
  itens,
  onDelete,
}: {
  titulo: string;
  itens: Movimentacao[];
  onDelete: (id: string) => void;
}) {
  return (
    <div className="surface-card overflow-hidden">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <h3 className="text-base font-semibold">{titulo}</h3>
        <span className="text-sm font-semibold">
          {formatBRL(itens.reduce((s, i) => s + i.valor, 0))}
        </span>
      </div>
      <table className="w-full text-sm">
        <tbody>
          {itens.map((i) => (
            <tr key={i.id} className="group border-b border-border last:border-0 hover:bg-muted/30">
              <td className="px-4 py-3">
                <div className="flex items-center gap-2">
                  <p className="font-medium">{i.descricao}</p>
                  {i.comprovanteUrl && (
                    <a
                      href="#"
                      onClick={(e) => {
                        e.preventDefault();
                        toast.info("Visualizando comprovante: " + i.descricao);
                      }}
                      className="text-brand hover:text-brand-dark"
                      title="Visualizar comprovante"
                    >
                      <Paperclip className="size-3.5" />
                    </a>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  {i.categoria} · {i.data}
                  {i.document_holder_document && (
                    <> · {i.document_holder_type}: {i.document_holder_document}</>
                  )}
                </p>
              </td>
              <td className="px-4 py-3">
                <StatusBadge status={i.status} />
              </td>
              <td className="px-4 py-3 text-right">
                <div className="flex items-center justify-end gap-3">
                  <span className="font-medium">{formatBRL(i.valor)}</span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-8 opacity-0 group-hover:opacity-100 text-destructive hover:text-destructive hover:bg-destructive/10"
                    onClick={() => onDelete(i.id)}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function FinanceiroProjeto() {
  const { id: projetoId } = useParams({ from: "/projetos/$id/financeiro" });
  const [receitas, setReceitas] = useState<Movimentacao[]>([]);
  const [despesas, setDespesas] = useState<Movimentacao[]>([]);
  const [open, setOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [movParaExcluir, setMovParaExcluir] = useState<string | null>(null);
  const [calculado, setCalculado] = useState(false);
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [tipoMov, setTipoMov] = useState<"receita" | "despesa">("despesa");
  const [documento, setDocumento] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    async function carregarMovimentacoes() {
      if (!projetoId || projetoId.length < 10) return;

      const { data, error } = await supabase
        .from("movimentacoes_financeiras")
        .select("*")
        .eq("projeto_id", projetoId)
        .order("data", { ascending: false });

      if (error) {
        console.error("Erro ao carregar movimentações:", error);
        return;
      }

      const formatted: Movimentacao[] = data.map((m) => ({
        id: m.id,
        descricao: m.descricao,
        categoria: m.categoria,
        data: new Date(m.data).toLocaleDateString("pt-BR"),
        valor: Number(m.valor),
        status: m.status as StatusKey,
        comprovanteUrl: m.comprovante_url ?? null,
        document_holder_document: m.document_holder_document ?? null,
        document_holder_type: m.document_holder_type as any,
        document_type: m.document_type as any,
        tipo: m.tipo as 'receita' | 'despesa',
      }));

      setReceitas(formatted.filter((m) => m.tipo === "receita"));
      setDespesas(formatted.filter((m) => m.tipo === "despesa"));
    }

    carregarMovimentacoes();
  }, [projetoId]);

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

    const { error } = await supabase
      .from("movimentacoes_financeiras")
      .delete()
      .eq("id", movParaExcluir);

    if (error) {
      toast.error("Erro ao excluir movimentação.");
      return;
    }

    setReceitas((prev) => prev.filter((m) => m.id !== movParaExcluir));
    setDespesas((prev) => prev.filter((m) => m.id !== movParaExcluir));

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
        <Dialog open={open} onOpenChange={(val) => {
          setOpen(val);
          if (!val) {
            setDocumento("");
            setArquivo(null);
          }
        }}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="size-4" /> Nova movimentação
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Nova movimentação</DialogTitle>
              <DialogDescription>O valor em nova movimentação também não está no padrão que havia solicitado anteriormente, formato de moeda padrão “R$” e o valor alinhado a direita, onde o usuário ao digitar 350, por exemplo, o campo já formate para “R$ 350,00”. Havia solicitado para revisar todo o projeto e todos os campos que são relacionados a valores, moeda, formatar em padrão unico. faça isso!</DialogDescription>
            </DialogHeader>
            <form
              className="space-y-4"
              onSubmit={async (e) => {
                e.preventDefault();
                const fd = new FormData(e.currentTarget);
                const desc = String(fd.get("descricao") || "Movimentação");
                const cat = String(fd.get("categoria") || "");
                const val = Number(fd.get("valor") || 0);
                const tipo = fd.get("tipo") as "receita" | "despesa";
                const doc = fd.get("documento") as string;

                if (doc && !validateDocument(doc)) {
                  toast.error("Documento (CPF/CNPJ) inválido.");
                  return;
                }

                const docDigits = doc.replace(/\D/g, "");
                const docType = docDigits.length === 11 ? "CPF" : "CNPJ";
                const holderType = tipo === "receita" ? "Origem" : "Destinatário";

                const { data: userResponse } = await supabase.auth.getUser();
                const userId = userResponse.user?.id || null;

                const { data, error } = await supabase
                  .from("movimentacoes_financeiras")
                  .insert({
                    projeto_id: projetoId,
                    tipo,
                    descricao: desc,
                    categoria: cat,
                    valor: val,
                    document_holder_document: doc || null,
                    document_type: doc ? docType : null,
                    document_holder_type: holderType,
                    user_id: userId,
                    status: "pendente",
                  })
                  .select()
                  .single();

                if (error) {
                  toast.error("Erro ao registrar movimentação.");
                  console.error(error);
                  return;
                }

                const nova: Movimentacao = {
                  id: data.id,
                  descricao: desc,
                  categoria: cat,
                  data: new Date().toLocaleDateString("pt-BR"),
                  valor: val,
                  status: "pendente",
                  comprovanteUrl: arquivo ? URL.createObjectURL(arquivo) : null,
                  document_holder_document: doc || null,
                  document_holder_type: holderType,
                  document_type: doc ? (docType as "CPF" | "CNPJ") : null,
                  tipo: tipo,
                };

                if (tipo === "receita") setReceitas((p) => [nova, ...p]);
                else setDespesas((p) => [nova, ...p]);

                setOpen(false);
                setArquivo(null);
                setDocumento("");
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
                  <Select name="categoria" required>
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
                  <Input id="valor" name="valor" type="number" step="0.01" required />
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
      }
    >
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { l: "Total de receitas", v: formatBRL(totalR), c: "text-success" },
          { l: "Total de despesas", v: formatBRL(totalD), c: "text-destructive" },
          { l: "Saldo do projeto", v: formatBRL(saldo), c: saldo >= 0 ? "text-success" : "text-destructive" },
          { l: "ROI projetado", v: "27,4%", c: "text-brand" },
        ].map((k) => (
          <div key={k.l} className="surface-card p-4">
            <p className="text-sm text-muted-foreground">{k.l}</p>
            <p className={`mt-1 text-xl font-semibold ${k.c}`}>{k.v}</p>
          </div>
        ))}
      </div>

      <div className="mt-6 grid gap-5 lg:grid-cols-2">
        <Tabela titulo="Receitas" itens={receitas} onDelete={handleExcluir} />
        <Tabela titulo="Despesas" itens={despesas} onDelete={handleExcluir} />
      </div>

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

      <div className="surface-card mt-6 p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-semibold">Distribuição de resultados</h3>
            <p className="text-sm text-muted-foreground">
              Cálculo conforme cotas e regras de honorários da empresa.
            </p>
          </div>
          <Button
            variant="outline"
            onClick={() => {
              setCalculado(true);
              toast.success("Distribuição recalculada!");
            }}
          >
            <Calculator className="size-4" /> Calcular distribuição
          </Button>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-muted/60 text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-4 py-2 font-medium">Participante</th>
              <th className="px-4 py-2 font-medium">Tipo</th>
              <th className="px-4 py-2 font-medium">%</th>
              <th className="px-4 py-2 text-right font-medium">Valor</th>
            </tr>
          </thead>
          <tbody>
            {distribuicao.map((d) => (
              <tr key={d.participante} className="border-t border-border">
                <td className="px-4 py-3 font-medium">{d.participante}</td>
                <td className="px-4 py-3 text-muted-foreground">{d.tipo}</td>
                <td className="px-4 py-3">{d.percentual}%</td>
                <td className="px-4 py-3 text-right font-medium">
                  {calculado ? formatBRL(d.valor) : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </AppLayout>
  );
}

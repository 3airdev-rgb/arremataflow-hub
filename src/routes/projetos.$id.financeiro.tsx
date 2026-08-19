import { createFileRoute } from "@tanstack/react-router";
import { useState, useRef } from "react";
import { Plus, Calculator, Paperclip, FileText, Trash2 } from "lucide-react";
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
  receitas as receitasMock,
  despesas as despesasMock,
  distribuicao,
  formatBRL,
  type Movimentacao,
  categoriasDocumentos,
} from "@/lib/mock-data";

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
  const [receitas, setReceitas] = useState(receitasMock);
  const [despesas, setDespesas] = useState(despesasMock);
  const [open, setOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [movParaExcluir, setMovParaExcluir] = useState<string | null>(null);
  const [calculado, setCalculado] = useState(false);
  const [arquivo, setArquivo] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  const confirmarExclusao = (removerDoDoc = false) => {
    if (!movParaExcluir) return;

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
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="size-4" /> Nova movimentação
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Nova movimentação</DialogTitle>
              <DialogDescription>Registre uma receita ou despesa do projeto.</DialogDescription>
            </DialogHeader>
            <form
              className="space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                const fd = new FormData(e.currentTarget);
                const nova: Movimentacao = {
                  id: `n${Date.now()}`,
                  descricao: String(fd.get("descricao") || "Movimentação"),
                  categoria: String(fd.get("categoria") || "Geral"),
                  data: "16/08/2026",
                  valor: Number(fd.get("valor") || 0),
                  status: "pendente",
                };
                if (fd.get("tipo") === "receita") setReceitas((p) => [nova, ...p]);
                else setDespesas((p) => [nova, ...p]);
                setOpen(false);
                toast.success("Movimentação registrada!");
              }}
            >
              <div className="space-y-2">
                <Label htmlFor="tipo">Tipo</Label>
                <Select name="tipo" defaultValue="despesa">
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
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="categoria">Categoria</Label>
                  <Input id="categoria" name="categoria" placeholder="Obra, Tributos..." />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="valor">Valor (R$)</Label>
                  <Input id="valor" name="valor" type="number" step="0.01" required />
                </div>
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
        <Tabela titulo="Receitas" itens={receitas} />
        <Tabela titulo="Despesas" itens={despesas} />
      </div>

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

import { useEffect, useRef, useState } from "react";
import { AlertCircle, Paperclip, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { CurrencyInput } from "@/components/ui/currency-input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { financialCategories } from "@/lib/financial-categories";
import { formatDocument, validateDocument } from "@/lib/utils-validation";
import { createFinancialMovement, findFinancialHolder } from "@/lib/financial";

export function NewFinancialMovementDialog({
  projetoId,
  onSaved,
  defaultOpen = false,
  defaultCategory = "",
  defaultDescription = "",
}: {
  projetoId: string;
  onSaved: () => void | Promise<void>;
  defaultOpen?: boolean;
  defaultCategory?: string;
  defaultDescription?: string;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const [arquivos, setArquivos] = useState<File[]>([]);
  const [tipoMov, setTipoMov] = useState<"receita" | "despesa">("despesa");
  const [documento, setDocumento] = useState("");
  const [nome, setNome] = useState("");
  const [nomeEncontrado, setNomeEncontrado] = useState(false);
  const [valorMov, setValorMov] = useState(0);
  const [categoriaMov, setCategoriaMov] = useState(defaultCategory);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!defaultOpen) return;
    setCategoriaMov(defaultCategory);
    setTipoMov("despesa");
    setOpen(true);
  }, [defaultCategory, defaultOpen]);

  const reset = () => {
    setArquivos([]);
    setTipoMov("despesa");
    setDocumento("");
    setNome("");
    setNomeEncontrado(false);
    setValorMov(0);
    setCategoriaMov(defaultCategory);
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selected = event.target.files?.[0];
    event.target.value = "";
    if (!selected) return;
    if (!["application/pdf", "image/jpeg", "image/png", "image/webp"].includes(selected.type)) {
      toast.error("Formato inválido. Use PDF, JPG, PNG ou WEBP."); return;
    }
    if (selected.size > 10 * 1024 * 1024) { toast.error("Arquivo muito grande. Limite de 10 MB."); return; }
    setArquivos((current) => [...current, selected]);
  };

  const findRegisteredName = async (formattedDocument: string) => {
    const documentDigits = formattedDocument.replace(/\D/g, "");
    if (documentDigits.length !== 11 && documentDigits.length !== 14) return null;
    return findFinancialHolder({ data: { projectId: projetoId, document: documentDigits } });
  };

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => {
      setOpen(nextOpen);
      if (!nextOpen) reset();
    }}>
      <DialogTrigger asChild>
        <Button><Plus className="size-4" /> Nova movimentação</Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Nova movimentação</DialogTitle>
          <DialogDescription>Cadastre uma receita ou despesa vinculada a este projeto.</DialogDescription>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={async (event) => {
            event.preventDefault();
            const form = new FormData(event.currentTarget);
            const description = String(form.get("descricao") || "Movimentação");

            if (!categoriaMov) {
              toast.error("Selecione uma categoria.");
              return;
            }
            if (documento && !validateDocument(documento)) {
              toast.error("Documento (CPF/CNPJ) inválido.");
              return;
            }

            if (valorMov <= 0) {
              toast.error("Informe um valor maior que zero.");
              return;
            }
            try {
              const created = await createFinancialMovement({ data: {
                projectId: projetoId, type: tipoMov, description,
                category: categoriaMov, amount: valorMov,
                holderDocument: documento || undefined, holderName: nome || undefined,
              } });
              for (const receipt of arquivos) {
                const upload = new FormData();
                upload.set("file", receipt); upload.set("projectId", projetoId);
                upload.set("financialMovementId", created.id); upload.set("name", `Comprovante — ${description}`);
                upload.set("category", categoriaMov);
                const response = await fetch("/api/documents/upload", { method: "POST", body: upload, credentials: "same-origin" });
                if (!response.ok) throw new Error(`Movimentação registrada, mas o comprovante falhou: ${await response.text()}`);
              }
              setOpen(false);
              reset();
              await onSaved();
              toast.success("Movimentação registrada!");
            } catch (error) {
              toast.error(error instanceof Error ? error.message : "Não foi possível registrar a movimentação.");
            }
          }}
        >
          <div className="space-y-2">
            <Label>Tipo</Label>
            <Select value={tipoMov} onValueChange={(value) => setTipoMov(value as "receita" | "despesa")}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="receita">Receita</SelectItem>
                <SelectItem value="despesa">Despesa</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="nova-movimentacao-descricao">Descrição</Label>
            <Input
              id="nova-movimentacao-descricao"
              name="descricao"
              defaultValue={defaultDescription}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="nova-movimentacao-documento">
              {tipoMov === "receita" ? "Origem – CNPJ ou CPF" : "Destinatário – CNPJ ou CPF"}
            </Label>
            <div className="relative">
              <Input
                id="nova-movimentacao-documento"
                value={documento}
                onChange={(event) => {
                  const formatted = formatDocument(event.target.value);
                  setDocumento(formatted);
                  void findRegisteredName(formatted).then((registeredName) => {
                    if (registeredName) { setNome(registeredName); setNomeEncontrado(true); }
                    else { setNomeEncontrado(false); if ([11, 14].includes(formatted.replace(/\D/g, "").length)) setNome(""); }
                  });
                }}
                placeholder="000.000.000-00 ou 00.000.000/0000-00"
              />
              {documento && !validateDocument(documento) && (
                <AlertCircle className="absolute right-3 top-2.5 size-4 text-destructive" />
              )}
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="nova-movimentacao-nome">Nome</Label>
            <Input
              id="nova-movimentacao-nome"
              value={nome}
              onChange={(event) => {
                setNome(event.target.value);
                setNomeEncontrado(false);
              }}
              placeholder="Nome ou razão social"
              required
            />
            {nomeEncontrado && (
              <p className="text-xs text-success">Nome preenchido a partir de um cadastro existente.</p>
            )}
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Categoria</Label>
              <Select value={categoriaMov} onValueChange={setCategoriaMov}>
                <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>
                  {financialCategories.map((category) => (
                    <SelectItem key={category} value={category}>{category}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Valor (R$)</Label>
              <CurrencyInput value={valorMov} onValueChange={setValorMov} required />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Comprovante</Label>
            <div className="flex items-center gap-3">
              <Button type="button" variant="outline" className="w-full justify-start gap-2" onClick={() => fileInputRef.current?.click()}>
                <Paperclip className="size-4" /> Anexar comprovante
              </Button>
              <input ref={fileInputRef} type="file" className="hidden" accept=".pdf,.jpg,.jpeg,.png,.webp" onChange={handleFileChange} />
            </div>
            {arquivos.length > 0 ? <ul className="space-y-2">{arquivos.map((item, index) => (
              <li key={`${item.name}-${index}`} className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
                <span className="truncate">{item.name}</span>
                <Button type="button" variant="ghost" size="icon" className="size-8 text-destructive" onClick={() => setArquivos((current) => current.filter((_, i) => i !== index))}><Trash2 className="size-4" /></Button>
              </li>
            ))}</ul> : null}
            <p className="text-[10px] text-muted-foreground">PDF, JPG, PNG ou WEBP até 10 MB por arquivo.</p>
          </div>
          <DialogFooter><Button type="submit">Registrar</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

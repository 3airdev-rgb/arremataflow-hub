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
import { categoriasDocumentos, type StatusKey } from "@/lib/mock-data";
import { getLocalFinancialMovements, saveLocalFinancialMovements } from "@/lib/local-financial-movements";
import { formatDocument, validateDocument } from "@/lib/utils-validation";
import { logProjectAudit } from "@/lib/local-project-audit";
import type { Movimentacao } from "@/routes/projetos.$id.financeiro";

const fileToDataUrl = (file: File) => new Promise<string>((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(String(reader.result));
  reader.onerror = () => reject(reader.error);
  reader.readAsDataURL(file);
});

export function NewFinancialMovementDialog({
  projetoId,
  onSaved,
  defaultOpen = false,
  defaultCategory = "",
  defaultDescription = "",
}: {
  projetoId: string;
  onSaved: () => void;
  defaultOpen?: boolean;
  defaultCategory?: string;
  defaultDescription?: string;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const [arquivos, setArquivos] = useState<File[]>([]);
  const [perguntarNovoComprovante, setPerguntarNovoComprovante] = useState(false);
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
    setPerguntarNovoComprovante(false);
    setTipoMov("despesa");
    setDocumento("");
    setNome("");
    setNomeEncontrado(false);
    setValorMov(0);
    setCategoriaMov(defaultCategory);
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const allowedTypes = ["application/pdf", "image/jpeg", "image/jpg", "image/png", "image/webp"];
    if (!allowedTypes.includes(file.type)) {
      toast.error("Formato inválido. Use PDF, JPG, PNG ou WEBP.");
      event.target.value = "";
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.error("Arquivo muito grande. Limite de 2MB.");
      event.target.value = "";
      return;
    }
    setArquivos((current) => [...current, file]);
    setPerguntarNovoComprovante(true);
    event.target.value = "";
  };

  const findRegisteredName = (formattedDocument: string) => {
    const documentDigits = formattedDocument.replace(/\D/g, "");
    if (documentDigits.length !== 11 && documentDigits.length !== 14) return null;

    const movementMatch = getLocalFinancialMovements(projetoId).find(
      (movement) => movement.document_holder_document?.replace(/\D/g, "") === documentDigits && movement.document_holder_name
    );
    if (movementMatch?.document_holder_name) return movementMatch.document_holder_name;

    const candidateKeys = [
      "arremataflow:service-providers",
      `arremataflow:project:${projetoId}:providers`,
      "arremataflow:people",
    ];
    const visit = (value: unknown): string | null => {
      if (Array.isArray(value)) {
        for (const item of value) {
          const found = visit(item);
          if (found) return found;
        }
      } else if (value && typeof value === "object") {
        const record = value as Record<string, unknown>;
        const storedDocument = String(record["document"] ?? record["documento"] ?? record["cpf"] ?? record["cnpj"] ?? "").replace(/\D/g, "");
        if (storedDocument === documentDigits) {
          const storedName = record["name"] ?? record["nome"] ?? record["tradeName"] ?? record["razaoSocial"];
          if (typeof storedName === "string" && storedName.trim()) return storedName;
        }
        for (const nested of Object.values(record)) {
          const found = visit(nested);
          if (found) return found;
        }
      }
      return null;
    };

    for (const key of candidateKeys) {
      try {
        const stored = localStorage.getItem(key);
        if (stored) {
          const found = visit(JSON.parse(stored));
          if (found) return found;
        }
      } catch {
        // Ignora cadastros locais inválidos e mantém o preenchimento manual.
      }
    }
    return null;
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

            const documentDigits = documento.replace(/\D/g, "");
            const movement: Movimentacao = {
              id: `local-${Date.now()}`,
              descricao: description,
              categoria: categoriaMov,
              data: new Date().toLocaleDateString("pt-BR"),
              valor: valorMov,
              status: "pendente" as StatusKey,
              comprovanteUrl: null,
              comprovanteUrls: await Promise.all(arquivos.map(fileToDataUrl)),
              document_holder_document: documento || null,
              document_holder_name: nome || null,
              document_holder_type: tipoMov === "receita" ? "Origem" : "Destinatário",
              document_type: documento ? (documentDigits.length === 11 ? "CPF" : "CNPJ") : null,
              tipo: tipoMov,
            };

            saveLocalFinancialMovements(projetoId, [movement, ...getLocalFinancialMovements(projetoId)]);
            logProjectAudit(
              projetoId,
              `incluiu uma ${tipoMov === "receita" ? "receita" : "despesa"}: ${description}${arquivos.length ? `, com ${arquivos.length} comprovante(s)` : ""}`,
              "Inclusão",
            );
            setOpen(false);
            reset();
            onSaved();
            toast.success("Movimentação registrada!");
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
                  const registeredName = findRegisteredName(formatted);
                  if (registeredName) {
                    setNome(registeredName);
                    setNomeEncontrado(true);
                  } else {
                    setNomeEncontrado(false);
                    if ([11, 14].includes(formatted.replace(/\D/g, "").length)) setNome("");
                  }
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
                  {categoriasDocumentos.map((category) => (
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
            {arquivos.length > 0 && (
              <ul className="space-y-2">
                {arquivos.map((file, index) => (
                  <li key={`${file.name}-${index}`} className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
                    <span className="truncate">{index + 1}. {file.name}</span>
                    <Button type="button" variant="ghost" size="icon" className="size-8 text-destructive" onClick={() => setArquivos((current) => current.filter((_, itemIndex) => itemIndex !== index))}>
                      <Trash2 className="size-4" />
                    </Button>
                  </li>
                ))}
              </ul>
            )}
            {perguntarNovoComprovante && (
              <div className="rounded-md border bg-muted/30 p-3">
                <p className="text-sm font-medium">Deseja inserir outro comprovante?</p>
                <div className="mt-2 flex gap-2">
                  <Button type="button" size="sm" onClick={() => {
                    setPerguntarNovoComprovante(false);
                    fileInputRef.current?.click();
                  }}>Sim</Button>
                  <Button type="button" size="sm" variant="outline" onClick={() => setPerguntarNovoComprovante(false)}>Não</Button>
                </div>
              </div>
            )}
            <p className="text-[10px] text-muted-foreground">PDF, JPG, PNG ou WEBP até 2MB.</p>
          </div>
          <DialogFooter><Button type="submit">Registrar</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

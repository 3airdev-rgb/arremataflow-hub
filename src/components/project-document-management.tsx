import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { FileText, FolderOpen, Upload, UploadCloud } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { financialCategories } from "@/lib/financial-categories";
import { listProjectDocuments } from "@/lib/documents";
import { showValidationAlert } from "@/lib/validation-feedback";

export function ProjectDocumentManagement({ projectId }: { projectId: string }) {
  const { data: docs = [], refetch } = useQuery({
    queryKey: ["project-documents", projectId],
    queryFn: () => listProjectDocuments({ data: { projectId } }),
  });
  const [category, setCategory] = useState("Todas");
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [sending, setSending] = useState(false);
  const visibleDocuments =
    category === "Todas" ? docs : docs.filter((document) => document.categoria === category);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold">Gestão Documental</h3>
          <p className="text-sm text-muted-foreground">
            Documentos do projeto organizados por categoria
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Upload className="size-4" /> Upload de documento
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Enviar documento</DialogTitle>
              <DialogDescription>Selecione o arquivo e a categoria.</DialogDescription>
            </DialogHeader>
            <form
              className="space-y-4"
              onSubmit={async (event) => {
                event.preventDefault();
                const formData = new FormData(event.currentTarget);
                if (!file) {
                  showValidationAlert("Selecione um arquivo.");
                  return;
                }
                formData.set("file", file);
                formData.set("projectId", projectId);
                formData.set("name", String(formData.get("nome") || file.name));
                setSending(true);
                try {
                  const response = await fetch("/api/documents/upload", {
                    method: "POST",
                    body: formData,
                    credentials: "same-origin",
                  });
                  if (!response.ok) throw new Error(await response.text());
                  await refetch();
                  setFile(null);
                  setOpen(false);
                  window.dispatchEvent(
                    new CustomEvent("project-documents-updated", { detail: { projectId } }),
                  );
                  toast.success("Documento enviado com segurança!");
                } catch (error) {
                  showValidationAlert(
                    error,
                    "Não foi possível enviar o documento. Revise os campos informados.",
                  );
                } finally {
                  setSending(false);
                }
              }}
            >
              <label className="grid cursor-pointer place-items-center gap-2 rounded-xl border-2 border-dashed border-border bg-muted/40 p-8 text-center">
                <UploadCloud className="size-8 text-muted-foreground" strokeWidth={1.5} />
                <p className="text-sm text-muted-foreground">
                  {file ? file.name : "Clique para selecionar PDF, JPG, PNG ou WEBP (até 10 MB)"}
                </p>
                <input
                  type="file"
                  className="sr-only"
                  accept=".pdf,.jpg,.jpeg,.png,.webp"
                  onChange={(event) => setFile(event.target.files?.[0] || null)}
                />
              </label>
              <div className="space-y-2">
                <Label htmlFor="embedded-document-name">Nome do documento</Label>
                <Input
                  id="embedded-document-name"
                  name="nome"
                  placeholder="Certidão negativa.pdf"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Categoria</Label>
                <Select name="categoria" defaultValue="Aquisição">
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {financialCategories.map((item) => (
                      <SelectItem key={item} value={item}>
                        {item}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <DialogFooter>
                <Button type="submit" disabled={sending}>
                  {sending ? "Enviando..." : "Enviar"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-5 lg:grid-cols-[240px_1fr]">
        <aside className="surface-card h-max p-3">
          <p className="px-2 pb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Categorias
          </p>
          {["Todas", ...financialCategories].map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setCategory(item)}
              className={cn(
                "flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors",
                category === item ? "bg-primary-soft font-medium text-brand" : "hover:bg-muted",
              )}
            >
              <FolderOpen className="size-4" strokeWidth={1.75} />
              {item}
              <span className="ml-auto text-xs text-muted-foreground">
                {item === "Todas"
                  ? docs.length
                  : docs.filter((document) => document.categoria === item).length}
              </span>
            </button>
          ))}
        </aside>
        <div className="surface-card overflow-hidden">
          <div
            tabIndex={0}
            role="region"
            aria-label="Tabela com rolagem horizontal"
            className="table-scroll overflow-x-auto"
          >
            <table className="w-full text-sm">
              <thead className="bg-muted/60 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 font-medium">Documento</th>
                  <th className="px-4 py-3 font-medium">Categoria</th>
                  <th className="px-4 py-3 font-medium">Versão</th>
                  <th className="px-4 py-3 font-medium">Autor</th>
                  <th className="px-4 py-3 font-medium">Data</th>
                </tr>
              </thead>
              <tbody>
                {visibleDocuments.map((document) => (
                  <tr key={document.id} className="border-t border-border hover:bg-muted/40">
                    <td className="px-4 py-3">
                      <a
                        href={document.url}
                        className="flex items-center gap-2 font-medium text-brand hover:underline"
                      >
                        <FileText className="size-4" />
                        {document.nome}
                      </a>
                      <span className="pl-6 text-xs text-muted-foreground">{document.tamanho}</span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{document.categoria}</td>
                    <td className="px-4 py-3">
                      <span className="rounded-full bg-primary-soft px-2 py-0.5 text-xs font-medium text-brand">
                        {document.versao}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{document.autor}</td>
                    <td className="px-4 py-3 text-muted-foreground">{document.data}</td>
                  </tr>
                ))}
                {!visibleDocuments.length ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-10 text-center text-muted-foreground">
                      Nenhum documento nesta categoria.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

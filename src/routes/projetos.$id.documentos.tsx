import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Upload, FolderOpen, FileText, UploadCloud, ArrowLeft } from "lucide-react";
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
import { cn } from "@/lib/utils";
import { financialCategories } from "@/lib/financial-categories";
import { listProjectDocuments } from "@/lib/documents";
import { showValidationAlert } from "@/lib/validation-feedback";

export const Route = createFileRoute("/projetos/$id/documentos")({
  validateSearch: (search: Record<string, unknown>) => ({
    categoria: typeof search["categoria"] === "string" ? search["categoria"] : undefined,
    retorno: typeof search["retorno"] === "string" ? search["retorno"] : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Documentos do Projeto | ArremataFlow" },
      {
        name: "description",
        content: "Organize documentos por categoria com versionamento, autor e data de publicação.",
      },
      { property: "og:title", content: "Gestão Documental | ArremataFlow" },
      {
        property: "og:description",
        content: "Upload, categorias e histórico de versões dos documentos.",
      },
    ],
  }),
  component: DocumentosProjeto,
});

function DocumentosProjeto() {
  const { id } = Route.useParams();
  const { categoria, retorno } = Route.useSearch();
  const { data: docs = [], refetch } = useQuery({
    queryKey: ["project-documents", id],
    queryFn: () => listProjectDocuments({ data: { projectId: id } }),
  });
  const [cat, setCat] = useState<string>(categoria || "Todas");
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [sending, setSending] = useState(false);

  const handleBack = () => {
    const projectPrefix = `/projetos/${id}`;
    const safeReturn =
      retorno?.startsWith(projectPrefix) && !retorno.startsWith(`${projectPrefix}/documentos`)
        ? retorno
        : `${projectPrefix}?aba=documentos`;

    window.location.assign(safeReturn);
  };

  const visiveis = cat === "Todas" ? docs : docs.filter((d) => d.categoria === cat);

  return (
    <AppLayout
      title="Gestão Documental"
      subtitle="Documentos do projeto organizados por categoria"
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
                onSubmit={async (e) => {
                  e.preventDefault();
                  const fd = new FormData(e.currentTarget);
                  if (!file) {
                    showValidationAlert("Selecione um arquivo.");
                    return;
                  }
                  fd.set("file", file);
                  fd.set("projectId", id);
                  fd.set("name", String(fd.get("nome") || file.name));
                  setSending(true);
                  try {
                    const response = await fetch("/api/documents/upload", {
                      method: "POST",
                      body: fd,
                      credentials: "same-origin",
                    });
                    if (!response.ok) throw new Error(await response.text());
                    await refetch();
                    setFile(null);
                    setOpen(false);
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
                  <Label htmlFor="nome">Nome do documento</Label>
                  <Input id="nome" name="nome" placeholder="Certidão negativa.pdf" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="categoria">Categoria</Label>
                  <Select name="categoria" defaultValue="Aquisição">
                    <SelectTrigger id="categoria">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {financialCategories.map((c) => (
                        <SelectItem key={c} value={c}>
                          {c}
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
      }
    >
      <div className="grid gap-5 lg:grid-cols-[240px_1fr]">
        <aside className="surface-card h-max p-3">
          <p className="px-2 pb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Categorias
          </p>
          {["Todas", ...financialCategories].map((c) => (
            <button
              key={c}
              onClick={() => setCat(c)}
              className={cn(
                "flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors",
                cat === c ? "bg-primary-soft font-medium text-brand" : "hover:bg-muted",
              )}
            >
              <FolderOpen className="size-4" strokeWidth={1.75} />
              {c}
              <span className="ml-auto text-xs text-muted-foreground">
                {c === "Todas" ? docs.length : docs.filter((d) => d.categoria === c).length}
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
                {visiveis.map((d) => (
                  <tr key={d.id} className="border-t border-border hover:bg-muted/40">
                    <td className="px-4 py-3">
                      <a
                        href={d.url}
                        className="flex items-center gap-2 font-medium text-brand hover:underline"
                      >
                        <FileText className="size-4 text-brand" strokeWidth={1.75} />
                        {d.nome}
                      </a>
                      <span className="pl-6 text-xs text-muted-foreground">{d.tamanho}</span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{d.categoria}</td>
                    <td className="px-4 py-3">
                      <span className="rounded-full bg-primary-soft px-2 py-0.5 text-xs font-medium text-brand">
                        {d.versao}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{d.autor}</td>
                    <td className="px-4 py-3 text-muted-foreground">{d.data}</td>
                  </tr>
                ))}
                {visiveis.length === 0 ? (
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
    </AppLayout>
  );
}

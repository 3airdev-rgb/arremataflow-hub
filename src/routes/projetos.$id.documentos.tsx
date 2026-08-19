import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Upload, FolderOpen, FileText, UploadCloud } from "lucide-react";
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
import { documentos as docsMock, categoriasDocumentos } from "@/lib/mock-data";

export const Route = createFileRoute("/projetos/$id/documentos")({
  head: () => ({
    meta: [
      { title: "Documentos do Projeto | ArremataFlow" },
      {
        name: "description",
        content: "Organize documentos por categoria com versionamento, autor e data de publicação.",
      },
      { property: "og:title", content: "Gestão Documental | ArremataFlow" },
      { property: "og:description", content: "Upload, categorias e histórico de versões dos documentos." },
    ],
  }),
  component: DocumentosProjeto,
});

function DocumentosProjeto() {
  const [docs, setDocs] = useState(docsMock);
  const [cat, setCat] = useState<string>("Todas");
  const [open, setOpen] = useState(false);

  // Efeito para simular a sincronização com o financeiro
  // Em uma aplicação real, isso seria uma query no banco de dados
  const syncWithFinanceiro = () => {
    const searchParams = new URLSearchParams(window.location.search);
    const sync = searchParams.get("sync");
    if (sync) {
      // Simulação: se houver movimentações novas com comprovante, elas apareceriam aqui
      // Como estamos usando mock local, apenas garantimos que o componente reage a mudanças
    }
  };
  const visiveis = cat === "Todas" ? docs : docs.filter((d) => d.categoria === cat);

  return (
    <AppLayout
      title="Gestão Documental"
      subtitle="Documentos do projeto organizados por categoria"
      actions={
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button>
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
              onSubmit={(e) => {
                e.preventDefault();
                const fd = new FormData(e.currentTarget);
                setDocs((prev) => [
                  {
                    id: `d${Date.now()}`,
                    nome: String(fd.get("nome") || "Documento.pdf"),
                    categoria: String(fd.get("categoria") || "Aquisição"),
                    versao: "v1",
                    autor: "Camila Andrade",
                    data: "16/08/2026",
                    tamanho: "420 KB",
                  },
                  ...prev,
                ]);
                setOpen(false);
                toast.success("Documento enviado!");
              }}
            >
              <div className="grid place-items-center gap-2 rounded-xl border-2 border-dashed border-border bg-muted/40 p-8 text-center">
                <UploadCloud className="size-8 text-muted-foreground" strokeWidth={1.5} />
                <p className="text-sm text-muted-foreground">
                  Arraste o arquivo aqui ou clique para selecionar
                </p>
              </div>
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
                    {categoriasDocumentos.map((c) => (
                      <SelectItem key={c} value={c}>
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <DialogFooter>
                <Button type="submit">Enviar</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      }
    >
      <div className="grid gap-5 lg:grid-cols-[240px_1fr]">
        <aside className="surface-card h-max p-3">
          <p className="px-2 pb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Categorias
          </p>
          {["Todas", ...categoriasDocumentos].map((c) => (
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
          <div className="overflow-x-auto">
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
                      <span className="flex items-center gap-2 font-medium">
                        <FileText className="size-4 text-brand" strokeWidth={1.75} />
                        {d.nome}
                      </span>
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

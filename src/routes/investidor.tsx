import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { UploadCloud, FileText } from "lucide-react";
import { AppLayout } from "@/components/app-layout";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { projetos, documentos, formatBRL } from "@/lib/mock-data";

export const Route = createFileRoute("/investidor")({
  head: () => ({
    meta: [
      { title: "Portal do Investidor | ArremataFlow" },
      {
        name: "description",
        content:
          "Acompanhe seus projetos, andamento das etapas, posição financeira e documentos autorizados.",
      },
      { property: "og:title", content: "Portal do Investidor | ArremataFlow" },
      { property: "og:description", content: "Transparência total sobre seus investimentos imobiliários." },
    ],
  }),
  component: PortalInvestidor,
});

const meus = projetos.slice(0, 3);

function PortalInvestidor() {
  const [sel, setSel] = useState(meus[0]);
  const [open, setOpen] = useState(false);

  if (!sel) return null;

  return (
    <AppLayout title="Portal do Investidor" subtitle="Marcos Ribeiro · 3 projetos ativos">
      <div className="grid gap-5 lg:grid-cols-[320px_1fr]">
        <aside className="space-y-3">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Meus projetos
          </h3>
          {meus.map((p) => (
            <button
              key={p.id}
              onClick={() => setSel(p)}
              className={cn(
                "surface-card flex w-full gap-3 p-3 text-left transition-shadow hover:shadow-soft",
                sel.id === p.id && "ring-2 ring-brand",
              )}
            >
              <img
                src={p.foto}
                alt={`Imóvel ${p.nome}`}
                loading="lazy"
                className="size-14 rounded-lg object-cover"
              />
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium">{p.nome}</span>
                <span className="block text-xs text-muted-foreground">{p.codigo}</span>
                <StatusBadge status={p.status} className="mt-1" />
              </span>
            </button>
          ))}
        </aside>

        <div className="space-y-5">
          <div className="surface-card overflow-hidden">
            <img
              src={sel.foto}
              alt={`Foto do imóvel ${sel.nome}`}
              className="h-48 w-full object-cover"
            />
            <div className="p-5">
              <h2 className="text-xl">{sel.nome}</h2>
              <p className="text-sm text-muted-foreground">
                {sel.endereco} — {sel.cidade}
              </p>
              <div className="mt-4">
                <p className="mb-1 text-xs text-muted-foreground">
                  Andamento — {sel.etapa} ({sel.progresso}%)
                </p>
                <Progress value={sel.progresso} />
              </div>
              <div className="mt-5 grid gap-4 sm:grid-cols-3">
                <div className="rounded-lg bg-muted p-3">
                  <p className="text-xs text-muted-foreground">Capital investido</p>
                  <p className="font-semibold">{formatBRL(sel.capitalInvestido)}</p>
                </div>
                <div className="rounded-lg bg-primary-soft p-3">
                  <p className="text-xs text-brand">Resultado projetado</p>
                  <p className="font-semibold text-brand">{formatBRL(sel.resultadoProjetado)}</p>
                </div>
                <div className="rounded-lg bg-success-soft p-3">
                  <p className="text-xs text-success">Minha cota</p>
                  <p className="font-semibold text-success">45%</p>
                </div>
              </div>
            </div>
          </div>

          <div className="surface-card p-5">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <h3 className="text-base font-semibold">Documentos autorizados</h3>
              <Dialog open={open} onOpenChange={setOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline">
                    <UploadCloud className="size-4" /> Enviar documento
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Enviar comprovante</DialogTitle>
                    <DialogDescription>
                      Envie comprovantes de aporte ou documentos solicitados.
                    </DialogDescription>
                  </DialogHeader>
                  <form
                    className="space-y-4"
                    onSubmit={(e) => {
                      e.preventDefault();
                      setOpen(false);
                      toast.success("Documento enviado para análise!");
                    }}
                  >
                    <div className="grid place-items-center gap-2 rounded-xl border-2 border-dashed border-border bg-muted/40 p-8 text-center">
                      <UploadCloud className="size-8 text-muted-foreground" strokeWidth={1.5} />
                      <p className="text-sm text-muted-foreground">
                        Arraste o arquivo aqui ou clique para selecionar
                      </p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="titulo-doc">Título</Label>
                      <Input id="titulo-doc" placeholder="Comprovante de aporte" required />
                    </div>
                    <DialogFooter>
                      <Button type="submit">Enviar</Button>
                    </DialogFooter>
                  </form>
                </DialogContent>
              </Dialog>
            </div>
            <ul className="divide-y divide-border text-sm">
              {documentos.slice(0, 4).map((d) => (
                <li key={d.id} className="flex flex-wrap justify-between gap-2 py-3">
                  <span className="flex items-center gap-2 font-medium">
                    <FileText className="size-4 text-brand" strokeWidth={1.75} />
                    {d.nome}
                  </span>
                  <span className="text-muted-foreground">
                    {d.categoria} · {d.data}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}

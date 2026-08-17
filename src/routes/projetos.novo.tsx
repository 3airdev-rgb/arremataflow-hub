import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { House, Handshake, BriefcaseBusiness, Users, Plus, Trash2, Save, UserPlus } from "lucide-react";
import { AppLayout } from "@/components/app-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { projetos } from "@/lib/mock-data";
import { InvestorRegistrationModal } from "@/components/investor-registration-modal";

export const Route = createFileRoute("/projetos/novo")({
  head: () => ({
    meta: [
      { title: "Novo Projeto | ArremataFlow" },
      {
        name: "description",
        content:
          "Cadastre um novo projeto com dados do imóvel, fotos, aquisição, modalidade de assessoria e participantes.",
      },
      { property: "og:title", content: "Cadastro de Projeto | ArremataFlow" },
      {
        property: "og:description",
        content: "Registre imóvel, aquisição, assessoria e participantes em um único formulário.",
      },
    ],
  }),
  component: NovoProjeto,
});

function SectionCard({
  icon: Icon,
  title,
  description,
  children,
}: {
  icon: typeof House;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="surface-card p-6">
      <div className="mb-5 flex items-start gap-3">
        <span className="grid size-10 place-items-center rounded-xl bg-primary-soft text-brand">
          <Icon className="size-5" strokeWidth={1.75} />
        </span>
        <div>
          <h3 className="text-base font-semibold">{title}</h3>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
      </div>
      {children}
    </section>
  );
}

const galeria = projetos[0]?.fotos ?? [];

function NovoProjeto() {
  const navigate = useNavigate();
  const [principal, setPrincipal] = useState(galeria[0] ?? "");
  const [isInvestorModalOpen, setIsInvestorModalOpen] = useState(false);
  const [participantes, setParticipantes] = useState([
    { nome: "Marcos Ribeiro", papel: "Investidor", percentual: "45" },
  ]);

  return (
    <AppLayout title="Cadastro de Projeto" subtitle="Novo projeto imobiliário">
      <form
        className="grid gap-6"
        onSubmit={(e) => {
          e.preventDefault();
          toast.success("Projeto salvo com sucesso!");
          setTimeout(() => navigate({ to: "/projetos/$id", params: { id: "1" } }), 600);
        }}
      >
        <SectionCard icon={House} title="Imóvel" description="Dados cadastrais e localização">
          <div className="mb-6">
            <div className="mb-3 flex items-center justify-between">
              <Label>Fotos do imóvel</Label>
              <Button type="button" variant="outline" size="sm">
                <Plus className="size-4" /> Adicionar fotos
              </Button>
            </div>
            <img
              src={principal}
              alt="Foto principal do imóvel"
              className="aspect-[16/7] w-full rounded-xl object-cover"
            />
            <div className="mt-3 flex gap-3 overflow-x-auto pb-1">
              {galeria.map((f) => (
                <button
                  type="button"
                  key={f}
                  onClick={() => setPrincipal(f)}
                  className={`size-20 shrink-0 overflow-hidden rounded-lg border-2 transition-colors ${
                    principal === f ? "border-brand" : "border-transparent hover:border-border"
                  }`}
                >
                  <img src={f} alt="Miniatura do imóvel" className="size-full object-cover" />
                </button>
              ))}
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="end">Endereço</Label>
              <Input id="end" placeholder="Rua, número, complemento" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cidade">Cidade / UF</Label>
              <Input id="cidade" placeholder="São Paulo / SP" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cep">CEP</Label>
              <Input id="cep" placeholder="00000-000" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="area">Área privativa</Label>
              <Input id="area" placeholder="78 m²" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="mat">Matrícula / Cartório</Label>
              <Input id="mat" placeholder="128.442 - 5º CRI" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tipo">Tipo do imóvel</Label>
              <Select>
                <SelectTrigger id="tipo">
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="apartamento">Apartamento</SelectItem>
                  <SelectItem value="casa">Casa</SelectItem>
                  <SelectItem value="comercial">Comercial</SelectItem>
                  <SelectItem value="terreno">Terreno</SelectItem>
                  <SelectItem value="galpao">Galpão</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="iptu">Inscrição municipal (IPTU)</Label>
              <Input id="iptu" placeholder="000.000.0000-0" />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="obs">Observações</Label>
              <Textarea id="obs" rows={3} placeholder="Situação de ocupação, pendências conhecidas..." />
            </div>
          </div>
        </SectionCard>

        <SectionCard icon={Handshake} title="Aquisição" description="Origem, valores e pagamento">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="origem">Origem</Label>
              <Select>
                <SelectTrigger id="origem">
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="leilao-judicial">Leilão judicial</SelectItem>
                  <SelectItem value="leilao-extra">Leilão extrajudicial</SelectItem>
                  <SelectItem value="venda-direta">Venda direta bancária</SelectItem>
                  <SelectItem value="particular">Aquisição particular</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="valor">Valor de aquisição</Label>
              <Input id="valor" placeholder="R$ 0,00" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="data">Data da aquisição</Label>
              <Input id="data" type="date" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pagamento">Forma de pagamento</Label>
              <Select>
                <SelectTrigger id="pagamento">
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="avista">À vista</SelectItem>
                  <SelectItem value="parcelado">Parcelado</SelectItem>
                  <SelectItem value="financiado">Financiado</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="itbi">ITBI e custas estimadas</Label>
              <Input id="itbi" placeholder="R$ 0,00" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="leiloeiro">Leiloeiro / Comitente</Label>
              <Input id="leiloeiro" placeholder="Nome do leiloeiro" />
            </div>
          </div>
        </SectionCard>

        <SectionCard
          icon={BriefcaseBusiness}
          title="Modalidade de Assessoria"
          description="Escopo contratado e honorários"
        >
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="modalidade">Modalidade</Label>
              <Select>
                <SelectTrigger id="modalidade">
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="completa">Assessoria Completa</SelectItem>
                  <SelectItem value="juridica">Assessoria Jurídica</SelectItem>
                  <SelectItem value="operacional">Assessoria Operacional</SelectItem>
                  <SelectItem value="consultiva">Consultoria pontual</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="honorario">Honorário (% sobre resultado)</Label>
              <Input id="honorario" placeholder="20" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="fixo">language selector</Label>
              <Input id="fixo" placeholder="R$ 0,00" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="resp">Assessor responsável</Label>
              <Select>
                <SelectTrigger id="resp">
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="camila">Camila Andrade</SelectItem>
                  <SelectItem value="rafael">Rafael Lima</SelectItem>
                  <SelectItem value="juliana">Juliana Prado</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </SectionCard>

        <SectionCard icon={Users} title="Participantes" description="Investidores e cotas do projeto">
          <div className="space-y-3">
            {participantes.map((p, i) => (
              <div key={i} className="grid gap-3 md:grid-cols-[1fr_1fr_140px_auto]">
                <Input
                  value={p.nome}
                  placeholder="Nome do participante"
                  onChange={(e) =>
                    setParticipantes((prev) =>
                      prev.map((x, idx) => (idx === i ? { ...x, nome: e.target.value } : x)),
                    )
                  }
                />
                <Input
                  value={p.papel}
                  placeholder="Papel"
                  onChange={(e) =>
                    setParticipantes((prev) =>
                      prev.map((x, idx) => (idx === i ? { ...x, papel: e.target.value } : x)),
                    )
                  }
                />
                <Input
                  value={p.percentual}
                  placeholder="% cota"
                  onChange={(e) =>
                    setParticipantes((prev) =>
                      prev.map((x, idx) => (idx === i ? { ...x, percentual: e.target.value } : x)),
                    )
                  }
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label="Remover participante"
                  onClick={() => setParticipantes((prev) => prev.filter((_, idx) => idx !== i))}
                >
                  <Trash2 className="size-4 text-destructive" />
                </Button>
              </div>
            ))}
            <div className="flex flex-wrap gap-3">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() =>
                  setParticipantes((prev) => [...prev, { nome: "", papel: "Investidor", percentual: "" }])
                }
              >
                <Plus className="size-4" /> Adicionar participante
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="border-brand text-brand hover:bg-brand/5"
                onClick={() => setIsInvestorModalOpen(true)}
              >
                <UserPlus className="size-4" /> Cadastrar novo investidor
              </Button>
            </div>
          </div>

          <InvestorRegistrationModal
            open={isInvestorModalOpen}
            onOpenChange={setIsInvestorModalOpen}
            onSave={(data) => {
              setParticipantes((prev) => [
                ...prev,
                { nome: data.nome, papel: "Investidor", percentual: "" },
              ]);
              toast.success(`Investidor ${data.nome} cadastrado e adicionado!`);
            }}
          />
        </SectionCard>

        <div className="flex justify-end gap-3 pb-4">
          <Button type="button" variant="outline" onClick={() => navigate({ to: "/projetos" })}>
            Cancelar
          </Button>
          <Button type="submit">
            <Save className="size-4" /> Salvar projeto
          </Button>
        </div>
      </form>
    </AppLayout>
  );
}

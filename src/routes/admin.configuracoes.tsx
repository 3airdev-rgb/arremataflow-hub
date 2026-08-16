import { createFileRoute, Link } from "@tanstack/react-router";
import { Building2, Percent, BellRing, Save, Users } from "lucide-react";
import { AppLayout } from "@/components/app-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/configuracoes")({
  head: () => ({
    meta: [
      { title: "Configurações da Empresa | ArremataFlow" },
      {
        name: "description",
        content: "Dados cadastrais, regras de honorários e distribuição, e canais de notificação da empresa.",
      },
      { property: "og:title", content: "Configurações da Empresa | ArremataFlow" },
      { property: "og:description", content: "Ajuste o comportamento do sistema multiempresa." },
    ],
  }),
  component: ConfiguracoesPage,
});

function Bloco({
  icon: Icon,
  titulo,
  descricao,
  children,
}: {
  icon: typeof Building2;
  titulo: string;
  descricao: string;
  children: React.ReactNode;
}) {
  return (
    <section className="surface-card p-6">
      <div className="mb-5 flex items-start gap-3">
        <span className="grid size-10 place-items-center rounded-xl bg-primary-soft text-brand">
          <Icon className="size-5" strokeWidth={1.75} />
        </span>
        <div>
          <h3 className="text-base font-semibold">{titulo}</h3>
          <p className="text-sm text-muted-foreground">{descricao}</p>
        </div>
      </div>
      {children}
    </section>
  );
}

function ConfiguracoesPage() {
  return (
    <AppLayout
      title="Configurações da Empresa"
      subtitle="Arremata Capital LTDA"
      actions={
        <div className="flex gap-2">
          <Button asChild variant="outline">
            <Link to="/admin/usuarios">
              <Users className="size-4" /> Usuários
            </Link>
          </Button>
          <Button onClick={() => toast.success("Configurações salvas!")}>
            <Save className="size-4" /> Salvar
          </Button>
        </div>
      }
    >
      <div className="grid gap-6">
        <Bloco icon={Building2} titulo="Dados da empresa" descricao="Identificação e contato">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="razao">Razão social</Label>
              <Input id="razao" defaultValue="Arremata Capital LTDA" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cnpj">CNPJ</Label>
              <Input id="cnpj" defaultValue="42.118.900/0001-33" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="emailc">E-mail institucional</Label>
              <Input id="emailc" defaultValue="contato@arremataflow.com" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tel">Telefone</Label>
              <Input id="tel" defaultValue="(11) 4002-8922" />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="endc">Endereço</Label>
              <Input id="endc" defaultValue="Av. Paulista, 1000 — São Paulo / SP" />
            </div>
          </div>
        </Bloco>

        <Bloco
          icon={Percent}
          titulo="Regras financeiras"
          descricao="Honorários padrão e política de distribuição"
        >
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="hon">Honorário padrão (%)</Label>
              <Input id="hon" defaultValue="20" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="taxa">Taxa de administração (%)</Label>
              <Input id="taxa" defaultValue="2" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="trib">Alíquota de tributos (%)</Label>
              <Input id="trib" defaultValue="9,4" />
            </div>
          </div>
          <div className="mt-5 space-y-3">
            {[
              "Distribuir apenas após quitação de todas as despesas",
              "Reter reserva de contingência de 5%",
              "Exigir aprovação dupla para distribuições acima de R$ 100 mil",
            ].map((r, i) => (
              <div key={r} className="flex items-center justify-between">
                <Label htmlFor={`regra-${i}`} className="font-normal">
                  {r}
                </Label>
                <Switch id={`regra-${i}`} defaultChecked={i !== 2} />
              </div>
            ))}
          </div>
        </Bloco>

        <Bloco icon={BellRing} titulo="Notificações" descricao="Canais e gatilhos de alerta">
          <div className="space-y-3">
            {[
              "E-mail para prazos vencendo em 3 dias",
              "WhatsApp para pendências críticas",
              "Resumo semanal para investidores",
              "Alerta de desvio de orçamento de obra",
            ].map((n, i) => (
              <div key={n} className="flex items-center justify-between">
                <Label htmlFor={`notif-${i}`} className="font-normal">
                  {n}
                </Label>
                <Switch id={`notif-${i}`} defaultChecked={i !== 1} />
              </div>
            ))}
          </div>
        </Bloco>
      </div>
    </AppLayout>
  );
}

import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Building2, Percent, BellRing, Save, Users } from "lucide-react";
import { AppLayout } from "@/components/app-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { brazilianStates, getOrganizationSettings, updateOrganizationSettings } from "@/lib/organization-settings";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/configuracoes")({
  head: () => ({
    meta: [
      { title: "Configurações | ArremataFlow" },
      {
        name: "description",
        content: "Dados cadastrais, regras de honorários e distribuição, e canais de notificação da empresa.",
      },
      { property: "og:title", content: "Configurações | ArremataFlow" },
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
  const queryClient = useQueryClient();
  const { data: organization, isLoading } = useQuery({
    queryKey: ["active-organization"],
    queryFn: () => getOrganizationSettings(),
  });
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: "",
    legalDocument: "",
    institutionalEmail: "",
    phone: "",
    address: "",
    addressNumber: "",
    addressComplement: "",
    district: "",
    city: "",
    state: "" as "" | (typeof brazilianStates)[number],
    postalCode: "",
  });

  useEffect(() => {
    if (organization) setForm({
      name: organization.name,
      legalDocument: organization.legalDocument,
      institutionalEmail: organization.institutionalEmail,
      phone: organization.phone,
      address: organization.address,
      addressNumber: organization.addressNumber,
      addressComplement: organization.addressComplement,
      district: organization.district,
      city: organization.city,
      state: organization.state as "" | (typeof brazilianStates)[number],
      postalCode: organization.postalCode,
    });
  }, [organization]);

  const change = (field: keyof typeof form, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const formatarCpfCnpj = (valor: string) => {
    const digitos = valor.replace(/\D/g, "").slice(0, 14);

    if (digitos.length <= 11) {
      return digitos
        .replace(/^(\d{3})(\d)/, "$1.$2")
        .replace(/^(\d{3})\.(\d{3})(\d)/, "$1.$2.$3")
        .replace(/\.(\d{3})(\d)/, ".$1-$2");
    }

    return digitos
      .replace(/^(\d{2})(\d)/, "$1.$2")
      .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
      .replace(/\.(\d{3})(\d)/, ".$1/$2")
      .replace(/(\d{4})(\d)/, "$1-$2");
  };

  return (
    <AppLayout
      title="Configurações"
      subtitle={form.name || organization?.name || "Empresa"}
      companyName={form.name || organization?.name || "Empresa"}
      actions={
        <div className="flex gap-2">
          <Button asChild variant="outline">
            <Link to="/admin/usuarios">
              <Users className="size-4" /> Usuários
            </Link>
          </Button>
          <Button disabled={isLoading || saving || form.name.trim().length < 2} onClick={async () => {
            setSaving(true);
            try {
              const updated = await updateOrganizationSettings({ data: form });
              queryClient.setQueryData(["active-organization"], updated);
              toast.success("Configurações salvas!");
            } catch {
              toast.error("Não foi possível salvar as configurações.");
            } finally {
              setSaving(false);
            }
          }}>
            <Save className="size-4" /> Salvar
          </Button>
        </div>
      }
    >
      <div className="grid gap-6">
        <Bloco icon={Building2} titulo="Dados cadastrais" descricao="Identificação e contato">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="razao">Nome ou Razão social</Label>
              <Input id="razao" value={form.name} onChange={(event) => change("name", event.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cnpj">CPF ou CNPJ</Label>
              <Input
                id="cnpj"
                inputMode="numeric"
                maxLength={18}
                placeholder="000.000.000-00 ou 00.000.000/0000-00"
                value={form.legalDocument}
                onChange={(event) => change("legalDocument", formatarCpfCnpj(event.target.value))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="emailc">E-mail institucional</Label>
              <Input id="emailc" type="email" value={form.institutionalEmail} onChange={(event) => change("institutionalEmail", event.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tel">Telefone</Label>
              <Input id="tel" value={form.phone} onChange={(event) => change("phone", event.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="endc">Endereço</Label>
              <Input id="endc" value={form.address} onChange={(event) => change("address", event.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="numero">Nro.</Label>
              <Input id="numero" inputMode="numeric" value={form.addressNumber} onChange={(event) => change("addressNumber", event.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="complemento">Complemento</Label>
              <Input id="complemento" value={form.addressComplement} onChange={(event) => change("addressComplement", event.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="bairro">Bairro</Label>
              <Input id="bairro" value={form.district} onChange={(event) => change("district", event.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cidade">Cidade</Label>
              <Input id="cidade" value={form.city} onChange={(event) => change("city", event.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="uf">UF</Label>
              <Select value={form.state} onValueChange={(value) => change("state", value)}>
                <SelectTrigger id="uf" aria-label="UF">
                  <SelectValue placeholder="Selecione a UF" />
                </SelectTrigger>
                <SelectContent>
                  {brazilianStates.map((state) => <SelectItem key={state} value={state}>{state}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="cep">CEP</Label>
              <Input id="cep" inputMode="numeric" maxLength={9} placeholder="00000-000" value={form.postalCode} onChange={(event) => change("postalCode", event.target.value)} />
            </div>
          </div>
        </Bloco>

        <Bloco
          icon={Percent}
          titulo="Regras financeiras"
          descricao="Honorários padrão e política de distribuição"
        >
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="hon">Honorário padrão (%)</Label>
              <Input id="hon" />
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

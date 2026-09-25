import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Building2, Percent, BellRing, Save, Users, CreditCard, ArrowUpRight } from "lucide-react";
import { AppLayout } from "@/components/app-layout";
import { formatPhoneInput, PHONE_PLACEHOLDER } from "@/lib/phone";
import { showValidationAlert } from "@/lib/validation-feedback";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BirthDateField } from "@/components/ui/birth-date-field";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  brazilianStates,
  getOrganizationSettings,
  updateOrganizationSettings,
} from "@/lib/organization-settings";
import { maritalStatusOptions } from "@/lib/marital-status";
import { getCurrentOrganizationUser } from "@/lib/organization-users";
import { homePathForRole } from "@/lib/role-home";
import { getCompanySubscription, requestSubscriptionUpgrade } from "@/lib/subscription";
import {
  higherSubscriptionPlans,
  subscriptionCycleLabel,
  subscriptionDateLabel,
  type SubscriptionPlanId,
} from "@/lib/subscription-plans";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/configuracoes")({
  beforeLoad: async () => {
    const user = await getCurrentOrganizationUser();
    if (!["owner", "admin"].includes(user.role)) throw redirect({ to: homePathForRole(user.role) });
  },
  head: () => ({
    meta: [
      { title: "Configurações | ArremataFlow" },
      {
        name: "description",
        content:
          "Dados cadastrais, regras de honorários e distribuição, e canais de notificação da empresa.",
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

function Campo({
  id,
  label,
  span,
  children,
}: {
  id: string;
  label: string;
  span: string;
  children: React.ReactNode;
}) {
  return (
    <div className={`space-y-1.5 ${span}`}>
      <Label htmlFor={id}>{label}</Label>
      {children}
    </div>
  );
}

function ConfiguracoesPage() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("visao-geral");
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [targetPlanId, setTargetPlanId] = useState<SubscriptionPlanId | "">("");
  const [requestingUpgrade, setRequestingUpgrade] = useState(false);
  const { data: organization, isLoading } = useQuery({
    queryKey: ["active-organization"],
    queryFn: () => getOrganizationSettings(),
  });
  const { data: subscription, isLoading: subscriptionLoading } = useQuery({
    queryKey: ["company-subscription"],
    queryFn: () => getCompanySubscription(),
  });
  const availableUpgrades =
    subscription?.status === "active" &&
    subscription.planId &&
    ["starter", "professional"].includes(subscription.planId)
      ? higherSubscriptionPlans(subscription.planId as SubscriptionPlanId)
      : [];
  const planNames: Record<SubscriptionPlanId, string> = {
    starter: "Starter",
    professional: "Profissional",
    custom: "Personalizado",
  };
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
    birthDate: "",
    maritalStatus: "" as "" | (typeof maritalStatusOptions)[number]["value"],
    bankName: "",
    bankAgency: "",
    bankAccount: "",
    taskDeadlineEmails: true,
    weeklyInvestorReports: true,
    defaultAdvisoryFeePercent: 10,
  });

  useEffect(() => {
    if (organization)
      setForm({
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
        birthDate: organization.birthDate,
        maritalStatus: organization.maritalStatus as
          "" | (typeof maritalStatusOptions)[number]["value"],
        bankName: organization.bankName,
        bankAgency: organization.bankAgency,
        bankAccount: organization.bankAccount,
        taskDeadlineEmails: organization.taskDeadlineEmails,
        weeklyInvestorReports: organization.weeklyInvestorReports,
        defaultAdvisoryFeePercent: organization.defaultAdvisoryFeePercent,
      });
  }, [organization]);

  const isCpf = form.legalDocument.replace(/\D/g, "").length === 11;

  const change = (field: keyof typeof form, value: string | boolean | number) => {
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
          {activeTab === "visao-geral" ? (
            <Button
              disabled={isLoading || saving || form.name.trim().length < 2}
              onClick={async () => {
                setSaving(true);
                try {
                  const updated = await updateOrganizationSettings({ data: form });
                  queryClient.setQueryData(["active-organization"], updated);
                  await Promise.all([
                    queryClient.invalidateQueries({ queryKey: ["contacts"] }),
                    queryClient.invalidateQueries({ queryKey: ["organization-users"] }),
                    queryClient.invalidateQueries({ queryKey: ["current-organization-user"] }),
                  ]);
                  toast.success("Configurações salvas!");
                } catch (error) {
                  showValidationAlert(error, "Não foi possível salvar as configurações.");
                } finally {
                  setSaving(false);
                }
              }}
            >
              <Save className="size-4" /> Salvar
            </Button>
          ) : null}
        </div>
      }
    >
      <Tabs value={activeTab} onValueChange={setActiveTab} className="min-w-0">
        <TabsList className="mb-5 w-full justify-start sm:w-auto" aria-label="Configurações">
          <TabsTrigger value="visao-geral" className="flex-1 sm:flex-none">
            Visão Geral
          </TabsTrigger>
          <TabsTrigger value="assinatura" className="flex-1 sm:flex-none">
            Assinatura
          </TabsTrigger>
        </TabsList>
        <TabsContent value="visao-geral">
          <div className="grid gap-6">
            <Bloco icon={Building2} titulo="Dados cadastrais" descricao="Identificação e contato">
              <div className="grid gap-x-4 gap-y-3 sm:grid-cols-6 lg:grid-cols-12">
                <Campo id="razao" label="Nome ou Razão social" span="sm:col-span-6 lg:col-span-6">
                  <Input
                    id="razao"
                    value={form.name}
                    onChange={(event) => change("name", event.target.value)}
                  />
                </Campo>
                <Campo id="cnpj" label="CPF ou CNPJ" span="sm:col-span-3 lg:col-span-3">
                  <Input
                    id="cnpj"
                    inputMode="numeric"
                    maxLength={18}
                    placeholder="CPF ou CNPJ"
                    value={form.legalDocument}
                    onChange={(event) =>
                      change("legalDocument", formatarCpfCnpj(event.target.value))
                    }
                  />
                </Campo>
                <Campo id="tel" label="Telefone" span="sm:col-span-3 lg:col-span-3">
                  <Input
                    id="tel"
                    value={form.phone}
                    inputMode="tel"
                    maxLength={14}
                    placeholder={PHONE_PLACEHOLDER}
                    onChange={(event) => change("phone", formatPhoneInput(event.target.value))}
                  />
                </Campo>
                <Campo
                  id="emailc"
                  label="E-mail do administrador"
                  span="sm:col-span-6 lg:col-span-6"
                >
                  <Input
                    id="emailc"
                    type="email"
                    required
                    value={form.institutionalEmail}
                    onChange={(event) => change("institutionalEmail", event.target.value)}
                  />
                </Campo>
                {isCpf ? (
                  <>
                    <Campo id="nasc" label="Data de nascimento" span="sm:col-span-3 lg:col-span-3">
                      <BirthDateField
                        id="nasc"
                        value={form.birthDate}
                        onValueChange={(value) => change("birthDate", value)}
                      />
                    </Campo>
                    <Campo id="civil" label="Estado civil" span="sm:col-span-3 lg:col-span-3">
                      <Select
                        value={form.maritalStatus}
                        onValueChange={(value) => change("maritalStatus", value)}
                      >
                        <SelectTrigger id="civil" aria-label="Estado civil">
                          <SelectValue placeholder="Selecione" />
                        </SelectTrigger>
                        <SelectContent>
                          {maritalStatusOptions.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </Campo>
                  </>
                ) : null}
                <p className="text-xs text-muted-foreground sm:col-span-6 lg:col-span-12">
                  O e-mail também é o acesso do administrador; se for alterado, use o novo e-mail no
                  próximo login. Com CPF ou CNPJ válido, o administrador passa a aparecer nas buscas
                  de investidor, assessor e gestor de projetos.
                </p>

                <Campo id="endc" label="Endereço" span="sm:col-span-4 lg:col-span-6">
                  <Input
                    id="endc"
                    value={form.address}
                    onChange={(event) => change("address", event.target.value)}
                  />
                </Campo>
                <Campo id="numero" label="Nro." span="sm:col-span-2 lg:col-span-2">
                  <Input
                    id="numero"
                    inputMode="numeric"
                    value={form.addressNumber}
                    onChange={(event) => change("addressNumber", event.target.value)}
                  />
                </Campo>
                <Campo id="complemento" label="Complemento" span="sm:col-span-6 lg:col-span-4">
                  <Input
                    id="complemento"
                    value={form.addressComplement}
                    onChange={(event) => change("addressComplement", event.target.value)}
                  />
                </Campo>
                <Campo id="bairro" label="Bairro" span="sm:col-span-3 lg:col-span-4">
                  <Input
                    id="bairro"
                    value={form.district}
                    onChange={(event) => change("district", event.target.value)}
                  />
                </Campo>
                <Campo id="cidade" label="Cidade" span="sm:col-span-3 lg:col-span-4">
                  <Input
                    id="cidade"
                    value={form.city}
                    onChange={(event) => change("city", event.target.value)}
                  />
                </Campo>
                <Campo id="uf" label="UF" span="sm:col-span-3 lg:col-span-2">
                  <Select value={form.state} onValueChange={(value) => change("state", value)}>
                    <SelectTrigger id="uf" aria-label="UF">
                      <SelectValue placeholder="UF" />
                    </SelectTrigger>
                    <SelectContent>
                      {brazilianStates.map((state) => (
                        <SelectItem key={state} value={state}>
                          {state}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Campo>
                <Campo id="cep" label="CEP" span="sm:col-span-3 lg:col-span-2">
                  <Input
                    id="cep"
                    inputMode="numeric"
                    maxLength={9}
                    placeholder="00000-000"
                    value={form.postalCode}
                    onChange={(event) => change("postalCode", event.target.value)}
                  />
                </Campo>
              </div>

              <div className="mt-6 border-t pt-4">
                <h4 className="mb-3 text-sm font-medium">Dados bancários</h4>
                <div className="grid gap-x-4 gap-y-3 sm:grid-cols-6 lg:grid-cols-12">
                  <Campo id="banco" label="Banco" span="sm:col-span-6 lg:col-span-5">
                    <Input
                      id="banco"
                      maxLength={80}
                      placeholder="Ex: Itaú"
                      value={form.bankName}
                      onChange={(event) => change("bankName", event.target.value)}
                    />
                  </Campo>
                  <Campo id="agencia" label="Agência" span="sm:col-span-3 lg:col-span-3">
                    <Input
                      id="agencia"
                      maxLength={20}
                      inputMode="numeric"
                      placeholder="0000"
                      value={form.bankAgency}
                      onChange={(event) => change("bankAgency", event.target.value)}
                    />
                  </Campo>
                  <Campo id="conta" label="Conta corrente" span="sm:col-span-3 lg:col-span-4">
                    <Input
                      id="conta"
                      maxLength={30}
                      placeholder="00000-0"
                      value={form.bankAccount}
                      onChange={(event) => change("bankAccount", event.target.value)}
                    />
                  </Campo>
                </div>
              </div>
            </Bloco>

            <div className="grid min-w-0 gap-6 lg:grid-cols-2 [&>section]:h-full">
              <Bloco
                icon={Percent}
                titulo="Regras financeiras"
                descricao="Honorários padrão e política de distribuição"
              >
                <div className="grid gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="hon">Honorário padrão (%)</Label>
                    <Input
                      id="hon"
                      type="number"
                      min="0"
                      max="100"
                      step="0.01"
                      value={form.defaultAdvisoryFeePercent}
                      onChange={(event) =>
                        change("defaultAdvisoryFeePercent", Number(event.target.value))
                      }
                    />
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
                  <div className="flex items-center justify-between">
                    <Label htmlFor="notif-0" className="font-normal">
                      E-mail para prazos vencendo em 3 dias
                    </Label>
                    <Switch
                      id="notif-0"
                      checked={form.taskDeadlineEmails}
                      onCheckedChange={(checked) => change("taskDeadlineEmails", checked)}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label htmlFor="notif-1" className="font-normal">
                      WhatsApp para pendências críticas
                    </Label>
                    <Switch id="notif-1" disabled />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label htmlFor="notif-2" className="font-normal">
                      Resumo semanal para investidores
                    </Label>
                    <Switch
                      id="notif-2"
                      checked={form.weeklyInvestorReports}
                      onCheckedChange={(checked) => change("weeklyInvestorReports", checked)}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label htmlFor="notif-3" className="font-normal">
                      Alerta de desvio de orçamento de obra
                    </Label>
                    <Switch id="notif-3" defaultChecked />
                  </div>
                </div>
              </Bloco>
            </div>
          </div>
        </TabsContent>
        <TabsContent value="assinatura">
          <Bloco icon={CreditCard} titulo="Assinatura" descricao="Plano e vigência da empresa">
            {subscriptionLoading ? (
              <p className="text-sm text-muted-foreground">Carregando assinatura...</p>
            ) : subscription ? (
              <div className="space-y-6">
                <dl className="grid gap-4 sm:grid-cols-2">
                  <div className="rounded-lg border border-border p-4">
                    <dt className="text-sm text-muted-foreground">Plano</dt>
                    <dd className="mt-1 font-semibold">{subscription.planName}</dd>
                  </div>
                  <div className="rounded-lg border border-border p-4">
                    <dt className="text-sm text-muted-foreground">Ciclo</dt>
                    <dd className="mt-1 font-semibold">
                      {subscriptionCycleLabel(subscription.billingCycle)}
                    </dd>
                  </div>
                  <div className="rounded-lg border border-border p-4">
                    <dt className="text-sm text-muted-foreground">Início da vigência</dt>
                    <dd className="mt-1 font-semibold">
                      {subscriptionDateLabel(subscription.startsAt)}
                    </dd>
                  </div>
                  <div className="rounded-lg border border-border p-4">
                    <dt className="text-sm text-muted-foreground">Término da vigência</dt>
                    <dd className="mt-1 font-semibold">
                      {subscriptionDateLabel(subscription.endsAt)}
                    </dd>
                  </div>
                </dl>
                {(!subscription.billingCycle || !subscription.startsAt || !subscription.endsAt) && (
                  <p className="text-sm text-muted-foreground">
                    Os dados de cobrança e vigência são exibidos somente quando registrados para
                    esta empresa.
                  </p>
                )}
                {availableUpgrades.length > 0 ? (
                  <Button
                    onClick={() => {
                      setTargetPlanId("");
                      setUpgradeOpen(true);
                    }}
                  >
                    <ArrowUpRight className="size-4" /> Fazer upgrade
                  </Button>
                ) : null}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                Nenhuma assinatura vinculada a esta empresa.
              </p>
            )}
          </Bloco>
        </TabsContent>
      </Tabs>
      <Dialog open={upgradeOpen} onOpenChange={setUpgradeOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Solicitar upgrade</DialogTitle>
            <DialogDescription>
              A solicitação será enviada ao Desenvolvedor para análise. Nenhum plano será ativado
              nem haverá cobrança nesta etapa.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="upgrade-plan">Plano desejado</Label>
            <Select
              value={targetPlanId}
              onValueChange={(value) => setTargetPlanId(value as SubscriptionPlanId)}
            >
              <SelectTrigger id="upgrade-plan">
                <SelectValue placeholder="Selecione um plano superior" />
              </SelectTrigger>
              <SelectContent>
                {availableUpgrades.map((planId) => (
                  <SelectItem key={planId} value={planId}>
                    {planNames[planId]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setUpgradeOpen(false)}>
              Cancelar
            </Button>
            <Button
              disabled={!targetPlanId || requestingUpgrade}
              onClick={async () => {
                if (!targetPlanId) return;
                setRequestingUpgrade(true);
                try {
                  const result = await requestSubscriptionUpgrade({ data: { targetPlanId } });
                  toast.success(`Solicitação ${result.controlNumber} aberta.`);
                  setUpgradeOpen(false);
                } catch (cause) {
                  toast.error(
                    cause instanceof Error
                      ? cause.message
                      : "Não foi possível solicitar o upgrade.",
                  );
                } finally {
                  setRequestingUpgrade(false);
                }
              }}
            >
              Enviar solicitação
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}

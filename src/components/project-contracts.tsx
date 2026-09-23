import * as React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Building2, FilePenLine, Hammer, House, Plus, Save } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CurrencyInput } from "@/components/ui/currency-input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
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
import { Textarea } from "@/components/ui/textarea";
import { getCommercialData } from "@/lib/commercial";
import { listProjectContracts, saveProjectContract } from "@/lib/contracts";
import { formatBRL } from "@/lib/format-currency";

type ContractType = "advisory" | "construction_services" | "real_estate_sale";
type ContractForm = {
  contractedName: string;
  contractedDocument: string;
  contractedEmail: string;
  contractedAddress: string;
  object: string;
  startDate: string;
  endDate: string;
  amount: number;
  paymentTerms: string;
  terminationNoticeDays: number;
  forum: string;
  notes: string;
  providerId: string;
};
type Provider = { id: string; name: string; document?: string; email?: string; address?: string };

const emptyForm: ContractForm = {
  contractedName: "",
  contractedDocument: "",
  contractedEmail: "",
  contractedAddress: "",
  object: "",
  startDate: "",
  endDate: "",
  amount: 0,
  paymentTerms: "",
  terminationNoticeDays: 30,
  forum: "",
  notes: "",
  providerId: "",
};
const typeLabels: Record<ContractType, string> = {
  advisory: "Contrato de assessoria",
  construction_services: "Prestação de serviços de obra",
  real_estate_sale: "Compra e Venda de Imóvel",
};

function Field({
  label,
  children,
  className = "",
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`space-y-1.5 ${className}`}>
      <Label>{label}</Label>
      {children}
    </div>
  );
}

export function ProjectContracts({
  projectId,
  projectName,
  projectCode,
  projectAddress,
  advisors = [],
  canEdit,
}: {
  projectId: string;
  projectName: string;
  projectCode: string;
  projectAddress: string;
  advisors?: string[];
  canEdit: boolean;
}) {
  const queryClient = useQueryClient();
  const [open, setOpen] = React.useState(false);
  const [step, setStep] = React.useState<1 | 2 | 3>(1);
  const [type, setType] = React.useState<ContractType>("advisory");
  const [title, setTitle] = React.useState(typeLabels.advisory);
  const [form, setForm] = React.useState<ContractForm>(emptyForm);
  const [saving, setSaving] = React.useState(false);
  const { data: contracts = [] } = useQuery({
    queryKey: ["project-contracts", projectId],
    queryFn: () => listProjectContracts({ data: { projectId } }),
  });
  const { data: commercial } = useQuery({
    queryKey: ["commercial-data", projectId],
    queryFn: () => getCommercialData({ data: { projectId } }),
  });
  const providers = (commercial?.providers || []) as Provider[];

  const start = () => {
    setStep(1);
    setType("advisory");
    setTitle(typeLabels.advisory);
    setForm({ ...emptyForm, contractedName: advisors[0] || "" });
    setOpen(true);
  };
  const selectType = (value: ContractType) => {
    setType(value);
    setTitle(typeLabels[value]);
    setForm((current) => ({
      ...current,
      contractedName: value === "advisory" ? advisors[0] || "" : "",
      contractedDocument: "",
      contractedEmail: "",
      contractedAddress: "",
      providerId: "",
    }));
    setStep(2);
  };
  const selectProvider = (providerId: string) => {
    const provider = providers.find((item) => item.id === providerId);
    setForm((current) => ({
      ...current,
      providerId,
      contractedName: provider?.name || "",
      contractedDocument: provider?.document || "",
      contractedEmail: provider?.email || "",
      contractedAddress: provider?.address || "",
    }));
  };
  const save = async () => {
    setSaving(true);
    try {
      await saveProjectContract({ data: { projectId, type, title, data: form } });
      await queryClient.invalidateQueries({ queryKey: ["project-contracts", projectId] });
      toast.success("Rascunho do contrato salvo.");
      setOpen(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível salvar o contrato.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="surface-card p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h3 className="text-base font-semibold">Contratos do projeto</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Crie contratos por um fluxo guiado e mantenha os rascunhos vinculados ao projeto.
            </p>
          </div>
          {canEdit ? (
            <Button onClick={start}>
              <Plus className="size-4" /> Novo contrato
            </Button>
          ) : null}
        </div>
        <div className="mt-5 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <strong>Modelos em preparação.</strong> Os dados já podem ser preenchidos e salvos. A
          geração do documento final será liberada quando os modelos jurídicos forem incluídos.
        </div>
      </div>
      {contracts.length ? (
        <div className="grid gap-4 md:grid-cols-2">
          {contracts.map((contract) => (
            <div key={contract.id} className="surface-card p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold">{contract.title}</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {typeLabels[contract.type as ContractType] || contract.type}
                  </p>
                </div>
                <Badge variant="secondary">Rascunho</Badge>
              </div>
              <dl className="mt-4 grid sm:grid-cols-2 gap-3 text-sm">
                <div>
                  <dt className="text-muted-foreground">Contratado</dt>
                  <dd className="font-medium">
                    {String(contract.data["contractedName"] || "Não informado")}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Valor</dt>
                  <dd className="font-medium">{formatBRL(Number(contract.data["amount"]) || 0)}</dd>
                </div>
              </dl>
              <p className="mt-4 text-xs text-muted-foreground">
                Atualizado em {new Date(contract.updatedAt).toLocaleString("pt-BR")}
              </p>
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-lg border border-dashed p-8 text-center">
          <FilePenLine className="mx-auto size-8 text-muted-foreground" />
          <p className="mt-3 text-sm text-muted-foreground">
            Nenhum contrato iniciado neste projeto.
          </p>
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Novo contrato</DialogTitle>
            <DialogDescription>
              Etapa {step} de 3 ·{" "}
              {step === 1
                ? "Escolha o tipo"
                : step === 2
                  ? "Preencha os dados"
                  : "Revise o rascunho"}
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-3 gap-2">
            <div className={`h-1 rounded ${step >= 1 ? "bg-brand" : "bg-muted"}`} />
            <div className={`h-1 rounded ${step >= 2 ? "bg-brand" : "bg-muted"}`} />
            <div className={`h-1 rounded ${step >= 3 ? "bg-brand" : "bg-muted"}`} />
          </div>
          {step === 1 ? (
            <div className="grid gap-4 sm:grid-cols-3">
              <button
                type="button"
                onClick={() => selectType("advisory")}
                className="rounded-xl border p-5 text-left transition hover:border-brand hover:bg-brand/5"
              >
                <Building2 className="size-6 text-brand" />
                <p className="mt-3 font-semibold">Contrato de assessoria</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Formalização da assessoria vinculada ao projeto.
                </p>
              </button>
              <button
                type="button"
                onClick={() => selectType("construction_services")}
                className="rounded-xl border p-5 text-left transition hover:border-brand hover:bg-brand/5"
              >
                <Hammer className="size-6 text-amber-600" />
                <p className="mt-3 font-semibold">Prestação de serviços de obra</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Contratação de prestador cadastrado no módulo Obra.
                </p>
              </button>
              <button
                type="button"
                onClick={() => selectType("real_estate_sale")}
                className="rounded-xl border p-5 text-left transition hover:border-brand hover:bg-brand/5"
              >
                <House className="size-6 text-emerald-600" />
                <p className="mt-3 font-semibold">Compra e Venda de Imóvel</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Formalização da venda do imóvel associado ao projeto.
                </p>
              </button>
            </div>
          ) : null}
          {step === 2 ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Título" className="sm:col-span-2">
                <Input value={title} onChange={(event) => setTitle(event.target.value)} />
              </Field>
              {type === "construction_services" ? (
                <Field label="Prestador cadastrado" className="sm:col-span-2">
                  <Select value={form.providerId} onValueChange={selectProvider}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione um prestador" />
                    </SelectTrigger>
                    <SelectContent>
                      {providers.map((provider) => (
                        <SelectItem key={provider.id} value={provider.id}>
                          {provider.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
              ) : null}
              <Field
                label={
                  type === "real_estate_sale"
                    ? "Nome/Razão social do comprador"
                    : "Nome/Razão social do contratado"
                }
              >
                <Input
                  value={form.contractedName}
                  onChange={(event) => setForm({ ...form, contractedName: event.target.value })}
                />
              </Field>
              <Field label="CPF/CNPJ">
                <Input
                  value={form.contractedDocument}
                  onChange={(event) => setForm({ ...form, contractedDocument: event.target.value })}
                />
              </Field>
              <Field label="E-mail">
                <Input
                  type="email"
                  value={form.contractedEmail}
                  onChange={(event) => setForm({ ...form, contractedEmail: event.target.value })}
                />
              </Field>
              <Field label="Endereço">
                <Input
                  value={form.contractedAddress}
                  onChange={(event) => setForm({ ...form, contractedAddress: event.target.value })}
                />
              </Field>
              <Field label="Objeto e escopo" className="sm:col-span-2">
                <Textarea
                  className="min-h-24"
                  value={form.object}
                  onChange={(event) => setForm({ ...form, object: event.target.value })}
                  placeholder="Descreva os serviços, entregas e responsabilidades."
                />
              </Field>
              <Field label="Data de início">
                <Input
                  type="date"
                  value={form.startDate}
                  onChange={(event) => setForm({ ...form, startDate: event.target.value })}
                />
              </Field>
              <Field label="Data final">
                <Input
                  type="date"
                  min={form.startDate || undefined}
                  value={form.endDate}
                  onChange={(event) => setForm({ ...form, endDate: event.target.value })}
                />
              </Field>
              <Field label="Valor">
                <CurrencyInput
                  value={form.amount}
                  onValueChange={(amount) => setForm({ ...form, amount })}
                />
              </Field>
              <Field label="Aviso para rescisão (dias)">
                <Input
                  type="number"
                  min={0}
                  max={365}
                  value={form.terminationNoticeDays}
                  onChange={(event) =>
                    setForm({ ...form, terminationNoticeDays: Number(event.target.value) })
                  }
                />
              </Field>
              <Field label="Forma e condições de pagamento" className="sm:col-span-2">
                <Textarea
                  value={form.paymentTerms}
                  onChange={(event) => setForm({ ...form, paymentTerms: event.target.value })}
                />
              </Field>
              <Field label="Foro">
                <Input
                  value={form.forum}
                  onChange={(event) => setForm({ ...form, forum: event.target.value })}
                />
              </Field>
              <Field label="Observações">
                <Input
                  value={form.notes}
                  onChange={(event) => setForm({ ...form, notes: event.target.value })}
                />
              </Field>
            </div>
          ) : null}
          {step === 3 ? (
            <div className="space-y-4">
              <div className="rounded-lg border bg-muted/30 p-4">
                <p className="text-xs font-medium uppercase text-muted-foreground">Projeto</p>
                <p className="mt-1 font-semibold">
                  {projectCode} · {projectName}
                </p>
                <p className="text-sm text-muted-foreground">{projectAddress}</p>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <p className="text-xs text-muted-foreground">Tipo</p>
                  <p className="font-medium">{typeLabels[type]}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Contratado</p>
                  <p className="font-medium">{form.contractedName}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Valor</p>
                  <p className="font-medium">{formatBRL(form.amount)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Vigência</p>
                  <p className="font-medium">
                    {form.startDate || "Não informada"} a {form.endDate || "prazo indeterminado"}
                  </p>
                </div>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Objeto</p>
                <p className="mt-1 whitespace-pre-wrap text-sm">{form.object}</p>
              </div>
            </div>
          ) : null}
          {step > 1 ? (
            <DialogFooter>
              <Button variant="outline" onClick={() => setStep(step === 3 ? 2 : 1)}>
                Voltar
              </Button>
              {step === 2 ? (
                <Button
                  disabled={
                    !title.trim() ||
                    form.contractedName.trim().length < 2 ||
                    form.object.trim().length < 5
                  }
                  onClick={() => setStep(3)}
                >
                  Revisar
                </Button>
              ) : (
                <Button disabled={saving} onClick={() => void save()}>
                  <Save className="size-4" />
                  {saving ? "Salvando..." : "Salvar rascunho"}
                </Button>
              )}
            </DialogFooter>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}

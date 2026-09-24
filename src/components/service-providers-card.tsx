import * as React from "react";
import { Building2, Pencil, Plus, Search, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CurrencyInput } from "@/components/ui/currency-input";
import { DatePickerField } from "@/components/ui/date-picker-field";
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
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { formatBRL } from "@/lib/format-currency";
import { formatPhoneInput, PHONE_PLACEHOLDER } from "@/lib/phone";
import {
  getCommercialData,
  saveProvider as saveProviderRecord,
  saveProviderAssignment,
} from "@/lib/commercial";

type Provider = {
  id: string;
  personType: "PF" | "PJ";
  name: string;
  tradeName: string;
  document: string;
  phone: string;
  email: string;
  address: string;
  specialty: string;
  professionalRegistry: string;
  references: string;
  bank: string;
  agency: string;
  account: string;
  pix: string;
  issuesInvoice: boolean;
};

type Assignment = {
  id: string;
  providerId: string;
  responsibilities: string[];
  startDate: string;
  expectedDelivery: string;
  approvedBudget: number;
  status: WorkStatus;
};

type WorkStatus = "nao-iniciado" | "iniciado" | "em-andamento" | "concluido" | "atrasado";

const statusOptions: { value: WorkStatus; label: string }[] = [
  { value: "nao-iniciado", label: "Não iniciado" },
  { value: "iniciado", label: "Iniciado" },
  { value: "em-andamento", label: "Em andamento" },
  { value: "concluido", label: "Concluído" },
  { value: "atrasado", label: "Atrasado" },
];

const responsibilities = [
  "Projetos",
  "Orçamento e Compras",
  "Licenças",
  "Segurança e Proteção",
  "Instalação do canteiro",
  "Demolição e Retirada",
  "Estrutura e Alvenaria",
  "Hidráulica",
  "Elétrica",
  "Lógica e Dados",
  "Revestimentos",
  "Acabamentos",
  "Pintura",
  "Limpeza e Entrega",
];

const initialProviders: Provider[] = [];

const emptyProvider: Provider = {
  id: "",
  personType: "PF",
  name: "",
  tradeName: "",
  document: "",
  phone: "",
  email: "",
  address: "",
  specialty: "",
  professionalRegistry: "",
  references: "",
  bank: "",
  agency: "",
  account: "",
  pix: "",
  issuesInvoice: false,
};

const emptyAssignment: Omit<Assignment, "id" | "providerId"> = {
  responsibilities: [],
  startDate: "",
  expectedDelivery: "",
  approvedBudget: 0,
  status: "nao-iniciado",
};

const formatDate = (value: string) =>
  value
    ? new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC" }).format(new Date(`${value}T00:00:00Z`))
    : "Não informado";

const getOverdueDays = (assignment: Assignment) => {
  if (!assignment.expectedDelivery || assignment.status === "concluido") return null;
  const dateParts = assignment.expectedDelivery.split("-");
  const year = Number(dateParts[0]);
  const month = Number(dateParts[1]);
  const day = Number(dateParts[2]);
  const now = new Date();
  const todayUtc = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  const deliveryUtc = Date.UTC(year, month - 1, day);
  const difference = Math.floor((todayUtc - deliveryUtc) / 86_400_000);
  return difference >= 0 ? difference : null;
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

export function ServiceProvidersCard({ projectId }: { projectId: string }) {
  const [providers, setProviders] = React.useState<Provider[]>(initialProviders);
  const [assignments, setAssignments] = React.useState<Assignment[]>([]);
  const [open, setOpen] = React.useState(false);
  const [mode, setMode] = React.useState<"list" | "new" | "assign">("list");
  const [query, setQuery] = React.useState("");
  const [providerForm, setProviderForm] = React.useState<Provider>(emptyProvider);
  const [selectedProvider, setSelectedProvider] = React.useState<Provider | null>(null);
  const [assignmentForm, setAssignmentForm] = React.useState(emptyAssignment);
  const [editingAssignmentId, setEditingAssignmentId] = React.useState<string | null>(null);

  React.useEffect(() => {
    void getCommercialData({ data: { projectId } }).then((data) => {
      setProviders(data.providers as Provider[]);
      setAssignments(data.assignments as Assignment[]);
    });
  }, [projectId]);

  const reload = async () => {
    const data = await getCommercialData({ data: { projectId } });
    setProviders(data.providers as Provider[]);
    setAssignments(data.assignments as Assignment[]);
  };

  const updateAssignmentStatus = async (assignmentId: string, status: WorkStatus) => {
    const assignment = assignments.find((item) => item.id === assignmentId);
    if (!assignment) return;
    try {
      await saveProviderAssignment({ data: { ...assignment, projectId, status } });
      await reload();
    } catch (error) {
      alert(error instanceof Error ? error.message : "Não foi possível atualizar o status.");
    }
  };

  const getScheduleTone = (assignment: Assignment) => {
    if (assignment.status === "concluido") return "border-success/50 bg-success-soft";
    if (getOverdueDays(assignment) !== null) return "border-destructive/50 bg-destructive/10";
    return "border-border bg-background";
  };

  const beginAssignment = (provider: Provider) => {
    setSelectedProvider(provider);
    setAssignmentForm(emptyAssignment);
    setEditingAssignmentId(null);
    setMode("assign");
  };

  const beginEditAssignment = (assignment: Assignment, provider: Provider) => {
    setSelectedProvider(provider);
    setProviderForm(provider);
    setAssignmentForm({
      responsibilities: assignment.responsibilities,
      startDate: assignment.startDate,
      expectedDelivery: assignment.expectedDelivery,
      approvedBudget: assignment.approvedBudget,
      status: assignment.status || "nao-iniciado",
    });
    setEditingAssignmentId(assignment.id);
    setMode("assign");
    setOpen(true);
  };

  const saveProvider = async () => {
    if (!providerForm.name || !providerForm.document || !providerForm.specialty) return;
    try {
      const { id, ...payload } = providerForm;
      const saved = (await saveProviderRecord({
        data: { ...payload, projectId, ...(id ? { id } : {}) },
      })) as Provider;
      await reload();
      if (editingAssignmentId) {
        setSelectedProvider(saved);
        setProviderForm(saved);
        setMode("assign");
        return;
      }
      setProviderForm(emptyProvider);
      beginAssignment(saved);
    } catch (error) {
      alert(error instanceof Error ? error.message : "Não foi possível cadastrar o prestador.");
    }
  };

  const saveAssignment = async () => {
    if (!selectedProvider || assignmentForm.responsibilities.length === 0) return;
    try {
      await saveProviderAssignment({
        data: {
          id: editingAssignmentId || undefined,
          projectId,
          providerId: selectedProvider.id,
          ...assignmentForm,
        },
      });
      await reload();
      setOpen(false);
      setMode("list");
      setEditingAssignmentId(null);
    } catch (error) {
      alert(error instanceof Error ? error.message : "Não foi possível vincular o prestador.");
    }
  };

  const filteredProviders = providers.filter((provider) =>
    `${provider.name} ${provider.tradeName} ${provider.specialty} ${provider.document}`
      .toLocaleLowerCase("pt-BR")
      .includes(query.toLocaleLowerCase("pt-BR")),
  );

  return (
    <div className="surface-card p-5 lg:col-span-2">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold">Cronograma e Prestadores de serviço</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Responsáveis, prazos, orçamento e andamento desta obra.
          </p>
        </div>
        <Button
          onClick={() => {
            setMode("list");
            setQuery("");
            setProviderForm(emptyProvider);
            setSelectedProvider(null);
            setEditingAssignmentId(null);
            setOpen(true);
          }}
        >
          <Plus className="size-4" /> Adicionar prestador
        </Button>
      </div>

      {assignments.length === 0 ? (
        <div className="mt-5 rounded-xl border border-dashed p-8 text-center">
          <Building2 className="mx-auto size-8 text-muted-foreground" />
          <p className="mt-3 font-medium">Nenhum prestador vinculado</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Consulte o cadastro compartilhado ou registre um novo prestador.
          </p>
        </div>
      ) : (
        <div className="mt-5 grid gap-4 md:grid-cols-2">
          {assignments.map((assignment) => {
            const provider = providers.find((item) => item.id === assignment.providerId);
            if (!provider) return null;
            const overdueDays = getOverdueDays(assignment);
            return (
              <article
                key={assignment.id}
                className={`rounded-xl border p-4 transition-colors ${getScheduleTone(assignment)}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold">{provider.tradeName || provider.name}</p>
                    {provider.tradeName && (
                      <p className="text-xs text-muted-foreground">{provider.name}</p>
                    )}
                    <p className="mt-1 text-sm text-muted-foreground">
                      {provider.specialty} · {provider.personType}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {provider.issuesInvoice && <Badge variant="secondary">Emite NF-e</Badge>}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => beginEditAssignment(assignment, provider)}
                      aria-label={`Editar ${provider.tradeName || provider.name}`}
                    >
                      <Pencil className="size-3.5" /> Editar
                    </Button>
                  </div>
                </div>
                <div className="mt-4 flex flex-wrap gap-1.5">
                  {assignment.responsibilities.map((item) => (
                    <Badge key={item} variant="outline">
                      {item}
                    </Badge>
                  ))}
                </div>
                <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <dt className="text-muted-foreground">Início</dt>
                    <dd className="font-medium">{formatDate(assignment.startDate)}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Previsão de entrega</dt>
                    <dd className="font-medium">{formatDate(assignment.expectedDelivery)}</dd>
                  </div>
                  <div className="col-span-2">
                    <dt className="text-muted-foreground">Orçamento aprovado</dt>
                    <dd className="text-right text-base font-semibold">
                      {formatBRL(assignment.approvedBudget)}
                    </dd>
                  </div>
                  <div className="col-span-2 flex flex-wrap items-center justify-between gap-3 border-t pt-3">
                    <dt className="text-muted-foreground">
                      <Label htmlFor={`provider-status-${assignment.id}`}>Situação atual</Label>
                    </dt>
                    <dd>
                      <select
                        id={`provider-status-${assignment.id}`}
                        value={assignment.status || "nao-iniciado"}
                        onChange={(e) =>
                          updateAssignmentStatus(assignment.id, e.target.value as WorkStatus)
                        }
                        className="h-9 rounded-md border bg-background px-3 text-sm font-medium"
                      >
                        {statusOptions.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </dd>
                  </div>
                  {overdueDays !== null && (
                    <div className="col-span-2 flex items-center justify-between gap-4 rounded-md bg-destructive/10 px-3 py-2 text-destructive">
                      <dt className="font-medium">Dias de Atraso</dt>
                      <dd className="font-semibold">
                        {overdueDays} {overdueDays === 1 ? "dia" : "dias"}
                      </dd>
                    </div>
                  )}
                </dl>
              </article>
            );
          })}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[88vh] max-w-3xl overflow-y-auto">
          {mode === "list" && (
            <>
              <DialogHeader>
                <DialogTitle>Adicionar prestador de serviço</DialogTitle>
                <DialogDescription>
                  Pesquise na lista disponível para todos os projetos.
                </DialogDescription>
              </DialogHeader>
              <div className="relative">
                <Search className="absolute left-3 top-3 size-4 text-muted-foreground" />
                <Input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Buscar por nome, especialidade, CPF ou CNPJ..."
                  className="pl-9"
                />
              </div>
              <div className="space-y-2">
                {filteredProviders.map((provider) => (
                  <button
                    key={provider.id}
                    type="button"
                    onClick={() => beginAssignment(provider)}
                    className="flex w-full items-center gap-3 rounded-lg border p-3 text-left transition-colors hover:bg-muted/50"
                  >
                    <span className="rounded-full bg-primary-soft p-2 text-brand">
                      {provider.personType === "PJ" ? (
                        <Building2 className="size-5" />
                      ) : (
                        <UserRound className="size-5" />
                      )}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block font-medium">
                        {provider.tradeName || provider.name}
                      </span>
                      <span className="block [overflow-wrap:anywhere] text-xs text-muted-foreground">
                        {provider.specialty} · {provider.document} · {provider.phone}
                      </span>
                    </span>
                    <span className="text-sm font-medium text-brand">Selecionar</span>
                  </button>
                ))}
                {filteredProviders.length === 0 && (
                  <p className="py-5 text-center text-sm text-muted-foreground">
                    Nenhum prestador localizado.
                  </p>
                )}
              </div>
              <Button
                variant="outline"
                className="w-full"
                onClick={() => {
                  setProviderForm(emptyProvider);
                  setMode("new");
                }}
              >
                <Plus className="size-4" /> Cadastrar novo prestador de serviço
              </Button>
            </>
          )}

          {mode === "new" && (
            <>
              <DialogHeader>
                <DialogTitle>
                  {providerForm.id
                    ? "Editar dados do prestador de serviço"
                    : "Cadastrar novo prestador de serviço"}
                </DialogTitle>
                <DialogDescription>
                  {providerForm.id
                    ? "Atualize os dados cadastrais permitidos sem alterar os vínculos existentes."
                    : "Este cadastro ficará disponível em todos os projetos."}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-6">
                <section>
                  <h4 className="mb-3 font-semibold">1. Dados de identificação</h4>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="Tipo de pessoa">
                      <select
                        value={providerForm.personType}
                        onChange={(e) =>
                          setProviderForm({
                            ...providerForm,
                            personType: e.target.value as "PF" | "PJ",
                          })
                        }
                        className="flex h-10 w-full rounded-md border bg-background px-3 text-sm"
                      >
                        <option value="PF">Pessoa Física</option>
                        <option value="PJ">Pessoa Jurídica / MEI</option>
                      </select>
                    </Field>
                    <Field label={providerForm.personType === "PF" ? "CPF *" : "CNPJ *"}>
                      <Input
                        value={providerForm.document}
                        onChange={(e) =>
                          setProviderForm({ ...providerForm, document: e.target.value })
                        }
                      />
                    </Field>
                    <Field
                      label={
                        providerForm.personType === "PF" ? "Nome completo *" : "Razão Social *"
                      }
                    >
                      <Input
                        value={providerForm.name}
                        onChange={(e) => setProviderForm({ ...providerForm, name: e.target.value })}
                      />
                    </Field>
                    <Field label="Nome fantasia">
                      <Input
                        value={providerForm.tradeName}
                        onChange={(e) =>
                          setProviderForm({ ...providerForm, tradeName: e.target.value })
                        }
                        disabled={providerForm.personType === "PF"}
                      />
                    </Field>
                  </div>
                </section>
                <section>
                  <h4 className="mb-3 font-semibold">2. Contato e endereço</h4>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="Celular / WhatsApp">
                      <Input
                        type="tel"
                        inputMode="tel"
                        maxLength={14}
                        placeholder={PHONE_PLACEHOLDER}
                        value={providerForm.phone}
                        onChange={(e) =>
                          setProviderForm({
                            ...providerForm,
                            phone: formatPhoneInput(e.target.value),
                          })
                        }
                      />
                    </Field>
                    <Field label="E-mail principal">
                      <Input
                        type="email"
                        value={providerForm.email}
                        onChange={(e) =>
                          setProviderForm({ ...providerForm, email: e.target.value })
                        }
                      />
                    </Field>
                    <Field label="Endereço completo com CEP" className="sm:col-span-2">
                      <Input
                        value={providerForm.address}
                        onChange={(e) =>
                          setProviderForm({ ...providerForm, address: e.target.value })
                        }
                      />
                    </Field>
                  </div>
                </section>
                <section>
                  <h4 className="mb-3 font-semibold">3. Dados profissionais e capacitação</h4>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="Especialidade principal *">
                      <Input
                        value={providerForm.specialty}
                        onChange={(e) =>
                          setProviderForm({ ...providerForm, specialty: e.target.value })
                        }
                        placeholder="Ex.: pedreiro, eletricista, pintor"
                      />
                    </Field>
                    <Field label="Registro profissional">
                      <Input
                        value={providerForm.professionalRegistry}
                        onChange={(e) =>
                          setProviderForm({ ...providerForm, professionalRegistry: e.target.value })
                        }
                        placeholder="CREA, CAU ou outro"
                      />
                    </Field>
                    <Field label="Indicações e referências" className="sm:col-span-2">
                      <Textarea
                        value={providerForm.references}
                        onChange={(e) =>
                          setProviderForm({ ...providerForm, references: e.target.value })
                        }
                        placeholder="Clientes anteriores e contatos para referência"
                      />
                    </Field>
                  </div>
                </section>
                <section>
                  <h4 className="mb-3 font-semibold">4. Dados financeiros</h4>
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    <Field label="Banco">
                      <Input
                        value={providerForm.bank}
                        onChange={(e) => setProviderForm({ ...providerForm, bank: e.target.value })}
                      />
                    </Field>
                    <Field label="Agência">
                      <Input
                        value={providerForm.agency}
                        onChange={(e) =>
                          setProviderForm({ ...providerForm, agency: e.target.value })
                        }
                      />
                    </Field>
                    <Field label="Conta">
                      <Input
                        value={providerForm.account}
                        onChange={(e) =>
                          setProviderForm({ ...providerForm, account: e.target.value })
                        }
                      />
                    </Field>
                    <Field label="Chave Pix">
                      <Input
                        value={providerForm.pix}
                        onChange={(e) => setProviderForm({ ...providerForm, pix: e.target.value })}
                      />
                    </Field>
                    <label className="flex items-center gap-2 text-sm sm:col-span-2">
                      <input
                        type="checkbox"
                        checked={providerForm.issuesInvoice}
                        onChange={(e) =>
                          setProviderForm({ ...providerForm, issuesInvoice: e.target.checked })
                        }
                        className="size-4 accent-primary"
                      />{" "}
                      Este prestador emite NF-e
                    </label>
                  </div>
                </section>
              </div>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setMode(editingAssignmentId ? "assign" : "list")}
                >
                  Voltar
                </Button>
                <Button
                  onClick={saveProvider}
                  disabled={!providerForm.name || !providerForm.document || !providerForm.specialty}
                >
                  {providerForm.id ? "Salvar dados cadastrais" : "Salvar e vincular à obra"}
                </Button>
              </DialogFooter>
            </>
          )}

          {mode === "assign" && selectedProvider && (
            <>
              <DialogHeader>
                <DialogTitle>
                  {editingAssignmentId
                    ? "Editar prestador e cronograma"
                    : "Responsabilidade na obra"}
                </DialogTitle>
                <DialogDescription>
                  Defina a atuação de {selectedProvider.tradeName || selectedProvider.name} neste
                  projeto.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-5">
                {editingAssignmentId ? (
                  <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-muted/30 p-3">
                    <div>
                      <p className="text-sm font-medium">
                        {selectedProvider.tradeName || selectedProvider.name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {selectedProvider.document} · {selectedProvider.specialty}
                      </p>
                    </div>
                    <Button type="button" variant="outline" onClick={() => setMode("new")}>
                      <Pencil className="size-4" /> Editar dados cadastrais
                    </Button>
                  </div>
                ) : null}
                <Field label="Responsabilidades *">
                  <div className="grid gap-2 rounded-lg border p-3 sm:grid-cols-2">
                    {responsibilities.map((item) => (
                      <label key={item} className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={assignmentForm.responsibilities.includes(item)}
                          onChange={(e) =>
                            setAssignmentForm({
                              ...assignmentForm,
                              responsibilities: e.target.checked
                                ? [...assignmentForm.responsibilities, item]
                                : assignmentForm.responsibilities.filter(
                                    (current) => current !== item,
                                  ),
                            })
                          }
                          className="size-4 accent-primary"
                        />
                        {item}
                      </label>
                    ))}
                  </div>
                </Field>
                <div className="grid gap-4 sm:grid-cols-3">
                  <Field label="Início">
                    <DatePickerField
                      value={assignmentForm.startDate}
                      aria-label="Início"
                      onValueChange={(startDate) =>
                        setAssignmentForm({ ...assignmentForm, startDate })
                      }
                    />
                  </Field>
                  <Field label="Previsão de Entrega">
                    <DatePickerField
                      value={assignmentForm.expectedDelivery}
                      min={assignmentForm.startDate}
                      aria-label="Previsão de Entrega"
                      onValueChange={(expectedDelivery) =>
                        setAssignmentForm({ ...assignmentForm, expectedDelivery })
                      }
                    />
                  </Field>
                  <Field label="Orçamento aprovado">
                    <CurrencyInput
                      value={assignmentForm.approvedBudget}
                      onValueChange={(approvedBudget) =>
                        setAssignmentForm({ ...assignmentForm, approvedBudget })
                      }
                    />
                  </Field>
                </div>
                <Field label="Situação atual">
                  <select
                    value={assignmentForm.status}
                    onChange={(e) =>
                      setAssignmentForm({ ...assignmentForm, status: e.target.value as WorkStatus })
                    }
                    className="flex h-10 w-full rounded-md border bg-background px-3 text-sm sm:max-w-xs"
                  >
                    {statusOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => (editingAssignmentId ? setOpen(false) : setMode("list"))}
                >
                  {editingAssignmentId ? "Cancelar" : "Voltar"}
                </Button>
                <Button
                  onClick={saveAssignment}
                  disabled={assignmentForm.responsibilities.length === 0}
                >
                  {editingAssignmentId ? "Salvar alterações" : "Adicionar à obra"}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

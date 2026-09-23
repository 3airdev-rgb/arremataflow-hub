import { useState, useEffect } from "react";
import { Save, CalendarIcon, FileText, Mail, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CurrencyInput } from "@/components/ui/currency-input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { format, parseISO } from "date-fns";
import { toast } from "sonner";
import { showValidationAlert } from "@/lib/validation-feedback";
import { cn } from "@/lib/utils";
import { getProjectOperations, savePossession } from "@/lib/project-operations";
import { listFinancialMovements } from "@/lib/financial";
import {
  getPropertyInspection,
  listPropertyInspections,
  sendPropertyInspection,
} from "@/lib/property-inspections";

type JudicialAction = {
  id?: string;
  scope?: "regularization" | "possession";
  tipo_acao: string;
  numero_processo: string;
  vara: string;
  ultima_movimentacao: string | null;
};

// formatCurrency and parseCurrency removed in favor of CurrencyInput component

type FinancialMovement = {
  id: string;
  tipo: string;
  categoria: string;
  descricao: string;
  valor: number;
};

export function PosseTab({
  projetoId,
  onRequestFinancialMovement,
}: {
  projetoId: string;
  onRequestFinancialMovement?: (category: string, description: string) => void;
}) {
  const [loading, setLoading] = useState(true);
  const [salvando, setSalvando] = useState(false);

  const [formData, setFormData] = useState({
    occupancy_status: "",
    possession_action_required: false,
    expected_possession_date: null as string | null,
    possession_completed_date: null as string | null,
    legal_costs: 0,
    bailiff_costs: 0,
    locksmith_security_costs: 0,
    settlement_costs: 0,
    property_inspection_required: false,
  });
  const [inspectorName, setInspectorName] = useState("");
  const [inspectorEmail, setInspectorEmail] = useState("");
  const [inspectionDueDate, setInspectionDueDate] = useState("");
  const [inspections, setInspections] = useState<any[]>([]);
  const [sendingInspection, setSendingInspection] = useState(false);
  const [viewedInspection, setViewedInspection] = useState<any | null>(null);
  const [imissaoAction, setImissaoAction] = useState<JudicialAction | null>(null);
  const [actionDialogOpen, setActionDialogOpen] = useState(false);
  const [savingAction, setSavingAction] = useState(false);
  const [financialMovements, setFinancialMovements] = useState<FinancialMovement[]>([]);

  const emptyImissaoAction = (): JudicialAction => ({
    tipo_acao: "Ação de Imissão na Posse",
    numero_processo: "",
    vara: "",
    ultima_movimentacao: null,
  });

  useEffect(() => {
    async function loadData() {
      try {
        const [operations, movements, inspectionRows] = await Promise.all([
          getProjectOperations({ data: { projectId: projetoId } }),
          listFinancialMovements({ data: { projectId: projetoId } }),
          listPropertyInspections({ data: { projectId: projetoId } }),
        ]);
        setFormData((previous) => ({
          ...previous,
          ...(operations.possession as Partial<typeof previous>),
        }));
        setImissaoAction(operations.possessionAction);
        setFinancialMovements(movements);
        setInspections(inspectionRows);
      } catch (err: any) {
        toast.error("Erro ao carregar dados da posse: " + err.message);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [projetoId]);

  useEffect(() => {
    const refresh = (event: Event) => {
      const updatedProjectId = (event as CustomEvent<{ projectId?: string }>).detail?.projectId;
      if (!updatedProjectId || updatedProjectId === projetoId) {
        void listFinancialMovements({ data: { projectId: projetoId } }).then(setFinancialMovements);
      }
    };
    window.addEventListener("financial-movements-updated", refresh);
    return () => window.removeEventListener("financial-movements-updated", refresh);
  }, [projetoId]);

  const possessionCost = (title: string) =>
    financialMovements
      .filter(
        (movement) =>
          movement.tipo === "despesa" &&
          movement.categoria === "Aquisição" &&
          movement.descricao.trim().toLocaleLowerCase("pt-BR") ===
            `custos da posse - ${title}`.toLocaleLowerCase("pt-BR"),
      )
      .reduce((total, movement) => total + movement.valor, 0);
  const possessionCosts = {
    legal: possessionCost("Custas Processuais"),
    bailiff: possessionCost("Oficial de Justiça"),
    locksmith: possessionCost("Chaveiro e Segurança"),
    settlement: possessionCost("Indenização / Acordo"),
  };
  const requestCostMovement = (title: string) =>
    onRequestFinancialMovement?.("Aquisição", `Custos da Posse - ${title}`);

  const saveImissaoAction = async () => {
    if (!imissaoAction) return;
    setSavingAction(true);
    const possessionData = { ...formData, possession_action_required: true };
    try {
      await savePossession({
        data: {
          projectId: projetoId,
          formData: possessionData,
          action: {
            ...imissaoAction,
            tipo_acao: "Ação de Imissão na Posse",
          },
        },
      });
      setFormData(possessionData);
      setActionDialogOpen(false);
      const operations = await getProjectOperations({ data: { projectId: projetoId } });
      setImissaoAction(operations.possessionAction);
      window.dispatchEvent(
        new CustomEvent("project-operations-updated", { detail: { projectId: projetoId } }),
      );
      toast.success("Ação de Imissão na Posse cadastrada no Jurídico.");
    } catch (error) {
      showValidationAlert(
        error,
        "Não foi possível cadastrar a ação judicial. Revise os campos informados.",
      );
    } finally {
      setSavingAction(false);
    }
  };

  const handleSave = async () => {
    setSalvando(true);
    try {
      await savePossession({
        data: {
          projectId: projetoId,
          formData: {
            ...formData,
            legal_costs: possessionCosts.legal,
            bailiff_costs: possessionCosts.bailiff,
            locksmith_security_costs: possessionCosts.locksmith,
            settlement_costs: possessionCosts.settlement,
          },
          action: imissaoAction,
        },
      });
      window.dispatchEvent(
        new CustomEvent("project-operations-updated", { detail: { projectId: projetoId } }),
      );
      toast.success("Alterações salvas com sucesso.");
    } catch (err: any) {
      showValidationAlert(
        err,
        "Não foi possível salvar os dados da posse. Revise os campos informados.",
      );
    } finally {
      setSalvando(false);
    }
  };

  if (loading) return <div className="p-8 text-center">Carregando dados da posse...</div>;

  return (
    <div className="space-y-6 mt-5">
      <div className="grid gap-6 xl:grid-cols-2">
        {/* Situação da Posse Section */}
        <div className="surface-card p-5 space-y-4">
          <h3 className="text-base font-semibold border-b pb-2">Situação da Posse</h3>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Ocupação</Label>
              <Select
                value={formData.occupancy_status}
                onValueChange={(v) => setFormData((prev) => ({ ...prev, occupancy_status: v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a ocupação" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Desocupada">Desocupada</SelectItem>
                  <SelectItem value="Ocupada pelo ex-proprietário">
                    Ocupada pelo ex-proprietário
                  </SelectItem>
                  <SelectItem value="Ocupada por terceiros">Ocupada por terceiros</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Ação de Imissão</Label>
              <Select
                value={formData.possession_action_required ? "Sim" : "Não"}
                onValueChange={(v) => {
                  const required = v === "Sim";
                  setFormData((prev) => ({ ...prev, possession_action_required: required }));
                  if (required && !imissaoAction) setImissaoAction(emptyImissaoAction());
                  if (required) setActionDialogOpen(true);
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Necessário ação?" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Sim">Sim</SelectItem>
                  <SelectItem value="Não">Não</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Data prevista da posse</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant={"outline"}
                    className={cn(
                      "relative w-full justify-end pl-9 text-right font-normal",
                      !formData.expected_possession_date && "text-muted-foreground",
                    )}
                  >
                    <CalendarIcon className="absolute left-3 h-4 w-4" />
                    {formData.expected_possession_date ? (
                      format(parseISO(formData.expected_possession_date), "dd/MM/yyyy")
                    ) : (
                      <span>Selecione a data</span>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="end">
                  <Calendar
                    mode="single"
                    selected={
                      formData.expected_possession_date
                        ? parseISO(formData.expected_possession_date)
                        : undefined
                    }
                    onSelect={(date) =>
                      setFormData((prev) => ({
                        ...prev,
                        expected_possession_date: date ? format(date, "yyyy-MM-dd") : null,
                      }))
                    }
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2">
              <Label>Data da posse realizada</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant={"outline"}
                    className={cn(
                      "relative w-full justify-end pl-9 text-right font-normal",
                      !formData.possession_completed_date && "text-muted-foreground",
                    )}
                  >
                    <CalendarIcon className="absolute left-3 h-4 w-4" />
                    {formData.possession_completed_date ? (
                      format(parseISO(formData.possession_completed_date), "dd/MM/yyyy")
                    ) : (
                      <span>Selecione a data</span>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="end">
                  <Calendar
                    mode="single"
                    selected={
                      formData.possession_completed_date
                        ? parseISO(formData.possession_completed_date)
                        : undefined
                    }
                    onSelect={(date) =>
                      setFormData((prev) => ({
                        ...prev,
                        possession_completed_date: date ? format(date, "yyyy-MM-dd") : null,
                      }))
                    }
                  />
                </PopoverContent>
              </Popover>
            </div>
            <div className="md:col-span-2 grid gap-4 border-t pt-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Vistoria no imóvel?</Label>
                <RadioGroup
                  value={formData.property_inspection_required ? "sim" : "nao"}
                  onValueChange={(value) =>
                    setFormData((current) => ({
                      ...current,
                      property_inspection_required: value === "sim",
                    }))
                  }
                  className="flex h-9 items-center gap-6"
                >
                  <label className="flex cursor-pointer items-center gap-2">
                    <RadioGroupItem value="sim" /> Sim
                  </label>
                  <label className="flex cursor-pointer items-center gap-2">
                    <RadioGroupItem value="nao" /> Não
                  </label>
                </RadioGroup>
              </div>
              {formData.property_inspection_required ? (
                <div className="space-y-2">
                  <Label>Data limite para vistoria</Label>
                  <Input
                    type="date"
                    value={inspectionDueDate}
                    onChange={(event) => setInspectionDueDate(event.target.value)}
                  />
                </div>
              ) : null}
            </div>
            {formData.property_inspection_required ? (
              <>
                <div className="md:col-span-2 grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Nome do Vistoriador</Label>
                    <Input
                      value={inspectorName}
                      onChange={(event) => setInspectorName(event.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Email</Label>
                    <Input
                      type="email"
                      value={inspectorEmail}
                      onChange={(event) => setInspectorEmail(event.target.value)}
                    />
                  </div>
                </div>
                <div className="md:col-span-2">
                  <Button
                    type="button"
                    disabled={sendingInspection}
                    onClick={async () => {
                      setSendingInspection(true);
                      try {
                        await sendPropertyInspection({
                          data: {
                            projectId: projetoId,
                            inspectorName,
                            inspectorEmail,
                            dueDate: inspectionDueDate,
                          },
                        });
                        setInspections(
                          await listPropertyInspections({ data: { projectId: projetoId } }),
                        );
                        toast.success("Vistoria enviada e tarefa criada com sucesso.");
                      } catch (error) {
                        showValidationAlert(
                          error,
                          "Não foi possível enviar a vistoria. Confira nome, e-mail, data limite e configuração do envio.",
                        );
                      } finally {
                        setSendingInspection(false);
                      }
                    }}
                  >
                    <Mail className="mr-2 size-4" />
                    {sendingInspection ? "Enviando..." : "Enviar vistoria ao e-mail"}
                  </Button>
                </div>
                {inspections.length ? (
                  <div className="md:col-span-2 space-y-2">
                    {inspections.map((inspection) => (
                      <div
                        key={inspection.id}
                        className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3 text-sm"
                      >
                        <div>
                          <p className="font-medium">{inspection.inspectorName}</p>
                          <p className="text-muted-foreground">
                            {inspection.status === "completed"
                              ? "Vistoria concluída"
                              : "Aguardando preenchimento"}
                            {inspection.status === "completed" && inspection.inspectionDate
                              ? ` · Data da Vistoria: ${format(parseISO(inspection.inspectionDate), "dd/MM/yyyy")}`
                              : ""}
                            {inspection.dueDate
                              ? ` · Prazo: ${inspection.dueDate.split("-").reverse().join("/")}`
                              : ""}
                          </p>
                        </div>
                        {inspection.status === "completed" ? (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={async () =>
                              setViewedInspection(
                                await getPropertyInspection({
                                  data: { projectId: projetoId, inspectionId: inspection.id },
                                }),
                              )
                            }
                          >
                            <Eye className="mr-2 size-4" />
                            Visualizar vistoria
                          </Button>
                        ) : null}
                      </div>
                    ))}
                  </div>
                ) : null}
              </>
            ) : null}
          </div>
        </div>

        {/* Custos da Posse Section */}
        <div className="surface-card p-5 space-y-4">
          <h3 className="text-base font-semibold border-b pb-2">Custos da Posse</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Custas Processuais</Label>
              <div className="flex gap-2">
                <CurrencyInput
                  className="flex-1 cursor-not-allowed bg-muted"
                  value={possessionCosts.legal}
                  onValueChange={() => undefined}
                  readOnly
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="shrink-0 text-brand"
                  title="Lançar Custas Processuais"
                  onClick={() => requestCostMovement("Custas Processuais")}
                >
                  <FileText className="size-4" />
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Oficial de Justiça</Label>
              <div className="flex gap-2">
                <CurrencyInput
                  className="flex-1 cursor-not-allowed bg-muted"
                  value={possessionCosts.bailiff}
                  onValueChange={() => undefined}
                  readOnly
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="shrink-0 text-brand"
                  title="Lançar Oficial de Justiça"
                  onClick={() => requestCostMovement("Oficial de Justiça")}
                >
                  <FileText className="size-4" />
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Chaveiro e Segurança</Label>
              <div className="flex gap-2">
                <CurrencyInput
                  className="flex-1 cursor-not-allowed bg-muted"
                  value={possessionCosts.locksmith}
                  onValueChange={() => undefined}
                  readOnly
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="shrink-0 text-brand"
                  title="Lançar Chaveiro e Segurança"
                  onClick={() => requestCostMovement("Chaveiro e Segurança")}
                >
                  <FileText className="size-4" />
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Indenização / Acordo</Label>
              <div className="flex gap-2">
                <CurrencyInput
                  className="flex-1 cursor-not-allowed bg-muted"
                  value={possessionCosts.settlement}
                  onValueChange={() => undefined}
                  readOnly
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="shrink-0 text-brand"
                  title="Lançar Indenização / Acordo"
                  onClick={() => requestCostMovement("Indenização / Acordo")}
                >
                  <FileText className="size-4" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <Dialog
        open={actionDialogOpen}
        onOpenChange={(open) => {
          setActionDialogOpen(open);
          if (!open && !imissaoAction?.id) {
            setImissaoAction(null);
            setFormData((current) => ({ ...current, possession_action_required: false }));
          }
        }}
      >
        <DialogContent className="sm:max-w-[620px]">
          <DialogHeader>
            <DialogTitle>Adicionar Ação</DialogTitle>
            <DialogDescription>
              Cadastre a ação para disponibilizá-la no card Jurídico da Regularização.
            </DialogDescription>
          </DialogHeader>
          {imissaoAction ? (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Tipo de Ação</Label>
                <Input value="Ação de Imissão na Posse" readOnly className="bg-muted" />
              </div>
              <div className="space-y-2">
                <Label>Número do Processo</Label>
                <Input
                  placeholder="Ex: 0000000-00.0000.0.00.0000"
                  value={imissaoAction.numero_processo}
                  onChange={(event) =>
                    setImissaoAction((current) =>
                      current ? { ...current, numero_processo: event.target.value } : current,
                    )
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Vara</Label>
                <Input
                  placeholder="Ex: 3ª Vara Cível"
                  value={imissaoAction.vara}
                  onChange={(event) =>
                    setImissaoAction((current) =>
                      current ? { ...current, vara: event.target.value } : current,
                    )
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Última Movimentação</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "relative w-full justify-end pl-9 text-right font-normal",
                        !imissaoAction.ultima_movimentacao && "text-muted-foreground",
                      )}
                    >
                      <CalendarIcon className="absolute left-3 size-4" />
                      {imissaoAction.ultima_movimentacao
                        ? format(parseISO(imissaoAction.ultima_movimentacao), "dd/MM/yyyy")
                        : "Selecionar data"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="end">
                    <Calendar
                      mode="single"
                      selected={
                        imissaoAction.ultima_movimentacao
                          ? parseISO(imissaoAction.ultima_movimentacao)
                          : undefined
                      }
                      onSelect={(date) =>
                        setImissaoAction((current) =>
                          current
                            ? {
                                ...current,
                                ultima_movimentacao: date ? format(date, "yyyy-MM-dd") : null,
                              }
                            : current,
                        )
                      }
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>
          ) : null}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setActionDialogOpen(false);
                if (!imissaoAction?.id) {
                  setImissaoAction(null);
                  setFormData((current) => ({ ...current, possession_action_required: false }));
                }
              }}
            >
              Cancelar
            </Button>
            <Button type="button" disabled={savingAction} onClick={() => void saveImissaoAction()}>
              {savingAction ? "Salvando..." : "Salvar Ação"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(viewedInspection)}
        onOpenChange={(open) => !open && setViewedInspection(null)}
      >
        <DialogContent className="max-h-[85vh] max-w-3xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Vistoria do imóvel</DialogTitle>
            <DialogDescription>
              {viewedInspection?.inspectorName} —{" "}
              {viewedInspection?.completedAt
                ? new Date(viewedInspection.completedAt).toLocaleString("pt-BR")
                : ""}
            </DialogDescription>
          </DialogHeader>
          {viewedInspection ? (
            <div className="space-y-4 text-sm">
              <InspectionSummary data={viewedInspection.formData} />
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      <div className="flex justify-center pt-4">
        <Button
          onClick={handleSave}
          disabled={salvando}
          className="bg-brand text-brand-foreground hover:bg-brand-hover px-12 h-11"
        >
          {salvando ? (
            "Salvando..."
          ) : (
            <>
              <Save className="mr-2 size-4" />
              Salvar Alterações
            </>
          )}
        </Button>
      </div>
    </div>
  );
}

function InspectionSummary({ data }: { data: any }) {
  const Value = ({ label, value }: { label: string; value: unknown }) => (
    <div className="rounded-md bg-muted/40 px-3 py-2">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 break-words text-foreground">{String(value ?? "-") || "-"}</p>
    </div>
  );
  const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
    <section className="space-y-3 rounded-lg border p-4">
      <h3 className="border-b pb-2 font-semibold text-brand">{title}</h3>
      {children}
    </section>
  );
  const yn = (value: unknown) => (value ? "Sim" : "Não");
  return (
    <div className="space-y-5">
      <Section title="1. Dados do Imóvel">
        <div className="grid gap-3 sm:grid-cols-2">
          <Value
            label="Tipo de vistoria"
            value={data.inspectionType === "venda" ? "Venda" : "Posse"}
          />
          <Value
            label="Data e hora"
            value={data.dateTime ? new Date(data.dateTime).toLocaleString("pt-BR") : "-"}
          />
          <Value label="Tipo de imóvel" value={data.propertyType} />
          <Value label="Contato do vistoriador" value={data.inspectorPhone} />
          <Value label="Oficial de Justiça presente" value={yn(data.bailiffPresent)} />
          {data.bailiffPresent && (
            <>
              <Value label="Nome do Oficial de Justiça" value={data.bailiffName} />
              <Value label="Fone do Oficial de Justiça" value={data.bailiffPhone} />
            </>
          )}
        </div>
      </Section>
      <Section title="2. Chaves e Acessos">
        <div className="grid gap-3 sm:grid-cols-3">
          {Object.entries({
            chaves: "Chaves",
            controle: "Controle remoto",
            tags: "Tags/cartões",
          }).map(([key, label]) => (
            <Value
              key={key}
              label={label}
              value={data.keys?.[key]?.has ? `Sim - Quantidade: ${data.keys[key].quantity}` : "Não"}
            />
          ))}
        </div>
        <Value label="Outros" value={data.otherAccess} />
      </Section>
      <Section title="3. Serviços Públicos">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Value label="Possui energia" value={yn(data.utilities?.energy)} />
          <Value label="Medidor de energia" value={data.utilities?.energyMeter} />
          <Value label="Concessionária de luz" value={data.utilities?.energyCompany} />
          <Value label="Possui água" value={yn(data.utilities?.water)} />
          <Value label="Medidor de água" value={data.utilities?.waterMeter} />
          <Value label="Concessionária de água" value={data.utilities?.waterCompany} />
          <Value label="Esgoto tratado" value={yn(data.utilities?.sewer)} />
          <Value label="Concessionária de esgoto" value={data.utilities?.sewerCompany} />
        </div>
      </Section>
      <Section title="4. Condições por Cômodo">
        <div className="space-y-4">
          {(data.rooms || []).length ? (
            data.rooms.map((room: any, index: number) => (
              <article key={index} className="rounded-lg border bg-background p-4">
                <h4 className="mb-3 font-semibold">{room.name || `Cômodo ${index + 1}`}</h4>
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {Object.entries(room.conditions || {}).map(([key, value]) => (
                    <Value key={key} label={key} value={value} />
                  ))}
                </div>
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  <Value label="Mobília" value={room.furniture} />
                  <Value label="Observações" value={room.notes} />
                </div>
              </article>
            ))
          ) : (
            <p className="text-muted-foreground">Nenhum cômodo informado.</p>
          )}
        </div>
      </Section>
      <Section title="5. Instalações Elétricas e Hidráulicas">
        <div className="grid gap-3 sm:grid-cols-2">
          <Value
            label="Quadro de luz e disjuntores"
            value={yn(data.installations?.electricalPanel)}
          />
          <Value
            label="Vazamentos"
            value={
              data.installations?.leaks
                ? `Sim - ${data.installations?.leakLocation || "Local não informado"}`
                : "Não"
            }
          />
          <Value label="Vasos sanitários e descargas" value={yn(data.installations?.toilets)} />
          <Value label="Ralos" value={data.installations?.drains} />
          <Value label="Caixa d'água" value={data.installations?.waterTank} />
        </div>
      </Section>
      <Section title="6. Inventário de Móveis e Eletrodomésticos">
        {(data.inventory || []).length ? (
          <div
            tabIndex={0}
            role="region"
            aria-label="Tabela com rolagem horizontal"
            className="table-scroll overflow-x-auto"
          >
            <table className="w-full text-left">
              <thead className="bg-muted">
                <tr>
                  <th className="p-2">Item</th>
                  <th className="p-2">Marca/Modelo</th>
                  <th className="p-2">Estado</th>
                </tr>
              </thead>
              <tbody>
                {data.inventory.map((item: any, index: number) => (
                  <tr key={index} className="border-b">
                    <td className="p-2">{item.item || "-"}</td>
                    <td className="p-2">{item.model || "-"}</td>
                    <td className="p-2">{item.condition || "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-muted-foreground">Nenhum item informado.</p>
        )}
      </Section>
      <Section title="7. Observações Gerais e Ressalvas">
        <p className="whitespace-pre-wrap">
          {data.generalNotes || "Nenhuma observação registrada."}
        </p>
      </Section>
      <Section title="8. Anexos Fotográficos">
        {(data.photos || []).length ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {data.photos.map((photo: any, index: number) => (
              <figure key={index} className="rounded-lg border p-2">
                <img
                  src={photo.data}
                  alt={photo.name}
                  className="max-h-80 w-full rounded-md object-contain"
                />
                <figcaption className="mt-2 [overflow-wrap:anywhere] text-xs text-muted-foreground">
                  {photo.name}
                </figcaption>
              </figure>
            ))}
          </div>
        ) : (
          <p className="text-muted-foreground">Nenhuma fotografia anexada.</p>
        )}
      </Section>
    </div>
  );
}

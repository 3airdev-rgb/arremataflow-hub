import { useEffect, useState } from "react";
import { Eye, Pencil, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { CurrencyInput } from "@/components/ui/currency-input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
import { formatBRL } from "@/lib/mock-data";
import { logProjectAudit } from "@/lib/local-project-audit";

type PortfolioOrigin = { id: string; name: string; type: string };
export type Proposal = {
  id: string;
  number: number;
  originId: string;
  originName: string;
  otherName?: string;
  otherPhone?: string;
  value: number;
  counterofferValue?: number;
  taxValue?: number;
  finalSaleValue?: number;
  condition: string;
  observations: string;
  status: "Em análise" | "Contraproposta" | "Recusada" | "Aceita";
  createdAt: string;
};

const portfolioKey = (projectId: string) => `arremataflow:project:${projectId}:sales-portfolio`;
const proposalsKey = (projectId: string) => `arremataflow:project:${projectId}:sales-proposals`;
export const SALES_PROPOSALS_UPDATED = "arremataflow:sales-proposals-updated";

export function getLocalSalesProposals(projectId: string): Proposal[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(proposalsKey(projectId)) || "[]") as Proposal[];
  } catch {
    return [];
  }
}

export function SalesProposalsCard({ projectId }: { projectId: string }) {
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [origins, setOrigins] = useState<PortfolioOrigin[]>([]);
  const [open, setOpen] = useState(false);
  const [originId, setOriginId] = useState("");
  const [otherName, setOtherName] = useState("");
  const [otherPhone, setOtherPhone] = useState("");
  const [value, setValue] = useState(0);
  const [counterofferValue, setCounterofferValue] = useState<number | null>(null);
  const [taxValue, setTaxValue] = useState(0);
  const [finalSaleValue, setFinalSaleValue] = useState<number | null>(null);
  const [condition, setCondition] = useState("");
  const [observations, setObservations] = useState("");
  const [status, setStatus] = useState<Proposal["status"]>("Em análise");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [viewProposal, setViewProposal] = useState<Proposal | null>(null);

  useEffect(() => {
    try {
      setProposals(getLocalSalesProposals(projectId));
    } catch {
      setProposals([]);
    }
  }, [projectId]);

  const loadOrigins = () => {
    try {
      const stored = JSON.parse(
        localStorage.getItem(portfolioKey(projectId)) || "[]",
      ) as PortfolioOrigin[];
      setOrigins(stored);
    } catch {
      setOrigins([]);
    }
  };

  const reset = () => {
    setOriginId("");
    setOtherName("");
    setOtherPhone("");
    setValue(0);
    setCounterofferValue(null);
    setTaxValue(0);
    setFinalSaleValue(null);
    setCondition("");
    setObservations("");
    setStatus("Em análise");
    setEditingId(null);
  };

  const beginEdit = (proposal: Proposal) => {
    loadOrigins();
    setEditingId(proposal.id);
    setOriginId(proposal.originId);
    setOtherName(proposal.otherName || "");
    setOtherPhone(proposal.otherPhone || "");
    setValue(proposal.value);
    setCounterofferValue(proposal.counterofferValue ?? null);
    setTaxValue(proposal.taxValue || 0);
    setFinalSaleValue(proposal.finalSaleValue ?? null);
    setCondition(proposal.condition);
    setObservations(proposal.observations);
    setStatus(proposal.status);
    setOpen(true);
  };

  const hasCounteroffers = proposals.some(
    (proposal) => proposal.counterofferValue !== undefined,
  );

  return (
    <section className="surface-card p-5 lg:col-span-2">
      <div className="flex flex-col gap-3 border-b pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-lg font-semibold">Propostas</h3>
          <p className="text-sm text-muted-foreground">
            Propostas recebidas para aquisição do imóvel.
          </p>
        </div>
        <Dialog
          open={open}
          onOpenChange={(next) => {
            setOpen(next);
            if (next) loadOrigins();
            else reset();
          }}
        >
          <DialogTrigger asChild>
            <Button>
              <Plus className="size-4" /> Cadastrar proposta
            </Button>
          </DialogTrigger>
          <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
            <DialogHeader>
              <DialogTitle>{editingId ? "Editar Proposta" : "Cadastro de Proposta"}</DialogTitle>
              <DialogDescription>
                {editingId
                  ? "Altere as informações da proposta cadastrada."
                  : "Registre a origem e as condições da proposta recebida."}
              </DialogDescription>
            </DialogHeader>
            <form
              className="space-y-4"
              onSubmit={(event) => {
                event.preventDefault();
                const origin = origins.find((item) => item.id === originId);
                const originName = originId === "outros" ? otherName : origin?.name || "";
                const existing = proposals.find((proposal) => proposal.id === editingId);
                const nextNumber =
                  existing?.number ??
                  proposals.reduce((highest, proposal) => Math.max(highest, proposal.number), 0) +
                    1;
                const proposal: Proposal = {
                  id: editingId || `proposal-${Date.now()}`,
                  number: nextNumber,
                  originId,
                  originName,
                  otherName,
                  otherPhone,
                  value,
                  ...(counterofferValue !== null ? { counterofferValue } : {}),
                  taxValue,
                  ...(finalSaleValue !== null ? { finalSaleValue } : {}),
                  condition,
                  observations,
                  status,
                  createdAt: existing?.createdAt || new Date().toISOString(),
                };
                const next = (
                  editingId
                    ? proposals.map((item) => (item.id === editingId ? proposal : item))
                    : [...proposals, proposal]
                ).sort((a, b) => a.number - b.number);
                setProposals(next);
                localStorage.setItem(proposalsKey(projectId), JSON.stringify(next));
                window.dispatchEvent(new CustomEvent(SALES_PROPOSALS_UPDATED, { detail: { projectId } }));
                logProjectAudit(
                  projectId,
                  `${editingId ? "editou" : "incluiu"} a proposta nº ${nextNumber}, no valor de ${formatBRL(value)}`,
                  editingId ? "Edição" : "Inclusão",
                );
                setOpen(false);
                reset();
                toast.success(editingId ? "Proposta atualizada." : "Proposta cadastrada.");
              }}
            >
              <Field label="Origem da Proposta">
                <Select value={originId} onValueChange={setOriginId} required>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione a origem" />
                  </SelectTrigger>
                  <SelectContent>
                    {origins.map((origin) => (
                      <SelectItem key={origin.id} value={origin.id}>
                        {origin.name} · {origin.type}
                      </SelectItem>
                    ))}
                    <SelectItem value="outros">Outros</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              {originId === "outros" && (
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Nome">
                    <Input
                      value={otherName}
                      onChange={(event) => setOtherName(event.target.value)}
                      required
                    />
                  </Field>
                  <Field label="Telefone">
                    <Input
                      type="tel"
                      value={otherPhone}
                      onChange={(event) => setOtherPhone(event.target.value)}
                      required
                    />
                  </Field>
                </div>
              )}
              <Field label="Valor da Proposta">
                <CurrencyInput value={value} onValueChange={setValue} required />
              </Field>
              {(status === "Contraproposta" || counterofferValue !== null) && (
                <Field label="Valor da Contraproposta">
                  <CurrencyInput
                    value={counterofferValue || 0}
                    onValueChange={setCounterofferValue}
                    required
                  />
                </Field>
              )}
              <div className={status === "Aceita" ? "grid gap-4 sm:grid-cols-2" : undefined}>
                <Field label="Valor dos Impostos">
                  <CurrencyInput value={taxValue} onValueChange={setTaxValue} />
                </Field>
                {status === "Aceita" && (
                  <Field label="Valor final de venda">
                    <CurrencyInput
                      value={finalSaleValue || 0}
                      onValueChange={setFinalSaleValue}
                      required
                    />
                  </Field>
                )}
              </div>
              <Field label="Condição da Proposta">
                <Select value={condition} onValueChange={setCondition} required>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {["À vista", "Parcelamento", "Financiamento Bancário", "Permuta", "Outros"].map(
                      (item) => (
                        <SelectItem key={item} value={item}>
                          {item}
                        </SelectItem>
                      ),
                    )}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Observações">
                <Textarea
                  value={observations}
                  onChange={(event) => setObservations(event.target.value)}
                  rows={4}
                />
              </Field>
              <Field label="Status">
                <Select
                  value={status}
                  onValueChange={(item) => {
                    const nextStatus = item as Proposal["status"];
                    setStatus(nextStatus);
                    if (nextStatus === "Contraproposta" && counterofferValue === null) {
                      setCounterofferValue(0);
                    }
                    if (nextStatus === "Aceita" && finalSaleValue === null) {
                      setFinalSaleValue(0);
                    }
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {["Em análise", "Contraproposta", "Recusada", "Aceita"].map((item) => (
                      <SelectItem key={item} value={item}>
                        {item}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <DialogFooter>
                <Button type="submit">{editingId ? "Salvar alterações" : "Cadastrar"}</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {proposals.length ? (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[960px] table-fixed text-sm">
            <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="w-[9%] px-2 py-3">Proposta</th>
                <th className="w-[15%] px-2 py-3">Origem</th>
                <th className="w-[11%] px-2 py-3">Condição</th>
                <th className="w-[14%] px-2 py-3 text-right leading-tight">Valor da Proposta</th>
                {hasCounteroffers && (
                  <th className="w-[15%] px-2 py-3 text-right leading-tight">Valor da Contraproposta</th>
                )}
                <th className="w-[12%] px-2 py-3 text-right leading-tight">Valor dos Impostos</th>
                <th className="w-[13%] px-2 py-3 text-right leading-tight">Valor Final de Venda</th>
                <th className="w-[11%] px-2 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {proposals.map((proposal) => (
                <tr key={proposal.id}>
                  <td className="px-2 py-3 font-medium">
                    Nº {String(proposal.number).padStart(3, "0")}
                  </td>
                  <td className="px-2 py-3 break-words">{proposal.originName}</td>
                  <td className="px-2 py-3 break-words">{proposal.condition}</td>
                  <td className="px-2 py-3 text-right font-semibold tabular-nums">
                    {formatBRL(proposal.value)}
                  </td>
                  {hasCounteroffers && (
                    <td className="px-2 py-3 text-right font-semibold tabular-nums">
                      {proposal.counterofferValue !== undefined
                        ? formatBRL(proposal.counterofferValue)
                        : "—"}
                    </td>
                  )}
                  <td className="px-2 py-3 text-right font-semibold tabular-nums">
                    {proposal.taxValue !== undefined ? formatBRL(proposal.taxValue) : "—"}
                  </td>
                  <td className="px-2 py-3 text-right font-semibold tabular-nums">
                    {proposal.finalSaleValue !== undefined ? formatBRL(proposal.finalSaleValue) : "—"}
                  </td>
                  <td className="px-2 py-3">
                    <div className="flex items-center gap-0.5">
                      <span
                        className={`mr-1 rounded-full px-2.5 py-1 text-xs font-medium ${proposal.status === "Aceita" ? "bg-success-soft text-success" : proposal.status === "Recusada" ? "bg-destructive/10 text-destructive" : proposal.status === "Contraproposta" ? "bg-amber-100 text-amber-700" : "bg-primary-soft text-brand"}`}
                      >
                        {proposal.status}
                      </span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="size-8"
                        title="Visualizar proposta"
                        onClick={() => setViewProposal(proposal)}
                      >
                        <Eye className="size-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="size-8 text-brand"
                        title="Editar proposta"
                        onClick={() => beginEdit(proposal)}
                      >
                        <Pencil className="size-4" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="mt-4 rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
          Nenhuma proposta cadastrada.
        </p>
      )}

      <Dialog open={Boolean(viewProposal)} onOpenChange={(next) => !next && setViewProposal(null)}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>
              Proposta nº {viewProposal ? String(viewProposal.number).padStart(3, "0") : ""}
            </DialogTitle>
            <DialogDescription>Visualização das informações cadastradas.</DialogDescription>
          </DialogHeader>
          {viewProposal && (
            <dl className="grid gap-4 text-sm sm:grid-cols-2">
              <Detail label="Origem" value={viewProposal.originName} />
              {viewProposal.originId === "outros" && viewProposal.otherPhone && (
                <Detail label="Telefone" value={viewProposal.otherPhone} />
              )}
              <Detail label="Valor da Proposta" value={formatBRL(viewProposal.value)} />
              {viewProposal.counterofferValue !== undefined && (
                <Detail label="Valor da Contraproposta" value={formatBRL(viewProposal.counterofferValue)} />
              )}
              <Detail label="Valor dos Impostos" value={formatBRL(viewProposal.taxValue || 0)} />
              {viewProposal.finalSaleValue !== undefined && (
                <Detail label="Valor final de venda" value={formatBRL(viewProposal.finalSaleValue)} />
              )}
              <Detail label="Condição" value={viewProposal.condition} />
              <Detail label="Status" value={viewProposal.status} />
              <Detail
                label="Data do cadastro"
                value={new Intl.DateTimeFormat("pt-BR", {
                  dateStyle: "short",
                  timeStyle: "short",
                }).format(new Date(viewProposal.createdAt))}
              />
              <div className="rounded-lg border bg-muted/20 p-3 sm:col-span-2">
                <dt className="text-xs text-muted-foreground">Observações</dt>
                <dd className="mt-1 whitespace-pre-wrap font-medium">
                  {viewProposal.observations || "Nenhuma observação."}
                </dd>
              </div>
            </dl>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setViewProposal(null)}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {children}
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-muted/20 p-3">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-1 font-medium">{value}</dd>
    </div>
  );
}

import { useEffect, useState } from "react";
import { Building2, ExternalLink, Globe2, Pencil, Plus, Trash2, UserRound } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { CurrencyInput } from "@/components/ui/currency-input";
import { DatePickerField } from "@/components/ui/date-picker-field";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatBRL } from "@/lib/format-currency";
import { COMMERCIAL_DATA_UPDATED, deletePortfolioEntry, getCommercialData, savePortfolioEntry } from "@/lib/commercial";
import { formatDocument } from "@/lib/utils-validation";

type PortfolioType = "Corretor" | "Imobiliária" | "Site";
type PriceHistoryEntry = {
  changedAt: string;
  previousValue: number;
  currentValue: number;
  percentageChange: number;
};
export type PortfolioEntry = {
  id: string;
  type: PortfolioType;
  name: string;
  document?: string;
  creci?: string;
  address?: string;
  city?: string;
  state?: string;
  email?: string;
  phone?: string;
  website?: string;
  advertisedValue?: number;
  commissionPercentage?: number;
  commissionValue?: number;
  advertisementDate?: string;
  advertisementCost?: number;
  priceHistory?: PriceHistoryEntry[];
  isPropertyAvailable?: boolean;
};

const states = ["AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG", "PA", "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO"];
const normalizeUrl = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) return "";
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
};

const emptyEntry = (type: PortfolioType): PortfolioEntry => ({
  id: "",
  type,
  name: "",
  document: "",
  creci: "",
  address: "",
  city: "",
  state: "",
  email: "",
  phone: "",
  website: "",
  advertisedValue: 0,
  commissionPercentage: 0,
  commissionValue: 0,
  advertisementDate: "",
  advertisementCost: 0,
  priceHistory: [],
  isPropertyAvailable: true,
});

export function SalesPortfolioCard({ projectId }: { projectId: string }) {
  const [entries, setEntries] = useState<PortfolioEntry[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<PortfolioEntry>(emptyEntry("Corretor"));
  const [editingId, setEditingId] = useState<string | null>(null);
  const [previousAdvertisedValue, setPreviousAdvertisedValue] = useState(0);
  const [viewEntry, setViewEntry] = useState<PortfolioEntry | null>(null);

  useEffect(() => {
    void getCommercialData({ data: { projectId } }).then((data) => setEntries(data.portfolio as PortfolioEntry[])).catch((error) => toast.error(error.message));
  }, [projectId]);

  const reload = async () => { setEntries((await getCommercialData({ data: { projectId } })).portfolio as PortfolioEntry[]); window.dispatchEvent(new CustomEvent(COMMERCIAL_DATA_UPDATED, { detail: { projectId } })); };

  const update = <K extends keyof PortfolioEntry>(field: K, value: PortfolioEntry[K]) =>
    setForm((current) => ({ ...current, [field]: value }));

  const remove = async (entry: PortfolioEntry) => {
    try { await deletePortfolioEntry({ data: { projectId, id: entry.id } }); await reload(); toast.success("Cadastro removido do portfólio."); }
    catch (error) { toast.error(error instanceof Error ? error.message : "Não foi possível remover o cadastro."); }
  };

  const beginEdit = (entry: PortfolioEntry) => {
    setEditingId(entry.id);
    setPreviousAdvertisedValue(entry.advertisedValue || 0);
    setForm({ ...entry, priceHistory: entry.priceHistory || [], isPropertyAvailable: entry.isPropertyAvailable ?? true });
    setOpen(true);
  };

  const iconFor = (type: PortfolioType) => type === "Corretor" ? UserRound : type === "Imobiliária" ? Building2 : Globe2;

  return (
    <section className="surface-card p-5 lg:col-span-2">
      <div className="flex flex-col gap-3 border-b pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-lg font-semibold">Portfólio de venda</h3>
          <p className="text-sm text-muted-foreground">Corretores, imobiliárias e sites utilizados na comercialização.</p>
        </div>
        <Dialog open={open} onOpenChange={(next) => {
          setOpen(next);
          if (!next) {
            setForm(emptyEntry("Corretor"));
            setEditingId(null);
            setPreviousAdvertisedValue(0);
          }
        }}>
          <DialogTrigger asChild><Button><Plus className="size-4" /> Adicionar ao portfólio</Button></DialogTrigger>
          <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
            <DialogHeader>
              <DialogTitle>{editingId ? "Editar cadastro de comercialização" : "Novo cadastro de comercialização"}</DialogTitle>
              <DialogDescription>Selecione o tipo e preencha as informações correspondentes.</DialogDescription>
            </DialogHeader>
            <form className="space-y-4" onSubmit={async (event) => {
              event.preventDefault();
              const commissionValue = (form.advertisedValue || 0) * (form.commissionPercentage || 0) / 100;
              const currentAdvertisedValue = form.advertisedValue || 0;
              const priceChanged = Boolean(editingId) && currentAdvertisedValue !== previousAdvertisedValue;
              const percentageChange = previousAdvertisedValue === 0
                ? (currentAdvertisedValue > 0 ? 100 : 0)
                : ((currentAdvertisedValue - previousAdvertisedValue) / previousAdvertisedValue) * 100;
              const priceHistory = priceChanged
                ? [
                    {
                      changedAt: new Date().toISOString(),
                      previousValue: previousAdvertisedValue,
                      currentValue: currentAdvertisedValue,
                      percentageChange,
                    },
                    ...(form.priceHistory || []),
                  ]
                : (form.priceHistory || []);
              const saved = {
                ...form,
                website: normalizeUrl(form.website || ""),
                commissionValue,
                priceHistory,
                id: editingId || undefined,
              };
              try {
                await savePortfolioEntry({ data: { projectId, id: saved.id, type: saved.type, name: saved.name, document: saved.document || "", creci: saved.creci || "", address: saved.address || "", city: saved.city || "", state: saved.state || "", email: saved.email || "", phone: saved.phone || "", website: saved.website || "", advertisedValue: saved.advertisedValue || 0, commissionPercentage: saved.commissionPercentage || 0, commissionValue: saved.commissionValue || 0, advertisementDate: saved.advertisementDate || "", advertisementCost: saved.advertisementCost || 0, priceHistory: saved.priceHistory || [], isPropertyAvailable: saved.isPropertyAvailable ?? true } }); await reload(); setOpen(false); setForm(emptyEntry("Corretor")); setEditingId(null); toast.success(editingId ? "Cadastro atualizado." : "Cadastro adicionado ao portfólio.");
              } catch (error) { toast.error(error instanceof Error ? error.message : "Não foi possível salvar o cadastro."); }
            }}>
              <div className="space-y-2">
                <Label>Tipo de cadastro</Label>
                <Select disabled={Boolean(editingId)} value={form.type} onValueChange={(value) => setForm(emptyEntry(value as PortfolioType))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Corretor">Corretor</SelectItem>
                    <SelectItem value="Imobiliária">Imobiliária</SelectItem>
                    <SelectItem value="Site">Site</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {form.type === "Site" ? (
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Nome do Site"><Input value={form.name} onChange={(event) => update("name", event.target.value)} required /></Field>
                  <UrlField value={form.website || ""} onChange={(value) => update("website", value)} required />
                  <Field label="Data do anúncio"><DatePickerField value={form.advertisementDate} aria-label="Data do anúncio" onValueChange={(value) => update("advertisementDate", value)} required /></Field>
                  <Field label="Custo do Anúncio"><CurrencyInput value={form.advertisementCost || 0} onValueChange={(value) => update("advertisementCost", value)} /></Field>
                  <Field label="Valor Anunciado"><CurrencyInput value={form.advertisedValue || 0} onValueChange={(value) => update("advertisedValue", value)} /></Field>
                  <PriceHistory
                    history={form.priceHistory || []}
                    pending={editingId && (form.advertisedValue || 0) !== previousAdvertisedValue ? {
                      changedAt: new Date().toISOString(),
                      previousValue: previousAdvertisedValue,
                      currentValue: form.advertisedValue || 0,
                      percentageChange: previousAdvertisedValue === 0
                        ? 100
                        : (((form.advertisedValue || 0) - previousAdvertisedValue) / previousAdvertisedValue) * 100,
                    } : null}
                  />
                  <AvailabilitySelect
                    value={form.isPropertyAvailable ?? true}
                    onChange={(value) => update("isPropertyAvailable", value)}
                  />
                </div>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label={form.type === "Corretor" ? "Nome completo" : "Razão Social"}><Input value={form.name} onChange={(event) => update("name", event.target.value)} required /></Field>
                  <Field label={form.type === "Corretor" ? "CPF" : "CNPJ"}><Input value={form.document} onChange={(event) => update("document", formatDocument(event.target.value))} required /></Field>
                  {form.type === "Corretor" && <Field label="CRECI"><Input value={form.creci} onChange={(event) => update("creci", event.target.value)} required /></Field>}
                  <Field label="Endereço"><Input value={form.address} onChange={(event) => update("address", event.target.value)} required /></Field>
                  <Field label="Cidade"><Input value={form.city} onChange={(event) => update("city", event.target.value)} required /></Field>
                  <Field label="UF"><Select value={form.state || ""} onValueChange={(value) => update("state", value)}><SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger><SelectContent>{states.map((state) => <SelectItem key={state} value={state}>{state}</SelectItem>)}</SelectContent></Select></Field>
                  <Field label="E-mail"><Input type="email" value={form.email} onChange={(event) => update("email", event.target.value)} required /></Field>
                  <Field label="Telefone"><Input type="tel" value={form.phone} onChange={(event) => update("phone", event.target.value)} required /></Field>
                  <UrlField label="Site ou Rede Social" value={form.website || ""} onChange={(value) => update("website", value)} />
                  <Field label="Valor Anunciado"><CurrencyInput value={form.advertisedValue || 0} onValueChange={(value) => update("advertisedValue", value)} /></Field>
                  <Field label="Comissão (%)">
                    <div className="relative">
                      <Input
                        type="number"
                        min="0"
                        max="100"
                        step="0.01"
                        className="pr-9 text-right"
                        value={form.commissionPercentage || ""}
                        onChange={(event) => update("commissionPercentage", Math.min(100, Math.max(0, Number(event.target.value))))}
                        placeholder="0,00"
                      />
                      <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">%</span>
                    </div>
                  </Field>
                  <Field label="Valor da Comissão">
                    <CurrencyInput
                      value={(form.advertisedValue || 0) * (form.commissionPercentage || 0) / 100}
                      onValueChange={() => undefined}
                      readOnly
                      className="bg-muted/50 font-medium"
                    />
                  </Field>
                  <PriceHistory
                    history={form.priceHistory || []}
                    pending={editingId && (form.advertisedValue || 0) !== previousAdvertisedValue ? {
                      changedAt: new Date().toISOString(),
                      previousValue: previousAdvertisedValue,
                      currentValue: form.advertisedValue || 0,
                      percentageChange: previousAdvertisedValue === 0
                        ? 100
                        : (((form.advertisedValue || 0) - previousAdvertisedValue) / previousAdvertisedValue) * 100,
                    } : null}
                  />
                  <AvailabilitySelect
                    value={form.isPropertyAvailable ?? true}
                    onChange={(value) => update("isPropertyAvailable", value)}
                  />
                </div>
              )}
              <DialogFooter><Button type="submit">{editingId ? "Salvar alterações" : "Cadastrar"}</Button></DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {entries.length ? (
        <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {entries.map((entry) => {
            const Icon = iconFor(entry.type);
            return (
              <article key={entry.id} className="rounded-xl border p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 gap-3">
                    <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-primary-soft text-brand"><Icon className="size-5" /></span>
                    <div className="min-w-0"><button type="button" className="block max-w-full truncate text-left font-semibold hover:text-brand hover:underline" onClick={() => setViewEntry(entry)}>{entry.name}</button><p className="text-xs text-muted-foreground">{entry.type}</p></div>
                  </div>
                  <div className="flex shrink-0">
                    <Button variant="ghost" size="icon" className="size-8 text-brand" onClick={() => beginEdit(entry)} title="Editar cadastro"><Pencil className="size-4" /></Button>
                    <Button variant="ghost" size="icon" className="size-8 text-destructive" onClick={() => remove(entry)} title="Excluir cadastro"><Trash2 className="size-4" /></Button>
                  </div>
                </div>
                <dl className="mt-4 space-y-2 text-sm">
                  {entry.document && <Row label={entry.type === "Corretor" ? "CPF" : "CNPJ"} value={entry.document} />}
                  {entry.creci && <Row label="CRECI" value={entry.creci} />}
                  {entry.advertisedValue ? <Row label="Valor anunciado" value={formatBRL(entry.advertisedValue)} /> : null}
                  {entry.commissionPercentage ? <Row label="Comissão" value={`${entry.commissionPercentage.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%`} /> : null}
                  {entry.commissionValue ? <Row label="Valor da comissão" value={formatBRL(entry.commissionValue)} /> : null}
                  {entry.advertisementDate && <Row label="Data do anúncio" value={new Date(`${entry.advertisementDate}T00:00:00`).toLocaleDateString("pt-BR")} />}
                  {entry.advertisementCost ? <Row label="Custo" value={formatBRL(entry.advertisementCost)} /> : null}
                  <Row label="Imóvel disponível para venda?" value={(entry.isPropertyAvailable ?? true) ? "Sim" : "Não"} />
                </dl>
                {entry.website && <a href={entry.website} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-brand hover:underline">Abrir link <ExternalLink className="size-3" /></a>}
              </article>
            );
          })}
        </div>
      ) : <p className="mt-4 rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">Nenhum canal de venda cadastrado.</p>}

      <Dialog open={Boolean(viewEntry)} onOpenChange={(next) => !next && setViewEntry(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Dados do cadastro</DialogTitle>
            <DialogDescription>Visualização das informações do portfólio de venda.</DialogDescription>
          </DialogHeader>
          {viewEntry && (
            <dl className="grid gap-4 text-sm sm:grid-cols-2">
              <Detail label="Tipo" value={viewEntry.type} />
              <Detail label={viewEntry.type === "Corretor" ? "Nome completo" : viewEntry.type === "Imobiliária" ? "Razão Social" : "Nome do Site"} value={viewEntry.name} />
              {viewEntry.document && <Detail label={viewEntry.type === "Corretor" ? "CPF" : "CNPJ"} value={viewEntry.document} />}
              {viewEntry.creci && <Detail label="CRECI" value={viewEntry.creci} />}
              {viewEntry.address && <Detail label="Endereço" value={viewEntry.address} />}
              {viewEntry.city && <Detail label="Cidade" value={viewEntry.city} />}
              {viewEntry.state && <Detail label="UF" value={viewEntry.state} />}
              {viewEntry.email && <Detail label="E-mail" value={viewEntry.email} />}
              {viewEntry.phone && <Detail label="Telefone" value={viewEntry.phone} />}
              {viewEntry.advertisedValue ? <Detail label="Valor anunciado" value={formatBRL(viewEntry.advertisedValue)} /> : null}
              {viewEntry.commissionPercentage ? <Detail label="Comissão" value={`${viewEntry.commissionPercentage.toLocaleString("pt-BR")}%`} /> : null}
              {viewEntry.commissionValue ? <Detail label="Valor da comissão" value={formatBRL(viewEntry.commissionValue)} /> : null}
              {viewEntry.advertisementDate && <Detail label="Data do anúncio" value={new Date(`${viewEntry.advertisementDate}T00:00:00`).toLocaleDateString("pt-BR")} />}
              {viewEntry.advertisementCost ? <Detail label="Custo do anúncio" value={formatBRL(viewEntry.advertisementCost)} /> : null}
              <Detail label="Imóvel disponível para venda?" value={(viewEntry.isPropertyAvailable ?? true) ? "Sim" : "Não"} />
              {viewEntry.website && (
                <div className="sm:col-span-2"><dt className="text-muted-foreground">Site, rede social ou anúncio</dt><dd className="mt-1"><a href={viewEntry.website} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-medium text-brand hover:underline">Abrir URL <ExternalLink className="size-3" /></a></dd></div>
              )}
            </dl>
          )}
          <DialogFooter><Button type="button" variant="outline" onClick={() => setViewEntry(null)}>Fechar</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-2"><Label>{label}</Label>{children}</div>;
}

function Row({ label, value }: { label: string; value: string }) {
  return <div className="flex justify-between gap-3"><dt className="text-muted-foreground">{label}</dt><dd className="text-right font-medium">{value}</dd></div>;
}

function Detail({ label, value }: { label: string; value: string }) {
  return <div className="rounded-lg border bg-muted/20 p-3"><dt className="text-xs text-muted-foreground">{label}</dt><dd className="mt-1 font-medium">{value}</dd></div>;
}

function AvailabilitySelect({ value, onChange }: { value: boolean; onChange: (value: boolean) => void }) {
  return (
    <div className="space-y-2 sm:col-span-2">
      <Label>Imóvel disponível para venda?</Label>
      <Select value={value ? "sim" : "nao"} onValueChange={(next) => onChange(next === "sim")}>
        <SelectTrigger><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="sim">Sim</SelectItem>
          <SelectItem value="nao">Não</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}

function PriceHistory({ history, pending }: { history: PriceHistoryEntry[]; pending: PriceHistoryEntry | null }) {
  const rows = pending ? [{ ...pending, isPending: true }, ...history.map((item) => ({ ...item, isPending: false }))] : history.map((item) => ({ ...item, isPending: false }));
  return (
    <div className="space-y-3 rounded-lg border bg-muted/20 p-4 sm:col-span-2">
      <div>
        <h4 className="text-sm font-semibold">Histórico de alteração do valor anunciado</h4>
        <p className="text-xs text-muted-foreground">Alterações são registradas ao salvar o cadastro.</p>
      </div>
      {rows.length ? (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[540px] text-sm">
            <thead className="text-left text-xs text-muted-foreground">
              <tr><th className="pb-2 font-medium">Data e hora</th><th className="pb-2 text-right font-medium">Valor anterior</th><th className="pb-2 text-right font-medium">Valor atual</th><th className="pb-2 text-right font-medium">Variação</th></tr>
            </thead>
            <tbody className="divide-y">
              {rows.map((item, index) => (
                <tr key={`${item.changedAt}-${index}`}>
                  <td className="py-2">{item.isPending ? "Alteração não salva" : new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(item.changedAt))}</td>
                  <td className="py-2 text-right">{formatBRL(item.previousValue)}</td>
                  <td className="py-2 text-right">{formatBRL(item.currentValue)}</td>
                  <td className={`py-2 text-right font-semibold ${item.percentageChange >= 0 ? "text-success" : "text-destructive"}`}>
                    {item.percentageChange > 0 ? "+" : ""}{item.percentageChange.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : <p className="text-sm text-muted-foreground">Nenhuma alteração registrada.</p>}
    </div>
  );
}

function UrlField({
  value,
  onChange,
  label = "URL do Anúncio",
  required = false,
}: {
  value: string;
  onChange: (value: string) => void;
  label?: string;
  required?: boolean;
}) {
  const url = normalizeUrl(value);
  return (
    <Field label={label}>
      <Input
        type="text"
        inputMode="url"
        placeholder="www.exemplo.com/anuncio"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        required={required}
      />
      {value.trim() && (
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-xs font-medium text-brand hover:underline"
        >
          Abrir URL em nova janela <ExternalLink className="size-3" />
        </a>
      )}
    </Field>
  );
}

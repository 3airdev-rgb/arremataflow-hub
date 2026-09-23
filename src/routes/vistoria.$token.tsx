import { createFileRoute } from "@tanstack/react-router";
import { useState, type ReactNode } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  getPublicInspection,
  submitPublicInspection,
  type InspectionAnswers,
} from "@/lib/property-inspections";

const ratings = ["Ótimo", "Bom", "Regular", "Ruim", "Danificado"];
const fixtures = [
  "Paredes",
  "Teto",
  "Piso",
  "Janelas",
  "Portas",
  "Tomadas/Interruptores",
  "Iluminação",
];
type KeyName = "chaves" | "controle" | "tags";
type Photo = InspectionAnswers["photos"][number];
type FormState = Omit<InspectionAnswers, "keys" | "utilities" | "installations"> & {
  keys: Record<KeyName, InspectionAnswers["keys"][string]>;
  utilities: {
    energy: boolean;
    energyMeter: string;
    energyCompany: string;
    water: boolean;
    waterMeter: string;
    waterCompany: string;
    sewer: boolean;
    sewerCompany: string;
  };
  installations: {
    electricalPanel: boolean;
    leaks: boolean;
    leakLocation: string;
    toilets: boolean;
    drains: string;
    waterTank: string;
  };
};
type NestedGroup = "utilities" | "installations";

const newRoom = () => ({
  name: "",
  conditions: Object.fromEntries(fixtures.map((item) => [item, ""])),
  furniture: "",
  notes: "",
});
function YesNo({ value, onChange }: { value: boolean; onChange: (value: boolean) => void }) {
  return (
    <div className="flex gap-5 pt-2">
      <label className="flex items-center gap-2">
        <input type="radio" checked={value} onChange={() => onChange(true)} />
        Sim
      </label>
      <label className="flex items-center gap-2">
        <input type="radio" checked={!value} onChange={() => onChange(false)} />
        Não
      </label>
    </div>
  );
}

export const Route = createFileRoute("/vistoria/$token")({
  loader: ({ params }) => getPublicInspection({ data: { token: params.token } }),
  component: InspectionPage,
  head: () => ({ meta: [{ title: "Vistoria do imóvel | ArremataFlow" }] }),
});

function InspectionPage() {
  const initial = Route.useLoaderData();
  const { token } = Route.useParams();
  const [done, setDone] = useState(initial.status === "completed");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [data, setData] = useState<FormState>({
    inspectionType: "posse",
    dateTime: "",
    propertyType: initial.propertyType,
    inspectorPhone: "",
    bailiffPresent: false,
    bailiffName: "",
    bailiffPhone: "",
    keys: {
      chaves: { has: false, quantity: 0 },
      controle: { has: false, quantity: 0 },
      tags: { has: false, quantity: 0 },
    },
    otherAccess: "",
    utilities: {
      energy: false,
      energyMeter: "",
      energyCompany: "",
      water: false,
      waterMeter: "",
      waterCompany: "",
      sewer: false,
      sewerCompany: "",
    },
    rooms: [],
    installations: {
      electricalPanel: false,
      leaks: false,
      leakLocation: "",
      toilets: false,
      drains: "",
      waterTank: "",
    },
    inventory: [],
    generalNotes: "",
    photos: [],
  });
  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setData((current) => ({ ...current, [key]: value }));
  const nested = <G extends NestedGroup, K extends keyof FormState[G]>(
    group: G,
    key: K,
    value: FormState[G][K],
  ) => setData((current) => ({ ...current, [group]: { ...current[group], [key]: value } }));
  if (done)
    return (
      <main className="grid min-h-screen place-items-center bg-slate-50 p-4 sm:p-6">
        <div className="surface-card max-w-lg p-8 text-center">
          <img src="/arremataflow-logo.jpg" className="mx-auto mb-5 h-16" alt="ArremataFlow" />
          <h1 className="text-2xl font-semibold">Vistoria registrada</h1>
          <p className="mt-2 text-muted-foreground">
            Os dados foram enviados ao ArremataFlow com sucesso.
          </p>
        </div>
      </main>
    );
  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8">
      <form
        className="mx-auto max-w-5xl space-y-6"
        onSubmit={async (event) => {
          event.preventDefault();
          setSaving(true);
          setError("");
          try {
            await submitPublicInspection({ data: { token, answers: data } });
            setDone(true);
          } catch (e) {
            setError((e instanceof Error && e.message) || "Não foi possível salvar a vistoria.");
          } finally {
            setSaving(false);
          }
        }}
      >
        <header className="surface-card p-6 text-center">
          <img src="/arremataflow-logo.jpg" className="mx-auto mb-4 h-16" alt="ArremataFlow" />
          <h1 className="text-2xl font-bold">Laudo de Vistoria de Imóvel</h1>
          <p className="mt-1 font-medium">{initial.projectName}</p>
          <p className="text-sm text-muted-foreground">
            {initial.address} — {initial.city}
          </p>
        </header>
        <Section title="1. Dados do Imóvel">
          <Grid>
            <Field label="Tipo de vistoria">
              <select
                className="h-10 w-full rounded-md border px-3"
                value={data.inspectionType}
                onChange={(e) =>
                  set("inspectionType", e.target.value as FormState["inspectionType"])
                }
              >
                <option value="posse">Posse</option>
                <option value="venda">Venda</option>
              </select>
            </Field>
            <Field label="Data e hora">
              <Input
                type="datetime-local"
                required
                value={data.dateTime}
                onChange={(e) => set("dateTime", e.target.value)}
              />
            </Field>
            <Field label="Tipo de imóvel">
              <Input required readOnly className="bg-muted" value={data.propertyType} />
            </Field>
            <Field label="Vistoriador responsável">
              <Input value={initial.inspectorName} readOnly className="bg-muted" />
            </Field>
            <Field label="Contato do vistoriador">
              <Input
                value={data.inspectorPhone}
                onChange={(e) => set("inspectorPhone", e.target.value)}
              />
            </Field>
            <Field label="Oficial de Justiça presente?">
              <YesNo value={data.bailiffPresent} onChange={(v) => set("bailiffPresent", v)} />
            </Field>
            {data.bailiffPresent && (
              <>
                <Field label="Nome do Oficial de Justiça">
                  <Input
                    value={data.bailiffName}
                    onChange={(e) => set("bailiffName", e.target.value)}
                  />
                </Field>
                <Field label="Fone de Contato">
                  <Input
                    value={data.bailiffPhone}
                    onChange={(e) => set("bailiffPhone", e.target.value)}
                  />
                </Field>
              </>
            )}
          </Grid>
        </Section>
        <Section title="2. Chaves e Acessos">
          <Grid>
            {(
              Object.entries({
                chaves: "Chaves",
                controle: "Controle remoto do portão",
                tags: "Tags/cartões de acesso",
              }) as [KeyName, string][]
            ).map(([key, label]) => (
              <Field key={key} label={label}>
                <YesNo
                  value={data.keys[key].has}
                  onChange={(v) =>
                    setData((c) => ({
                      ...c,
                      keys: {
                        ...c.keys,
                        [key]: { ...c.keys[key], has: v, quantity: v ? c.keys[key].quantity : 0 },
                      },
                    }))
                  }
                />
                {data.keys[key].has && (
                  <div className="mt-2 max-w-32">
                    <Label>Qtde.</Label>
                    <Input
                      type="number"
                      min="1"
                      max="99"
                      value={data.keys[key].quantity || ""}
                      onChange={(e) =>
                        setData((c) => ({
                          ...c,
                          keys: {
                            ...c.keys,
                            [key]: {
                              ...c.keys[key],
                              quantity: Math.min(99, Number(e.target.value)),
                            },
                          },
                        }))
                      }
                    />
                  </div>
                )}
              </Field>
            ))}
          </Grid>
          <Field label="Outros">
            <Textarea
              value={data.otherAccess}
              onChange={(e) => set("otherAccess", e.target.value)}
            />
          </Field>
        </Section>
        <Section title="3. Serviços Públicos">
          <div className="grid gap-4 lg:grid-cols-3">
            <Field label="Possui energia?">
              <YesNo
                value={data.utilities.energy}
                onChange={(v) => nested("utilities", "energy", v)}
              />
            </Field>
            <Field label="Número do medidor de energia">
              <Input
                value={data.utilities.energyMeter}
                onChange={(e) => nested("utilities", "energyMeter", e.target.value)}
              />
            </Field>
            <Field label="Concessionária de luz">
              <Input
                value={data.utilities.energyCompany}
                onChange={(e) => nested("utilities", "energyCompany", e.target.value)}
              />
            </Field>
            <Field label="Possui água?">
              <YesNo
                value={data.utilities.water}
                onChange={(v) => nested("utilities", "water", v)}
              />
            </Field>
            <Field label="Número do medidor de água">
              <Input
                value={data.utilities.waterMeter}
                onChange={(e) => nested("utilities", "waterMeter", e.target.value)}
              />
            </Field>
            <Field label="Concessionária de água">
              <Input
                value={data.utilities.waterCompany}
                onChange={(e) => nested("utilities", "waterCompany", e.target.value)}
              />
            </Field>
            <Field label="Possui esgoto tratado?">
              <YesNo
                value={data.utilities.sewer}
                onChange={(v) => nested("utilities", "sewer", v)}
              />
            </Field>
            <Field label="Concessionária de esgoto">
              <Input
                value={data.utilities.sewerCompany}
                onChange={(e) => nested("utilities", "sewerCompany", e.target.value)}
              />
            </Field>
          </div>
        </Section>
        <Section title="4. Condições por Cômodo">
          {data.rooms.map((room, i) => (
            <div key={i} className="mb-5 rounded-lg border p-4">
              <div className="mb-4 flex items-end gap-2">
                <Field label="Identificação do cômodo">
                  <Input
                    value={room.name}
                    placeholder="Ex.: Sala de estar"
                    onChange={(e) => changeRoom(i, "name", e.target.value)}
                  />
                </Field>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() =>
                    setData((c) => ({
                      ...c,
                      rooms: c.rooms.filter((_, n) => n !== i),
                    }))
                  }
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                {fixtures.map((item) => (
                  <Field key={item} label={item}>
                    <div className="flex flex-wrap gap-x-4 gap-y-2">
                      {ratings.map((value) => (
                        <label key={value} className="flex items-center gap-1.5 text-sm">
                          <input
                            type="checkbox"
                            checked={room.conditions[item] === value}
                            onChange={() =>
                              changeRoomCondition(
                                i,
                                item,
                                room.conditions[item] === value ? "" : value,
                              )
                            }
                          />
                          {value}
                        </label>
                      ))}
                    </div>
                  </Field>
                ))}
              </div>
              <Field label="Mobília">
                <Textarea
                  value={room.furniture}
                  onChange={(e) => changeRoom(i, "furniture", e.target.value)}
                />
              </Field>
              <Field label="Observações">
                <Textarea
                  value={room.notes}
                  onChange={(e) => changeRoom(i, "notes", e.target.value)}
                />
              </Field>
            </div>
          ))}
          <Button
            type="button"
            variant="outline"
            onClick={() => setData((c) => ({ ...c, rooms: [...c.rooms, newRoom()] }))}
          >
            <Plus className="size-4" />
            Cômodo
          </Button>
        </Section>
        <Section title="5. Instalações Elétricas e Hidráulicas">
          <Grid>
            <Field label="Quadro de luz: estado e disjuntores funcionando?">
              <YesNo
                value={data.installations.electricalPanel}
                onChange={(v) => nested("installations", "electricalPanel", v)}
              />
            </Field>
            <Field label="Identificados vazamentos?">
              <YesNo
                value={data.installations.leaks}
                onChange={(v) => nested("installations", "leaks", v)}
              />
              {data.installations.leaks && (
                <Input
                  className="mt-2"
                  placeholder="Local do vazamento"
                  value={data.installations.leakLocation}
                  onChange={(e) => nested("installations", "leakLocation", e.target.value)}
                />
              )}
            </Field>
            <Field label="Vasos sanitários e descargas funcionando?">
              <YesNo
                value={data.installations.toilets}
                onChange={(v) => nested("installations", "toilets", v)}
              />
            </Field>
            <Field label="Ralos: desobstruídos?">
              <Input
                value={data.installations.drains}
                onChange={(e) => nested("installations", "drains", e.target.value)}
              />
            </Field>
            <Field label="Caixa d'água: estado e tampa">
              <Input
                value={data.installations.waterTank}
                onChange={(e) => nested("installations", "waterTank", e.target.value)}
              />
            </Field>
          </Grid>
        </Section>
        <Section title="6. Inventário de Móveis e Eletrodomésticos">
          {data.inventory.length > 0 && (
            <div
              tabIndex={0}
              role="region"
              aria-label="Tabela com rolagem horizontal"
              className="table-scroll overflow-x-auto"
            >
              <table className="w-full min-w-[540px] border-collapse">
                <thead>
                  <tr className="bg-muted">
                    <th className="p-2 text-left">Item</th>
                    <th className="p-2 text-left">Marca/Modelo</th>
                    <th className="p-2 text-left">Estado</th>
                    <th className="w-12" />
                  </tr>
                </thead>
                <tbody>
                  {data.inventory.map((x, i) => (
                    <tr key={i} className="border-b">
                      <td className="p-2">
                        <Input
                          value={x.item}
                          onChange={(e) => changeInventory(i, "item", e.target.value)}
                        />
                      </td>
                      <td className="p-2">
                        <Input
                          value={x.model}
                          onChange={(e) => changeInventory(i, "model", e.target.value)}
                        />
                      </td>
                      <td className="p-2">
                        <Input
                          value={x.condition}
                          onChange={(e) => changeInventory(i, "condition", e.target.value)}
                        />
                      </td>
                      <td>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() =>
                            setData((c) => ({
                              ...c,
                              inventory: c.inventory.filter((_, n) => n !== i),
                            }))
                          }
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <Button
            type="button"
            variant="outline"
            onClick={() =>
              setData((c) => ({
                ...c,
                inventory: [...c.inventory, { item: "", model: "", condition: "" }],
              }))
            }
          >
            <Plus className="size-4" />
            Adicionar item
          </Button>
        </Section>
        <Section title="7. Observações Gerais e Ressalvas">
          <Textarea
            rows={6}
            value={data.generalNotes}
            onChange={(e) => set("generalNotes", e.target.value)}
          />
        </Section>
        <Section title="8. Anexos Fotográficos">
          <Input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            onChange={async (e) => {
              const files = Array.from(e.target.files || []);
              if (files.some((f) => f.size > 2 * 1024 * 1024)) {
                setError("Cada imagem deve ter no máximo 2 MB.");
                return;
              }
              const photos = await Promise.all(
                files.map(
                  (f) =>
                    new Promise<Photo>((resolve, reject) => {
                      const reader = new FileReader();
                      reader.onload = () =>
                        resolve({
                          name: f.name,
                          type: f.type as Photo["type"],
                          data: String(reader.result),
                        });
                      reader.onerror = reject;
                      reader.readAsDataURL(f);
                    }),
                ),
              );
              setData((current) => ({
                ...current,
                photos: [...current.photos, ...photos].slice(0, 10),
              }));
              e.target.value = "";
            }}
          />
          <p className="text-xs text-muted-foreground">
            Você pode selecionar várias imagens ou adicioná-las em etapas. Limite de 10 imagens, com
            no máximo 2 MB cada.
          </p>
          {data.photos.length > 0 && (
            <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
              {data.photos.map((photo, index) => (
                <figure key={`${photo.name}-${index}`} className="relative rounded-lg border p-2">
                  <img
                    src={photo.data}
                    alt={photo.name}
                    className="h-40 w-full rounded object-cover"
                  />
                  <figcaption className="mt-2 [overflow-wrap:anywhere] text-xs">
                    {photo.name}
                  </figcaption>
                  <Button
                    type="button"
                    variant="destructive"
                    size="icon"
                    className="absolute right-3 top-3 size-8"
                    onClick={() =>
                      setData((current) => ({
                        ...current,
                        photos: current.photos.filter((_, n) => n !== index),
                      }))
                    }
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </figure>
              ))}
            </div>
          )}
        </Section>
        {error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
        <Button className="w-full" size="lg" disabled={saving}>
          {saving ? "Salvando..." : "Salvar vistoria"}
        </Button>
      </form>
    </main>
  );
  function changeRoom(i: number, key: "name" | "furniture" | "notes", value: string) {
    setData((c) => ({
      ...c,
      rooms: c.rooms.map((x, n) => (n === i ? { ...x, [key]: value } : x)),
    }));
  }
  function changeRoomCondition(i: number, key: string, value: string) {
    setData((c) => ({
      ...c,
      rooms: c.rooms.map((x, n) =>
        n === i ? { ...x, conditions: { ...x.conditions, [key]: value } } : x,
      ),
    }));
  }
  function changeInventory(i: number, key: "item" | "model" | "condition", value: string) {
    setData((c) => ({
      ...c,
      inventory: c.inventory.map((x, n) => (n === i ? { ...x, [key]: value } : x)),
    }));
  }
}
function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="surface-card space-y-4 p-6">
      <h2 className="text-lg font-semibold">{title}</h2>
      {children}
    </section>
  );
}
function Grid({ children }: { children: ReactNode }) {
  return <div className="grid gap-4 md:grid-cols-2">{children}</div>;
}
function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0 flex-1 space-y-2">
      <Label>{label}</Label>
      {children}
    </div>
  );
}

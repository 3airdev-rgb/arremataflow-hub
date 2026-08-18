import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { House, Handshake, BriefcaseBusiness, Users, Plus, Trash2, Save, UserPlus, Search, CalendarIcon, CheckCircle2 } from "lucide-react";
import { AppLayout } from "@/components/app-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { projetos, usuarios, formatBRL } from "@/lib/mock-data";
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
  const [isAssessorModalOpen, setIsAssessorModalOpen] = useState(false);
  const [participantes, setParticipantes] = useState([
    { nome: "Marcos Ribeiro", papel: "Investidor", percentual: "45" },
  ]);
  const [assessoresVinculados, setAssessoresVinculados] = useState([
    { nome: "Camila Andrade", papel: "Assessor", percentual: "100" },
  ]);
  
  // States for new logic
  const [modalidade, setModalidade] = useState<string>("");
  const [valorAquisicao, setValorAquisicao] = useState<number>(0);
  const [percentualHonorarios, setPercentualHonorarios] = useState<number>(10);
  const [temMinimo, setTemMinimo] = useState<string>("nao");
  const [valorMinimo, setValorMinimo] = useState<number>(0);
  const [dataAquisicao, setDataAquisicao] = useState<Date | undefined>(undefined);

  const honorarioCalculado = useMemo(() => {
    const calculado = valorAquisicao * (percentualHonorarios / 100);
    if (temMinimo === "sim") {
      return Math.max(calculado, valorMinimo);
    }
    return calculado;
  }, [valorAquisicao, percentualHonorarios, temMinimo, valorMinimo]);

  const investidoresDisponiveis = usuarios.filter(u => u.perfil === "Investidor");
  const assessoresDisponiveis = usuarios.filter(u => u.perfil === "Assessor" || u.perfil === "Administrador" || u.perfil === "Jurídico");

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
              <Input 
                id="valor" 
                placeholder="R$ 0,00" 
                onChange={(e) => {
                  const val = parseFloat(e.target.value.replace(/[^0-9]/g, "")) || 0;
                  setValorAquisicao(val);
                }}
              />
            </div>
            <div className="space-y-2">
              <Label>Data da aquisição</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant={"outline"}
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !dataAquisicao && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dataAquisicao ? (
                      format(dataAquisicao, "dd/MM/yyyy")
                    ) : (
                      <span>Selecione uma data</span>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={dataAquisicao}
                    onSelect={setDataAquisicao}
                    locale={ptBR}
                  />
                </PopoverContent>
              </Popover>
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
              <Select onValueChange={setModalidade} required>
                <SelectTrigger id="modalidade">
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="completa">Assessoria Completa</SelectItem>
                  <SelectItem value="parcial">Assessoria Parcial</SelectItem>
                  <SelectItem value="juridica">Assessoria Jurídica</SelectItem>
                  <SelectItem value="operacional">Assessoria Operacional</SelectItem>
                  <SelectItem value="consultiva">Consultoria Específica</SelectItem>
                  <SelectItem value="nenhuma">Sem Assessoria</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {(modalidade === "parcial" || modalidade === "juridica" || modalidade === "operacional" || modalidade === "consultiva") && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="honorario">Percentual de Honorários (%)</Label>
                  <Input 
                    id="honorario" 
                    type="number"
                    value={percentualHonorarios}
                    onChange={(e) => setPercentualHonorarios(parseFloat(e.target.value) || 0)}
                  />
                </div>
                
                <div className="space-y-3">
                  <Label>Há valor mínimo de honorários?</Label>
                  <RadioGroup 
                    value={temMinimo} 
                    onValueChange={setTemMinimo}
                    className="flex items-center gap-4"
                  >
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="sim" id="min-sim" />
                      <Label htmlFor="min-sim" className="cursor-pointer">Sim</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="nao" id="min-nao" />
                      <Label htmlFor="min-nao" className="cursor-pointer">Não</Label>
                    </div>
                  </RadioGroup>
                </div>

                {temMinimo === "sim" && (
                  <div className="space-y-2">
                    <Label htmlFor="val-min">Valor Mínimo de Honorários</Label>
                    <Input 
                      id="val-min" 
                      placeholder="R$ 0,00"
                      onChange={(e) => {
                        const val = parseFloat(e.target.value.replace(/[^0-9]/g, "")) || 0;
                        setValorMinimo(val);
                      }}
                    />
                  </div>
                )}

                <div className="space-y-2">
                  <Label>Valor devido calculado</Label>
                  <div className="h-10 flex items-center px-3 rounded-md border bg-muted font-medium">
                    {formatBRL(honorarioCalculado)}
                  </div>
                </div>
              </>
            )}

            {modalidade === "completa" && (
              <div className="md:col-span-2 rounded-lg bg-primary-soft p-4 border border-brand/20">
                <p className="text-sm font-medium text-brand">Regra de Assessoria Completa</p>
                <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                  Honorários apurados sobre o Resultado Líquido (Venda - Despesas).
                  Distribuição: 50% Assessoria / 50% Investidores.
                </p>
              </div>
            )}

            {modalidade === "nenhuma" && (
              <div className="md:col-span-2 space-y-4">
                <div className="rounded-lg bg-muted p-4 border border-border">
                  <p className="text-sm font-medium">Sem Assessoria</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Nenhum cálculo de honorários ou distribuição será realizado para assessoria.
                  </p>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="fixo-zero">Valor dos honorários</Label>
                    <Input id="fixo-zero" value="R$ 0,00" disabled />
                  </div>
                </div>
              </div>
            )}

            {modalidade !== "nenhuma" && modalidade !== "" && (
              <div className="md:col-span-2 space-y-6 pt-4 border-t">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-sm font-semibold">Assessores</h4>
                    <p className="text-xs text-muted-foreground">Vincule os assessores e defina suas participações</p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setIsAssessorModalOpen(true)}
                  >
                    <UserPlus className="mr-2 h-4 w-4" />
                    Cadastrar novo assessor
                  </Button>
                </div>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Vincular assessor existente</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          role="combobox"
                          className="w-full justify-between"
                        >
                          Procurar por nome...
                          <Search className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-[400px] p-0" align="start">
                        <Command>
                          <CommandInput placeholder="Digite o nome do assessor..." />
                          <CommandList>
                            <CommandEmpty>Nenhum assessor encontrado.</CommandEmpty>
                            <CommandGroup>
                              {assessoresDisponiveis.map((assessor) => (
                                <CommandItem
                                  key={assessor.id}
                                  value={assessor.nome}
                                  onSelect={() => {
                                    if (!assessoresVinculados.find(p => p.nome === assessor.nome)) {
                                      setAssessoresVinculados([...assessoresVinculados, { nome: assessor.nome, papel: "Assessor", percentual: "" }]);
                                      toast.success(`${assessor.nome} adicionado.`);
                                    } else {
                                      toast.error("Assessor já adicionado.");
                                    }
                                  }}
                                >
                                  <CheckCircle2 className="mr-2 h-4 w-4" />
                                  {assessor.nome} ({assessor.email})
                                </CommandItem>
                              ))}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                  </div>

                  <div className="space-y-3">
                    {assessoresVinculados.map((assessor, index) => (
                      <div key={index} className="flex items-end gap-3 rounded-lg border bg-muted/30 p-3">
                        <div className="flex-1 space-y-1">
                          <Label className="text-xs text-muted-foreground">Nome</lebel>
                          <div className="h-10 flex items-center px-3 rounded-md bg-white border font-medium">
                            {assessor.nome}
                          </div>
                        </div>
                        <div className="w-32 space-y-1">
                          <Label className="text-xs text-muted-foreground">% Participação</Label>
                          <Input
                            type="number"
                            placeholder="0"
                            value={assessor.percentual}
                            onChange={(e) => {
                              const newAssessores = [...assessoresVinculados];
                              newAssessores[index].percentual = e.target.value;
                              setAssessoresVinculados(newAssessores);
                            }}
                          />
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="text-destructive hover:text-destructive hover:bg-destructive/10"
                          onClick={() => {
                            setAssessoresVinculados(assessoresVinculados.filter((_, i) => i !== index));
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </SectionCard>

        <SectionCard icon={Users} title="Investidores" description="Investidores e cotas do projeto">
          <div className="space-y-6">
            <div className="space-y-2">
              <Label>Vincular investidor existente</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    className="w-full justify-between"
                  >
                    Procurar por nome...
                    <Search className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[400px] p-0" align="start">
                  <Command>
                    <CommandInput placeholder="Digite o nome do investidor..." />
                    <CommandList>
                      <CommandEmpty>Nenhum investidor encontrado.</CommandEmpty>
                      <CommandGroup>
                        {investidoresDisponiveis.map((investidor) => (
                          <CommandItem
                            key={investidor.id}
                            value={investidor.nome}
                            onSelect={() => {
                              if (!participantes.find(p => p.nome === investidor.nome)) {
                                setParticipantes([...participantes, { nome: investidor.nome, papel: "Investidor", percentual: "" }]);
                                toast.success(`${investidor.nome} adicionado.`);
                              } else {
                                toast.error("Investidor já adicionado.");
                              }
                            }}
                          >
                            <CheckCircle2 className="mr-2 h-4 w-4" />
                            {investidor.nome} ({investidor.email})
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-3">
              {participantes.map((p, i) => (
                <div key={i} className="grid gap-3 md:grid-cols-[2fr_140px_auto] items-end">
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Nome</Label>
                    <div className="h-10 flex items-center px-3 rounded-md border bg-muted font-medium text-sm">
                      {p.nome}
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">% Participação</Label>
                    <Input
                      value={p.percentual}
                      placeholder="00"
                      onChange={(e) =>
                        setParticipantes((prev) =>
                          prev.map((x, idx) => (idx === i ? { ...x, percentual: e.target.value } : x)),
                        )
                      }
                    />
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="mb-0.5"
                    aria-label="Remover investidor"
                    onClick={() => setParticipantes((prev) => prev.filter((_, idx) => idx !== i))}
                  >
                    <Trash2 className="size-4 text-destructive" />
                  </Button>
                </div>
              ))}
            </div>
            
            <div className="flex flex-wrap gap-3">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="border-brand text-brand hover:bg-brand/5"
                onClick={() => setIsInvestorModalOpen(true)}
              >
                <Plus className="size-4" /> Cadastrar novo investidor
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
            type="Investidor"
          />

          <InvestorRegistrationModal
            open={isAssessorModalOpen}
            onOpenChange={setIsAssessorModalOpen}
            onSave={(data) => {
              setAssessoresVinculados((prev) => [
                ...prev,
                { nome: data.nome, papel: "Assessor", percentual: "" },
              ]);
              toast.success(`Assessor ${data.nome} cadastrado e adicionado!`);
            }}
            type="Assessor"
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

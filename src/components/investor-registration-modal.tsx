import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { showValidationAlert } from "@/lib/validation-feedback";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { BirthDateField } from "@/components/ui/birth-date-field";
import { maritalStatusOptions } from "@/lib/marital-status";
import { Label } from "@/components/ui/label";
import { joinProfileLabels, profileTypeLabels, type PersonProfile } from "@/lib/contact-profile";
import { formatDocument as maskDocument } from "@/lib/utils-validation";
import { formatPhoneInput, PHONE_PLACEHOLDER } from "@/lib/phone";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export type UnifiedEntityData = PersonProfile;

export type ExtraProfileType = "Investidor" | "Assessor" | "Responsável";
const multiProfileTypes: ExtraProfileType[] = ["Investidor", "Assessor", "Responsável"];

interface UnifiedModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (data: UnifiedEntityData, alsoTypes: ExtraProfileType[]) => void | Promise<void>;
  type?: "Investidor" | "Assessor" | "Responsável" | "Leiloeiro";
  mode?: "create" | "edit";
  initialData?: UnifiedEntityData;
  registeredTypes?: string[];
}

const emptyEntity: UnifiedEntityData = {
  nome: "",
  documento: "",
  dataNascimento: "",
  estadoCivil: "",
  celulares: [""],
  endereco: "",
  numero: "",
  complemento: "",
  bairro: "",
  cep: "",
  email: "",
  banco: "",
  agencia: "",
  conta: "",
  website: "",
  cidade: "",
  estado: "",
};

const UFs = [
  "AC",
  "AL",
  "AP",
  "AM",
  "BA",
  "CE",
  "DF",
  "ES",
  "GO",
  "MA",
  "MT",
  "MS",
  "MG",
  "PA",
  "PB",
  "PR",
  "PE",
  "PI",
  "RJ",
  "RN",
  "RS",
  "RO",
  "RR",
  "SC",
  "SP",
  "SE",
  "TO",
];

export function InvestorRegistrationModal({
  open,
  onOpenChange,
  onSave,
  type = "Investidor",
  mode = "create",
  initialData,
  registeredTypes = [],
}: UnifiedModalProps) {
  const isEdit = mode === "edit";
  const [formData, setFormData] = useState<UnifiedEntityData>(
    initialData
      ? {
          ...emptyEntity,
          ...initialData,
          documento: maskDocument(initialData.documento),
          celulares: initialData.celulares.length ? initialData.celulares : [""],
        }
      : emptyEntity,
  );
  const [alsoTypes, setAlsoTypes] = useState<ExtraProfileType[]>([]);
  const otherTypes = multiProfileTypes.filter((profileType) => profileType !== type);
  const supportsMultiProfile = multiProfileTypes.some((profileType) => profileType === type);
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [duplicateDocumentWarning, setDuplicateDocumentWarning] = useState(false);

  const formatDocument = (value: string) => {
    const digits = value.replace(/\D/g, "");
    if (digits.length <= 11) {
      // CPF
      return digits
        .replace(/(\d{3})(\d)/, "$1.$2")
        .replace(/(\d{3})(\d)/, "$1.$2")
        .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
    } else {
      // CNPJ
      return digits
        .substring(0, 14)
        .replace(/^(\d{2})(\d)/, "$1.$2")
        .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
        .replace(/\.(\d{3})(\d)/, ".$1/$2")
        .replace(/(\d{4})(\d)/, "$1-$2");
    }
  };

  const addCelular = () => {
    setFormData({
      ...formData,
      celulares: [...formData.celulares, ""],
    });
  };

  const removeCelular = (index: number) => {
    if (formData.celulares.length <= 1) return;
    const newCelulares = [...formData.celulares];
    newCelulares.splice(index, 1);
    setFormData({ ...formData, celulares: newCelulares });
  };

  const updateCelular = (index: number, value: string) => {
    const newCelulares = [...formData.celulares];
    newCelulares[index] = formatPhoneInput(value);
    setFormData({ ...formData, celulares: newCelulares });
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setErrorMessage("");
    setSaving(true);
    try {
      await onSave(formData, alsoTypes);
      onOpenChange(false);
      if (!isEdit) {
        setFormData(emptyEntity);
        setAlsoTypes([]);
      }
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : `Não foi possível cadastrar o ${type.toLowerCase()}.`;
      setErrorMessage(message);
      if (message === "CPF já Cadastrado.") {
        setDuplicateDocumentWarning(true);
      } else {
        showValidationAlert(message, `Revise os dados do ${type.toLowerCase()}.`);
      }
    } finally {
      setSaving(false);
    }
  };

  const isLeiloeiro = type === "Leiloeiro";
  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      setErrorMessage("");
      setDuplicateDocumentWarning(false);
    }
    onOpenChange(nextOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar cadastro" : `Cadastro de ${type}`}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Atualize os dados cadastrais. As alterações valem para todos os perfis desta pessoa."
              : "Informe os dados cadastrais para vincular ao projeto."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6 pt-4">
          {isEdit && registeredTypes.length > 0 && (
            <p className="rounded-md bg-muted/50 px-3 py-2 text-sm text-muted-foreground">
              Perfis cadastrados: <strong>{joinProfileLabels(registeredTypes)}</strong>
            </p>
          )}
          {!isEdit && supportsMultiProfile && (
            <fieldset className="space-y-2 rounded-md border p-3">
              <legend className="px-1 text-sm font-medium">Perfis do cadastro</legend>
              <div className="flex flex-wrap gap-6">
                <div className="flex items-center gap-2">
                  <Checkbox id="perfil-principal" checked disabled />
                  <Label htmlFor="perfil-principal">{profileTypeLabels[type] ?? type}</Label>
                </div>
                {otherTypes.map((otherType) => (
                  <div key={otherType} className="flex items-center gap-2">
                    <Checkbox
                      id={`perfil-adicional-${otherType}`}
                      checked={alsoTypes.includes(otherType)}
                      onCheckedChange={(checked) =>
                        setAlsoTypes((current) =>
                          checked === true
                            ? [...current.filter((item) => item !== otherType), otherType]
                            : current.filter((item) => item !== otherType),
                        )
                      }
                    />
                    <Label htmlFor={`perfil-adicional-${otherType}`}>
                      {profileTypeLabels[otherType] ?? otherType}
                    </Label>
                  </div>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                A pessoa será vinculada a este projeto como{" "}
                {(profileTypeLabels[type] ?? type).toLowerCase()} e aparecerá na busca de cada
                perfil selecionado.
              </p>
            </fieldset>
          )}
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="nome">Nome {isLeiloeiro ? "" : "Completo"}</Label>
              <Input
                id="nome"
                required
                value={formData.nome}
                onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                placeholder={isLeiloeiro ? "Nome do leiloeiro ou empresa" : "Ex: João da Silva"}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="documento">CPF ou CNPJ</Label>
              <Input
                id="documento"
                required
                value={formData.documento}
                onChange={(e) =>
                  setFormData({ ...formData, documento: formatDocument(e.target.value) })
                }
                placeholder="000.000.000-00 ou 00.000.000/0000-00"
              />
            </div>

            {isLeiloeiro ? (
              <div className="space-y-2">
                <Label htmlFor="website">Website</Label>
                <Input
                  id="website"
                  type="url"
                  value={formData.website}
                  onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                  placeholder="https://exemplo.com.br"
                />
              </div>
            ) : (
              <div className="space-y-2">
                <Label htmlFor="nascimento">Data de Nascimento</Label>
                <BirthDateField
                  id="nascimento"
                  value={formData.dataNascimento ?? ""}
                  onValueChange={(dataNascimento) => setFormData({ ...formData, dataNascimento })}
                  required
                />
              </div>
            )}

            {!isLeiloeiro && (
              <div className="space-y-2">
                <Label htmlFor="estadoCivil">Estado Civil</Label>
                <Select
                  value={formData.estadoCivil || ""}
                  onValueChange={(val) => setFormData({ ...formData, estadoCivil: val })}
                >
                  <SelectTrigger id="estadoCivil">
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
              </div>
            )}

            <div className="space-y-2">
              <Label>{isLeiloeiro ? "Telefone" : "Celular"}</Label>
              <div className="space-y-2">
                {formData.celulares.map((cel, idx) => (
                  <div key={idx} className="flex gap-2">
                    <Input
                      value={cel}
                      onChange={(e) => updateCelular(idx, e.target.value)}
                      inputMode="tel"
                      maxLength={14}
                      placeholder={PHONE_PLACEHOLDER}
                    />
                    {formData.celulares.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => removeCelular(idx)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    )}
                  </div>
                ))}
                {!isLeiloeiro && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="w-full"
                    onClick={addCelular}
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Adicionar celular
                  </Button>
                )}
              </div>
            </div>

            {isLeiloeiro && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="cidade">Cidade</Label>
                  <Input
                    id="cidade"
                    value={formData.cidade}
                    onChange={(e) => setFormData({ ...formData, cidade: e.target.value })}
                    placeholder="Ex: São Paulo"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="estado">Estado (UF)</Label>
                  <Select
                    value={formData.estado || ""}
                    onValueChange={(val) => setFormData({ ...formData, estado: val })}
                  >
                    <SelectTrigger id="estado">
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      {UFs.map((uf) => (
                        <SelectItem key={uf} value={uf}>
                          {uf}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}
          </div>

          {!isLeiloeiro && (
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="endereco">Endereço</Label>
                <Input
                  id="endereco"
                  required
                  value={formData.endereco}
                  onChange={(e) => setFormData({ ...formData, endereco: e.target.value })}
                  placeholder="Rua, avenida, travessa..."
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="numero">Nro.</Label>
                <Input
                  id="numero"
                  required
                  value={formData.numero}
                  onChange={(e) => setFormData({ ...formData, numero: e.target.value })}
                  placeholder="123"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="complemento">Complemento</Label>
                <Input
                  id="complemento"
                  value={formData.complemento}
                  onChange={(e) => setFormData({ ...formData, complemento: e.target.value })}
                  placeholder="Apto., sala, bloco..."
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="bairro">Bairro</Label>
                <Input
                  id="bairro"
                  required
                  value={formData.bairro}
                  onChange={(e) => setFormData({ ...formData, bairro: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cidade">Cidade</Label>
                <Input
                  id="cidade"
                  required
                  value={formData.cidade}
                  onChange={(e) => setFormData({ ...formData, cidade: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="estado">UF</Label>
                <Select
                  value={formData.estado || ""}
                  onValueChange={(value) => setFormData({ ...formData, estado: value })}
                  required
                >
                  <SelectTrigger id="estado">
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {UFs.map((uf) => (
                      <SelectItem key={uf} value={uf}>
                        {uf}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="cep">CEP</Label>
                <Input
                  id="cep"
                  required
                  inputMode="numeric"
                  maxLength={9}
                  value={formData.cep}
                  onChange={(e) => {
                    const digits = e.target.value.replace(/\D/g, "").slice(0, 8);
                    setFormData({ ...formData, cep: digits.replace(/(\d{5})(\d)/, "$1-$2") });
                  }}
                  placeholder="00000-000"
                />
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              required
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              placeholder="exemplo@email.com"
            />
          </div>

          {!isLeiloeiro && (
            <div className="space-y-4">
              <h4 className="text-sm font-medium border-b pb-2">Dados Bancários</h4>
              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="banco">Banco</Label>
                  <Input
                    id="banco"
                    value={formData.banco}
                    onChange={(e) => setFormData({ ...formData, banco: e.target.value })}
                    placeholder="Ex: Itaú"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="agencia">Agência</Label>
                  <Input
                    id="agencia"
                    value={formData.agencia}
                    onChange={(e) => setFormData({ ...formData, agencia: e.target.value })}
                    placeholder="0000"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="conta">Conta Corrente</Label>
                  <Input
                    id="conta"
                    value={formData.conta}
                    onChange={(e) => setFormData({ ...formData, conta: e.target.value })}
                    placeholder="00000-0"
                  />
                </div>
              </div>
            </div>
          )}

          {errorMessage ? (
            <p
              role="alert"
              className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
            >
              {errorMessage}
            </p>
          ) : null}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={saving}>
              {saving
                ? isEdit
                  ? "Salvando..."
                  : "Cadastrando..."
                : isEdit
                  ? "Salvar alterações"
                  : "Cadastrar e Adicionar"}
            </Button>
          </DialogFooter>
        </form>

        <AlertDialog open={duplicateDocumentWarning} onOpenChange={setDuplicateDocumentWarning}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>CPF já Cadastrado.</AlertDialogTitle>
              <AlertDialogDescription>
                Já existe um cadastro com este CPF neste segmento. Verifique o documento informado
                antes de continuar.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogAction onClick={() => setDuplicateDocumentWarning(false)}>
                OK
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </DialogContent>
    </Dialog>
  );
}

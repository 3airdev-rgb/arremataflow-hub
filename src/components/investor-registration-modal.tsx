import { useState } from "react";
import { Plus, Trash2, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export interface UnifiedEntityData {
  nome: string;
  documento: string; // CPF ou CNPJ
  dataNascimento?: string;
  estadoCivil?: string;
  celulares: string[];
  endereco?: string;
  email: string;
  banco?: string;
  agencia?: string;
  conta?: string;
  website?: string;
  cidade?: string;
  estado?: string;
}

interface UnifiedModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (data: UnifiedEntityData) => void;
  type?: "Investidor" | "Assessor" | "Leiloeiro";
}

const UFs = [
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG", "PA", "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO"
];

export function InvestorRegistrationModal({
  open,
  onOpenChange,
  onSave,
  type = "Investidor",
}: UnifiedModalProps) {
  const [formData, setFormData] = useState<UnifiedEntityData>({
    nome: "",
    documento: "",
    dataNascimento: "",
    estadoCivil: "",
    celulares: [""],
    endereco: "",
    email: "",
    banco: "",
    agencia: "",
    conta: "",
    website: "",
    cidade: "",
    estado: "",
  });

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

  const formatPhone = (value: string) => {
    const digits = value.replace(/\D/g, "");
    if (digits.length <= 11) {
      return digits
        .replace(/^(\d{2})(\d)/, "($1) $2")
        .replace(/(\d{5})(\d)/, "$1-$2");
    }
    return value;
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
    newCelulares[index] = formatPhone(value);
    setFormData({ ...formData, celulares: newCelulares });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Check if document already exists in the database
    if (formData.documento) {
      try {
        const { data: existingPerson, error } = await supabase
          .from("pessoas")
          .select("id")
          .eq("documento", formData.documento)
          .maybeSingle();
          
        if (error) throw error;
        
        if (existingPerson) {
          toast.error("Investidor já Cadastrado", {
            description: "Um registro com este CPF ou CNPJ já existe na base de dados.",
            icon: <AlertCircle className="h-4 w-4" />,
          });
          return;
        }
      } catch (err) {
        console.error("Erro ao verificar documento:", err);
      }
    }

    onSave(formData);
    onOpenChange(false);
    // Reset form
    setFormData({
      nome: "",
      documento: "",
      dataNascimento: "",
      estadoCivil: "",
      celulares: [""],
      endereco: "",
      email: "",
      banco: "",
      agencia: "",
      conta: "",
      website: "",
      cidade: "",
      estado: "",
    });
  };

  const isLeiloeiro = type === "Leiloeiro";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Cadastro de {type}</DialogTitle>
          <DialogDescription>
            language selector
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6 pt-4">
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
                onChange={(e) => setFormData({ ...formData, documento: formatDocument(e.target.value) })}
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
                <Input
                  id="nascimento"
                  type="date"
                  required
                  value={formData.dataNascimento}
                  onChange={(e) => setFormData({ ...formData, dataNascimento: e.target.value })}
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
                    <SelectItem value="solteiro">Solteiro(a)</SelectItem>
                    <SelectItem value="casado">Casado(a)</SelectItem>
                    <SelectItem value="divorciado">Divorciado(a)</SelectItem>
                    <SelectItem value="viuvo">Viúvo(a)</SelectItem>
                    <SelectItem value="uniao-estavel">União Estável</SelectItem>
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
                      placeholder="(+55) 00 00000-0000"
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
                        <SelectItem key={uf} value={uf}>{uf}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}
          </div>

          {!isLeiloeiro && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="endereco">Endereço Completo</Label>
                <Textarea
                  id="endereco"
                  required
                  value={formData.endereco}
                  onChange={(e) => setFormData({ ...formData, endereco: e.target.value })}
                  placeholder="Rua, Número, Complemento, Bairro, Cidade - UF"
                  rows={3}
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

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancelar
            </Button>
            <Button type="submit">Cadastrar e Adicionar</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

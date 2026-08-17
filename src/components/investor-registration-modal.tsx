import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
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

interface InvestorData {
  nome: string;
  cpf: string;
  dataNascimento: string;
  estadoCivil: string;
  celulares: string[];
  endereco: string;
  email: string;
  banco: string;
  agencia: string;
  conta: string;
}

interface InvestorModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (data: InvestorData) => void;
}

export function InvestorRegistrationModal({
  open,
  onOpenChange,
  onSave,
}: InvestorModalProps) {
  const [formData, setFormData] = useState<InvestorData>({
    nome: "",
    cpf: "",
    dataNascimento: "",
    estadoCivil: "",
    celulares: [""],
    endereco: "",
    email: "",
    banco: "",
    agencia: "",
    conta: "",
  });

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
    newCelulares[index] = value;
    setFormData({ ...formData, celulares: newCelulares });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
    onOpenChange(false);
    // Reset form
    setFormData({
      nome: "",
      cpf: "",
      dataNascimento: "",
      estadoCivil: "",
      celulares: [""],
      endereco: "",
      email: "",
      banco: "",
      agencia: "",
      conta: "",
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Cadastro de Investidor</DialogTitle>
          <DialogDescription>
            Insira os dados do novo investidor para adicioná-lo ao projeto.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6 pt-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="nome">Nome Completo</Label>
              <Input
                id="nome"
                required
                value={formData.nome}
                onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                placeholder="Ex: João da Silva"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="cpf">CPF</Label>
              <Input
                id="cpf"
                required
                value={formData.cpf}
                onChange={(e) => setFormData({ ...formData, cpf: e.target.value })}
                placeholder="000.000.000-00"
              />
            </div>

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

            <div className="space-y-2">
              <Label htmlFor="estadoCivil">Estado Civil</Label>
              <Select
                value={formData.estadoCivil}
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

            <div className="space-y-2">
              <Label>Celular</Label>
              <div className="space-y-2">
                {formData.celulares.map((cel, idx) => (
                  <div key={idx} className="flex gap-2">
                    <Input
                      value={cel}
                      onChange={(e) => updateCelular(idx, e.target.value)}
                      placeholder="+5548988888888"
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
              </div>
            </div>
          </div>

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
          </div>

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

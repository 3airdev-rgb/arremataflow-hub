import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { UserPlus, ShieldCheck } from "lucide-react";
import { AppLayout } from "@/components/app-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { usuarios as usuariosMock } from "@/lib/mock-data";

export const Route = createFileRoute("/admin/usuarios")({
  head: () => ({
    meta: [
      { title: "Usuários e Permissões | ArremataFlow" },
      {
        name: "description",
        content: "Convide usuários, defina perfis e ajuste permissões de acesso da empresa.",
      },
      { property: "og:title", content: "Gestão de Usuários | ArremataFlow" },
      { property: "og:description", content: "Controle de perfis, convites e permissões multiempresa." },
    ],
  }),
  component: UsuariosPage,
});

const permissoes = [
  "Visualizar projetos",
  "Editar projetos",
  "Gerenciar financeiro",
  "Aprovar distribuições",
  "Gerenciar documentos",
  "Administrar usuários",
];

function UsuariosPage() {
  const [usuarios, setUsuarios] = useState(usuariosMock);
  const [convite, setConvite] = useState(false);
  const [editando, setEditando] = useState<string | null>(null);
  const alvo = usuarios.find((u) => u.id === editando);

  return (
    <AppLayout
      title="Gestão de Usuários"
      subtitle="Perfis e permissões da Arremata Capital LTDA"
      actions={
        <Dialog open={convite} onOpenChange={setConvite}>
          <DialogTrigger asChild>
            <Button>
              <UserPlus className="size-4" /> Convidar
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Convidar usuário</DialogTitle>
              <DialogDescription>Um e-mail de convite será enviado.</DialogDescription>
            </DialogHeader>
            <form
              className="space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                const fd = new FormData(e.currentTarget);
                setUsuarios((p) => [
                  ...p,
                  {
                    id: `u${Date.now()}`,
                    nome: String(fd.get("nome") || "Novo usuário"),
                    email: String(fd.get("email")),
                    perfil: String(fd.get("perfil") || "Assessor"),
                    status: "Convite enviado",
                  },
                ]);
                setConvite(false);
                toast.success("Convite enviado por e-mail!");
              }}
            >
              <div className="space-y-2">
                <Label htmlFor="nome">Nome</Label>
                <Input id="nome" name="nome" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">E-mail</Label>
                <Input id="email" name="email" type="email" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="perfil">Perfil</Label>
                <Select name="perfil" defaultValue="Assessor">
                  <SelectTrigger id="perfil">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Administrador">Administrador</SelectItem>
                    <SelectItem value="Assessor">Assessor</SelectItem>
                    <SelectItem value="Jurídico">Jurídico</SelectItem>
                    <SelectItem value="Investidor">Investidor</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <DialogFooter>
                <Button type="submit">Enviar convite</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      }
    >
      <div className="surface-card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/60 text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-4 py-3 font-medium">Nome</th>
              <th className="px-4 py-3 font-medium">E-mail</th>
              <th className="px-4 py-3 font-medium">Perfil</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 text-right font-medium">Ações</th>
            </tr>
          </thead>
          <tbody>
            {usuarios.map((u) => (
              <tr key={u.id} className="border-t border-border hover:bg-muted/40">
                <td className="px-4 py-3 font-medium">{u.nome}</td>
                <td className="px-4 py-3 text-muted-foreground">{u.email}</td>
                <td className="px-4 py-3">
                  <span className="rounded-full bg-primary-soft px-2.5 py-0.5 text-xs font-medium text-brand">
                    {u.perfil}
                  </span>
                </td>
                <td className="px-4 py-3 text-muted-foreground">{u.status}</td>
                <td className="px-4 py-3 text-right">
                  <Button variant="ghost" size="sm" onClick={() => setEditando(u.id)}>
                    <ShieldCheck className="size-4" /> Permissões
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Dialog open={!!editando} onOpenChange={(o) => !o && setEditando(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Permissões de {alvo?.nome}</DialogTitle>
            <DialogDescription>Perfil atual: {alvo?.perfil}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            {permissoes.map((p, i) => (
              <div key={p} className="flex items-center justify-between">
                <Label htmlFor={`perm-${i}`} className="font-normal">
                  {p}
                </Label>
                <Switch id={`perm-${i}`} defaultChecked={i < 3} />
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button
              onClick={() => {
                setEditando(null);
                toast.success("Permissões atualizadas!");
              }}
            >
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}

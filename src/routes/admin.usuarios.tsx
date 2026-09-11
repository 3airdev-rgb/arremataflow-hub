import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { UserPlus } from "lucide-react";
import { AppLayout } from "@/components/app-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import {
  getLocalAccessUsers,
  inviteLocalUser,
  type LocalAccessUser,
} from "@/lib/local-access";

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

function UsuariosPage() {
  const [usuarios, setUsuarios] = useState<LocalAccessUser[]>([]);
  const [convite, setConvite] = useState(false);

  useEffect(() => setUsuarios(getLocalAccessUsers()), []);

  return (
    <AppLayout
      title="Gestão de Usuários"
      subtitle="Administradores, assessores e investidores da Arremata Capital LTDA"
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
                inviteLocalUser({
                  nome: String(fd.get("nome") || "Novo usuário"),
                  email: String(fd.get("email")),
                  perfil: String(fd.get("perfil") || "Assessor") as "Assessor" | "Investidor",
                });
                setUsuarios(getLocalAccessUsers());
                setConvite(false);
                toast.success("Convite local criado! O envio de e-mail foi simulado.");
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
                    <SelectItem value="Assessor">Assessor</SelectItem>
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
              </tr>
            ))}
          </tbody>
        </table>
      </div>

    </AppLayout>
  );
}

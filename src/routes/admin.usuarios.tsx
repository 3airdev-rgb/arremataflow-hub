import { createFileRoute, redirect } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Mail, Pencil, UserPlus } from "lucide-react";
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
  getOrganizationUsers,
  inviteOrganizationUser,
  renewOrganizationInvitation,
  updateOrganizationUser,
} from "@/lib/organization-users";
import { getOrganizationSettings } from "@/lib/organization-settings";
import { getCurrentOrganizationUser } from "@/lib/organization-users";

export const Route = createFileRoute("/admin/usuarios")({
  beforeLoad: async () => {
    const user = await getCurrentOrganizationUser();
    if (!["owner", "admin"].includes(user.role)) throw redirect({ to: "/dashboard" });
  },
  head: () => ({
    meta: [
      { title: "Usuários e Permissões | ArremataFlow" },
      {
        name: "description",
        content: "Convide usuários, defina perfis e ajuste permissões de acesso da empresa.",
      },
      { property: "og:title", content: "Gestão de Usuários | ArremataFlow" },
      {
        property: "og:description",
        content: "Controle de perfis, convites e permissões multiempresa.",
      },
    ],
  }),
  component: UsuariosPage,
});

function UsuariosPage() {
  const [convite, setConvite] = useState(false);
  const [editing, setEditing] = useState<{
    id: string;
    name: string;
    email: string;
    role: string;
  } | null>(null);
  const queryClient = useQueryClient();
  const { data, isPending, error } = useQuery({
    queryKey: ["organization-users"],
    queryFn: () => getOrganizationUsers(),
  });
  const { data: organization } = useQuery({
    queryKey: ["active-organization"],
    queryFn: () => getOrganizationSettings(),
  });
  const updateUser = useMutation({
    mutationFn: updateOrganizationUser,
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["organization-users"] }),
        queryClient.invalidateQueries({ queryKey: ["current-organization-user"] }),
      ]);
      setEditing(null);
      toast.success("Perfil atualizado com segurança.");
    },
    onError: (cause) =>
      toast.error(cause instanceof Error ? cause.message : "Não foi possível atualizar o perfil."),
  });
  const inviteUser = useMutation({
    mutationFn: inviteOrganizationUser,
    onSuccess: async (result) => {
      await queryClient.invalidateQueries({ queryKey: ["organization-users"] });
      setConvite(false);
      if (result.delivery === "local" && result.invitationUrl) {
        await navigator.clipboard.writeText(result.invitationUrl);
        toast.success("Convite local criado e link copiado. Ele expira em 30 minutos.");
      } else if (result.delivery === "existing")
        toast.success("Usuário existente vinculado à empresa.");
      else toast.success("Convite enviado por e-mail.");
    },
    onError: (cause) =>
      toast.error(cause instanceof Error ? cause.message : "Não foi possível enviar o convite."),
  });
  const renewInvitation = useMutation({
    mutationFn: renewOrganizationInvitation,
    onSuccess: async (result) => {
      if (result.invitationUrl) {
        await navigator.clipboard.writeText(result.invitationUrl);
        toast.success("Novo link de convite copiado. Ele expira em 30 minutos.");
      } else toast.success("Convite reenviado por e-mail.");
    },
    onError: (cause) =>
      toast.error(cause instanceof Error ? cause.message : "Não foi possível renovar o convite."),
  });

  return (
    <AppLayout
      title="Gestão de Usuários"
      subtitle={`Administradores, gestores, assessores e investidores da ${organization?.name || "empresa"}`}
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
              <DialogDescription>Contas novas recebem um convite por e-mail.</DialogDescription>
            </DialogHeader>
            <form
              className="space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                const fd = new FormData(e.currentTarget);
                inviteUser.mutate({
                  data: {
                    name: String(fd.get("nome") || ""),
                    email: String(fd.get("email")),
                    role: String(fd.get("perfil") || "advisor") as
                      "project_manager" | "advisor" | "investor",
                  },
                });
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
                <Select name="perfil" defaultValue="advisor">
                  <SelectTrigger id="perfil">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="project_manager">Gestor de Projetos</SelectItem>
                    <SelectItem value="advisor">Assessor</SelectItem>
                    <SelectItem value="investor">Investidor</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <DialogFooter>
                <Button type="submit" disabled={inviteUser.isPending}>
                  {inviteUser.isPending ? "Enviando..." : "Enviar convite"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      }
    >
      <div
        tabIndex={0}
        role="region"
        aria-label="Tabela com rolagem horizontal"
        className="table-scroll surface-card overflow-x-auto"
      >
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
            {data?.members.map((u) => (
              <tr key={u.id} className="border-t border-border hover:bg-muted/40">
                <td className="px-4 py-3 font-medium">{u.name}</td>
                <td className="px-4 py-3 text-muted-foreground">{u.email}</td>
                <td className="px-4 py-3">
                  <span className="rounded-full bg-primary-soft px-2.5 py-0.5 text-xs font-medium text-brand">
                    {u.role === "owner" || u.role === "admin"
                      ? "Administrador"
                      : u.role === "project_manager"
                        ? "Gestor de Projetos"
                        : u.role === "advisor"
                          ? "Assessor"
                          : "Investidor"}
                  </span>
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  {u.status === "active" ? "Ativo" : "Pendente"}
                </td>
                <td className="px-4 py-3 text-right">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      setEditing({ id: u.id, name: u.name, email: u.email, role: u.role })
                    }
                  >
                    <Pencil className="size-4" /> Editar
                  </Button>
                  {u.status === "invited" && (
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={renewInvitation.isPending}
                      onClick={() => renewInvitation.mutate({ data: { userId: u.id } })}
                    >
                      <Mail className="size-4" /> Renovar convite
                    </Button>
                  )}
                </td>
              </tr>
            ))}
            {isPending ? (
              <tr>
                <td className="px-4 py-6 text-center text-muted-foreground" colSpan={5}>
                  Carregando usuários...
                </td>
              </tr>
            ) : null}
            {error ? (
              <tr>
                <td className="px-4 py-6 text-center text-destructive" colSpan={5}>
                  Não foi possível carregar os usuários.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <Dialog
        open={Boolean(editing)}
        onOpenChange={(open) => {
          if (!open) setEditing(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar perfil</DialogTitle>
            <DialogDescription>Atualize os dados e o perfil do usuário.</DialogDescription>
          </DialogHeader>
          {editing ? (
            <form
              className="space-y-4"
              onSubmit={(event) => {
                event.preventDefault();
                const form = new FormData(event.currentTarget);
                updateUser.mutate({
                  data: {
                    userId: editing.id,
                    name: String(form.get("name") || ""),
                    email: String(form.get("email") || ""),
                    role:
                      ["owner", "admin"].includes(editing.role) ||
                      String(form.get("role") || editing.role) === editing.role
                        ? undefined
                        : (String(form.get("role") || editing.role) as
                            "project_manager" | "advisor" | "investor"),
                  },
                });
              }}
            >
              <div className="space-y-2">
                <Label htmlFor="edit-name">Nome</Label>
                <Input
                  id="edit-name"
                  name="name"
                  defaultValue={editing.name}
                  required
                  maxLength={120}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-email">E-mail</Label>
                <Input
                  id="edit-email"
                  name="email"
                  type="email"
                  defaultValue={editing.email}
                  required
                  maxLength={254}
                />
              </div>
              {!["owner", "admin"].includes(editing.role) && (
                <div className="space-y-2">
                  <Label htmlFor="edit-role">Perfil</Label>
                  <Select name="role" defaultValue={editing.role}>
                    <SelectTrigger id="edit-role">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="project_manager">Gestor de Projetos</SelectItem>
                      <SelectItem value="advisor">Assessor</SelectItem>
                      <SelectItem value="investor">Investidor</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
              <DialogFooter>
                <Button type="submit" disabled={updateUser.isPending}>
                  {updateUser.isPending ? "Salvando..." : "Salvar alterações"}
                </Button>
              </DialogFooter>
            </form>
          ) : null}
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}

import { createFileRoute, redirect } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Mail, Pencil, Trash2, UserPlus } from "lucide-react";
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { joinProfileLabels } from "@/lib/contact-profile";
import {
  InvestorRegistrationModal,
  type UnifiedEntityData,
} from "@/components/investor-registration-modal";
import {
  getOrganizationUserProfile,
  getOrganizationUsers,
  inviteOrganizationUser,
  removeOrganizationUser,
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

function profileLabel(u: { role: string; contactTypes: string[] }) {
  if (u.role === "owner" || u.role === "admin") return "Administrador";
  const roleType =
    u.role === "project_manager" ? "Responsável" : u.role === "advisor" ? "Assessor" : "Investidor";
  return joinProfileLabels([...u.contactTypes, roleType]);
}

function UsuariosPage() {
  const [convite, setConvite] = useState(false);
  const [editing, setEditing] = useState<{
    id: string;
    name: string;
    email: string;
    role: string;
  } | null>(null);
  const [removing, setRemoving] = useState<{ id: string; name: string } | null>(null);
  const [editingProfile, setEditingProfile] = useState<{
    id: string;
    type: "Investidor" | "Assessor" | "Responsável";
    types: string[];
    profile: UnifiedEntityData;
  } | null>(null);
  const [loadingEditId, setLoadingEditId] = useState<string | null>(null);
  const queryClient = useQueryClient();

  async function startEdit(u: { id: string; name: string; email: string; role: string }) {
    if (["owner", "admin"].includes(u.role)) {
      setEditing({ id: u.id, name: u.name, email: u.email, role: u.role });
      return;
    }
    setLoadingEditId(u.id);
    try {
      const result = await getOrganizationUserProfile({ data: { userId: u.id } });
      if (!result.profile) {
        setEditing({ id: u.id, name: u.name, email: u.email, role: u.role });
        return;
      }
      const type = result.types.includes("Responsável")
        ? "Responsável"
        : result.types.includes("Assessor")
          ? "Assessor"
          : "Investidor";
      setEditingProfile({ id: u.id, type, types: result.types, profile: result.profile });
    } catch (cause) {
      toast.error(
        cause instanceof Error ? cause.message : "Não foi possível carregar o cadastro do usuário.",
      );
    } finally {
      setLoadingEditId(null);
    }
  }
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
  const removeUser = useMutation({
    mutationFn: removeOrganizationUser,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["organization-users"] });
      setRemoving(null);
      toast.success("Usuário removido da empresa.");
    },
    onError: (cause) =>
      toast.error(cause instanceof Error ? cause.message : "Não foi possível remover o usuário."),
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
                    {profileLabel(u)}
                  </span>
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  {u.status === "active" ? "Ativo" : "Pendente"}
                </td>
                <td className="px-4 py-3 text-right">
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={loadingEditId === u.id}
                    onClick={() => void startEdit(u)}
                  >
                    <Pencil className="size-4" /> Editar
                  </Button>
                  {!["owner", "admin"].includes(u.role) && u.status === "invited" && (
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={renewInvitation.isPending}
                      onClick={() => renewInvitation.mutate({ data: { userId: u.id } })}
                    >
                      <Mail className="size-4" /> Renovar convite
                    </Button>
                  )}
                  {!["owner", "admin"].includes(u.role) && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive hover:text-destructive"
                      onClick={() => setRemoving({ id: u.id, name: u.name })}
                    >
                      <Trash2 className="size-4" /> Remover
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

      {editingProfile ? (
        <InvestorRegistrationModal
          key={editingProfile.id}
          open
          onOpenChange={(open) => {
            if (!open) setEditingProfile(null);
          }}
          mode="edit"
          type={editingProfile.type}
          initialData={editingProfile.profile}
          registeredTypes={editingProfile.types}
          onSave={async (data) => {
            await updateOrganizationUser({
              data: {
                userId: editingProfile.id,
                name: data.nome,
                email: data.email,
                profile: data,
              },
            });
            await Promise.all([
              queryClient.invalidateQueries({ queryKey: ["organization-users"] }),
              queryClient.invalidateQueries({ queryKey: ["current-organization-user"] }),
              queryClient.invalidateQueries({ queryKey: ["contacts"] }),
            ]);
            toast.success("Cadastro atualizado.");
          }}
        />
      ) : null}

      <AlertDialog
        open={Boolean(removing)}
        onOpenChange={(open) => {
          if (!open && !removeUser.isPending) setRemoving(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover usuário</AlertDialogTitle>
            <AlertDialogDescription>
              {removing?.name} perderá o acesso e terá o cadastro e a conta excluídos. Pessoas
              vinculadas a projetos precisam ser removidas dos projetos antes.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={removeUser.isPending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={removeUser.isPending}
              onClick={(event) => {
                event.preventDefault();
                if (removing) removeUser.mutate({ data: { userId: removing.id } });
              }}
            >
              {removeUser.isPending ? "Removendo..." : "Remover usuário"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog
        open={Boolean(editing)}
        onOpenChange={(open) => {
          if (!open) setEditing(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar perfil</DialogTitle>
            <DialogDescription>
              {editing && ["owner", "admin"].includes(editing.role)
                ? "Administradores permitem editar somente nome e e-mail."
                : "Atualize os dados e o perfil do usuário."}
            </DialogDescription>
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

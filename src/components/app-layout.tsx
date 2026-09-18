import { useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useRouter, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard,
  FolderKanban,
  Users,
  BriefcaseBusiness,
  FileBarChart,
  Bell,
  Settings,
  Search,
  Menu,
  X,
  Building2,
  Check,
  ChevronsUpDown,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { getOrganizationSettings } from "@/lib/organization-settings";
import { getCurrentOrganizationUser } from "@/lib/organization-users";
import { unreadNotificationCount } from "@/lib/tasks";
import { listUserOrganizations, selectActiveOrganization } from "@/lib/active-organization";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const nav = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/projetos", label: "Projetos", icon: FolderKanban },
  { to: "/investidor", label: "Investidores", icon: Users },
  { to: "/assessores", label: "Assessores", icon: BriefcaseBusiness },
  { to: "/relatorios", label: "Relatórios", icon: FileBarChart },
  { to: "/notificacoes", label: "Notificações", icon: Bell },
  { to: "/admin/configuracoes", label: "Configurações", icon: Settings },
] as const;

export function AppLayout({
  title,
  subtitle,
  actions,
  companyName,
  children,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  companyName?: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();
  const router = useRouter();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { data: organization } = useQuery({
    queryKey: ["active-organization"],
    queryFn: () => getOrganizationSettings(),
  });
  const { data: companyAccess } = useQuery({
    queryKey: ["user-organizations"],
    queryFn: () => listUserOrganizations(),
  });
  const switchCompany = useMutation({
    mutationFn: (organizationId: string) => selectActiveOrganization({ data: { organizationId } }),
    onSuccess: async () => {
      await queryClient.invalidateQueries();
      await router.navigate({ to: "/dashboard" });
    },
  });
  const { data: serverUser } = useQuery({
    queryKey: ["current-organization-user"],
    queryFn: () => getCurrentOrganizationUser(),
  });
  const { data: unreadCount = 0 } = useQuery({
    queryKey: ["unread-notifications"],
    queryFn: () => unreadNotificationCount(),
    refetchInterval: 30_000,
  });
  const currentUser = serverUser ? {
    nome: serverUser.name,
    perfil: serverUser.role === "owner" || serverUser.role === "admin"
      ? "Administrador"
      : serverUser.role === "advisor" ? "Assessor" : "Investidor",
  } : { nome: "Usuário", perfil: "Visualizador" };
  const selectedCompany = companyAccess?.organizations.find((item) => item.id === companyAccess.activeOrganizationId);
  const activeCompanyName = selectedCompany?.name || companyName || organization?.name || "Empresa";
  const visibleNav = currentUser.perfil === "Administrador"
    ? nav
    : currentUser.perfil === "Investidor"
      ? nav
          .filter((item) => ["/investidor", "/notificacoes"].includes(item.to))
          .map((item) => item.to === "/investidor" ? { ...item, label: "Investidor" } : item)
      : currentUser.perfil === "Assessor"
        ? nav
            .filter((item) => ["/assessores", "/notificacoes"].includes(item.to))
            .map((item) => item.to === "/assessores" ? { ...item, label: "Assessor" } : item)
        : nav.filter((item) => ["/dashboard", "/projetos", "/notificacoes"].includes(item.to));
  const showCompanyContext = currentUser.perfil !== "Investidor" && currentUser.perfil !== "Assessor";
  const initials = currentUser.nome.split(" ").slice(0, 2).map((part) => part[0]).join("").toUpperCase();

  return (
    <div className="min-h-screen bg-background">
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-64 flex-col bg-sidebar text-sidebar-foreground transition-transform lg:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex h-16 items-center border-b border-sidebar-border px-3">
          <Link to="/dashboard" className="flex h-12 min-w-0 flex-1 items-center overflow-hidden rounded-lg bg-white px-2" aria-label="ArremataFlow — ir para o dashboard">
            <img
              src="/arremataflow-logo.jpg"
              alt="ArremataFlow — Gestão Pós-Arrematação e Regularização de Imóveis"
              className="h-full w-full object-contain"
            />
          </Link>
          <button
            className="ml-2 shrink-0 lg:hidden"
            onClick={() => setOpen(false)}
            aria-label="Fechar menu"
          >
            <X className="size-5" />
          </button>
        </div>
        <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 py-4">
          {visibleNav.map((item) => {
            const active =
              pathname === item.to || (item.to !== "/dashboard" && pathname.startsWith(item.to));
            return (
              <Link
                key={item.to}
                to={item.to}
                onClick={() => setOpen(false)}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                  active
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
                )}
              >
                <item.icon className="size-4.5 shrink-0" strokeWidth={1.75} />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-sidebar-border p-4 text-xs text-sidebar-foreground/70">
          Plano Corporate · v1.0
        </div>
      </aside>

      {open ? (
        <div
          className="fixed inset-0 z-40 bg-foreground/40 lg:hidden"
          onClick={() => setOpen(false)}
        />
      ) : null}

      <div className="lg:pl-64">
        <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-border bg-card/90 px-4 backdrop-blur lg:px-8">
          <button className="lg:hidden" onClick={() => setOpen(true)} aria-label="Abrir menu">
            <Menu className="size-5" />
          </button>
          {showCompanyContext ? (
            <div className="relative hidden max-w-sm flex-1 md:block">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar projetos, imóveis, investidores..."
                className="h-9 pl-9"
                aria-label="Busca global"
              />
            </div>
          ) : null}
          <div className="ml-auto flex items-center gap-3">
            {companyAccess && companyAccess.organizations.length > 1 ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="hidden max-w-64 gap-2 rounded-full px-3 text-xs text-muted-foreground sm:flex" disabled={switchCompany.isPending} aria-label={`Empresa ativa: ${activeCompanyName}. Alterar empresa`}>
                    <Building2 className="size-3.5 shrink-0" />
                    <span className="truncate">{activeCompanyName}</span>
                    <ChevronsUpDown className="size-3.5 shrink-0" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-72">
                  <DropdownMenuLabel>Selecionar empresa</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {companyAccess.organizations.map((item) => (
                    <DropdownMenuItem key={item.id} onSelect={() => item.id !== companyAccess.activeOrganizationId && switchCompany.mutate(item.id)} className="gap-2">
                      <Check className={cn("size-4", item.id === companyAccess.activeOrganizationId ? "opacity-100" : "opacity-0")} />
                      <span className="min-w-0 flex-1 truncate">{item.name}</span>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <span className="hidden items-center gap-2 rounded-full border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground sm:flex">
                <Building2 className="size-3.5" /> {activeCompanyName}
              </span>
            )}
            <Button asChild variant="ghost" size="icon">
              <Link to="/notificacoes" className="relative" aria-label={`Notificações${unreadCount ? `: ${unreadCount} não lida${unreadCount === 1 ? "" : "s"}` : ""}`}>
                <Bell className="size-4.5" />
                {unreadCount > 0 ? (
                  <span className="absolute right-0.5 top-0.5 grid min-h-4 min-w-4 place-items-center rounded-full bg-destructive px-1 text-[10px] font-bold leading-none text-destructive-foreground">
                    {unreadCount > 99 ? "99+" : unreadCount}
                  </span>
                ) : null}
              </Link>
            </Button>
            <div className="flex items-center gap-2">
              <span className="grid size-8 place-items-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
                {initials}
              </span>
              <span className="hidden text-sm font-medium sm:block">
                {currentUser.nome} · {currentUser.perfil}
              </span>
            </div>
          </div>
        </header>

        <main className="px-4 py-6 lg:px-8 lg:py-8">
          <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
            <div>
              <h1>{title}</h1>
              {subtitle ? <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p> : null}
            </div>
            {actions}
          </div>
          {children}
        </main>
      </div>
    </div>
  );
}

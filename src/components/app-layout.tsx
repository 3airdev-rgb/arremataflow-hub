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
  LifeBuoy,
  Search,
  Menu,
  Building2,
  Check,
  ChevronsUpDown,
  LogOut,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { getOrganizationSettings } from "@/lib/organization-settings";
import { getCurrentOrganizationUser } from "@/lib/organization-users";
import { homePathForRole, isAdminRole } from "@/lib/role-home";
import { getActivePlan } from "@/lib/developer";
import { authClient } from "@/lib/auth-client";
import { unreadNotificationCount } from "@/lib/tasks";
import { listUserOrganizations, selectActiveOrganization } from "@/lib/active-organization";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const nav = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/projetos", label: "Projetos", icon: FolderKanban },
  { to: "/investidor", label: "Investidores", icon: Users },
  { to: "/assessores", label: "Assessores", icon: BriefcaseBusiness },
  { to: "/relatorios", label: "Relatórios", icon: FileBarChart },
  { to: "/notificacoes", label: "Notificações", icon: Bell },
  { to: "/admin/configuracoes", label: "Configurações", icon: Settings },
  { to: "/suporte", label: "Suporte", icon: LifeBuoy },
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
  const { data: activePlan } = useQuery({
    queryKey: ["active-plan"],
    queryFn: () => getActivePlan(),
  });
  const { data: companyAccess } = useQuery({
    queryKey: ["user-organizations"],
    queryFn: () => listUserOrganizations(),
  });
  const switchCompany = useMutation({
    mutationFn: (organizationId: string) => selectActiveOrganization({ data: { organizationId } }),
    onSuccess: async () => {
      await queryClient.invalidateQueries();
      const user = await getCurrentOrganizationUser();
      await router.navigate({ to: homePathForRole(user.role) });
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
  const currentUser = serverUser
    ? {
        nome: serverUser.name,
        perfil:
          serverUser.role === "owner" || serverUser.role === "admin"
            ? "Administrador"
            : serverUser.role === "project_manager"
              ? "Gestor de Projetos"
              : serverUser.role === "advisor"
                ? "Assessor"
                : "Investidor",
      }
    : { nome: "Usuário", perfil: "Visualizador" };
  const selectedCompany = companyAccess?.organizations.find(
    (item) => item.id === companyAccess.activeOrganizationId,
  );
  const activeCompanyName = selectedCompany?.name || companyName || organization?.name || "Empresa";
  const roleNav =
    currentUser.perfil === "Administrador"
      ? nav
      : currentUser.perfil === "Gestor de Projetos"
        ? nav.filter((item) => item.to !== "/admin/configuracoes" && item.to !== "/dashboard")
        : currentUser.perfil === "Investidor"
          ? nav
              .filter((item) => ["/investidor", "/notificacoes", "/suporte"].includes(item.to))
              .map((item) => (item.to === "/investidor" ? { ...item, label: "Investidor" } : item))
          : currentUser.perfil === "Assessor"
            ? nav
                .filter((item) => ["/assessores", "/notificacoes", "/suporte"].includes(item.to))
                .map((item) => (item.to === "/assessores" ? { ...item, label: "Assessor" } : item))
            : [];
  const visibleNav = roleNav.filter(
    (item) =>
      item.to === "/suporte" ||
      !activePlan ||
      activePlan.menuItems.includes(nav.find((entry) => entry.to === item.to)?.label ?? item.label),
  );
  const showCompanyContext =
    currentUser.perfil !== "Investidor" && currentUser.perfil !== "Assessor";
  const logoLinksToDashboard = serverUser ? isAdminRole(serverUser.role) : false;
  const initials = currentUser.nome
    .split(" ")
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();

  const navigation = (
    <>
      <div className="flex h-16 shrink-0 items-center border-b border-sidebar-border px-3">
        {logoLinksToDashboard ? (
          <Link
            to="/dashboard"
            className="flex h-12 min-w-0 flex-1 items-center overflow-hidden rounded-lg bg-white px-2"
            aria-label="ArremataFlow — ir para o dashboard"
          >
            <img
              src="/arremataflow-logo.jpg"
              alt="ArremataFlow — Gestão Pós-Arrematação e Regularização de Imóveis"
              className="h-full w-full object-contain"
            />
          </Link>
        ) : (
          <div className="flex h-12 min-w-0 flex-1 items-center overflow-hidden rounded-lg bg-white px-2">
            <img
              src="/arremataflow-logo.jpg"
              alt="ArremataFlow — Gestão Pós-Arrematação e Regularização de Imóveis"
              className="h-full w-full object-contain"
            />
          </div>
        )}
      </div>
      <nav
        aria-label="Navegação principal"
        className="min-h-0 flex-1 space-y-0.5 overflow-y-auto px-3 py-4"
      >
        {visibleNav.map((item) => {
          const active =
            pathname === item.to || (item.to !== "/dashboard" && pathname.startsWith(item.to));
          return (
            <Link
              key={item.to}
              to={item.to}
              onClick={() => setOpen(false)}
              className={cn(
                "flex min-h-11 items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring",
                active
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
              )}
            >
              <item.icon className="size-4.5 shrink-0" strokeWidth={1.75} />
              <span className="min-w-0 flex-1">{item.label}</span>
              {item.to === "/notificacoes" && unreadCount > 0 ? (
                <span
                  className="grid min-h-5 min-w-5 shrink-0 place-items-center rounded-full bg-destructive px-1.5 text-[10px] font-bold leading-none text-destructive-foreground"
                  aria-label={`${unreadCount} notificaç${unreadCount === 1 ? "ão não visualizada" : "ões não visualizadas"}`}
                >
                  {unreadCount > 99 ? "99+" : unreadCount}
                </span>
              ) : null}
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-sidebar-border p-4 text-xs text-sidebar-foreground/70">
        Plano {activePlan?.name ?? "Personalizado"} · v1.0
      </div>
    </>
  );

  return (
    <div className="min-h-dvh bg-background">
      <a
        href="#conteudo-principal"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-2 focus:z-[100] focus:rounded focus:bg-background focus:p-3 focus:ring-2"
      >
        Ir para o conteúdo
      </a>
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col bg-sidebar text-sidebar-foreground lg:flex">
        {navigation}
      </aside>

      <div className="min-w-0 lg:pl-64">
        <header className="app-header sticky top-0 z-30 flex min-h-16 flex-wrap items-center gap-2 border-b border-border bg-card/95 px-4 py-2 backdrop-blur lg:px-8">
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="shrink-0 lg:hidden"
                aria-label="Abrir menu"
              >
                <Menu className="size-5" />
              </Button>
            </SheetTrigger>
            <SheetContent
              side="left"
              className="flex w-72 max-w-[calc(100vw-2rem)] flex-col gap-0 bg-sidebar p-0 text-sidebar-foreground"
              aria-describedby={undefined}
            >
              <SheetTitle className="sr-only">Navegação principal</SheetTitle>
              <div className="flex min-h-0 flex-1 flex-col pt-10">{navigation}</div>
            </SheetContent>
          </Sheet>
          {showCompanyContext ? (
            <div className="relative order-last w-full min-w-0 xl:order-none xl:max-w-sm xl:flex-1">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar projetos, imóveis, investidores..."
                className="h-9 pl-9"
                aria-label="Busca global"
              />
            </div>
          ) : null}
          <div className="ml-auto flex min-w-0 flex-1 flex-wrap items-center justify-end gap-2 xl:flex-none">
            {companyAccess && companyAccess.organizations.length > 1 ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-auto min-h-11 max-w-full gap-2 rounded-full px-3 text-xs text-muted-foreground"
                    disabled={switchCompany.isPending}
                    aria-label={`Empresa ativa: ${activeCompanyName}. Alterar empresa`}
                  >
                    <Building2 className="size-3.5 shrink-0" />
                    <span className="min-w-0 whitespace-normal text-left [overflow-wrap:anywhere]">
                      {activeCompanyName}
                    </span>
                    <ChevronsUpDown className="size-3.5 shrink-0" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-72">
                  <DropdownMenuLabel>Selecionar empresa</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {companyAccess.organizations.map((item) => (
                    <DropdownMenuItem
                      key={item.id}
                      onSelect={() =>
                        item.id !== companyAccess.activeOrganizationId &&
                        switchCompany.mutate(item.id)
                      }
                      className="gap-2"
                    >
                      <Check
                        className={cn(
                          "size-4",
                          item.id === companyAccess.activeOrganizationId
                            ? "opacity-100"
                            : "opacity-0",
                        )}
                      />
                      <span className="min-w-0 flex-1 whitespace-normal [overflow-wrap:anywhere]">
                        {item.name}
                      </span>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <span className="flex min-w-0 max-w-full items-center gap-2 rounded-full border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground">
                <Building2 className="size-3.5 shrink-0" />{" "}
                <span className="[overflow-wrap:anywhere]">{activeCompanyName}</span>
              </span>
            )}
            <Button asChild variant="ghost" size="icon">
              <Link
                to="/notificacoes"
                className="relative"
                aria-label={`Notificações${unreadCount ? `: ${unreadCount} não lida${unreadCount === 1 ? "" : "s"}` : ""}`}
              >
                <Bell className="size-4.5" />
                {unreadCount > 0 ? (
                  <span className="absolute right-0.5 top-0.5 grid min-h-4 min-w-4 place-items-center rounded-full bg-destructive px-1 text-[10px] font-bold leading-none text-destructive-foreground">
                    {unreadCount > 99 ? "99+" : unreadCount}
                  </span>
                ) : null}
              </Link>
            </Button>
            <div className="flex min-w-0 items-center gap-2">
              <span className="grid size-8 shrink-0 place-items-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
                {initials}
              </span>
              <span className="min-w-0 text-xs font-medium [overflow-wrap:anywhere] sm:text-sm">
                {currentUser.nome}
              </span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="shrink-0 gap-1.5"
              onClick={async () => {
                await authClient.signOut();
                window.location.assign("/");
              }}
            >
              <LogOut className="size-4" aria-hidden="true" />
              Sair
            </Button>
          </div>
        </header>

        <main
          id="conteudo-principal"
          tabIndex={-1}
          className="app-content min-w-0 px-4 py-6 lg:px-8 lg:py-8"
        >
          <div className="mb-6 flex min-w-0 flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
            <div className="min-w-0">
              <h1>{title}</h1>
              {subtitle ? <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p> : null}
            </div>
            {actions ? <div className="page-actions min-w-0">{actions}</div> : null}
          </div>
          {children}
        </main>
      </div>
    </div>
  );
}

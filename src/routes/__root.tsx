import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
  redirect,
} from "@tanstack/react-router";
import type { ReactNode } from "react";

import appCss from "../styles.css?url";
import { Toaster } from "@/components/ui/sonner";
import { ValidationAlertHost } from "@/components/validation-alert-host";
import { getAuthState } from "@/lib/auth-session";
import { getActivePlan, getSystemRole } from "@/lib/developer";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Página não encontrada</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          A página que você procura não existe ou foi movida.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary-hover"
          >
            Voltar ao início
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          Não foi possível carregar esta página
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Ocorreu uma falha inesperada. Tente novamente ou volte ao início.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary-hover"
          >
            Tentar novamente
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Voltar ao início
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  beforeLoad: async ({ location }) => {
    const isPublicRoute =
      location.pathname === "/" ||
      location.pathname === "/redefinir-senha" ||
      location.pathname.startsWith("/vistoria/") ||
      location.pathname.startsWith("/api/auth/");
    if (isPublicRoute) return;

    const { enforceAuthentication, session } = await getAuthState();
    if (enforceAuthentication && !session) throw redirect({ to: "/" });
    if (!session) return;
    const systemRole = await getSystemRole();
    if (systemRole === "developer") {
      if (location.pathname !== "/desenvolvedor") throw redirect({ to: "/desenvolvedor" });
      return;
    }
    if (location.pathname === "/desenvolvedor") throw redirect({ to: "/dashboard" });
    const plan = await getActivePlan();
    if (!plan) return;
    const path = location.pathname;
    const menuItem = path.startsWith("/projetos")
      ? "Projetos"
      : path.startsWith("/investidor")
        ? "Investidores"
        : path.startsWith("/assessores")
          ? "Assessores"
          : path.startsWith("/relatorios")
            ? "Relatórios"
            : path.startsWith("/notificacoes")
              ? "Notificações"
              : path.startsWith("/admin/")
                ? "Configurações"
                : path.startsWith("/dashboard")
                  ? "Dashboard"
                  : null;
    if (menuItem && !plan.menuItems.includes(menuItem)) throw redirect({ to: "/suporte" });
  },
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "ArremataFlow — Gestão pós-arrematação de imóveis" },
      {
        name: "description",
        content:
          "SaaS multiempresa para gestão do ciclo pós-arrematação: regularização, posse, obras, documentos, financeiro e resultados.",
      },
      { name: "author", content: "ArremataFlow" },
      { property: "og:title", content: "ArremataFlow" },
      {
        property: "og:description",
        content: "Gestão completa do pós-arremate imobiliário em uma única plataforma.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap",
      },
      { rel: "icon", href: "/favicon.jpg?v=4", type: "image/jpeg" },
      { rel: "shortcut icon", href: "/favicon.jpg?v=4", type: "image/jpeg" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  return (
    <QueryClientProvider client={queryClient}>
      {/* Required: nested routes render here. Removing <Outlet /> breaks all child routes. */}
      <Outlet />
      <ValidationAlertHost />
      <Toaster position="top-right" richColors />
    </QueryClientProvider>
  );
}

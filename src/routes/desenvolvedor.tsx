import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { LayoutDashboard, Layers, LifeBuoy, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DashboardTab } from "@/components/developer/dashboard-tab";
import { FinanceTab } from "@/components/developer/finance-tab";
import { HelpDeskTab } from "@/components/developer/helpdesk-tab";
import { PlansTab } from "@/components/developer/plans-tab";
import { developerTabs, type DeveloperTab } from "@/components/developer/format";
import { authClient } from "@/lib/auth-client";
import { getSystemRole } from "@/lib/developer";

export const Route = createFileRoute("/desenvolvedor")({
  validateSearch: (search: Record<string, unknown>): { aba?: DeveloperTab; foco?: string } => {
    const result: { aba?: DeveloperTab; foco?: string } = {};
    if (developerTabs.includes(search["aba"] as DeveloperTab))
      result.aba = search["aba"] as DeveloperTab;
    if (typeof search["foco"] === "string" && search["foco"]) result.foco = search["foco"];
    return result;
  },
  beforeLoad: async () => {
    if ((await getSystemRole()) !== "developer") throw redirect({ to: "/dashboard" });
  },
  component: DeveloperPage,
});

const tabs = [
  { value: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { value: "planos", label: "Planos", icon: Layers },
  { value: "financeiro", label: "Financeiro", icon: Wallet },
  { value: "helpdesk", label: "Help Desk", icon: LifeBuoy },
] as const;

function DeveloperPage() {
  const { aba = "dashboard", foco } = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const go = (tab: DeveloperTab, focus?: string) =>
    void navigate({ search: focus ? { aba: tab, foco: focus } : { aba: tab } });

  return (
    <main className="min-h-dvh max-w-full overflow-x-hidden bg-background p-4 text-foreground md:p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-semibold">Painel do Desenvolvedor</h1>
            <p className="text-muted-foreground">
              Indicadores, planos, financeiro e suporte do ArremataFlow
            </p>
          </div>
          <Button
            variant="outline"
            onClick={async () => {
              await authClient.signOut();
              location.href = "/";
            }}
          >
            Sair
          </Button>
        </header>
        <Tabs value={aba} onValueChange={(value) => go(value as DeveloperTab)} className="min-w-0">
          <TabsList aria-label="Seções do painel" className="mb-4 w-full justify-start sm:w-auto">
            {tabs.map(({ value, label, icon: Icon }) => (
              <TabsTrigger key={value} value={value} className="flex-1 gap-2 sm:flex-none">
                <Icon className="size-4" aria-hidden="true" />
                {label}
              </TabsTrigger>
            ))}
          </TabsList>
          <TabsContent value="dashboard">
            <DashboardTab onNavigate={go} />
          </TabsContent>
          <TabsContent value="planos">
            <PlansTab />
          </TabsContent>
          <TabsContent value="financeiro">
            <FinanceTab focus={foco} />
          </TabsContent>
          <TabsContent value="helpdesk">
            <HelpDeskTab />
          </TabsContent>
        </Tabs>
      </div>
    </main>
  );
}

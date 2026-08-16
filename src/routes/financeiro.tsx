import { createFileRoute } from "@tanstack/react-router";
import { Wallet } from "lucide-react";
import { ModulePage } from "@/components/module-page";

export const Route = createFileRoute("/financeiro")({
  head: () => ({
    meta: [
      { title: "Financeiro | ArremataFlow" },
      { name: "description", content: "Receitas, despesas, tributos e fluxo de caixa consolidado da carteira." },
      { property: "og:title", content: "Financeiro | ArremataFlow" },
      { property: "og:description", content: "Receitas, despesas, tributos e fluxo de caixa consolidado da carteira." },
    ],
  }),
  component: () => (
    <ModulePage
      title="Financeiro"
      subtitle="Movimentações consolidadas"
      icon={Wallet}
      campo="etapa"
      descricaoModulo="Receitas, despesas, tributos e fluxo de caixa consolidado da carteira."
    />
  ),
});

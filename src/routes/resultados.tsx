import { createFileRoute } from "@tanstack/react-router";
import { TrendingUp } from "lucide-react";
import { ModulePage } from "@/components/module-page";

export const Route = createFileRoute("/resultados")({
  head: () => ({
    meta: [
      { title: "Resultados | ArremataFlow" },
      { name: "description", content: "Resultados projetados e realizados, com distribuição por investidor e assessoria." },
      { property: "og:title", content: "Resultados | ArremataFlow" },
      { property: "og:description", content: "Resultados projetados e realizados, com distribuição por investidor e assessoria." },
    ],
  }),
  component: () => (
    <ModulePage
      title="Resultados"
      subtitle="Apuração e distribuição"
      icon={TrendingUp}
      campo="etapa"
      descricaoModulo="Resultados projetados e realizados, com distribuição por investidor e assessoria."
    />
  ),
});

import { createFileRoute } from "@tanstack/react-router";
import { KeyRound } from "lucide-react";
import { ModulePage } from "@/components/module-page";

export const Route = createFileRoute("/posse")({
  head: () => ({
    meta: [
      { title: "Posse | ArremataFlow" },
      { name: "description", content: "Situação de ocupação, custos e documentos relativos à imissão na posse." },
      { property: "og:title", content: "Posse | ArremataFlow" },
      { property: "og:description", content: "Situação de ocupação, custos e documentos relativos à imissão na posse." },
    ],
  }),
  component: () => (
    <ModulePage
      title="Posse"
      subtitle="Imissão e desocupação"
      icon={KeyRound}
      campo="etapa"
      descricaoModulo="Situação de ocupação, custos e documentos relativos à imissão na posse."
    />
  ),
});

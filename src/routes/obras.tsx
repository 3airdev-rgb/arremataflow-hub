import { createFileRoute } from "@tanstack/react-router";
import { Hammer } from "lucide-react";
import { ModulePage } from "@/components/module-page";

export const Route = createFileRoute("/obras")({
  head: () => ({
    meta: [
      { title: "Obras | ArremataFlow" },
      { name: "description", content: "Orçamentos aprovados, cronograma físico-financeiro e desvios por projeto." },
      { property: "og:title", content: "Obras | ArremataFlow" },
      { property: "og:description", content: "Orçamentos aprovados, cronograma físico-financeiro e desvios por projeto." },
    ],
  }),
  component: () => (
    <ModulePage
      title="Obras"
      subtitle="Reformas e cronogramas"
      icon={Hammer}
      campo="etapa"
      descricaoModulo="Orçamentos aprovados, cronograma físico-financeiro e desvios por projeto."
    />
  ),
});

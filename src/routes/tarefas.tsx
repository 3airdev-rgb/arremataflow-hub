import { createFileRoute } from "@tanstack/react-router";
import { CheckSquare } from "lucide-react";
import { ModulePage } from "@/components/module-page";

export const Route = createFileRoute("/tarefas")({
  head: () => ({
    meta: [
      { title: "Tarefas | ArremataFlow" },
      { name: "description", content: "Todas as tarefas da empresa agrupadas por projeto, prazo e responsável." },
      { property: "og:title", content: "Tarefas | ArremataFlow" },
      { property: "og:description", content: "Todas as tarefas da empresa agrupadas por projeto, prazo e responsável." },
    ],
  }),
  component: () => (
    <ModulePage
      title="Tarefas"
      subtitle="Pipeline operacional consolidado"
      icon={CheckSquare}
      campo="etapa"
      descricaoModulo="Todas as tarefas da empresa agrupadas por projeto, prazo e responsável."
    />
  ),
});

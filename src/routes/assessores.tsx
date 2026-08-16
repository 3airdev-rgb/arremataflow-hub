import { createFileRoute } from "@tanstack/react-router";
import { BriefcaseBusiness } from "lucide-react";
import { ModulePage } from "@/components/module-page";

export const Route = createFileRoute("/assessores")({
  head: () => ({
    meta: [
      { title: "Assessores | ArremataFlow" },
      { name: "description", content: "Distribuição de carteira por assessor, com carga de trabalho e projetos sob responsabilidade." },
      { property: "og:title", content: "Assessores | ArremataFlow" },
      { property: "og:description", content: "Distribuição de carteira por assessor, com carga de trabalho e projetos sob responsabilidade." },
    ],
  }),
  component: () => (
    <ModulePage
      title="Assessores"
      subtitle="Equipe responsável pelos projetos"
      icon={BriefcaseBusiness}
      campo="responsavel"
      descricaoModulo="Distribuição de carteira por assessor, com carga de trabalho e projetos sob responsabilidade."
    />
  ),
});

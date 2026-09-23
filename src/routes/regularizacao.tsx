import { createFileRoute } from "@tanstack/react-router";
import { FileCheck } from "lucide-react";
import { ModulePage } from "@/components/module-page";

export const Route = createFileRoute("/regularizacao")({
  head: () => ({
    meta: [
      { title: "Regularização | ArremataFlow" },
      { name: "description", content: "Acompanhe averbações, certidões, débitos condominiais e ações judiciais em andamento." },
      { property: "og:title", content: "Regularização | ArremataFlow" },
      { property: "og:description", content: "Acompanhe averbações, certidões, débitos condominiais e ações judiciais em andamento." },
    ],
  }),
  component: () => (
    <ModulePage
      title="Regularização"
      subtitle="Cartório, prefeitura, condomínio e jurídico"
      icon={FileCheck}
      campo="etapa"
      descricaoModulo="Acompanhe averbações, certidões, débitos condominiais e ações judiciais em andamento."
    />
  ),
});

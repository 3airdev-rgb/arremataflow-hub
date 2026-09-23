import { createFileRoute } from "@tanstack/react-router";
import { FolderOpen } from "lucide-react";
import { ModulePage } from "@/components/module-page";

export const Route = createFileRoute("/documentos")({
  head: () => ({
    meta: [
      { title: "Documentos | ArremataFlow" },
      { name: "description", content: "Documentos de todos os projetos com versionamento, categoria e trilha de auditoria." },
      { property: "og:title", content: "Documentos | ArremataFlow" },
      { property: "og:description", content: "Documentos de todos os projetos com versionamento, categoria e trilha de auditoria." },
    ],
  }),
  component: () => (
    <ModulePage
      title="Documentos"
      subtitle="Repositório documental da empresa"
      icon={FolderOpen}
      campo="etapa"
      descricaoModulo="Documentos de todos os projetos com versionamento, categoria e trilha de auditoria."
    />
  ),
});

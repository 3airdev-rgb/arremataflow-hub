import { createFileRoute } from "@tanstack/react-router";
import { House } from "lucide-react";
import { ModulePage } from "@/components/module-page";

export const Route = createFileRoute("/imoveis")({
  head: () => ({
    meta: [
      { title: "Imóveis | ArremataFlow" },
      { name: "description", content: "Cadastro único de imóveis com localização, matrícula, área e vínculo com projetos." },
      { property: "og:title", content: "Imóveis | ArremataFlow" },
      { property: "og:description", content: "Cadastro único de imóveis com localização, matrícula, área e vínculo com projetos." },
    ],
  }),
  component: () => (
    <ModulePage
      title="Imóveis"
      subtitle="Carteira de imóveis da empresa"
      icon={House}
      campo="cidade"
      descricaoModulo="Cadastro único de imóveis com localização, matrícula, área e vínculo com projetos."
    />
  ),
});

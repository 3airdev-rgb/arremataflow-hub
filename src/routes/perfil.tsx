import { createFileRoute } from "@tanstack/react-router";
import { UserCircle } from "lucide-react";
import { ModulePage } from "@/components/module-page";

export const Route = createFileRoute("/perfil")({
  head: () => ({
    meta: [
      { title: "Perfil | ArremataFlow" },
      { name: "description", content: "Dados pessoais, preferências de notificação e projetos sob sua responsabilidade." },
      { property: "og:title", content: "Perfil | ArremataFlow" },
      { property: "og:description", content: "Dados pessoais, preferências de notificação e projetos sob sua responsabilidade." },
    ],
  }),
  component: () => (
    <ModulePage
      title="Perfil"
      subtitle="Sua conta no ArremataFlow"
      icon={UserCircle}
      campo="responsavel"
      descricaoModulo="Dados pessoais, preferências de notificação e projetos sob sua responsabilidade."
    />
  ),
});

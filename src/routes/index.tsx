import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Building2, Loader2, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Entrar | ArremataFlow — Gestão pós-arrematação" },
      {
        name: "description",
        content:
          "Acesse o ArremataFlow e gerencie regularização, posse, obras, documentos e resultados dos seus imóveis arrematados.",
      },
      { property: "og:title", content: "Entrar | ArremataFlow" },
      {
        property: "og:description",
        content: "Plataforma SaaS de gestão do ciclo pós-arrematação de imóveis.",
      },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [recuperar, setRecuperar] = useState(false);
  const [enviado, setEnviado] = useState(false);

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="hidden flex-col justify-between bg-sidebar p-12 text-sidebar-foreground lg:flex">
        <div className="flex items-center gap-2">
          <span className="grid size-9 place-items-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
            <Building2 className="size-5" />
          </span>
          <span className="text-lg font-semibold text-white">ArremataFlow</span>
        </div>
        <div className="max-w-md space-y-4">
          <h2 className="text-white">Todo o pós-arremate sob controle.</h2>
          <p className="text-sm leading-relaxed text-sidebar-foreground/80">
            Centralize regularização, imissão na posse, reformas, documentos, financeiro e
            distribuição de resultados — com trilha de auditoria e portal do investidor.
          </p>
          <div className="flex items-center gap-2 text-sm text-sidebar-foreground/80">
            <ShieldCheck className="size-4" /> Multiempresa, com permissões por perfil
          </div>
        </div>
        <p className="text-xs text-sidebar-foreground/60">© 2026 ArremataFlow</p>
      </div>

      <div className="flex items-center justify-center px-6 py-16">
        <div className="w-full max-w-sm">
          <div className="mb-8 flex items-center gap-2 lg:hidden">
            <span className="grid size-9 place-items-center rounded-lg bg-primary text-primary-foreground">
              <Building2 className="size-5" />
            </span>
            <span className="text-lg font-semibold">ArremataFlow</span>
          </div>

          {recuperar ? (
            <form
              className="space-y-5"
              onSubmit={(e) => {
                e.preventDefault();
                setEnviado(true);
              }}
            >
              <div>
                <h1 className="text-2xl">Recuperar senha</h1>
                <p className="mt-1 text-sm text-muted-foreground">
                  Enviaremos um link de redefinição para seu e-mail corporativo.
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="email-rec">E-mail</Label>
                <Input id="email-rec" type="email" placeholder="voce@empresa.com" required />
              </div>
              {enviado ? (
                <p className="rounded-lg bg-success-soft px-3 py-2 text-sm text-success">
                  Link enviado! Verifique sua caixa de entrada.
                </p>
              ) : null}
              <Button type="submit" className="w-full">
                Enviar link
              </Button>
              <button
                type="button"
                className="w-full text-sm text-brand hover:underline"
                onClick={() => setRecuperar(false)}
              >
                Voltar ao login
              </button>
            </form>
          ) : (
            <form
              className="space-y-5"
              onSubmit={(e) => {
                e.preventDefault();
                setLoading(true);
                setTimeout(() => navigate({ to: "/dashboard" }), 600);
              }}
            >
              <div>
                <h1 className="text-2xl">Entrar</h1>
                <p className="mt-1 text-sm text-muted-foreground">
                  language selector
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">E-mail</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="voce@empresa.com"
                  defaultValue="camila@arremataflow.com"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="senha">Senha</Label>
                <Input id="senha" type="password" defaultValue="demo1234" required />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? <Loader2 className="size-4 animate-spin" /> : null}
                Entrar
              </Button>
              <div className="flex items-center justify-between text-sm">
                <button
                  type="button"
                  className="text-brand hover:underline"
                  onClick={() => setRecuperar(true)}
                >
                  Esqueci minha senha
                </button>
                <Link to="/investidor" className="text-muted-foreground hover:underline">
                  Sou investidor
                </Link>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

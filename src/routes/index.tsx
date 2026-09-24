import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Loader2, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authClient } from "@/lib/auth-client";
import { getSystemRole } from "@/lib/developer";

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
  const [erro, setErro] = useState<string | null>(null);

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="relative hidden overflow-hidden bg-sidebar lg:block">
        <img
          src="/login-hero.jpg"
          alt=""
          className="absolute inset-0 size-full object-cover object-left"
        />
        <div className="relative flex h-full flex-col justify-center p-12">
          <div className="max-w-md space-y-4 rounded-2xl bg-sidebar/85 p-8 text-white shadow-xl backdrop-blur-sm">
            <h2 className="text-white">Todo o pós-arremate sob controle.</h2>
            <p className="text-sm leading-relaxed text-white/85">
              Centralize regularização, imissão na posse, reformas, documentos, financeiro e
              distribuição de resultados — com trilha de auditoria e portal do investidor.
            </p>
            <div className="flex items-center gap-2 text-sm text-white/85">
              <ShieldCheck className="size-4" /> Multiempresa, com permissões por perfil
            </div>
          </div>
        </div>
        <p className="absolute bottom-6 left-12 text-xs text-white/80 [text-shadow:0_1px_2px_rgb(0_0_0/0.6)]">
          © 2026 ArremataFlow
        </p>
      </div>

      <div className="flex items-center justify-center px-4 py-8 sm:px-6 sm:py-16">
        <div className="w-full max-w-sm">
          <img
            src="/login-logo.jpg"
            alt="ArremataFlow — Gestão pós-arrematação e regularização de imóveis"
            className="mx-auto mb-6 w-full max-w-sm mix-blend-multiply [mask-image:radial-gradient(ellipse_at_center,black_55%,transparent_100%)]"
          />

          {recuperar ? (
            <form
              className="space-y-5"
              onSubmit={async (e) => {
                e.preventDefault();
                const form = e.currentTarget;
                const email = (form.elements.namedItem("email-rec") as HTMLInputElement).value;
                setLoading(true);
                setErro(null);
                const { error } = await authClient.requestPasswordReset({
                  email,
                  redirectTo: `${window.location.origin}/redefinir-senha`,
                });
                setLoading(false);
                if (error) {
                  setErro("Não foi possível processar a solicitação agora.");
                  return;
                }
                setEnviado(true);
              }}
            >
              <div>
                <h1 className="text-2xl">Recuperar senha</h1>
                <p className="mt-1 text-sm text-muted-foreground">
                  Informe seu e-mail para solicitar a recuperação do acesso.
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="email-rec">E-mail</Label>
                <Input
                  id="email-rec"
                  name="email-rec"
                  type="email"
                  placeholder="voce@empresa.com"
                  required
                />
              </div>
              {enviado ? (
                <p className="rounded-lg bg-success-soft px-3 py-2 text-sm text-success">
                  Solicitação registrada com sucesso.
                </p>
              ) : null}
              {erro ? (
                <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  {erro}
                </p>
              ) : null}
              <Button type="submit" className="w-full" disabled={loading || enviado}>
                {loading ? <Loader2 className="size-4 animate-spin" /> : null}
                Enviar link seguro
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
              onSubmit={async (e) => {
                e.preventDefault();
                const form = e.currentTarget;
                const email = (form.elements.namedItem("email") as HTMLInputElement).value;
                const senha = (form.elements.namedItem("senha") as HTMLInputElement).value;
                setLoading(true);
                setErro(null);
                const { error } = await authClient.signIn.email({
                  email,
                  password: senha,
                  rememberMe: false,
                });
                setLoading(false);
                if (error) {
                  const serviceUnavailable =
                    error.status >= 500 || error.code === "INTERNAL_SERVER_ERROR";
                  setErro(
                    serviceUnavailable
                      ? "O serviço de autenticação está indisponível. Tente novamente em instantes."
                      : error.code === "EMAIL_NOT_VERIFIED"
                        ? "Confirme seu e-mail antes de entrar. Enviamos um novo link de confirmação."
                        : "E-mail ou senha inválidos.",
                  );
                  return;
                }
                const systemRole = await getSystemRole();
                navigate({ to: systemRole === "developer" ? "/desenvolvedor" : "/projetos" });
              }}
            >
              <div>
                <h1 className="text-2xl">Entrar</h1>
                <p className="mt-1 text-sm text-muted-foreground">Entre com seu e-mail e senha.</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">E-mail</Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  placeholder="voce@empresa.com"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="senha">Senha</Label>
                <Input
                  id="senha"
                  name="senha"
                  type="password"
                  minLength={12}
                  required
                  autoComplete="current-password"
                />
              </div>
              {erro ? (
                <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  {erro}
                </p>
              ) : null}
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? <Loader2 className="size-4 animate-spin" /> : null}
                Entrar
              </Button>
              <div className="flex flex-col gap-3 text-sm sm:flex-row sm:items-center sm:justify-between">
                <span className="text-muted-foreground">
                  Novo por aqui?{" "}
                  <Link to="/cadastro" className="text-brand hover:underline">
                    Criar conta
                  </Link>
                </span>
                <button
                  type="button"
                  className="min-h-11 text-left text-brand hover:underline"
                  onClick={() => setRecuperar(true)}
                >
                  Esqueci minha senha
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

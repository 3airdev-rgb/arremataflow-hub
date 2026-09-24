import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Loader2, MailCheck } from "lucide-react";
import { OnboardingShell } from "@/components/onboarding-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TRIAL_DAYS } from "@/lib/access";

export const Route = createFileRoute("/cadastro/")({
  head: () => ({ meta: [{ title: "Criar conta | ArremataFlow" }] }),
  component: SignupPage,
});

function SignupPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);

  if (sentTo)
    return (
      <OnboardingShell>
        <div className="space-y-4">
          <span className="grid size-12 place-items-center rounded-full bg-success-soft text-success">
            <MailCheck className="size-6" />
          </span>
          <h1 className="text-2xl">Confirme seu e-mail</h1>
          <p className="text-sm text-muted-foreground">
            Enviamos um link de confirmação para <strong>{sentTo}</strong>. Abra o e-mail e clique
            no link para continuar (ele vale por 1 hora). Confira também a caixa de spam.
          </p>
          <Button asChild variant="outline" className="w-full">
            <Link to="/">Voltar ao login</Link>
          </Button>
        </div>
      </OnboardingShell>
    );

  return (
    <OnboardingShell>
      <form
        className="space-y-5"
        onSubmit={async (event) => {
          event.preventDefault();
          const form = event.currentTarget;
          const value = (name: string) => (form.elements.namedItem(name) as HTMLInputElement).value;
          setError(null);
          if (value("password") !== value("confirmation")) {
            setError("As senhas informadas não coincidem.");
            return;
          }
          setLoading(true);
          try {
            const response = await fetch("/api/signup", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                name: value("name"),
                email: value("email"),
                password: value("password"),
              }),
            });
            if (response.status === 429) {
              setError("Muitas tentativas. Aguarde um pouco antes de tentar novamente.");
              return;
            }
            if (!response.ok) {
              const body = (await response.json().catch(() => null)) as { message?: string } | null;
              setError(body?.message ?? "Não foi possível criar a conta agora.");
              return;
            }
            setSentTo(value("email"));
          } catch {
            setError("Não foi possível conectar ao servidor. Tente novamente.");
          } finally {
            setLoading(false);
          }
        }}
      >
        <div>
          <h1 className="text-2xl">Criar conta</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Teste o plano Profissional por {TRIAL_DAYS} dias, sem cartão de crédito.
          </p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="name">Seu nome</Label>
          <Input id="name" name="name" autoComplete="name" minLength={2} required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="email">E-mail</Label>
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            placeholder="voce@empresa.com"
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">Senha</Label>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="new-password"
            minLength={12}
            required
          />
          <p className="text-xs text-muted-foreground">Use pelo menos 12 caracteres.</p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="confirmation">Confirmar senha</Label>
          <Input
            id="confirmation"
            name="confirmation"
            type="password"
            autoComplete="new-password"
            minLength={12}
            required
          />
        </div>
        {error ? (
          <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>
        ) : null}
        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? <Loader2 className="size-4 animate-spin" /> : null}
          Criar conta
        </Button>
        <p className="text-center text-sm text-muted-foreground">
          Já tem conta?{" "}
          <Link to="/" className="text-brand hover:underline">
            Entrar
          </Link>
        </p>
      </form>
    </OnboardingShell>
  );
}

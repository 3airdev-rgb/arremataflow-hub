import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Building2, Loader2 } from "lucide-react";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authClient } from "@/lib/auth-client";

const searchSchema = z.object({
  token: z.string().optional(),
  error: z.string().optional(),
});

export const Route = createFileRoute("/redefinir-senha")({
  validateSearch: searchSchema,
  head: () => ({ meta: [{ title: "Criar nova senha | ArremataFlow" }] }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const navigate = useNavigate();
  const { token, error: tokenError } = Route.useSearch();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const invalidToken = tokenError === "INVALID_TOKEN" || !token;

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-6 py-16">
      <div className="w-full max-w-sm space-y-6">
        <div className="flex items-center gap-2">
          <span className="grid size-9 place-items-center rounded-lg bg-primary text-primary-foreground">
            <Building2 className="size-5" />
          </span>
          <span className="text-lg font-semibold">ArremataFlow</span>
        </div>

        {invalidToken ? (
          <div className="space-y-4">
            <h1 className="text-2xl">Link inválido ou expirado</h1>
            <p className="text-sm text-muted-foreground">
              Solicite um novo link de acesso. Por segurança, cada link pode ser usado apenas uma vez.
            </p>
            <Button asChild className="w-full"><Link to="/">Voltar ao login</Link></Button>
          </div>
        ) : (
          <form
            className="space-y-5"
            onSubmit={async (event) => {
              event.preventDefault();
              const form = event.currentTarget;
              const password = (form.elements.namedItem("password") as HTMLInputElement).value;
              const confirmation = (form.elements.namedItem("confirmation") as HTMLInputElement).value;
              setError(null);
              if (password !== confirmation) {
                setError("As senhas informadas não coincidem.");
                return;
              }
              setLoading(true);
              const result = await authClient.resetPassword({ newPassword: password, token });
              setLoading(false);
              if (result.error) {
                setError("O link expirou ou já foi utilizado. Solicite um novo link.");
                return;
              }
              navigate({ to: "/" });
            }}
          >
            <div>
              <h1 className="text-2xl">Criar nova senha</h1>
              <p className="mt-1 text-sm text-muted-foreground">Use pelo menos 12 caracteres.</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Nova senha</Label>
              <Input id="password" name="password" type="password" minLength={12} autoComplete="new-password" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmation">Confirmar nova senha</Label>
              <Input id="confirmation" name="confirmation" type="password" minLength={12} autoComplete="new-password" required />
            </div>
            {error ? <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p> : null}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? <Loader2 className="size-4 animate-spin" /> : null}
              Salvar nova senha
            </Button>
          </form>
        )}
      </div>
    </main>
  );
}


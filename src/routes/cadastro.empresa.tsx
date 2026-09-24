import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Loader2 } from "lucide-react";
import { OnboardingShell } from "@/components/onboarding-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TRIAL_DAYS } from "@/lib/access";
import { authClient } from "@/lib/auth-client";
import { createCompany } from "@/lib/onboarding";
import { showValidationAlert } from "@/lib/validation-feedback";
import { formatDocument } from "@/lib/utils-validation";

export const Route = createFileRoute("/cadastro/empresa")({
  ssr: false,
  head: () => ({ meta: [{ title: "Sua empresa | ArremataFlow" }] }),
  component: CompanyPage,
});

function CompanyPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [document, setDocument] = useState("");

  return (
    <OnboardingShell
      actions={
        <Button
          variant="ghost"
          size="sm"
          onClick={async () => {
            await authClient.signOut();
            location.href = "/";
          }}
        >
          Sair
        </Button>
      }
    >
      <form
        className="space-y-5"
        onSubmit={async (event) => {
          event.preventDefault();
          const name = (event.currentTarget.elements.namedItem("company") as HTMLInputElement)
            .value;
          setLoading(true);
          try {
            await createCompany({ data: { name, legalDocument: document } });
            await navigate({ to: "/planos", search: { boasvindas: "1" } });
          } catch (error) {
            showValidationAlert(error, "Não foi possível criar a empresa. Revise os dados.");
          } finally {
            setLoading(false);
          }
        }}
      >
        <div>
          <h1 className="text-2xl">Dados da sua empresa</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            E-mail confirmado. Falta só identificar a empresa; seu teste de {TRIAL_DAYS} dias do
            plano Profissional começa em seguida.
          </p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="company">Nome da empresa</Label>
          <Input id="company" name="company" minLength={2} maxLength={160} required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="document">CNPJ ou CPF (opcional)</Label>
          <Input
            id="document"
            inputMode="numeric"
            value={document}
            onChange={(event) => setDocument(formatDocument(event.target.value))}
            maxLength={18}
          />
        </div>
        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? <Loader2 className="size-4 animate-spin" /> : null}
          Continuar
        </Button>
      </form>
    </OnboardingShell>
  );
}

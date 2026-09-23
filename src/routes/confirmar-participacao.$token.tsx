import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { respondToTaskMeetingInvitation } from "@/lib/tasks";

export const Route = createFileRoute("/confirmar-participacao/$token")({
  validateSearch: (search: Record<string, unknown>) => ({
    resposta:
      search["resposta"] === "confirmado"
        ? ("confirmado" as const)
        : search["resposta"] === "recusado"
          ? ("recusado" as const)
          : null,
  }),
  component: MeetingResponsePage,
  head: () => ({ meta: [{ title: "Confirmação de participação | ArremataFlow" }] }),
});

function MeetingResponsePage() {
  const { token } = Route.useParams();
  const { resposta } = Route.useSearch();
  const [result, setResult] = useState<Awaited<
    ReturnType<typeof respondToTaskMeetingInvitation>
  > | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!resposta) {
      setError("Resposta de participação inválida.");
      return;
    }
    void respondToTaskMeetingInvitation({ data: { token, response: resposta } })
      .then(setResult)
      .catch((reason) =>
        setError(
          reason instanceof Error ? reason.message : "Não foi possível registrar a resposta.",
        ),
      );
  }, [resposta, token]);

  return (
    <main className="grid min-h-screen place-items-center bg-slate-50 p-6">
      <div className="surface-card w-full max-w-lg p-8 text-center">
        <img src="/arremataflow-logo.jpg" className="mx-auto mb-5 h-16" alt="ArremataFlow" />
        {error ? (
          <>
            <h1 className="text-2xl font-semibold">Não foi possível confirmar</h1>
            <p className="mt-3 text-red-700">{error}</p>
          </>
        ) : result ? (
          <>
            <h1 className="text-2xl font-semibold">Resposta registrada</h1>
            <p className="mt-3 text-muted-foreground">
              {result.recipientName}, sua resposta para a tarefa <strong>{result.taskTitle}</strong>{" "}
              do projeto <strong>{result.projectName}</strong> foi registrada como:
            </p>
            <p
              className={`mt-5 text-lg font-semibold ${result.response === "confirmado" ? "text-green-700" : "text-red-700"}`}
            >
              {result.response === "confirmado"
                ? "Confirmo participação"
                : "Não poderei participar"}
            </p>
          </>
        ) : (
          <>
            <h1 className="text-2xl font-semibold">Registrando sua resposta...</h1>
            <p className="mt-3 text-muted-foreground">Aguarde um instante.</p>
          </>
        )}
      </div>
    </main>
  );
}

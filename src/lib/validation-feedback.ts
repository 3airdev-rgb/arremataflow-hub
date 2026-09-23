export const VALIDATION_ALERT_EVENT = "arremataflow:validation-alert";

const fieldLabels: Record<string, string> = {
  name: "Nome", nome: "Nome", email: "E-mail", documento: "CPF ou CNPJ",
  address: "Endereço", end: "Endereço", cidade: "Cidade", estado: "UF", cep: "CEP",
  percentage: "% de participação", amount: "Valor", title: "Título", category: "Categoria",
  dueDate: "Prazo", description: "Descrição", password: "Senha",
};

function issueMessage(issue: unknown) {
  if (!issue || typeof issue !== "object") return null;
  const record = issue as { message?: unknown; path?: unknown[] };
  const rawMessage = typeof record.message === "string" ? record.message : "Valor inválido.";
  const lastPath = record.path?.at(-1);
  const label = typeof lastPath === "string" ? fieldLabels[lastPath] : undefined;
  return label && !rawMessage.toLowerCase().includes(label.toLowerCase()) ? `${label}: ${rawMessage}` : rawMessage;
}

export function readableValidationMessage(error: unknown, fallback = "Revise os campos informados.") {
  const raw = error instanceof Error ? error.message : typeof error === "string" ? error : fallback;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (Array.isArray(parsed)) {
      const messages = [...new Set(parsed.map(issueMessage).filter((item): item is string => Boolean(item)))];
      if (messages.length) return messages.join("\n");
    }
  } catch {
    // Mensagens comuns já estão prontas para exibição.
  }
  if (/validation|invalid_string|invalid_type|regex|zod/i.test(raw)) return fallback;
  return raw || fallback;
}

export function showValidationAlert(error: unknown, fallback?: string) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(VALIDATION_ALERT_EVENT, {
    detail: { message: readableValidationMessage(error, fallback) },
  }));
}

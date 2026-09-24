export const brl = (value: number | null | undefined) =>
  (value ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export const compactBrl = (value: number) =>
  value >= 1000
    ? `R$ ${(value / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mil`
    : brl(value);

export function formatMinutes(minutes: number | null | undefined) {
  if (minutes === null || minutes === undefined) return "Sem dados";
  if (minutes < 60) return `${Math.round(minutes)} min`;
  const hours = minutes / 60;
  return hours < 48
    ? `${hours.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} h`
    : `${Math.round(hours / 24)} dias`;
}

export const formatDate = (value: string | null | undefined) =>
  value ? new Date(value).toLocaleDateString("pt-BR", { timeZone: "UTC" }) : "—";

export const formatDateTime = (value: string | null | undefined) =>
  value ? new Date(value).toLocaleString("pt-BR") : "—";

export function relativeTime(value: string, now: number = Date.now()) {
  const seconds = Math.round((now - new Date(value).getTime()) / 1000);
  if (seconds < 60) return "agora";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `há ${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `há ${hours} h`;
  const days = Math.round(hours / 24);
  return `há ${days} ${days === 1 ? "dia" : "dias"}`;
}

export const dateInputValue = (value: string | null | undefined) =>
  value ? new Date(value).toISOString().slice(0, 10) : "";

export const selectClass =
  "h-10 min-w-0 rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-2 focus-visible:outline-ring";

export const developerTabs = ["dashboard", "planos", "financeiro", "helpdesk"] as const;
export type DeveloperTab = (typeof developerTabs)[number];

import type { Movimentacao } from "@/routes/projetos.$id.financeiro";

const storageKey = (projectId: string) => `arremataflow:financial:${projectId}`;
export const FINANCIAL_MOVEMENTS_UPDATED = "arremataflow:financial-movements-updated";

export function getLocalFinancialMovements(projectId: string): Movimentacao[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(storageKey(projectId)) || "[]") as Movimentacao[];
  } catch {
    return [];
  }
}

export function saveLocalFinancialMovements(projectId: string, movements: Movimentacao[]) {
  localStorage.setItem(storageKey(projectId), JSON.stringify(movements));
  window.dispatchEvent(new CustomEvent(FINANCIAL_MOVEMENTS_UPDATED, { detail: { projectId } }));
}

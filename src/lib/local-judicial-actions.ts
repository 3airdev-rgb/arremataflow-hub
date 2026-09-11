export type LocalJudicialAction = {
  id?: string;
  tipo_acao: string;
  numero_processo: string;
  vara: string;
  ultima_movimentacao: string | null;
};

const storageKey = (projectId: string) => `arremataflow:project:${projectId}:judicial-actions`;

export function getLocalJudicialActions(projectId: string): LocalJudicialAction[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(storageKey(projectId)) || "[]") as LocalJudicialAction[];
  } catch {
    return [];
  }
}

export function setLocalJudicialActions(projectId: string, actions: LocalJudicialAction[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(storageKey(projectId), JSON.stringify(actions));
}

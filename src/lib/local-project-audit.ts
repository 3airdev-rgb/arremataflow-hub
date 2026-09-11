import { getCurrentLocalUser } from "@/lib/local-access";

export type ProjectAuditEvent = {
  id: string;
  projectId: string;
  userId: string;
  userName: string;
  action: string;
  category: "Inclusão" | "Edição" | "Exclusão" | "Documento" | "Relatório" | "Impressão" | "Acesso";
  createdAt: string;
};

const storageKey = (projectId: string) => `arremataflow:project:${projectId}:audit`;
export const PROJECT_AUDIT_UPDATED = "arremataflow:project-audit-updated";

export function getProjectAudit(projectId: string): ProjectAuditEvent[] {
  if (typeof window === "undefined") return [];
  try {
    return (JSON.parse(localStorage.getItem(storageKey(projectId)) || "[]") as ProjectAuditEvent[])
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  } catch {
    return [];
  }
}

export function logProjectAudit(
  projectId: string,
  action: string,
  category: ProjectAuditEvent["category"],
) {
  if (typeof window === "undefined") return;
  const user = getCurrentLocalUser();
  const event: ProjectAuditEvent = {
    id: `audit-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    projectId,
    userId: user.id,
    userName: user.nome,
    action,
    category,
    createdAt: new Date().toISOString(),
  };
  localStorage.setItem(storageKey(projectId), JSON.stringify([event, ...getProjectAudit(projectId)]));
  window.dispatchEvent(new CustomEvent(PROJECT_AUDIT_UPDATED, { detail: { projectId } }));
}

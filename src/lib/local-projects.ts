export type LocalProject = {
  id: string;
  codigo: string;
  nome: string;
  endereco: string;
  cidade: string;
  etapa: string;
  status: string;
  responsavel: string;
  investidores: string[];
  foto: string | null;
  updated_at: string;
  [key: string]: unknown;
};

const STORAGE_KEY = "arremataflow:projects";

export function getLocalProjects(): LocalProject[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]") as LocalProject[];
  } catch {
    return [];
  }
}

export function saveLocalProject(project: LocalProject) {
  const projects = getLocalProjects();
  localStorage.setItem(STORAGE_KEY, JSON.stringify([project, ...projects.filter((item) => item.id !== project.id)]));
}

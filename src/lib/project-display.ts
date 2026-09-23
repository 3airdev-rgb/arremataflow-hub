export type StatusKey =
  "atrasado" | "pendente" | "aguardando" | "andamento" | "nao_iniciado" | "concluido";

export const statusLabels: Record<StatusKey, string> = {
  atrasado: "Atrasado",
  pendente: "Pendente",
  aguardando: "Aguardando terceiro",
  andamento: "Em andamento",
  nao_iniciado: "Não iniciado",
  concluido: "Concluído",
};

export const statusPriority: Record<StatusKey, number> = {
  atrasado: 1,
  pendente: 2,
  aguardando: 3,
  andamento: 4,
  nao_iniciado: 5,
  concluido: 6,
};

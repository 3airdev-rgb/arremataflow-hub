type Movement = { type: string; amount: string | number | null };
type ProjectWithData = { data: Record<string, unknown> };

const sum = (values: Array<string | number | null>) =>
  values.reduce<number>((total, value) => total + (Number(value) || 0), 0);

/**
 * Totais do fluxo de caixa. Aquisição é a soma do valor de aquisição cadastrado nos projetos
 * do relatório; capital investido é a aquisição somada a todas as despesas listadas.
 */
export function cashFlowSummary(movements: Movement[], projects: ProjectWithData[]) {
  const credits = sum(movements.filter((item) => item.type === "receita").map((i) => i.amount));
  const debits = sum(movements.filter((item) => item.type === "despesa").map((i) => i.amount));
  const acquisition = sum(projects.map((project) => Number(project.data["valor_aquisicao"])));
  return { credits, debits, acquisition, capitalInvested: acquisition + debits };
}

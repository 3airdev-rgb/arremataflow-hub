export type StatusKey = "atrasado" | "pendente" | "aguardando" | "andamento" | "nao_iniciado" | "concluido";

export const statusLabels: Record<StatusKey, string> = {
  atrasado: "Atrasado", pendente: "Pendente", aguardando: "Aguardando terceiro",
  andamento: "Em andamento", nao_iniciado: "Não iniciado", concluido: "Concluído",
};

export const statusPriority: Record<StatusKey, number> = {
  atrasado: 1, pendente: 2, aguardando: 3, andamento: 4, nao_iniciado: 5, concluido: 6,
};

export type Projeto = {
  id: string; codigo: string; nome: string; endereco: string; cidade: string;
  etapa: string; status: StatusKey; responsavel: string; modalidade: string;
  matricula: string; area: string; land_area?: number; built_area?: number;
  total_area?: number; valorAquisicao: number; dataAquisicao: string;
  capitalInvestido: number; honorarios: number; resultadoProjetado: number;
  progresso: number; foto: string; fotos: string[]; investidores: string[];
  assessores: string[]; updated_at: string;
};

export type Tarefa = {
  id: string; titulo: string; projeto: string; responsavel: string; prazo: string;
  status: StatusKey; categoria: string;
};

export type Documento = {
  id: string; nome: string; categoria: string; versao: string; autor: string;
  data: string; tamanho: string;
};

export type Movimentacao = {
  id: string; descricao: string; categoria: string; data: string; valor: number;
  status: StatusKey; comprovanteUrl?: string;
};

export const categoriasDocumentos = [
  "Aquisição", "Cartório", "Prefeitura", "Condomínio", "Jurídico", "Obra", "Financeiro", "Venda",
];

// Coleções vazias: os dados do ambiente devem vir exclusivamente da fonte persistente.
export const projetos: Projeto[] = [];
export const tarefas: Tarefa[] = [];
export const documentos: Documento[] = [];
export const receitas: Movimentacao[] = [];
export const despesas: Movimentacao[] = [];
export const distribuicao: Array<{ participante: string; tipo: string; percentual: number; valor: number }> = [];
export const usuarios: Array<{ id: string; nome: string; email: string; perfil: string; status: string }> = [];
export const movimentacoesRecentes: Array<{ id: string; texto: string; projeto: string; quando: string }> = [];
export const alertasCriticos: Array<{ id: string; texto: string; projeto: string; nivel: StatusKey; enviadoEm: string }> = [];
export const pipeline: Array<{ etapa: string; itens: Array<{ codigo: string; nome: string; status: StatusKey }> }> = [];

export const kpis = {
  projetosAtivos: 0, regularizacoes: 0, pendencias: 0, possePendente: 0, reformas: 0,
  aVenda: 0, capitalInvestido: 0, honorarios: 0, resultadoProjetado: 0, resultadoRealizado: 0,
};

export const formatBRL = (value: number) =>
  value.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

export const formatBRLWithCents = (value: number) =>
  value.toLocaleString("pt-BR", {
    style: "currency", currency: "BRL", minimumFractionDigits: 2, maximumFractionDigits: 2,
  });

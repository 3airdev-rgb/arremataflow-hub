export type StatusKey =
  | "atrasado"
  | "pendente"
  | "aguardando"
  | "andamento"
  | "nao_iniciado"
  | "concluido";

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

export type Projeto = {
  id: string;
  codigo: string;
  nome: string;
  endereco: string;
  cidade: string;
  etapa: string;
  status: StatusKey;
  responsavel: string;
  modalidade: string;
  matricula: string;
  area: string;
  land_area?: number;
  built_area?: number;
  total_area?: number;
  valorAquisicao: number;
  dataAquisicao: string;
  capitalInvestido: number;
  honorarios: number;
  resultadoProjetado: number;
  progresso: number;
  foto: string;
  fotos: string[];
  investidores: string[];
  assessores: string[];
  updated_at: string;
};

const foto = (seed: string) => `https://images.unsplash.com/${seed}?auto=format&fit=crop&w=1200&q=70`;

export const projetos: Projeto[] = [
  {
    id: "1",
    codigo: "AF-2026-018",
    nome: "Residencial Vila Mariana",
    endereco: "Rua Domingos de Morais, 1240 - Apto 82",
    cidade: "São Paulo / SP",
    etapa: "Regularização",
    status: "andamento",
    responsavel: "Camila Andrade",
    modalidade: "Assessoria Completa",
    matricula: "128.442 - 5º CRI SP",
    area: "78 m²",
    land_area: 120,
    built_area: 78,
    total_area: 78,
    valorAquisicao: 412000,
    dataAquisicao: "12/03/2026",
    capitalInvestido: 468500,
    honorarios: 41200,
    resultadoProjetado: 187000,
    progresso: 62,
    foto: foto("photo-1560448204-e02f11c3d0e2"),
    fotos: [
      foto("photo-1560448204-e02f11c3d0e2"),
      foto("photo-1502672260266-1c1ef2d93688"),
      foto("photo-1493809842364-78817add7ffb"),
      foto("photo-1484154218962-a197022b5858"),
    ],
    investidores: ["Marcos Ribeiro", "Fundo Atlas"],
    assessores: ["Camila Andrade", "Dr. Paulo Tavares"],
    updated_at: new Date().toISOString(),
  },
  {
    id: "2",
    codigo: "AF-2026-021",
    nome: "Casa Jardim Botânico",
    endereco: "Rua das Palmeiras, 305",
    cidade: "Curitiba / PR",
    etapa: "Posse",
    status: "aguardando",
    responsavel: "Rafael Lima",
    modalidade: "Assessoria Jurídica",
    matricula: "44.902 - 2º CRI CWB",
    area: "160 m²",
    land_area: 250,
    built_area: 160,
    total_area: 160,
    valorAquisicao: 690000,
    dataAquisicao: "02/02/2026",
    capitalInvestido: 742000,
    honorarios: 69000,
    resultadoProjetado: 245000,
    progresso: 38,
    foto: foto("photo-1568605114967-8130f3a36994"),
    fotos: [
      foto("photo-1568605114967-8130f3a36994"),
      foto("photo-1600585154340-be6161a56a0c"),
      foto("photo-1600607687939-ce8a6c25118c"),
    ],
    investidores: ["Ana Beatriz Souza"],
    assessores: ["Rafael Lima"],
    updated_at: new Date(Date.now() - 86400000).toISOString(),
  },
  {
    id: "3",
    codigo: "AF-2026-009",
    nome: "Cobertura Boa Viagem",
    endereco: "Av. Boa Viagem, 4820 - Cob. 01",
    cidade: "Recife / PE",
    etapa: "Reforma",
    status: "atrasado",
    responsavel: "Juliana Prado",
    modalidade: "Assessoria Completa",
    matricula: "91.334 - 1º CRI REC",
    area: "212 m²",
    valorAquisicao: 1250000,
    dataAquisicao: "18/11/2025",
    capitalInvestido: 1398000,
    honorarios: 125000,
    resultadoProjetado: 430000,
    progresso: 71,
    foto: foto("photo-1512917774080-9991f1c4c750"),
    fotos: [
      foto("photo-1512917774080-9991f1c4c750"),
      foto("photo-1600566753086-00f18fb6b3ea"),
      foto("photo-1600210492486-724fe5c67fb0"),
    ],
    investidores: ["Fundo Atlas", "Pedro Nogueira"],
    assessores: ["Juliana Prado", "Dr. Paulo Tavares"],
    updated_at: new Date(Date.now() - 172800000).toISOString(),
  },
  {
    id: "4",
    codigo: "AF-2025-104",
    nome: "Galpão Industrial Betim",
    endereco: "Rod. Fernão Dias, km 492",
    cidade: "Betim / MG",
    etapa: "Venda",
    status: "concluido",
    responsavel: "Camila Andrade",
    modalidade: "Assessoria Operacional",
    matricula: "12.887 - CRI Betim",
    area: "1.400 m²",
    valorAquisicao: 2100000,
    dataAquisicao: "05/07/2025",
    capitalInvestido: 2245000,
    honorarios: 210000,
    resultadoProjetado: 612000,
    progresso: 100,
    foto: foto("photo-1553413077-190dd305871c"),
    fotos: [foto("photo-1553413077-190dd305871c"), foto("photo-1581094794329-c8112a89af12")],
    investidores: ["Fundo Atlas"],
    assessores: ["Camila Andrade"],
    updated_at: new Date(Date.now() - 259200000).toISOString(),
  },
  {
    id: "5",
    codigo: "AF-2026-025",
    nome: "Apartamento Moinhos de Vento",
    endereco: "Rua Padre Chagas, 210 - Apto 501",
    cidade: "Porto Alegre / RS",
    etapa: "Aquisição",
    status: "pendente",
    responsavel: "Rafael Lima",
    modalidade: "Assessoria Completa",
    matricula: "77.201 - 3º CRI POA",
    area: "95 m²",
    valorAquisicao: 585000,
    dataAquisicao: "28/06/2026",
    capitalInvestido: 601000,
    honorarios: 58500,
    resultadoProjetado: 162000,
    progresso: 12,
    foto: foto("photo-1522708323590-d24dbb6b0267"),
    fotos: [foto("photo-1522708323590-d24dbb6b0267"), foto("photo-1505691938895-1758d7feb511")],
    investidores: ["Marcos Ribeiro"],
    assessores: ["Rafael Lima"],
  },
  {
    id: "6",
    codigo: "AF-2026-030",
    nome: "Sobrado Alphaville",
    endereco: "Alameda Araguaia, 88",
    cidade: "Barueri / SP",
    etapa: "Regularização",
    status: "nao_iniciado",
    responsavel: "Juliana Prado",
    modalidade: "Assessoria Jurídica",
    matricula: "55.610 - CRI Barueri",
    area: "245 m²",
    valorAquisicao: 980000,
    dataAquisicao: "10/08/2026",
    capitalInvestido: 995000,
    honorarios: 98000,
    resultadoProjetado: 310000,
    progresso: 5,
    foto: foto("photo-1580587771525-78b9dba3b914"),
    fotos: [foto("photo-1580587771525-78b9dba3b914"), foto("photo-1613490493576-7fde63acd811")],
    investidores: ["Ana Beatriz Souza", "Pedro Nogueira"],
    assessores: ["Juliana Prado"],
  },
];

export const kpis = {
  projetosAtivos: 18,
  regularizacoes: 11,
  pendencias: 7,
  possePendente: 4,
  reformas: 3,
  aVenda: 5,
  capitalInvestido: 6449500,
  honorarios: 601700,
  resultadoProjetado: 1946000,
  resultadoRealizado: 612000,
};

export type Tarefa = {
  id: string;
  titulo: string;
  projeto: string;
  responsavel: string;
  prazo: string;
  status: StatusKey;
  categoria: string;
};

export const tarefas: Tarefa[] = [
  { id: "t1", titulo: "Protocolar averbação da carta de arrematação", projeto: "AF-2026-018", responsavel: "Camila Andrade", prazo: "Hoje", status: "atrasado", categoria: "Regularização" },
  { id: "t2", titulo: "Solicitar certidão negativa de IPTU", projeto: "AF-2026-018", responsavel: "Rafael Lima", prazo: "Hoje", status: "andamento", categoria: "Prefeitura" },
  { id: "t3", titulo: "Agendar vistoria de imissão na posse", projeto: "AF-2026-021", responsavel: "Juliana Prado", prazo: "18/08/2026", status: "aguardando", categoria: "Posse" },
  { id: "t4", titulo: "Aprovar orçamento de reforma - hidráulica", projeto: "AF-2026-009", responsavel: "Camila Andrade", prazo: "20/08/2026", status: "pendente", categoria: "Obra" },
  { id: "t5", titulo: "Enviar relatório mensal aos investidores", projeto: "AF-2025-104", responsavel: "Rafael Lima", prazo: "31/08/2026", status: "nao_iniciado", categoria: "Financeiro" },
  { id: "t6", titulo: "Quitar débitos condominiais pendentes", projeto: "AF-2026-021", responsavel: "Juliana Prado", prazo: "14/08/2026", status: "concluido", categoria: "Condomínio" },
];

export type Documento = {
  id: string;
  nome: string;
  categoria: string;
  versao: string;
  autor: string;
  data: string;
  tamanho: string;
};

export const categoriasDocumentos = [
  "Aquisição",
  "Cartório",
  "Prefeitura",
  "Condomínio",
  "Jurídico",
  "Obra",
  "Financeiro",
  "Venda",
];

export const documentos: Documento[] = [
  { id: "d1", nome: "Carta de Arrematação.pdf", categoria: "Aquisição", versao: "v2", autor: "Camila Andrade", data: "14/03/2026", tamanho: "1,2 MB" },
  { id: "d2", nome: "Matrícula Atualizada.pdf", categoria: "Cartório", versao: "v1", autor: "Rafael Lima", data: "20/03/2026", tamanho: "840 KB" },
  { id: "d3", nome: "Certidão Negativa IPTU.pdf", categoria: "Prefeitura", versao: "v1", autor: "Camila Andrade", data: "02/04/2026", tamanho: "310 KB" },
  { id: "d4", nome: "Declaração de Quitação Condominial.pdf", categoria: "Condomínio", versao: "v3", autor: "Juliana Prado", data: "11/05/2026", tamanho: "220 KB" },
  { id: "d5", nome: "Petição de Imissão na Posse.docx", categoria: "Jurídico", versao: "v4", autor: "Dr. Paulo Tavares", data: "29/05/2026", tamanho: "96 KB" },
  { id: "d6", nome: "Orçamento Reforma - Consolidado.xlsx", categoria: "Obra", versao: "v2", autor: "Juliana Prado", data: "07/07/2026", tamanho: "512 KB" },
];

export type Movimentacao = {
  id: string;
  descricao: string;
  categoria: string;
  data: string;
  valor: number;
  status: StatusKey;
  comprovanteUrl?: string | undefined;
};

export const receitas: Movimentacao[] = [
  { id: "r1", descricao: "Aporte de investidor - Marcos Ribeiro", categoria: "Aporte", data: "12/03/2026", valor: 250000, status: "concluido" },
  { id: "r2", descricao: "Aporte de investidor - Fundo Atlas", categoria: "Aporte", data: "15/03/2026", valor: 218500, status: "concluido" },
  { id: "r3", descricao: "Sinal de venda", categoria: "Venda", data: "05/08/2026", valor: 60000, status: "andamento" },
];

export const despesas: Movimentacao[] = [
  { id: "e1", descricao: "Valor da arrematação", categoria: "Aquisição", data: "12/03/2026", valor: 412000, status: "concluido" },
  { id: "e2", descricao: "ITBI e emolumentos", categoria: "Tributos", data: "26/03/2026", valor: 18540, status: "concluido" },
  { id: "e3", descricao: "Débitos condominiais", categoria: "Condomínio", data: "11/05/2026", valor: 12360, status: "concluido" },
  { id: "e4", descricao: "Reforma - fase 1", categoria: "Obra", data: "22/06/2026", valor: 42800, status: "andamento" },
  { id: "e5", descricao: "Honorários de assessoria", categoria: "Honorários", data: "30/07/2026", valor: 41200, status: "pendente" },
];

export const distribuicao = [
  { participante: "Marcos Ribeiro", tipo: "Investidor", percentual: 45, valor: 84150 },
  { participante: "Fundo Atlas", tipo: "Investidor", percentual: 35, valor: 65450 },
  { participante: "ArremataFlow Assessoria", tipo: "Assessoria", percentual: 20, valor: 37400 },
];

export const usuarios = [
  { id: "u1", nome: "Camila Andrade", email: "camila@arremataflow.com", perfil: "Administrador", status: "Ativo" },
  { id: "u2", nome: "Rafael Lima", email: "rafael@arremataflow.com", perfil: "Assessor", status: "Ativo" },
  { id: "u3", nome: "Juliana Prado", email: "juliana@arremataflow.com", perfil: "Assessor", status: "Ativo" },
  { id: "u4", nome: "Dr. Paulo Tavares", email: "paulo@tavaresadv.com", perfil: "Jurídico", status: "Ativo" },
  { id: "u5", nome: "Marcos Ribeiro", email: "marcos.ribeiro@investidor.com", perfil: "Investidor", status: "Convite enviado" },
  { id: "u6", nome: "Ana Beatriz Souza", email: "ana.souza@investidor.com", perfil: "Investidor", status: "Ativo" },
  { id: "u7", nome: "Leilões Judiciais BR", email: "contato@leiloesjudiciais.com.br", perfil: "Leiloeiro", status: "Ativo" },
  { id: "u8", nome: "Zukerman Leilões", email: "atendimento@zukerman.com.br", perfil: "Leiloeiro", status: "Ativo" },
];

export const movimentacoesRecentes = [
  { id: "m1", texto: "Documento 'Matrícula Atualizada' publicado", projeto: "AF-2026-018", quando: "há 20 min" },
  { id: "m2", texto: "Despesa de R$ 42.800 registrada em Obra", projeto: "AF-2026-009", quando: "há 2 h" },
  { id: "m3", texto: "Tarefa 'Quitar débitos condominiais' concluída", projeto: "AF-2026-021", quando: "há 5 h" },
  { id: "m4", texto: "Proposta de venda recebida — R$ 2.850.000", projeto: "AF-2025-104", quando: "ontem" },
];

export const alertasCriticos = [
  { id: "a1", texto: "Averbação da carta de arrematação vencida há 3 dias", projeto: "AF-2026-018", nivel: "atrasado" as StatusKey },
  { id: "a2", texto: "Cronograma de obra com 12 dias de desvio", projeto: "AF-2026-009", nivel: "atrasado" as StatusKey },
  { id: "a3", texto: "Aguardando resposta do cartório há 9 dias", projeto: "AF-2026-021", nivel: "aguardando" as StatusKey },
];

export const pipeline: { etapa: string; itens: { codigo: string; nome: string; status: StatusKey }[] }[] = [
  {
    etapa: "Aquisição",
    itens: [{ codigo: "AF-2026-025", nome: "Apto Moinhos de Vento", status: "pendente" }],
  },
  {
    etapa: "Regularização",
    itens: [
      { codigo: "AF-2026-018", nome: "Residencial Vila Mariana", status: "andamento" },
      { codigo: "AF-2026-030", nome: "Sobrado Alphaville", status: "nao_iniciado" },
    ],
  },
  {
    etapa: "Posse",
    itens: [{ codigo: "AF-2026-021", nome: "Casa Jardim Botânico", status: "aguardando" }],
  },
  {
    etapa: "Reforma",
    itens: [{ codigo: "AF-2026-009", nome: "Cobertura Boa Viagem", status: "atrasado" }],
  },
  {
    etapa: "Venda",
    itens: [{ codigo: "AF-2025-104", nome: "Galpão Industrial Betim", status: "concluido" }],
  },
];

export const formatBRL = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

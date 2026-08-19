# Plan: Reestruturação da Navegação da Ficha do Projeto

Substituir o componente de abas (Tabs) da Ficha do Projeto por um painel de navegação baseado em botões organizados em duas linhas, conforme a PRD.

## User Review Required

> [!IMPORTANT]
> A navegação será alterada de abas horizontais para botões fixos em duas linhas (6 na primeira, 5 na segunda). O comportamento de SPA (carregamento dinâmico sem refresh) será mantido utilizando o estado das abas do Radix UI, mas com uma interface personalizada.

## Proposed Changes

### Ficha do Projeto (Hub)

#### [src/routes/projetos.$id.index.tsx]
- Substituir `TabsList` por um `div` customizado com grid responsivo.
- Implementar botões de navegação com estilo ArremataFlow:
  - **Linha 1 (6 botões):** Visão Geral, Regularização, Posse, Financeiro, Documentos, Tarefas.
  - **Linha 2 (5 botões):** Obra, Venda, Resultado, Distribuição de Resultados, Histórico.
- Aplicar estilos de estado ativo: fundo primário (#0F3D56), texto branco, sombra e borda destacada.
- Garantir responsividade:
  - **Desktop:** Grid 6 colunas (linha 1) e 5 colunas (linha 2).
  - **Tablet/Mobile:** Reorganização em múltiplas colunas (1 ou 2 em mobile) para evitar scroll horizontal.
- Manter o componente `Tabs` e `TabsContent` para preservar a lógica de troca de conteúdo sem refresh.

## Technical Details

- Utilizar `TabsTrigger` do Radix UI (via shadcn) estilizado como botão (usando `asChild` se necessário ou estilizando o próprio trigger) para manter a acessibilidade e o controle de estado.
- Tailwind Grid e Flexbox para a distribuição exata dos botões.
- Manter a função `slug` para mapeamento de valores das abas.
- Cores: `bg-brand` para o estado ativo e `bg-surface` com hover para o estado inativo.

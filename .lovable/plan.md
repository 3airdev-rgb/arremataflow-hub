# Plano de Implementação: Filtros na Gestão de Projetos

Este plano detalha a implementação de filtros por coluna para "Etapa" e "Status" na tela de Gestão de Projetos, permitindo a seleção de uma única condição por filtro.

## Alterações Propostas

### UI e Componentes
- Importar componentes `Select` da biblioteca UI.
- Adicionar seletores de filtro no cabeçalho da tabela ou próximo à barra de busca.
- Implementar estados para controlar a Etapa selecionada e o Status selecionado.

### Lógica de Filtragem
- Refinar a lógica de filtragem da lista de projetos para considerar:
    - O termo de busca textual (já existente).
    - A etapa selecionada (se houver).
    - O status selecionado (se houver).
- Garantir que a filtragem funcione tanto para os dados mockados quanto para os dados vindos do banco de dados (Supabase).

## Detalhes Técnicos

- **Arquivo:** `src/routes/projetos.index.tsx`
- **Componentes:** `Select`, `SelectTrigger`, `SelectValue`, `SelectContent`, `SelectItem`.
- **Estados:** `etapaFilter` (string), `statusFilter` (string).
- **Opções de Status:** Extraídas de `statusLabels` em `src/lib/mock-data.ts`.
- **Opções de Etapa:** Extraídas dinamicamente da lista de projetos (ex: Aquisição, Regularização, Posse, Reforma, Venda).

## Passos da Implementação
1. Modificar `src/routes/projetos.index.tsx` para incluir os novos estados e componentes de filtro.
2. Atualizar a lógica de `lista` (projetos mockados) e aplicar lógica similar para `salvos` (projetos do banco) ou unificar a exibição se apropriado.
3. Adicionar um botão "Limpar Filtros" para facilitar a navegação.

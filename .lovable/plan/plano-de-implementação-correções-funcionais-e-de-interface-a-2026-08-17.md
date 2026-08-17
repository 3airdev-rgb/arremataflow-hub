# Plano de Implementação - Correções Funcionais e de Interface ArremataFlow

Este plano detalha as alterações solicitadas para aprimorar a gestão de tarefas, o cadastro de projetos, as regras financeiras e a gestão de investidores no MVP do ArremataFlow.

## 1. Gestão de Tarefas
- **Reposicionamento do botão Editar**: Alterar a ordem dos elementos na listagem de tarefas (`src/routes/projetos.$id.tarefas.tsx`) para `Título → Responsável → Prazo → Status → Editar`. O botão será simplificado para o ícone de lápis + texto "Editar".
- **Date Picker**: Substituir o campo de texto de data na criação e edição de tarefas por um componente `Popover` + `Calendar` (Date Picker) do shadcn/ui.

## 2. Cadastro de Projeto
- **Modalidade de Assessoria**: Atualizar o `Select` em `src/routes/projetos.novo.tsx` com as opções: Assessoria Completa, Assessoria Parcial, Assessoria Jurídica, Assessoria Operacional e Consultoria Específica. O campo será marcado como obrigatório.
- **Nomenclatura**: Renomear a seção "Participantes" para "Investidores". O botão "Adicionar participante" será renomeado para "Adicionar investidor".

## 3. Regras Financeiras e Honorários (`src/routes/projetos.novo.tsx`)
- **Regra Assessoria Completa**: Implementar lógica para ocultar campos de honorários fixos/percentuais e preparar a estrutura para a nova regra (50% assessoria / 50% investidores).
- **Regra Assessoria Parcial**: Adicionar campo "Há valor mínimo de honorários?" (Radio Group). Se "Sim", exibir campo "Valor Mínimo". Implementar cálculo automático: `Aquisição × Percentual`, garantindo que o valor final seja o maior entre o calculado e o mínimo.
- **Nova Seção "Distribuição de Resultados"**: Adicionar uma nova aba ou seção na ficha do projeto (`src/routes/projetos.$id.index.tsx`) para exibir o cálculo do Resultado Líquido e a divisão entre empresa e investidores.

## 4. Gestão de Investidores
- **Busca Autocomplete**: Implementar um componente de busca dinâmica na seção de Investidores do cadastro de projeto. O usuário selecionará investidores existentes em uma lista de sugestões baseada no `usuarios` mock data.
- **Vínculo**: Após selecionar, exibir apenas Nome e o campo de Percentual de Participação. Permitir a adição de múltiplos investidores.

## Detalhes Técnicos
- **Componentes**: Utilização de `Popover`, `Calendar` e `RadioGroup` do shadcn/ui.
- **Estado**: Gerenciamento de estado local (`useState`) para as regras condicionais de honorários e busca de investidores.
- **Mock Data**: Atualização de `src/lib/mock-data.ts` se necessário para suportar as novas modalidades e campos.
- **Localização**: As datas serão formatadas no padrão brasileiro (dd/mm/aaaa).

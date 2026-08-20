# Plano de Implementação: Refinamento do Cadastro de Tarefas

Ajustar a funcionalidade de tarefas para restringir a seleção de responsáveis e participantes apenas a usuários vinculados ao projeto (assessores e investidores), implementando componentes de seleção adequados (dropdown e multi-select com autocomplete) e garantindo a persistência correta dos dados.

## Alterações Propostas

### 1. Componente de Seleção Múltipla (`src/components/ui/multi-select.tsx`)
- Adicionar suporte a identificação do vínculo (opcional) nos itens e chips.
- Garantir que a pesquisa dinâmica funcione corretamente.

### 2. Gestão de Tarefas (`src/routes/projetos.$id.tarefas.tsx`)

#### Lógica de Dados
- Refinar o carregamento de `participantesProjeto` para incluir o tipo de vínculo (Assessor ou Investidor).
- Implementar verificação: se não houver participantes vinculados, desabilitar campos e exibir mensagem de aviso.

#### Interface (Modal Nova/Editar Tarefa)
- **Campo Responsável**:
    - Substituir `Input` por `Select` (Dropdown).
    - Listar apenas os participantes carregados.
    - Tornar o campo obrigatório.
- **Campo Participantes da Reunião**:
    - Exibir apenas se "Reunião Online" for "Sim".
    - Utilizar `MultiSelect` com os mesmos participantes.
    - Adicionar validação para exigir pelo menos um participante se for reunião online.
- **Persistência**:
    - Garantir que ao salvar/editar, os participantes sejam vinculados na tabela `task_meeting_participants`.

## Detalhes Técnicos
- Utilizar `projeto_participantes` e `project_managers` como fontes de dados.
- Manter compatibilidade com UUIDs e evitar erros em projetos de demonstração (mock).
- Respeitar a estrutura da tabela `task_meeting_participants`: `task_id`, `participant_id`, `participant_type`.

## Critérios de Aceite
- Somente participantes vinculados podem ser selecionados.
- Responsável é seleção única via dropdown.
- Participantes são seleção múltipla via chips/autocomplete.
- O sistema impede duplicados e exige participantes em reuniões online.

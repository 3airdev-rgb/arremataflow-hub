# PRD – Ajustes no Modal "Nova Tarefa"

Atualizar o modal Nova Tarefa para incluir classificação por categoria e permitir o cadastro de reuniões online com campos específicos e participantes vinculados ao projeto.

## User Review Required

> [!IMPORTANT]
> A implementação requer alterações no banco de dados para suportar os novos campos de tarefas e reuniões online.

- Confirma a lista de categorias: Aquisição, Cartório, Prefeitura, Condomínio, Jurídico, Obra, Financeiro, Venda?
- A seleção de participantes deve incluir apenas pessoas já vinculadas ao projeto (investidores e assessores)?

## Proposed Changes

### Database Schema (Supabase)

- Adicionar colunas à tabela `tarefas` (a ser criada ou atualizada):
  - `category` (TEXT, NOT NULL)
  - `is_online_meeting` (BOOLEAN, DEFAULT FALSE)
  - `meeting_url` (TEXT)
  - `meeting_time` (TEXT/TIME)
- Criar tabela `task_meeting_participants`:
  - `id` (UUID, PRIMARY KEY)
  - `task_id` (UUID, REFERENCES tarefas)
  - `participant_id` (UUID, REFERENCES pessoas)
  - `participant_type` (TEXT)

### Frontend Components

#### Task Route (`src/routes/projetos.$id.tarefas.tsx`)
- Refatorar o modal "Nova Tarefa" para seguir o novo layout:
  - **Linha 1**: Campo "Categoria" (Dropdown obrigatório).
  - **Linha 2**: Título.
  - **Linha 3**: Responsável e Prazo (grid).
  - **Linha 4**: Toggle "Esta tarefa é uma reunião online?".
  - **Seção Condicional "Informações da Reunião"**:
    - Link da Reunião (URL com validação).
    - Horário da Reunião (Time Picker).
    - Participantes (Autocomplete multisseleção com chips).
  - **Linha 7**: Descrição.

### Business Logic
- Validação de URL para o link da reunião.
- Validação de campos obrigatórios quando `is_online_meeting` é verdadeiro.
- Persistência dos dados no Supabase.

## Technical Details

- **Zod Validation**: Atualizar o schema de validação da tarefa para incluir os novos campos e validações condicionais (`superRefine`).
- **Multi-select Component**: Utilizar um componente de `Command` ou `Select` múltiplo para os participantes.
- **Time Picker**: Implementar ou utilizar um seletor de horário compatível com o design system.
- **Grants**: Adicionar `GRANT` para a nova tabela `task_meeting_participants`.

```sql
ALTER TABLE public.tarefas ADD COLUMN IF NOT EXISTS category TEXT NOT NULL DEFAULT 'Geral';
ALTER TABLE public.tarefas ADD COLUMN IF NOT EXISTS is_online_meeting BOOLEAN DEFAULT FALSE;
ALTER TABLE public.tarefas ADD COLUMN IF NOT EXISTS meeting_url TEXT;
ALTER TABLE public.tarefas ADD COLUMN IF NOT EXISTS meeting_time TEXT;

CREATE TABLE public.task_meeting_participants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id UUID REFERENCES public.tarefas(id) ON DELETE CASCADE,
    participant_id UUID REFERENCES public.pessoas(id) ON DELETE CASCADE,
    participant_type TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.task_meeting_participants TO authenticated;
GRANT ALL ON public.task_meeting_participants TO service_role;
```

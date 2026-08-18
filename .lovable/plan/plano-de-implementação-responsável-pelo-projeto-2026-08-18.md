# Plano de Implementação – Responsável pelo Projeto

Adicionar a seção "Responsável pelo Projeto" no cadastro de projetos, permitindo vincular assessores cadastrados como responsáveis operacionais, sem impacto nas regras financeiras.

## Alterações

### Banco de Dados (Supabase)
- Criar a tabela `project_managers` para persistir o vínculo entre projetos e assessores (responsáveis).
- Habilitar RLS e adicionar políticas para permitir que usuários autenticados gerenciem os vínculos de seus projetos.
- Conceder permissões à API de Dados (`authenticated`, `service_role`).

### Interface do Usuário (Frontend)
- **Componente de Cadastro de Projeto (`projetos.novo.tsx`)**:
  - Adicionar novo estado `responsaveisVinculados` (lista de nomes/IDs).
  - Implementar a nova seção "Responsável pelo Projeto" abaixo da seção "Investidores".
  - Reutilizar o componente de autocomplete/busca já existente para selecionar assessores.
  - Integrar o botão "Cadastrar novo assessor" para abrir o modal de cadastro unificado.
  - Exibir a lista de responsáveis selecionados com opção de remoção.
  - Atualizar a função `onSubmit` para persistir os vínculos na nova tabela `project_managers`.

### Visualização e Listagem
- **Dashboard e Ficha do Projeto**:
  - Atualizar as visualizações para listar os responsáveis vinculados ao projeto.

## Detalhes Técnicos

### SQL
```sql
CREATE TABLE public.project_managers (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id uuid NOT NULL REFERENCES public.projetos(id) ON DELETE CASCADE,
    assessor_id uuid NOT NULL REFERENCES public.pessoas(id) ON DELETE CASCADE,
    created_at timestamptz DEFAULT now() NOT NULL,
    user_id uuid NOT NULL REFERENCES auth.users(id) DEFAULT auth.uid()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_managers TO authenticated;
GRANT ALL ON public.project_managers TO service_role;

ALTER TABLE public.project_managers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage managers for their own projects"
ON public.project_managers
FOR ALL
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.projetos 
        WHERE id = project_managers.project_id 
        AND user_id = auth.uid()
    )
);
```

# Plano de Implementação - Edição de Projetos

Implementar a funcionalidade completa de edição de projetos, permitindo que o usuário altere todas as informações de um projeto existente (Imóvel, Fotos, Aquisição, Assessoria, Investidores e Responsáveis) através da mesma interface utilizada para criação.

## Tarefas

1.  **Refatorar Componentes Compartilhados**:
    *   Substituir a declaração local de `SectionCard` em `src/routes/_authenticated/projetos.novo.tsx` pelo componente centralizado em `src/components/project-form-section-card.tsx`.

2.  **Implementar Rota de Edição (`src/routes/_authenticated/projetos.$id.editar.tsx`)**:
    *   **Carregamento de Dados**: Buscar o projeto, seus participantes (`projeto_participantes`), responsáveis (`project_managers`) e metadados de fotos (`projeto_fotos`) do banco de dados.
    *   **Interface do Usuário**: Replicar a estrutura do formulário de criação (seções de Imóvel, Aquisição, Assessoria, Investidores e Responsável).
    *   **Lógica de Negócio**: Portar os hooks de cálculo (honorários, comissão, parcelas) e a lógica de autocomplete/cadastro rápido.
    *   **Persistência**: Implementar o `onSubmit` para atualizar o registro do projeto e sincronizar as tabelas relacionadas (limpar e reinserir participantes/responsáveis).

3.  **Ajustes de Navegação**:
    *   Garantir que o botão "Editar Projeto" na ficha do projeto redirecione corretamente para a nova rota.

## Detalhes Técnicos

*   **Sincronização de Participantes**: No salvamento, os registros antigos em `projeto_participantes` e `project_managers` para o ID do projeto atual serão removidos e os novos (selecionados no formulário) serão inseridos, garantindo integridade.
*   **Gestão de Imagens**: O componente `ImageManagementSection` será inicializado com as URLs e metadados das fotos já existentes no banco.
*   **Tipagem**: Uso dos tipos gerados pelo Supabase para garantir que todos os campos (`land_area`, `built_area`, etc.) sejam persistidos corretamente.

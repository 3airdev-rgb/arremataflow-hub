# PRD – Reestruturação do Menu Principal e Módulo de Relatórios

Reorganizar o menu lateral para focar no fluxo centrado em Projetos e implementar um novo módulo de Relatórios organizado por categorias e filtros.

## Alterações de Interface

### 1. Novo Menu Lateral
- **Dashboard** (Mantido)
- **Projetos** (Mantido)
- **Investidores** (Mantido)
- **Assessores** (Mantido)
- **Relatórios** (Novo item com ícone `FileBarChart`)
- **Notificações** (Mantido)
- **Configurações** (Mantido)

### 2. Remoção de Itens (Acessíveis via Projetos)
Os seguintes itens serão removidos do menu principal, mas continuam acessíveis nas abas da ficha do projeto:
- Imóveis, Tarefas, Documentos, Regularização, Posse, Obras, Financeiro, Resultados, Perfil.

### 3. Tela de Relatórios (`/relatorios`)
Uma nova tela contendo:
- **Busca e Filtros:** Pesquisa por nome, filtros por Categoria, Período, Projeto, Investidor e Assessor.
- **Categorias de Relatórios:**
    - **Financeiro:** Receitas, Despesas, Fluxo de caixa, Honorários, Distribuição de resultados, Capital investido.
    - **Operacional:** Atividades, Tarefas, Projetos (em andamento, encerrados, modalidade, status).
    - **Auditoria:** Histórico de ações, Alterações financeiras/percentuais, Log.
    - **Contratos:** Assessoria, Investimento, Termos e documentos vinculados.
    - **Cadastros:** Usuários, Investidores, Assessores, Projetos.
    - **Documentos:** Relação, Pendentes, Vencidos, Por categoria.
- **Ações:** Botões para Visualizar, Exportar PDF e Exportar Excel.

## Detalhes Técnicos

### 1. Navegação
- Atualizar `src/components/app-layout.tsx` para refletir a nova lista `nav`.
- Criar a rota `src/routes/relatorios.tsx`.

### 2. Componente de Relatórios
- Desenvolver um sistema de cards para os relatórios, agrupados por seções colapsáveis ou abas laterais.
- Implementar a barra de ferramentas superior com os filtros solicitados.

### 3. Persistência
- Não há mudanças no banco de dados necessárias para esta fase de visualização (reorganização de menus e mock da tela de relatórios).
- As permissões mencionadas serão simuladas via UI nesta etapa.

```text
Menu Lateral:
[Dashboard]
[Projetos]
[Investidores]
[Assessores]
[Relatórios] (Novo)
[Notificações]
[Configurações]
```

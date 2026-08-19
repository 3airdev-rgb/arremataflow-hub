# Plan - Reformulação da Aba "Posse"

Reformular a aba "Posse" da ficha do projeto para permitir controle detalhado da ocupação, datas e custos, com persistência no banco de dados e integração com o sistema de arquivos.

## Alterações Técnicas

### Banco de Dados
- Criar migração para adicionar os campos necessários na tabela `public.projetos`:
    - `occupancy_status` (text)
    - `possession_action_required` (boolean)
    - `expected_possession_date` (date)
    - `possession_completed_date` (date)
    - `legal_costs` (numeric)
    - `bailiff_costs` (numeric)
    - `locksmith_security_costs` (numeric)
    - `settlement_costs` (numeric)

### Componentes
- Criar `src/components/posse-tab-form.tsx`:
    - Formulário dividido em dois painéis: "Situação da Posse" e "Custos da Posse".
    - Implementar máscaras monetárias e seletores (Dropdown, Switch para Sim/Não, Date Picker).
    - Botão "Salvar Alterações" com feedback via `sonner` e sincronização com Supabase.
    - Sincronização de custos com o módulo financeiro (opcional, conforme PRD anterior de Regularização).

### Integração
- Atualizar `src/routes/projetos.$id.index.tsx` para renderizar o novo componente na aba de Posse.
- Reutilizar `SectionCard` e componentes de UI do Shadcn.

## Critérios de Aceitação
- Dropdown de ocupação com opções: Desocupada, Ocupada pelo ex-proprietário, Ocupada por terceiros.
- Seletor Sim/Não para Ação de Imissão.
- Date Pickers para datas prevista e realizada.
- Campos monetários com máscara R$ (Custas, Oficial, Chaveiro/Segurança, Indenização).
- Persistência funcional no Lovable Cloud.

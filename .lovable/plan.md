# Plano para Implementação da Nova Movimentação Financeira

Adição de campos de identificação (CPF/CNPJ) ao modal de movimentação financeira, com suporte a máscaras dinâmicas, validação e persistência no banco de dados.

## Alterações de Banco de Dados

- Criar tabela `movimentacoes_financeiras` para substituir o uso de dados mockados.
- Adicionar campos conforme PRD:
  - `document_holder_name` (text, opcional)
  - `document_holder_type` (text, 'Origem' ou 'Destinatário')
  - `document_holder_document` (text, CPF ou CNPJ)
  - `document_type` (text, 'CPF' ou 'CNPJ')
  - Campos padrão: `projeto_id`, `tipo`, `descricao`, `categoria`, `valor`, `data`, `status`, `comprovante_url`.

## Alterações no Frontend

### 1. Novo Componente de Máscara de Documento
- Criar utilitário para aplicar máscara de CPF (000.000.000-00) ou CNPJ (00.000.000/0000-00) automaticamente durante a digitação.
- Implementar validação de dígito verificador para ambos os documentos.

### 2. Atualização do Modal "Nova Movimentação"
- Inserir o novo campo imediatamente abaixo do campo "Descrição".
- Alterar o label dinamicamente:
  - Tipo = Despesa -> "Destinatário – CNPJ ou CPF"
  - Tipo = Receita -> "Origem – CNPJ ou CPF"
- Aplicar máscara dinâmica e validação em tempo real.
- Exibir mensagem de erro caso o documento seja inválido.

### 3. Persistência e Visualização
- Atualizar a lógica de salvamento para persistir os novos campos via Supabase.
- Atualizar as tabelas de Receitas e Despesas na página financeira para exibir a identificação (Origem/Destinatário) quando disponível.
- Garantir que a edição e visualização de movimentações também suportem os novos campos.

## Detalhes Técnicos

- **Caminho:** `src/routes/projetos.$id.financeiro.tsx`
- **Validação:** Utilização de regex e lógica de pesos para validação de documentos brasileiros.
- **Interface:** Manutenção dos padrões do Design System ArremataFlow (Petroleum Blue, Success Green).
- **Segurança:** Habilitar RLS na nova tabela e garantir GRANTs para usuários autenticados.

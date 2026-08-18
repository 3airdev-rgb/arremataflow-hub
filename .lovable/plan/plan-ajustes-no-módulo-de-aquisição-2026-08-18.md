# Plan - Ajustes no Módulo de Aquisição

Atualizar a seção de Aquisição no cadastro de projetos para incluir busca por autocomplete de leiloeiros, cadastro rápido via modal, cálculos automáticos de comissão e exibição condicional de dados de financiamento/parcelamento.

## User Review Required

> [!IMPORTANT]
> A remoção do campo "ITBI e Custas Estimadas" foi realizada conforme solicitado. Os cálculos de comissão e parcelas são feitos em tempo real no frontend para esta versão MVP.

## Proposed Changes

### Componente de Cadastro (Generalização)
- Atualizar `src/components/investor-registration-modal.tsx` para suportar o tipo "Leiloeiro".
- Adicionar campos específicos para leiloeiro: Website, Cidade e Estado (UF).
- Implementar máscaras automáticas para CPF/CNPJ e Telefone.

### Mock Data
- Adicionar leiloeiros de exemplo ao array `usuarios` em `src/lib/mock-data.ts` para testar o autocomplete.

### Cadastro de Projeto (`src/routes/projetos.novo.tsx`)
- **Remoção**: Excluir o campo "ITBI e Custas Estimadas".
- **Autocomplete de Leiloeiro**: Substituir o input de texto por um componente de busca que filtra por perfil "Leiloeiro".
- **Comissão**: Adicionar campos "Comissão (%)" e "Valor da Comissão (R$)" com cálculo automático em tempo real (Valor Aquisição * %).
- **Pagamento Dinâmico**: 
    - Exibir campos de Credor, Valor e Parcelas apenas se "Parcelado" ou "Financiado" for selecionado.
    - Calcular automaticamente o "Valor da Parcela (R$)" (Valor Total / Qtd Parcelas).
- **Modal**: Integrar o botão "Cadastrar novo leiloeiro" para abrir a modal configurada.

### Dashboard do Projeto (`src/routes/projetos.$id.index.tsx`)
- Ajustar a aba "Distribuição de Resultados" para refletir a nova lógica de cotas e assessoria de forma mais clara, removendo redundâncias observadas nos assessores.

## Technical Details
- Uso de `useMemo` para garantir que os cálculos reajam instantaneamente a qualquer mudança nos inputs de valor, percentual ou quantidade.
- Máscara de documento (CPF/CNPJ) baseada no comprimento da string de dígitos.
- Filtro de usuários por `perfil === 'Leiloeiro'` no componente de `Command` (autocomplete).

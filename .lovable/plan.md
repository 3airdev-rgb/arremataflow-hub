# Plan - Ajustes na Modalidade de Assessoria e Vinculação de Assessores

Este plano descreve as alterações no módulo de Cadastro de Projeto para gerenciar múltiplos assessores e implementar novas regras de honorários.

## User Review Required

> [!IMPORTANT]
> - A soma das participações dos assessores deve totalizar 100% por padrão.
> - A modalidade "Sem Assessoria" zerará e bloqueará os honorários.

## Proposed Changes

### 1. Cadastro de Projeto (`src/routes/projetos.novo.tsx`)
- **Modalidades**: Atualizar lista de opções (Completa, Parcial, Jurídica, Operacional, Consultoria, Sem Assessoria).
- **Gestão de Assessores**:
    - Remover campo único "Assessor Responsável".
    - Implementar seção "Assessores" com layout idêntico à seção "Investidores" (autocomplete, múltiplos vínculos, % participação).
    - Adicionar botão "Cadastrar novo assessor" (reutilizando ou estendendo o modal de registro).
- **Lógica Financeira Dinâmica**:
    - **Assessoria Completa**: Exibir apenas seção de assessores; ocultar campos de % honorário e mínimo.
    - **Parcial/Jurídica/Operacional/Consultiva**: Exibir % honorários (padrão 10%), rádio para valor mínimo e cálculo automático (maior entre % e mínimo).
    - **Sem Assessoria**: Ocultar seção de assessores e campos financeiros; definir e bloquear honorários em R$ 0,00.

### 2. Distribuição de Resultados (`src/routes/projetos.$id.index.tsx`)
- **Regra 50/50**: Para "Assessoria Completa", calcular 50% para investidores e 50% para assessores sobre o resultado líquido.
- **Divisão Proporcional**: Distribuir as parcelas entre múltiplos investidores e assessores com base nas cotas cadastradas.
- **Interface**: Atualizar a aba "Distribuição de Resultados" para refletir essas novas divisões e histórico.

### 3. Componentes e Mock Data
- **InvestorRegistrationModal**: Adaptar ou criar uma versão genérica para cadastrar assessores (ou adicionar flag `tipo`).
- **Mock Data**: Garantir que a lista de usuários (`usuarios`) suporte a busca por assessores.

## Technical Details
- Utilizar `useMemo` para cálculos em tempo real no formulário.
- Validar a soma dos percentuais de assessores antes da submissão.
- Reutilizar componentes de `Command` e `Popover` para o autocomplete de assessores.

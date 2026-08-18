# Ajuste de Layout da Seção "Aquisição"

Ajustar o layout da seção Aquisição no Cadastro de Projeto para melhorar o alinhamento visual dos campos (Leiloeiro, Comissão %, Valor Comissão R$) e otimizar o espaço, seguindo as proporções e requisitos de largura solicitados.

## User Review Required

> [!IMPORTANT]
> Os campos serão reorganizados para ficarem na mesma linha com as proporções sugeridas (60% / 15% / 25%). O botão "Cadastrar novo leiloeiro" será posicionado logo abaixo do campo de seleção do leiloeiro.

## Proposed Changes

### Cadastro de Projetos (Frontend)

#### [src/routes/projetos.novo.tsx]
- Reestruturar a linha que contém "Leiloeiro / Comitente", "Comissão do Leiloeiro (%)" e "Valor da Comissão (R$)".
- Utilizar classes Tailwind (`flex` ou `grid` com proporções específicas) para atingir a distribuição recomendada:
    - **Leiloeiro / Comitente**: ~60% da largura.
    - **Comissão do Leiloeiro (%)**: ~15% da largura.
    - **Valor da Comissão (R$)**: ~25% da largura.
- Redimensionar os campos de entrada para suportar os valores esperados (até 99,99% e até R$ 99.000.000,00).
- Posicionar o botão "Cadastrar novo leiloeiro" abaixo do campo de autocomplete.
- Garantir alinhamento vertical dos rótulos (Labels) e dos componentes de entrada.

## Technical Details

- Utilizar `flex-[0_0_60%]`, `flex-[0_0_15%]`, `flex-[0_0_25%]` ou um grid customizado `grid-cols-[6fr_1.5fr_2.5fr]` no container.
- Garantir que o `Popover` do autocomplete não quebre o layout ao ser expandido.
- Manter a responsividade ajustando para `flex-col` ou `grid-cols-1` em telas pequenas (mobile).

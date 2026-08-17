# Plano de Implementação: Cadastro de Investidor no Fluxo de Projeto

Este plano descreve a implementação de um modal de cadastro de investidor dentro da tela de criação de novo projeto, permitindo a captura detalhada de dados dos participantes.

## Alterações Sugeridas

### Frontend e UI
- **Modal de Cadastro de Investidor**: Criar um novo componente `InvestorRegistrationModal` que será acionado ao clicar em "Adicionar participante" ou em um novo botão específico na seção de Participantes.
- **Campos do Formulário**:
  - Nome Completo
  - CPF (com máscara básica se possível)
  - Data de Nascimento
  - Estado Civil (Select)
  - Endereço Completo (Textarea ou múltiplos campos)
  - Dados Bancários:
    - Banco
    - Agência
    - Conta Corrente
- **Integração no Fluxo**: 
  - Atualizar `src/routes/projetos.novo.tsx` para incluir o estado do modal e lidar com a submissão dos dados do investidor.
  - O investidor recém-cadastrado será adicionado à lista de participantes do projeto atual.

## Detalhes Técnicos
- Utilizar componentes do shadcn/ui (`Dialog`, `Input`, `Label`, `Select`) para manter a consistência visual.
- Gerenciar o estado do formulário do investidor localmente no componente do modal.
- Assegurar que os dados bancários sejam agrupados visualmente conforme solicitado.

## Considerações
- Como o projeto utiliza dados mockados no momento, o cadastro do investidor persistirá apenas no estado local do formulário de criação do projeto até que a integração com o banco de dados seja realizada futuramente.

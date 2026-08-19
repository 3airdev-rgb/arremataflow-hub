# Plano de Integração Financeiro e Gestão Documental

Este plano detalha as alterações necessárias para padronizar as categorias financeiras com a Gestão Documental, permitir o upload de comprovantes no lançamento de movimentações e automatizar o registro desses documentos no sistema.

## Alterações Propostas

### 1. Padronização de Categorias e Tipos
- Atualizar `src/lib/mock-data.ts` para incluir a propriedade `comprovanteUrl` na interface `Movimentacao`.
- Garantir que as categorias financeiras e de documentos utilizem a mesma lista: `Aquisição, Cartório, Prefeitura, Condomínio, Jurídico, Obra, Financeiro, Venda`.

### 2. Interface de Nova Movimentação (`src/routes/projetos.$id.financeiro.tsx`)
- Substituir o campo de texto "Categoria" por um `Select` com as opções padronizadas.
- Tornar o campo "Categoria" obrigatório.
- Adicionar um botão "Anexar Comprovante" com ícone de clipe ao lado do botão "Registrar".
- Implementar lógica de upload simulada (respeitando limites: 1 arquivo, máx 2MB, formatos PDF/JPG/JPEG/PNG/WEBP).
- Exibir mensagem de erro caso o arquivo seja inválido.

### 3. Integração Automática com Gestão Documental
- Ao registrar uma movimentação com comprovante:
  - Adicionar a movimentação à lista de receitas/despesas.
  - Criar automaticamente uma entrada na lista de documentos (`src/lib/mock-data.ts`) herdando: Projeto, Categoria, Descrição (como nome), Data, Valor e Tipo.
  - Vincular as duas entidades pelo ID da movimentação.

### 4. Visualização e Gestão
- No Financeiro: Adicionar um ícone de clipe ou link "Visualizar comprovante" nas linhas da tabela que possuem anexo.
- Na Gestão Documental: O documento aparecerá normalmente na categoria selecionada.

### 5. Regras de Exclusão
- Ao tentar excluir uma movimentação com comprovante, exibir um diálogo de confirmação permitindo:
  - Excluir apenas a movimentação (mantendo o documento).
  - Excluir ambos.

## Detalhes Técnicos
- Utilização de `Input type="file"` escondido disparado pelo botão de anexo.
- Validação de arquivos via JavaScript no frontend antes do "upload".
- Persistência em memória (mock) simulando o comportamento do banco de dados/storage solicitado na PRD.

## Critérios de Aceitação
- Categoria é um Dropdown obrigatório com as 8 opções definidas.
- Upload funcional de 1 arquivo < 2MB em formatos permitidos.
- Comprovante visível no financeiro após o registro.
- Documento criado automaticamente no módulo de documentos.

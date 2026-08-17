# ArremataFlow Hub

# ArremataFlow MVP




## Objetivo




Plataforma SaaS multiempresa para gestão completa do ciclo pós-arrematação e pós-aquisição de imóveis, centralizando processos operacionais, documentais, financeiros e jurídicos.




## Telas




### Autenticação




**Rota:** `/`




**Objetivo:** Autenticar usuário ou iniciar recuperação de senha.




**Componentes:**




- **Input Email**

- **Input Senha**

- **Botão Entrar**: Autentica o usuário e redireciona para o dashboard.

- **Link Esqueci Senha**: Navega para a tela de recuperação de senha.




### Dashboard Executivo




**Rota:** `/dashboard`




**Objetivo:** Exibir indicadores operacionais e financeiros da empresa.




**Componentes:**




- **Alertas do Dia**: Exibe tarefas vencendo hoje e pendências críticas.

- **Resumo do Dia**: Exibe resumo das atividades e indicadores do dia.

- **KPI Projetos Ativos**: Exibe quantidade de projetos ativos.

- **KPI Regularizações**: Exibe quantidade de regularizações.

- **KPI Pendências**: Exibe quantidade de pendências.

- **KPI Posse Pendente**: Exibe quantidade de posses pendentes.

- **KPI Reformas**: Exibe quantidade de reformas.

- **KPI Imóveis à Venda**: Exibe quantidade de imóveis à venda.

- **KPI Capital Investido**: Exibe valor do capital investido.

- **KPI Honorários**: Exibe valor dos honorários.

- **KPI Resultado Projetado**: Exibe resultado financeiro projetado.

- **KPI Resultado Realizado**: Exibe resultado financeiro realizado.




### Gestão de Projetos




**Rota:** `/projetos`




**Objetivo:** Listar e gerenciar todos os projetos imobiliários da empresa.




**Componentes:**




- **Botão Novo Projeto**: Abre modal de cadastro de novo projeto.

- **Tabela de Projetos**: Exibe lista com nome, etapa, responsável e status.

- **Barra de Busca**: Filtra projetos por nome ou endereço.




### Cadastro de Projeto




**Rota:** `/projetos/novo`




**Objetivo:** Registrar novo projeto com dados do imóvel, aquisição e participantes.




**Componentes:**




- **Seção Imóvel**: Campos para dados do imóvel (endereço, área, matrícula, etc.).

- **Fotos do Imóvel**: Inserir fotos do imóvel logo abaixo do título 'Imóvel'; exibe uma foto principal em destaque e as demais em formato carrossel.

- **Seção Aquisição**: Campos para dados da aquisição (valor, data, forma de pagamento, etc.).

- **Seção Modalidade de Assessoria**: Seleção da modalidade de assessoria e dados relacionados.

- **Seção Participantes**: Campos para adicionar/gerenciar participantes do projeto.

- **Botão Salvar Projeto**: Valida e salva o projeto, redireciona para a ficha central.




### Ficha Central do Projeto




**Rota:** `/projetos/:id`




**Objetivo:** Centralizar todas as abas de gestão de um projeto específico.




**Componentes:**




- **Aba Visão Geral**: Exibe resumo do projeto.

- **Aba Regularização**: Controla cartório, prefeitura, condomínio e jurídico.

- **Aba Posse**: Registra situação, custos e documentos da posse.

- **Aba Financeiro**: Exibe receitas, despesas e indicadores financeiros.

- **Aba Documentos**: Gerencia documentos do projeto.

- **Aba Tarefas**: Exibe e gerencia tarefas do pipeline.

- **Aba Obra**: Controla reforma e obras.

- **Aba Venda**: Registra comercialização e propostas.

- **Aba Resultado**: Apresenta apuração e distribuição financeira.

- **Aba Histórico**: Exibe auditoria de alterações.




### Gestão de Tarefas




**Rota:** `/projetos/:id/tarefas`




**Objetivo:** Gerenciar tarefas do pipeline operacional do projeto.




**Componentes:**




- **Botão Nova Tarefa**: Abre modal de criação de tarefa.

- **Lista de Tarefas**: Exibe tarefas com status, prazo e responsável.

- **Filtro por Status**: Filtra tarefas por status.




### Gestão Documental




**Rota:** `/projetos/:id/documentos`




**Objetivo:** Organizar e gerenciar documentos do projeto por categoria.




**Componentes:**




- **Botão Upload Documento**: Abre modal para upload e categorização de documento.

- **Árvore de Categorias**: Exibe categorias de documentos.

- **Lista de Documentos**: Exibe documentos com versão, autor e data.




### Financeiro do Projeto




**Rota:** `/projetos/:id/financeiro`




**Objetivo:** Controlar receitas, despesas, tributos e distribuições do projeto.




**Componentes:**




- **Tabela de Receitas**

- **Tabela de Despesas**

- **Botão Nova Movimentação**: Abre modal para registrar receita ou despesa.

- **Seção Distribuição**: Exibe e aciona cálculo de distribuição financeira.

- **Indicadores Financeiros**




### Portal do Investidor




**Rota:** `/investidor`




**Objetivo:** Permitir que investidores acompanhem seus projetos e documentos.




**Componentes:**




- **Lista de Projetos**: Exibe projetos nos quais o investidor participa.

- **Detalhes do Projeto**: Exibe andamento, financeiro e documentos autorizados.

- **Botão Enviar Documento**: Abre modal para upload de comprovante ou documento.




### Gestão de Usuários




**Rota:** `/admin/usuarios`




**Objetivo:** Gerenciar usuários, perfis e permissões da empresa.




**Componentes:**




- **Tabela de Usuários**: Exibe lista com nome, email e perfil.

- **Botão Convidar**: Envia convite por email para novo usuário.

- **Alterar Permissões**: Abre modal para editar permissões do usuário.




### Configurações da Empresa




**Rota:** `/admin/configuracoes`




**Objetivo:** Gerenciar dados e regras da empresa no sistema multi-tenant.




**Componentes:**




- **Seção Dados da Empresa**

- **Seção Regras Financeiras**: Define regras de honorários e distribuição.

- **Seção Notificações**: Configura canais de alerta.

Design System — ArremataFlow

Conceito Visual

O ArremataFlow deve transmitir confiança, organização, segurança jurídica e controle financeiro. O design deve seguir uma estética SaaS moderna, limpa e corporativa, priorizando produtividade e leitura rápida das informações.

Paleta de Cores

Primária

Azul Petróleo — #0F3D56

Azul Médio — #1E5F8B

Azul Claro — #DCEFF8

Secundária

Verde Sucesso — #16A34A

Verde Claro — #DCFCE7

Neutras

Branco — #FFFFFF

Fundo — #F8FAFC

Cinza Claro — #E5E7EB

Cinza Médio — #6B7280

Texto Principal — #1F2937

Alertas

Amarelo — #F59E0B

Vermelho — #DC2626

Azul Informação — #2563EB

Estilo Geral

Interface minimalista

Cards com cantos de 12px

Sombras suaves

Muito espaço em branco

Ícones outline

Botões arredondados

Tabelas modernas

Responsivo para desktop, tablet e mobile

Tipografia

Fonte

Inter

Hierarquia

H1 — 32px / Bold

H2 — 24px / Semibold

H3 — 20px / Semibold

Texto — 16px

Labels — 14px

Pequenos indicadores — 12px

Navegação

Sidebar esquerda

Ícones + texto:

🏠 Dashboard

🏢 Projetos

🏘 Imóveis

👥 Investidores

🧑‍💼 Assessores

✅ Tarefas

📁 Documentos

📑 Regularização

🔑 Posse

🏗 Obras

💰 Financeiro

📈 Resultados

🔔 Notificações

⚙ Configurações

👤 Perfil

Dashboard

Topo com:

Pesquisa global

Notificações

Empresa ativa

Perfil do usuário

KPIs em cards:

Projetos Ativos

Regularizações

Pendências

Em Posse

Em Reforma

À Venda

Capital Investido

Honorários

Resultado Projetado

Abaixo:

Pipeline Kanban

Calendário de vencimentos

Tarefas do dia

Alertas críticos

Últimas movimentações

Página do Projeto

Banner superior com:

Foto principal do imóvel

Código

Endereço

Modalidade

Status

Investidores

Assessores

Abas:

Visão Geral

Financeiro

Regularização

Posse

Documentos

Tarefas

Reforma

Venda

Resultado

Histórico

Cores dos Status

🟢 Concluído — Verde

🔵 Em andamento — Azul

🟡 Aguardando terceiro — Amarelo

🟠 Pendente — Laranja

🔴 Atrasado — Vermelho

⚪ Não iniciado — Cinza

Ícones por Módulo (Lucide Icons)

Dashboard — LayoutDashboard

Projetos — FolderKanban

Imóveis — House

Investidores — Users

Assessores — BriefcaseBusiness

Regularização — FileCheck

Documentos — FolderOpen

Financeiro — Wallet

Pagamentos — CreditCard

Posse — KeyRound

Reforma — Hammer

Comercialização — Store

Venda — BadgeDollarSign

Resultados — TrendingUp

Notificações — Bell

Auditoria — ShieldCheck

Configurações — Settings

Perfil — UserCircle

Componentes

Cards de KPI

Timeline

Kanban

Data Grid com filtros

Upload por drag-and-drop

Visualizador de documentos

Linha do tempo do projeto

Calendário de tarefas

Modal lateral (Drawer)

Dialogs de confirmação

Badges coloridas

Breadcrumbs

Tabs

Toasts de notificação

Experiência do Usuário

Navegação intuitiva com poucos cliques

Ações principais sempre visíveis

Indicadores financeiros destacados

Alertas e prazos evidentes

Busca global para projetos, imóveis, investidores e documentos

Feedback visual imediato para ações concluídas

Interface otimizada para grandes volumes de dados sem perder clareza
não vou conectar banco de dados agora. use dados mock.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/4a62e4cf-6636-495e-af7d-bbef04edaa98).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```

# Segurança e operação do ArremataFlow

## Controles implementados

- Autenticação Better Auth obrigatória por padrão. Somente rotas de login, recuperação de senha e API de autenticação são públicas.
- Senhas nunca são armazenadas pela aplicação; permanecem sob o hash gerenciado pelo Better Auth. Convites usam tokens aleatórios, de uso limitado e com expiração de 30 minutos.
- Cookies seguros são obrigatórios em produção e as origens aceitas ficam limitadas a `BETTER_AUTH_URL`.
- CSRF é bloqueado nas funções do servidor e uploads também validam a origem.
- Tentativas de login e recuperação de senha têm limitação por endereço e rota. Em produção com mais de uma réplica, substituir o contador em memória por Redis.
- Todas as consultas operacionais restringem dados pela empresa e, para assessor/investidor, pelos projetos vinculados ao e-mail autenticado.
- Alterações de empresa, usuários, projetos, documentos, finanças, tarefas, relatórios, regularização, posse, comercialização, prestadores e distribuições geram auditoria no PostgreSQL.
- Valores monetários, percentuais, estados, e-mails, documentos, status e URLs são validados no servidor. O banco também possui restrições para domínios críticos.
- SQL é emitido pelo Drizzle com parâmetros; não há concatenação de entrada em consultas.
- Uploads aceitam apenas PDF, JPEG, PNG e WebP, com limite de 10 MB, verificação por assinatura, nome interno aleatório, hash SHA-256 e armazenamento privado.
- Downloads exigem sessão e autorização do projeto, usam `no-store`, `nosniff` e nome de arquivo higienizado.
- Cabeçalhos CSP, HSTS em produção, antiframe, política de referência, isolamento de origem e restrição de recursos do navegador são aplicados globalmente.
- Exportações CSV neutralizam fórmulas iniciadas por `=`, `+`, `-` e `@`; a saída de impressão escapa HTML.
- `.env`, dados locais, documentos e artefatos de compilação são ignorados e não devem ser versionados.

## Pendências antes da produção

1. Substituir o rate limiting em memória por Redis se houver múltiplas instâncias do aplicativo.
2. Definir `TRUSTED_PROXY_HOPS=1` quando o app estiver atrás de um proxy reverso (Caddy/Nginx) que sobrescreve ou acrescenta `X-Forwarded-For`. Sem isso, o limite de tentativas usa um único contador por rota, pois cabeçalhos de encaminhamento enviados pelo cliente são ignorados.

Nenhuma dessas pendências deve ser ocultada por dados simulados. Uma tela ainda não migrada deve ser tratada como módulo em transição.

## LGPD

- Coletar somente dados necessários à administração dos projetos e registrar a finalidade no contrato/aviso de privacidade.
- Definir prazos de retenção para contatos, documentos, auditoria e backups.
- Atender solicitações de acesso, correção, portabilidade e eliminação sem apagar registros sujeitos a obrigação legal.
- Restringir exportações e documentos por perfil; registrar emissões de relatórios.
- Não registrar senhas, tokens, documentos completos ou conteúdo de arquivos nos logs.
- Manter contrato e registro dos operadores usados para e-mail, hospedagem, backup e monitoramento.

## Backup e recuperação

- PostgreSQL: backup diário criptografado, retenção mínima de 30 dias e cópia fora do servidor principal.
- Documentos: snapshot diário do volume persistente e cópia externa criptografada.
- Testar restauração completa mensalmente em ambiente separado e registrar tempo de recuperação e perda máxima de dados.
- Antes de cada atualização, criar backup do banco e do volume; migrações devem ser aplicadas uma única vez.

## Monitoramento e incidentes

- Monitorar indisponibilidade, erros HTTP 5xx, falhas de login, armazenamento, conexões do banco e expiração de certificados.
- Alertas não devem conter tokens, senhas ou dados pessoais completos.
- Em incidente: preservar evidências, revogar sessões e segredos afetados, isolar o serviço, restaurar de fonte íntegra e avaliar comunicação à ANPD e aos titulares nos prazos aplicáveis.
- Atualizar mensalmente imagens Docker e dependências; correções críticas de segurança devem ter prioridade imediata.

## Implantação

- Usar somente HTTPS e definir `BETTER_AUTH_URL` com o domínio HTTPS definitivo.
- Gerar `BETTER_AUTH_SECRET` exclusivo, aleatório e com pelo menos 32 caracteres.
- Definir `AUTH_ENFORCEMENT_ENABLED=true` e `NODE_ENV=production`.
- Criar um volume persistente e definir `DOCUMENT_STORAGE_PATH=/data/documents`.
- Não usar as senhas dos exemplos. Banco e aplicativo devem usar credenciais próprias e de privilégio mínimo.

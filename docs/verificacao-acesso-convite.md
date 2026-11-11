# Verificação do acesso por convite

Migração nova aplicada: `drizzle/migrations/0003_acesso_somente_por_pre_cadastro.sql`.
As migrações SQL antigas e todos os arquivos em `src/` permanecem com o conteúdo original.

## Configurações confirmadas no serviço de autenticação
- Cadastro habilitado (`disable_signup=false`).
- Confirmação por e-mail obrigatória (`mailer_autoconfirm=false`).
- E-mail/senha e Google habilitados.
- Nenhuma configuração de autenticação foi alterada.

## Resultados solicitados
1. Cadastro real de `teste@gmail.com`: HTTP 500, código `P0001`, mensagem exata **Acesso restrito a e-mails da CENTERFRIOS e da 381 Distribuidora.** Nenhuma conta criada.
2. Cadastro real de `nao.convidado@centerfrios.com`: HTTP 500, código `P0001`, mensagem exata **Seu acesso ainda não foi liberado. Peça o convite ao administrador.** Nenhuma conta criada.
3. Pré-cadastro com `CONVIDADO.TESTE@GRUPO381.COM.BR`, uma empresa e papel vendedor; criação de autenticação com o e-mail minúsculo pelo endpoint administrativo: sucesso, `auth_user_id` preenchido, somente vendedor em `user_roles`, nenhuma linha pendente e exatamente o vínculo original com a 381. Login temporário apagado; limpeza da linha temporária executada separadamente. Não houve envio de confirmação nem alteração das configurações globais.
4. Contas de autenticação existentes comparadas integralmente antes/depois, sem alterações. Filipe segue ligado a Humberto, com vendedor e administrador. **adm@centerfrios.com já tinha somente vendedor**, ligado a Clara; foi preservado assim, sem promoção. Vínculos existentes mantidos.
5. Definição vigente consultada: sem Humberto, Clara, v_primeiro e sem operações em usuario_empresas. O gatilho existente continua apontando para ao_criar_usuario.
6. **Login real com Google de uma conta Gmail não foi executado:** não há sessão Google dessa conta disponível para concluir o fluxo. O gatilho verificado recusa qualquer nova linha com domínio Gmail, independentemente do provedor; isso não equivale à validação completa do retorno Google ou de sua mensagem visual. O gatilho é de criação e não revalida logins de contas já existentes; só existiam as duas contas corporativas preservadas.

## Modelo de papéis
`papeis_pre_cadastro` tem RLS e política de leitura/escrita exclusivamente para administrador; não há acesso anon. A função de gatilho consome os papéis atomicamente. `empresa_id=NULL` registra todas as empresas; os papéis são copiados para o modelo global já existente de `user_roles`, enquanto os vínculos continuam em `usuario_empresas`. Esta etapa não implementa autorização de papéis por empresa.

## Repetição dos testes
`tests/test_acesso_convite.py`: cinco testes de integração executados com sucesso. O teste de convite exige pré-criar a linha temporária, seu vínculo à 381 e papel vendedor pelas ferramentas de dados; o teste de preservação exige registrar antes o estado privado das contas. Após a execução, remover a linha pública temporária. Credenciais e registros privados não são incluídos no projeto.
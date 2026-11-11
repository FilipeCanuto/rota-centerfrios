# Verificação das permissões

Migração nova: `0004_permissoes_por_empresa.sql`. Migrações SQL anteriores preservadas por comparação SHA-256. O único arquivo existente de `src/` alterado além dos tipos regenerados foi `sessao.tsx`: retirada de `perfil` da consulta e do tipo, sem outras alterações.

## Resultados pela API com sessões authenticated reais

21 testes de integração passaram. Quatro convites temporários foram vinculados pelo gatilho, com senha aleatória e confirmação apenas destas contas de teste; as configurações de cadastro não foram alteradas.

| Perfil | Verificação | Resultado |
|---|---|---|
| Vendedor | Clientes | 2, ambos próprios |
| Vendedor | Alterar metas | 0 linhas |
| Vendedor | Inserir vendas | HTTP 403, 42501 |
| Vendedor | Alterar equipe_id | HTTP 403, 42501 |
| Vendedor | Alterar tema | 1 linha, escuro |
| Supervisor | Clientes da equipe / outras equipes | 2 / 0 |
| Supervisor | Remanejar clientes | 0 linhas, RLS bloqueia |
| Diretoria | Clientes das duas empresas | 62 = 60 existentes + 2 temporários |
| Diretoria | Alterar metas / regras | 1 linha em cada, apenas registros temporários |
| Administrador | Clientes, vendas, metas, auditoria | 0 em cada |
| Administrador | Criar usuário, vínculo, papel, link | Permitido |
| Administrador | Alterar regras | 0 linhas |
| Empresa | Supervisor somente 381 | CENTERFRIOS false; 381 true; assinatura antiga false |

Também conferidos: somente ultimo_followup pode ser atualizado em orçamentos; somente lido em alertas; função administrativa rejeita vendedor e aceita administrador; convites são consumidos e empresa_id é preservado. Para criar links sem vínculo à empresa, usar retorno mínimo: a política permite inserir, mas não ler o registro retornado.

## Preservação e limpeza

- Filipe/Humberto preservado: mesmo auth_user_id, vendedor + administrador globais.
- adm/Clara preservado: mesmo auth_user_id, vendedor global (já não era administrador).
- Marcos preservado: supervisor global pendente em papeis_pre_cadastro.
- Todas as quatro contas de autenticação e os registros temporários foram removidos; zero usuários rls.* restantes.
- Os 17 testes existentes de regras e roteamento passaram; último registro de compilação: build OK.
- Página /inicio verificada com sessão existente de Clara: painel preenchido, sem erros JavaScript.

## Limitação explícita

A permissão de migrações incompatíveis rejeitou DROP COLUMN; nenhuma alteração foi aplicada nessa tentativa. A única migração aplicada marca usuarios.perfil e empresas.empresa_id como DEPRECATED. As colunas continuam fisicamente presentes e aparecem nos tipos gerados; perfil deixou de ser consultado pela sessão e não determina autorização. Para removê-las fisicamente, mudar Settings → Agent permissions → Execute backward incompatible database migrations para Ask each time ou Always allow; será necessária outra migração.

Os helpers pode_ver_vendedor e tem_empresa foram preservados exatamente como solicitado: a assinatura de dois argumentos de has_role reconhece somente papéis globais. Um supervisor com papel apenas na 381 passa no helper de três parâmetros para 381, mas não ganha supervisão de carteira pela assinatura global antiga. A UI de sessão também permanece sem adaptação de papéis por empresa, fora do escopo permitido.
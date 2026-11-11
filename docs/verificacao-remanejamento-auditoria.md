# Remanejamento e auditoria

Aplicada a migração nova `0005_remanejamento_auditoria.sql`. Comparação SHA-256 confirmou: nenhuma migração SQL anterior e nenhuma tela foram alteradas; em src/ mudou somente o arquivo de tipos regenerado.

## Resultados com sessões authenticated reais

Foram pré-cadastrados vendedor A, vendedor B, supervisor da equipe com papel somente CENTERFRIOS, supervisor de outra equipe com o mesmo escopo, diretoria e administrador. Foram criados dois clientes temporários (10 e 95 dias desde a compra), duas equipes e uma meta. Todos os dados foram exclusivos para teste.

| Cenário | Resultado |
|---|---|
| 1. Vendedor chama remanejar_cliente | Recusado: 42501 |
| 2. Supervisor, compra há 10 dias | Recusado: Este cliente comprou há menos de 90 dias e ainda não pode mudar de carteira. |
| 3. Supervisor, compra há 95 dias | Funcionou; cliente passou de A para B; exatamente uma auditoria com ator supervisor, vendedor afetado A, motivo Redistribuição teste, dias_sem_compra 95, antigo e novo |
| 4. Supervisor de outra equipe | Recusado: 42501 |
| 5. UPDATE direto pela diretoria | Bloqueado pela RLS: 0 linhas; vendedor continuou B |
| 6. INSERT direto em auditoria | Recusado: 42501, para todas as seis contas; auditar também inacessível |
| 7. Diretoria altera meta | alteracao_meta com antigo meta_vendas=123 e novo meta_vendas=456 |
| 8. Administrador lê auditoria | Vê alteracao_permissao; não vê remanejamento |
| 9. Supervisor somente por empresa | Vê os dois clientes da equipe na CENTERFRIOS e a auditoria do remanejamento |

Testes extras: motivo de 4 caracteres recusado; UPDATE e DELETE em auditoria recusados para todas as seis contas. Total: 11 testes de integração passaram e 17 testes existentes passaram. Compilação: build OK.

## Limite da verificação

O UPDATE direto solicitado já é bloqueado pela RLS da migração 0004, antes de qualquer gatilho: não é correto afirmar que essa tentativa chegou ao gatilho. O gatilho adicional só aceita service_role ou execução privilegiada pela função, com marca local à transação; o caminho permitido da função foi exercitado. A marca é restaurada antes do fim da função. Não foram adicionadas permissões de UPDATE para permitir um teste artificial pela diretoria.

O remanejamento pela função chama auditar uma única vez. O gatilho AFTER audita trocas pela integração; o gatilho genérico audita INSERT/UPDATE/DELETE de metas e regras e INSERT/DELETE de papéis e vínculos. As funções internas não são executáveis por authenticated.

## Limpeza

Apagadas as seis contas de autenticação, convites, vínculos, equipes, clientes, meta e auditorias temporárias. Conferência final: 0 contas de teste, 0 usuários de teste e 0 auditorias de teste. Contas e carteiras existentes não foram alteradas.

Pendências anteriores permanecem fora deste pedido: remoção física das colunas legadas depende de permissão para migrações incompatíveis; teste Google/Gmail real depende de sessão Google.
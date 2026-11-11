# Feriados

Aplicada a migração nova `0006_feriados.sql`; carga das 20 datas executada separadamente pela ferramenta de dados. Tipos regenerados automaticamente. Nenhuma tela ou migração antiga alterada.

| Verificação | Resultado |
|---|---|
| Quantidade e lista exata | 20, somente datas e nomes nacionais solicitados de 2026 e 2027 |
| Escopo/origem | empresa e localidade nulas; abrangência nacional; origem manual |
| Novembro/2026 | 19 dias úteis: 21 dias de segunda a sexta menos 02/11 e 20/11; 15/11 é domingo |
| Vendedor sem vínculo | Lê os 20 globais; inserção recusada, 42501 |
| Diretoria | Insere, altera e apaga feriado municipal temporário |
| Auditoria | alteracao_feriado com INSERT, UPDATE e DELETE, valores anteriores/novos e ator correto |
| Abrangência inválida | Recusada, 23514 |
| Data global duplicada | Recusada, 23505 |

Sete testes de integração autenticada passaram. Usuários temporários, feriado temporário e auditorias de teste removidos; os registros de auditoria da carga inicial permanecem, pois não são dados de teste.

A tabela está disponível para cálculos futuros. Nenhuma regra ou tela de dias úteis foi conectada à tabela nesta etapa, conforme a restrição a alterações em src/.
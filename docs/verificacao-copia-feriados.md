# Datas móveis e cópia anual de feriados

Aplicada a migração nova `0012_feriados_moveis_copia_anual.sql`. Migrações anteriores preservadas; em `src/`, somente o arquivo de tipos gerado mudou.

- Abrangência aceita nacional, estadual, municipal e empresa, sem restringir `empresa_id` por abrangência.
- Coluna `data_movel boolean not null default false` criada. Os dois registros Paixão de Cristo foram marcados pela ferramenta de dados; o carregador nacional também grava essa marca em novos registros.
- `copiar_feriados_para_ano` é SECURITY INVOKER, executável por authenticated, e preserva RLS e o gatilho de auditoria. Copia nome, abrangência, localidade, empresa e origem, mantendo dia/mês. Anos inválidos são recusados; 29/02 inválido é ignorado sem ser contado como duplicata.
- Nenhum cálculo de dias úteis nem tela foi alterado.

## Resultados

| Verificação | Resultado |
|---|---|
| Diretoria cria Carnaval 2027, empresa global e móvel | Permitido; alteracao_feriado com novo valor conferida |
| Vendedor insere abrangência empresa | Recusado por RLS |
| Cópia 2027 → 2028 pela diretoria | copiados 9, ja_existiam 0, ignorados_moveis 2 |
| Segunda cópia 2027 → 2028 | copiados 0, ja_existiam 9, ignorados_moveis 2 |
| Paixão de Cristo e Carnaval em 2028 | Não copiados |
| Vendedor chama cópia | Recusado por RLS; nenhuma inserção |
| 29/02/2096 → 2097 | Ignorado; outra data fixa copiada preservando empresa, município e abrangência |
| Carregador nacional após marcação | Retornou 0 |
| Limpeza final | 20 feriados; somente as duas Paixões de Cristo móveis; zero feriados de 2028 ou fixtures restantes |

`PYTHONDONTWRITEBYTECODE=1 python3 tests/test_copia_feriados.py -v`: três testes autenticados passaram com sessão de Filipe/diretoria. Os 13 feriados temporários foram removidos no encerramento, inclusive os nove de 2028. As auditorias foram preservadas.

`tests/test_copia_feriados_vendedor.sql` foi executado pela ferramenta de dados em transação revertida, sob `SET LOCAL ROLE authenticated` e identidade com somente papel vendedor. Tanto a inserção quanto a cópia geraram insufficient_privilege. Nenhuma alteração de papéis, dados ou auditoria dessa transação foi persistida; Willames continua somente administrador. Este teste cobre o contexto RLS autenticado do banco, não um novo login por senha/Google.

17 testes existentes passaram. Último registro automático: `build OK`. SHA-256 confirmou preservação de todas as telas e migrações anteriores; apenas tipos e journal gerenciados mudaram entre arquivos preexistentes.

A tela de edição e o botão de cópia ficam para o ramo `revisao-fundacao`, conforme solicitado; nesta etapa o fluxo foi conferido pela API autenticada e pelo contexto RLS do banco.
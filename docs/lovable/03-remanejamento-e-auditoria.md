Agora a troca de carteira e a auditoria. Faça numa **migração nova**, sem editar migrações antigas e **sem alterar telas em `src/`** (só regenere `src/integrations/supabase/types.ts`).

## 1. Auditoria que ninguém falsifica
- Em `public.registro_auditoria`, **remova** a política de `insert` para `authenticated`. Só funções `security definer` e gatilhos gravam auditoria. Ninguém altera nem apaga linhas (sem políticas de `update`/`delete`).
- Adicione a coluna `vendedor_id uuid` (referência a `usuarios.id`, pode ser nula): o vendedor afetado pela ação.
- Leitura: diretoria lê tudo; supervisor lê as linhas em que `pode_ver_vendedor(vendedor_id)` é verdadeiro, ou em que ele mesmo é o `usuario_id`. Administrador lê só as ações técnicas (`tabela` em `usuarios`, `usuario_empresas`, `user_roles`, `links`, `equipes`).
- Crie a função interna `public.auditar(_acao text, _tabela text, _registro uuid, _empresa uuid, _vendedor uuid, _detalhes jsonb)` (`security definer`, sem permissão de execução para `authenticated`), que grava com `usuario_id = meu_usuario_id()`.

## 2. Gatilhos de auditoria
Grave uma linha em `registro_auditoria`, com os valores antigos e novos em `detalhes`, sempre que houver:
- `insert`, `update` ou `delete` em `metas` ("alteracao_meta");
- `insert`, `update` ou `delete` em `configuracoes_regras` ("alteracao_regra");
- `insert` ou `delete` em `user_roles` ("alteracao_permissao");
- `insert` ou `delete` em `usuario_empresas` ("alteracao_vinculo_empresa");
- mudança de `clientes.vendedor_id` ("remanejamento", veja abaixo).

## 3. Remanejamento de cliente
Crie a função `public.remanejar_cliente(_cliente_id uuid, _novo_vendedor_id uuid, _motivo text)` (`security definer`, com permissão de execução para `authenticated`), que:
1. Exige `_motivo` com pelo menos 5 caracteres.
2. Exige que quem chama tenha o papel `supervisor` **na empresa do cliente** (`has_role` de três parâmetros), ou `diretoria`.
3. Se for supervisor: o vendedor atual **e** o novo vendedor precisam ser da equipe que ele supervisiona, e o novo vendedor precisa ter vínculo com a empresa do cliente.
4. Lê o limite `cliente_sem_compra_dias` de `configuracoes_regras` da empresa do cliente (90 se não existir) e só permite a troca se `data_ultima_compra` for nula ou tiver pelo menos esse número de dias, contados na data de hoje em `America/Maceio`. Senão, recusa com "Este cliente comprou há menos de N dias e ainda não pode mudar de carteira."
5. Atualiza `clientes.vendedor_id` e chama `auditar('remanejamento', 'clientes', cliente, empresa, vendedor antigo, {de, para, motivo, dias_sem_compra})`.

Além disso, crie um gatilho em `clientes` que **recusa** qualquer mudança de `vendedor_id` que não venha dessa função ou do `service_role` (integração). Por exemplo, a função define `set_config('rota.remanejamento', 'on', true)` antes do `update`, e o gatilho confere essa marca.

## Como conferir
Com usuários de teste (vendedor A e vendedor B na mesma equipe, supervisor dessa equipe, supervisor de outra equipe e diretoria), mostre:
1. Vendedor chamando `remanejar_cliente` → recusado.
2. Supervisor da equipe com um cliente que comprou há 10 dias → recusado com a mensagem dos dias.
3. Supervisor da equipe com um cliente sem compra há 95 dias → funciona, e aparece uma linha "remanejamento" em `registro_auditoria` com o motivo e os dias.
4. Supervisor de **outra** equipe com o mesmo cliente → recusado.
5. `update clientes set vendedor_id = ...` direto, como diretoria → recusado pelo gatilho.
6. Qualquer usuário tentando `insert into registro_auditoria` → recusado.
7. Diretoria alterando uma meta → aparece "alteracao_meta" com os valores antigo e novo.
8. Administrador lê a linha de "alteracao_permissao", mas não a de "remanejamento".
Depois, apague os dados de teste.

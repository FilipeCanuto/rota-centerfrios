Migração nova, sem editar migrações antigas e sem alterar telas em `src/` (mantenha os tipos regenerados). Agenda com retornos, visitas e ligações e tarefas criadas pelos alertas.

## 1. Tarefas mais completas
Em `tarefas_agenda`, adicione:
- `tipo text not null default 'tarefa'`, com os valores `retorno`, `visita`, `ligacao` e `tarefa`;
- `hora time` (opcional);
- `observacao text`;
- `motivo_alerta text` (nulo quando criada à mão; senão o tipo do alerta: `recompra_urgente`, `recompra_atencao`, `orcamento_parado`, `esquecido`, `sem_compra`);
- `concluida_em timestamptz`.

Índice único parcial em `(vendedor_id, cliente_id, data, motivo_alerta)` quando `motivo_alerta` não for nulo, para não duplicar tarefa automática.

## 2. Tarefas automáticas dos alertas
Função `gerar_tarefas_dos_alertas(_itens jsonb)` (`security invoker`, executável por `authenticated`). Recebe a lista calculada pelo app (`{empresa_id, cliente_id, motivo_alerta, titulo}`), cria tarefas para o próprio vendedor (`meu_usuario_id()`) com data de hoje em America/Maceio e `tipo = 'retorno'`, ignorando as que já existem (`on conflict do nothing`), e devolve quantas criou. A RLS de inserção já garante que só entra cliente da carteira.

## 3. Permissões
O vendedor pode alterar `concluida`, `concluida_em`, `data`, `hora`, `titulo`, `tipo` e `observacao` das próprias tarefas (as políticas de update de `tarefas_agenda` já existem; confira as permissões por coluna).

## Como conferir
1. Vendedor de teste chama `gerar_tarefas_dos_alertas` com 2 itens: cria 2; chamar de novo cria 0.
2. Item com cliente de outro vendedor: não cria.
3. Vendedor conclui uma tarefa própria; não consegue alterar a de outro.
Apague os dados de teste.

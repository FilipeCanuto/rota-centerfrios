Agora o desempenho das consultas e das regras de acesso. Faça numa **migração nova**, sem editar migrações antigas e **sem alterar `src/`**.

## 1. Índices
Crie os índices abaixo (com `if not exists`). Antes de criar, confira se já existe um igual e não duplique.

| Tabela | Colunas |
| --- | --- |
| `clientes` | `(empresa_id, vendedor_id)` |
| `vendas` | `(empresa_id, vendedor_id, data_faturamento)` e `(cliente_id, data_faturamento)` |
| `interacoes` | `(empresa_id, vendedor_id, data)` |
| `orcamentos` | `(empresa_id, vendedor_id, status)` e `(cliente_id)` |
| `tarefas_agenda` | `(empresa_id, vendedor_id, data)` e `(cliente_id)` |
| `alertas` | `(empresa_id, vendedor_id, data)` |
| `pontos` | `(empresa_id, vendedor_id, data)` |
| `selos` | `(empresa_id, vendedor_id)` |
| `metas` | já coberto pela restrição única `(empresa_id, vendedor_id, mes)`; não criar |
| `usuario_empresas` | `(empresa_id)` |
| `user_roles` | `(user_id, role)` |
| `equipes` | `(supervisor_id)` |
| `usuarios` | `(equipe_id)` |
| `registro_auditoria` | `(empresa_id, created_at)` e `(vendedor_id, created_at)` |

Depois, apague os índices antigos que ficarem redundantes (por exemplo `vendas (vendedor_id, data_faturamento)`, se o novo com `empresa_id` cobrir os mesmos filtros). Liste no fim quais foram apagados.

## 2. Funções das políticas calculadas uma vez por consulta
Em **todas** as políticas de RLS, troque as chamadas diretas por subconsulta, para o Postgres calcular uma vez só e não linha a linha:
- `auth.uid()` vira `(select auth.uid())`;
- `public.meu_usuario_id()` vira `(select public.meu_usuario_id())`;
- `public.ve_tudo()` vira `(select public.ve_tudo())`;
- `public.eh_admin()` vira `(select public.eh_admin())`.

`tem_empresa(empresa_id)` e `pode_ver_vendedor(vendedor_id)` dependem da linha e ficam como estão. Todas as funções auxiliares devem estar marcadas como `stable`. Não mude o comportamento de nenhuma política: só a forma de chamar.

## Como conferir
1. Liste os índices de cada tabela acima e mostre que existem.
2. Rode `explain` (como um vendedor de teste) da consulta "clientes do vendedor X na empresa Y" e "vendas do vendedor X na empresa Y desde o início do mês" e mostre que usam os índices novos (`Index Scan` ou `Bitmap Index Scan`), quando a tabela tiver dados suficientes.
3. Repita as conferências 1 a 4 da mensagem 02 (vendedor, supervisor, diretoria, administrador) e mostre que o resultado não mudou.

Preciso corrigir quem é quem nas duas contas que já existem. Hoje elas estão ligadas aos vendedores de demonstração. Faça numa **migração nova** (o que for estrutura) e pela ferramenta de dados (o que for ajuste de linhas), sem editar migrações antigas e **sem alterar `src/`**.

## Situação atual (conferida em 11/11/2026)
- `filipecanuto@centerfrios.com` está ligado à linha `usuarios` "Humberto" (id `830d3560-06b0-4506-b40c-6ba424e34ce0`), com papéis `vendedor` e `administrador` e 30 clientes de demonstração.
- `adm@centerfrios.com` está ligado à linha "Clara" (id `00b31584-f79e-4e93-9a14-96f308eed4f4`), com papel `vendedor` e 30 clientes de demonstração.
- Nenhum dos dois tem dados reais (0 clientes, interações ou tarefas com `demo = false`). Os dois já têm vínculo com as duas empresas.

## O que deve ficar
| Conta | Nome | Papéis | Empresas |
| --- | --- | --- | --- |
| `filipecanuto@centerfrios.com` | Filipe Canuto | `administrador` e `diretoria` (globais, `empresa_id` nulo) | CENTERFRIOS e 381 |
| `adm@centerfrios.com` | Willames Costa | `administrador` (global) | CENTERFRIOS e 381 |

**Nenhum dos dois é vendedor.**

## Passos, nesta ordem
1. Chame `apagar_dados_demo()` (no contexto de um administrador ou pela ferramenta de dados com o mesmo efeito). Isso tira as carteiras de demonstração dessas duas contas. Mostre o resumo devolvido.
2. Atualize as duas linhas de `usuarios`: nome "Filipe Canuto" e "Willames Costa", `equipe_id` nulo, `apelido_copiloto` igual ao primeiro nome, `demo = false`. **Não mexa** em `auth_user_id`, e-mail nem vínculos de empresa.
3. Em `user_roles`: tire o papel `vendedor` das duas contas; garanta `administrador` global para as duas e `diretoria` global só para Filipe. Os gatilhos de auditoria devem registrar essas mudanças.
4. Chame `carregar_dados_demo()` **sem parâmetro**, para recriar a demonstração com os vendedores fictícios "Humberto Demo" e "Clara Demo" e o "Supervisor Demo" (sem login). Assim Filipe, como diretoria, continua vendo a demonstração inteira, e Willames, como administrador, não vê dados comerciais.

## Como conferir
1. `filipecanuto@` → nome Filipe Canuto, papéis administrador + diretoria, 0 clientes na própria carteira, e como diretoria enxerga os 60 clientes de demonstração.
2. `adm@` → nome Willames Costa, papel administrador, 0 clientes visíveis (vendas e metas também 0).
3. Existem "Humberto Demo", "Clara Demo" e "Supervisor Demo", todos com `demo = true` e sem login, com as carteiras de demonstração.
4. O login das duas contas continua funcionando (mesmo `auth_user_id`).
5. As mudanças de papel aparecem em `registro_auditoria` como "alteracao_permissao".

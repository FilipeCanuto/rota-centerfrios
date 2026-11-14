Migração nova, sem editar migrações antigas e sem alterar telas em `src/` (regenere só os tipos). Faz duas coisas: (A) passa o catálogo de **setores** para uma tabela editável pelo administrador; (B) guarda o **enquadramento** de cada mídia do login. Não mexa em `usuario_setores`, `tem_setor`, `meus_setores` nem nas políticas RESTRICTIVE da mensagem 18.

## A. Tabela `setores`
Colunas: `chave text primary key check (chave ~ '^[a-z][a-z_]{1,30}$')`, `nome text not null check (char_length(btrim(nome)) between 2 and 60)`, `icone text not null default 'building' check (icone in ('briefcase','users','wallet','receipt','truck','clipboard-check','landmark','shopping-cart','file-text','calculator','building'))`, `ativo boolean not null default true`, `disponivel boolean not null default false`, `created_at timestamptz not null default now()`, `updated_at timestamptz not null default now()` (use o gatilho de `updated_at` que o projeto já usa). Índice único em `lower(btrim(nome))`.

- `disponivel` diz que o módulo do setor está construído e publicado. **Só migração/deploy altera**: nenhuma função desta mensagem nem o app grava essa coluna.
- RLS ligada. `authenticated` só tem `select` (todas as linhas); `anon` nada. **Sem** `insert/update/delete` para `authenticated`: só as funções abaixo gravam. Revogue `insert, update, delete, truncate` de `anon` e `authenticated`.

### Dados iniciais (na mesma migração, `on conflict (chave) do nothing`)
| chave | nome | icone | ativo | disponivel |
|---|---|---|---|---|
| comercial | Comercial | briefcase | true | **true** |
| rh | RH | users | true | false |
| financeiro | Financeiro | wallet | true | false |
| faturamento | Faturamento | receipt | true | false |
| logistica | Logística | truck | true | false |
| supervisao | Supervisão | clipboard-check | true | false |
| diretoria | Diretoria | landmark | true | false |
| compras | Compras | shopping-cart | true | false |
| fiscal | Fiscal | file-text | true | false |
| contabilidade | Contabilidade | calculator | true | false |

### Funções (`security definer`, `search_path = public`, `execute` só para `authenticated` e `service_role`)
Ambas começam com `IF NOT public.eh_admin() THEN RAISE EXCEPTION 'Apenas administradores.' USING ERRCODE = '42501'; END IF;`.

- **`admin_criar_setor(_chave text, _nome text, _icone text default 'building') returns void`**: recusa chave fora de `^[a-z][a-z_]{1,30}$`, nome vazio ou fora de 2–60 caracteres, ícone fora da lista, chave ou nome (sem diferenciar maiúsculas) já existentes. Insere com `ativo = true` e `disponivel = false`. Audita com `auditar('setor_criado', 'setores', null, null, null, jsonb_build_object('chave', _chave, 'nome', _nome, 'icone', _icone))` (se `auditar` exigir um id uuid, passe nulo; se não aceitar nulo, grave a chave em `detalhes`).
- **`admin_atualizar_setor(_chave text, _dados jsonb) returns void`**: aceita **só** as chaves `nome`, `icone` e `ativo` (`ativo` boolean); qualquer outra chave (inclusive `disponivel` e `chave`) → erro 'Campo não permitido.' Recusa setor inexistente e os mesmos nome/ícone inválidos. Atualiza `updated_at`. Trava a linha (`for update`). Audita `setor_alterado` com `jsonb_build_object('chave', _chave, 'antigo', <linha antes>, 'novo', <linha depois>)`; quando só `ativo` muda, use a ação `setor_ativacao`. **Não existe exclusão**: não crie `delete` nem função de exclusão (só desativar). Desativar um setor **não** apaga nem desativa linhas de `usuario_setores`: o acesso gravado continua, só some do cadastro e do seletor.

Não aplique política RESTRICTIVE de setor em `setores` (é comum a todos os setores, como `usuarios` e `empresas`).

## B. Enquadramento da mídia do login
Em `midia_login`, adicione:
- `enquadramento text not null default 'preencher' check (enquadramento in ('preencher','ajustar'))`
- `foco_x smallint not null default 50 check (foco_x between 0 and 100)`
- `foco_y smallint not null default 50 check (foco_y between 0 and 100)`

Linhas existentes ficam com os padrões. As políticas e o trigger de auditoria que já existem para `midia_login` valem para as colunas novas (só o administrador altera; leitura pública continua devolvendo só as ativas). Se a permissão de coluna estiver listada por coluna, inclua as três.

## Tipos
Regenere `src/integrations/supabase/types.ts` (tabela `setores`, colunas novas de `midia_login`, funções `admin_criar_setor` e `admin_atualizar_setor`).

## Como conferir (salve como `tests/test_setores_editaveis.py`, no padrão dos outros testes, e rode)
Todas as chamadas como `authenticated` com o JWT de cada usuário de teste (nunca `service_role`); apague tudo no fim.
1. **Dados iniciais:** `select count(*) from setores` ≥ 10; `comercial` com `disponivel = true`; os outros nove com `disponivel = false` e `ativo = true`.
2. **Leitura:** vendedor, supervisor, diretoria e administrador conseguem `select` em `setores`; `anon` → recusado/0 linhas.
3. **Escrita direta inválida:** vendedor **e administrador** fazendo `insert`, `update` (inclusive `set disponivel = true`) e `delete` direto em `setores` → **recusado**.
4. **Funções por não administrador:** vendedor, supervisor e diretoria chamando `admin_criar_setor` e `admin_atualizar_setor` → **42501**; `anon` → recusado.
5. **Administrador, caminho certo:** `admin_criar_setor('qualidade', 'Qualidade', 'clipboard-check')` cria com `ativo = true`, `disponivel = false`; `admin_atualizar_setor('qualidade', '{"nome":"Qualidade Total"}')` renomeia; `'{"ativo": false}'` desativa; cada chamada aparece em `registro_auditoria` com `antigo` e `novo`.
6. **Inválidos:** chave `'RH!'`, `'1x'`, `''`, `null` → recusado; nome vazio ou com 61 caracteres → recusado; ícone `'foguete'` → recusado; chave repetida e nome repetido (`'  comercial '`, maiúsculas) → recusado; `_dados = '{"disponivel": true}'`, `'{"chave":"x"}'` e `'{"ativo":"sim"}'` → recusado; setor inexistente → recusado.
7. **Sem exclusão:** nenhuma função nem política permite apagar uma linha de `setores`.
8. **Desativar não tira acesso gravado:** com `rh` desativado, a linha de `usuario_setores` do usuário continua `ativo = true` e `meus_setores()` continua devolvendo `rh`; o acesso a dados do Comercial não muda.
9. **Mídia do login:** administrador atualiza `enquadramento = 'ajustar'`, `foco_x = 20`, `foco_y = 80` → ok; `enquadramento = 'cortar'`, `foco_x = 101`, `foco_y = -1` → **recusado**; vendedor atualizando essas colunas → **recusado**; leitura anônima das mídias ativas devolve as colunas novas.

Migração nova, sem editar migrações antigas e sem alterar telas em `src/` (regenere só os tipos). Cria a camada de **setores** (Comercial hoje; RH, Financeiro, Compras depois). O papel (vendedor, supervisor, diretoria, administrador) continua em `user_roles`; setor é uma camada separada e **somada**: para ler ou gravar dado comercial é preciso o papel certo (políticas atuais, que **não mudam**) **e** o setor `comercial` (políticas RESTRICTIVE novas). Administrador continua sem ver dado comercial; diretoria continua vendo tudo, desde que tenha o setor.

## 1. Conta ativa
- Em `usuarios`, adicione `ativo boolean not null default true`.
- A permissão de coluna do usuário comum **não** muda (continua só `apelido_copiloto` e `tema`).

## 2. Tabela `usuario_setores`
Colunas: `id uuid pk default gen_random_uuid()`, `usuario_id uuid not null references usuarios(id) on delete cascade`, `setor text not null check (setor ~ '^[a-z][a-z_]{1,30}$')` (sem lista fixa: setor novo não exige mudar a tabela), `empresa_id uuid references empresas(id)` (nulo = todas as empresas do usuário), `ativo boolean not null default true`, `liberado_por uuid references usuarios(id)`, `liberado_em timestamptz not null default now()`, `origem origem_dado not null default 'manual'`, `unique nulls not distinct (usuario_id, setor, empresa_id)`, índice em `(usuario_id, setor) where ativo`.

RLS ligada. `authenticated` só tem `select`: a própria linha (`usuario_id = meu_usuario_id()`) ou `eh_admin()`. **Sem** `insert/update/delete` para `authenticated` e nada para `anon`: só as funções abaixo gravam.

## 3. Funções de setor (`stable`, `security definer`, `search_path = public`; `execute` só para `authenticated` e `service_role`)
- `tem_setor(_usuario_id uuid, _setor text) returns boolean`: existe linha `ativo` em `usuario_setores` para esse usuário e setor **e** `usuarios.ativo = true`.
- `tem_setor(_setor text) returns boolean`: `tem_setor(meu_usuario_id(), _setor)`.
- `meus_setores() returns text[]`: setores ativos do usuário logado, em ordem alfabética, sem repetição; vazio se `usuarios.ativo = false`. (O app chama essa função depois do login.)

## 4. Políticas RESTRICTIVE do Comercial
Em **cada** tabela abaixo, crie **uma** política nova `AS RESTRICTIVE FOR ALL TO authenticated USING ((select public.tem_setor('comercial'))) WITH CHECK ((select public.tem_setor('comercial')))`, chamada `setor_comercial`. **Não altere nem apague nenhuma política permissiva existente.**

`clientes`, `vendas`, `itens_venda`, `orcamentos`, `interacoes`, `tarefas_agenda`, `alertas`, `metas`, `pontos`, `selos`, `notas_cliente`, `importacoes`, `posts_instagram`, `links`, `notificacoes`, `preferencias_notificacao`.

Se existir outra tabela do domínio comercial que não está na lista (carteira, vendas, metas, agenda, gamificação), aplique também e **liste na resposta**. Não aplique em `usuarios`, `empresas`, `equipes`, `user_roles`, `usuario_empresas`, `papeis_pre_cadastro`, `registro_auditoria`, `configuracoes_regras`, `configuracoes_texto`, `feriados`, `avisos`, `midia_login` (são comuns a todos os setores).

Armazenamento: em `storage.objects`, política `AS RESTRICTIVE FOR ALL TO authenticated USING (bucket_id <> 'arquivos' OR (select public.tem_setor('comercial'))) WITH CHECK (mesma expressão)`. Os outros buckets não mudam.

## 5. Funções SECURITY DEFINER do Comercial
RLS não vale dentro delas, então a checagem vai no começo de cada uma, logo depois das checagens de papel que já existem:
`IF auth.uid() IS NOT NULL AND NOT public.tem_setor('comercial') THEN RAISE EXCEPTION 'Sem acesso ao setor Comercial.' USING ERRCODE = '42501'; END IF;`
(com `auth.uid()` nulo é o agendador/`service_role`, que continua funcionando).

Aplique em: `importar_clientes`, `importar_vendas`, `importar_orcamentos`, `remanejar_cliente`, `calcular_pontos_dia`, `atualizar_selos`, `registrar_notificacoes`. Confira também `painel_vendedor`, `cobertura_vendedor`, `painel_gestao`, `ficha_cliente`, `ranking`, `gerar_tarefas_dos_alertas` e qualquer outra função que leia ou grave tabela do item 4: se for `SECURITY INVOKER` não precisa (a RLS já vale); se for `SECURITY DEFINER` e puder ser chamada por `authenticated`, aplique. Não mexa em funções de gatilho, nos auxiliares usados dentro de políticas (`pode_ver_vendedor`, `gam_*`, `has_role`…) nem em `carregar_dados_demo`/`apagar_dados_demo`. **Liste na resposta** quais funções receberam a checagem.

## 6. Cadastro pelo administrador (funções `security definer`, `search_path = public`, `execute` só para `authenticated`)
Todas começam com `IF NOT public.eh_admin() THEN RAISE EXCEPTION 'Apenas administradores.' USING ERRCODE = '42501'; END IF;`.

- **`admin_salvar_acessos(_usuario_id uuid, _papeis app_role[], _empresas uuid[], _setores text[]) returns void`**
  - Recusa: `_papeis`, `_empresas` ou `_setores` vazios ou nulos ("Marque pelo menos um setor." para setores); setor fora de `^[a-z][a-z_]{1,30}$`; empresa inexistente; usuário inexistente; o administrador tirar o papel `administrador` de si mesmo.
  - Trava a linha do usuário (`for update`).
  - **Papéis globais** (`empresa_id is null`): se o usuário já tem login, sincroniza `user_roles` (apaga os globais fora da lista, insere os que faltam); se não tem, sincroniza `papeis_pre_cadastro` do mesmo jeito. Papéis **por empresa** (`empresa_id` não nulo) ficam como estão.
  - **Empresas:** sincroniza `usuario_empresas` com `_empresas`.
  - **Setores:** linhas com `empresa_id is null` fora da lista viram `ativo = false`; as da lista ficam `ativo = true` (insere se faltar). Quando uma linha é criada ou volta a ficar ativa, grava `liberado_por = meu_usuario_id()` e `liberado_em = now()`.
  - Audita atomicamente com `auditar('alteracao_acessos', 'usuarios', _usuario_id, <empresa do usuário>, _usuario_id, jsonb_build_object('antigo', {papeis, empresas, setores}, 'novo', {papeis, empresas, setores}))`.
- **`admin_pre_cadastrar(_nome text, _email text, _papeis app_role[], _empresas uuid[], _setores text[], _pode_publicar_avisos boolean default false) returns uuid`**
  - Nome não vazio; e-mail normalizado (`lower(btrim())`) com a mesma regra de domínio do gatilho de cadastro (`centerfrios.com` ou `grupo381.com.br`); recusa e-mail que já existe em `usuarios` ("Já existe usuário com este e-mail.").
  - Insere em `usuarios` (`nome`, `email`, `empresa_id` = primeira de `_empresas`, `pode_publicar_avisos`, `ativo = true`, `auth_user_id` nulo), chama `admin_salvar_acessos` e audita `pre_cadastro`. Tudo na mesma transação. O gatilho `ao_criar_usuario` não muda: no primeiro acesso a pessoa assume a linha e os papéis.
- **`admin_atualizar_usuario`**: aceite também o campo `ativo` (só boolean). Recuse o administrador desativar a si mesmo. Quando `ativo` mudar, audite `alteracao_permissao` com `{'permissao': 'ativo', 'antigo', 'novo'}`. O resto (campos recusados, auditoria) continua igual.

## 7. Dados atuais (na mesma migração)
- **Todos** os usuários existentes (com ou sem login, demonstração inclusive) ganham `comercial` ativo em `usuario_setores` (`empresa_id` nulo, `liberado_por` nulo, `on conflict do nothing`). Ninguém perde acesso.
- `adm@centerfrios.com` e `filipecanuto@centerfrios.com`: confirme `ativo = true`, setor `comercial` ativo e que nenhum papel delas foi removido. **Informe na resposta os papéis de cada uma.**

## 8. Tipos
Regenere `src/integrations/supabase/types.ts` (coluna `ativo`, tabela `usuario_setores`, funções `tem_setor`, `meus_setores`, `admin_salvar_acessos`, `admin_pre_cadastrar`).

## Como conferir (salve como `tests/test_setores_acesso.py`, no padrão dos outros testes, e rode)
Use usuários de teste com papel e empresa CENTERFRIOS e apague tudo no fim. Todas as chamadas como `authenticated` com o JWT de cada um (nunca `service_role`).
1. **Sem setor** (vendedor com papel e empresa, sem linha em `usuario_setores`): `select` em `clientes`, `vendas`, `orcamentos`, `metas`, `links`, `notificacoes` → **0 linhas**; `insert` em `interacoes` e `tarefas_agenda` → **recusado**; `update` em `orcamentos` → 0 linhas; `rpc importar_vendas` e `calcular_pontos_dia` → **42501**; ler arquivo do bucket `arquivos` → recusado; `meus_setores()` → `{}`.
2. **Um setor** (`comercial`): lê e grava como antes (mesmo resultado dos testes atuais de RLS); `meus_setores()` → `{comercial}`.
3. **Dois setores** (`comercial` e `rh`): `meus_setores()` → `{comercial,rh}`; acesso comercial igual ao item 2. Depois o administrador tira `comercial` → o mesmo usuário passa a ler 0 linhas (item 1).
4. **Administrador com `comercial`:** continua **sem** ver carteira (0 linhas em `clientes`, como hoje); consegue `admin_pre_cadastrar` e `admin_salvar_acessos`, e cada chamada aparece em `registro_auditoria` (`pre_cadastro`, `alteracao_acessos`). `admin_salvar_acessos` com `_setores = '{}'` → **recusado**; com `'{RH!}'` → **recusado**; tirar o próprio `administrador` → **recusado**; desativar a si mesmo → **recusado**.
5. **Diretoria:** com `comercial` vê todas as empresas como hoje; sem `comercial` → 0 linhas e `importar_*` → 42501.
6. **Inválidos diretos:** vendedor faz `insert/update/delete` em `usuario_setores` (inclusive na própria linha) → **recusado**; vendedor chama `admin_salvar_acessos`/`admin_pre_cadastrar` → **42501**; `update usuarios set ativo = true` na própria linha → **recusado**.
7. **Conta desativada** (`admin_atualizar_usuario(id, '{"ativo": false}')`): `meus_setores()` → `{}` e 0 linhas em `clientes`, mesmo com a linha `comercial` ativa.
8. **Dados atuais:** `select count(*) from usuarios u where not exists (select 1 from usuario_setores s where s.usuario_id = u.id and s.setor = 'comercial' and s.ativo)` → **0**.

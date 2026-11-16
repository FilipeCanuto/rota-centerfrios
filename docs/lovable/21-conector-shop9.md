Migração nova, **depois da mensagem 20 aplicada**, sem editar migrações antigas e sem alterar telas em `src/` (regenere só os tipos). Cria o canal seguro entre a Rota e o **conector local do Shop9** (programa no computador do módulo Integrações da empresa, que só faz chamadas de saída HTTPS para `/api/conector/<acao>` da Rota). As rotas de servidor já existem no código (`src/integracoes/conectorServidor.server.ts`); elas chamam as funções abaixo com `service_role`.

Regras que valem para tudo abaixo:
- Nenhuma tabela nova tem acesso para `anon`. RLS ligada em todas.
- Funções `conector_*`: `security definer`, `search_path = public`, `revoke execute ... from public, anon, authenticated` e `grant execute ... to service_role` (**só** o servidor chama).
- Funções `admin_*`: `security definer`, `search_path = public`, `execute` só para `authenticated`, e começam com `IF NOT public.eh_admin() THEN RAISE EXCEPTION 'Só administradores.' USING ERRCODE = '42501'; END IF;`. Diretoria, supervisor e vendedor **não** veem nem gerenciam o conector.
- **Nenhum** segredo do Shop9 (endereço, série, senha, códigos de filial) entra no banco. O token do conector é guardado só como `sha256` em hex.
- Todo `RAISE` de regra usa `ERRCODE = 'P0001'` com mensagem em português.

## 1. Tabelas
- `conectores`: `id uuid pk default gen_random_uuid()`, `nome text not null check (length(btrim(nome)) between 1 and 60)`, `token_hash text not null` (sha256 hex, 64 caracteres), `ativo boolean not null default true`, `ultimo_contato timestamptz`, `versao text`, `shop9_ok boolean`, `revogado_em timestamptz`, `criado_por uuid references usuarios(id)`, `created_at timestamptz not null default now()`.
  - RLS: `select` só para administrador. **Revogue** `select (token_hash)` de `authenticated` (privilégio por coluna: `revoke select on conectores from authenticated; grant select (id, nome, ativo, ultimo_contato, versao, shop9_ok, revogado_em, created_at) on conectores to authenticated;`). Sem escrita direta.
- `conector_nonces`: `nonce text primary key`, `conector_id uuid not null references conectores(id) on delete cascade`, `acao text not null`, `criado_em timestamptz not null default now()`. Índice `(conector_id, criado_em)`. RLS ligada **sem** política (só `service_role`).
- `conector_lotes`: `conector_id uuid not null references conectores(id)`, `lote_id text not null`, `tipo text not null check (tipo in ('clientes','produtos','vendas','orcamentos'))`, `empresa_id uuid not null references empresas(id)`, `resultado jsonb not null`, `criado_em timestamptz not null default now()`, `primary key (conector_id, lote_id)`. RLS: `select` só administrador.
- `conector_eventos`: `id uuid pk`, `conector_id uuid references conectores(id)`, `empresa_id uuid references empresas(id)`, `tipo text not null` (`envio_orcamento`, `sincronizacao`, `token_gerado`, `token_revogado`, `configuracao`), `ok boolean not null`, `mensagem text` (máx. 300 caracteres, **nunca** dado de cliente: só código Shop9, contagens e erro técnico), `criado_em timestamptz not null default now()`. Índice `(criado_em desc)`. RLS: `select` só administrador.
- `shop9_integracao` (linha única): `id boolean primary key default true check (id)`, `modo text not null default 'manual' check (modo in ('manual','conector'))`, `ambiente text not null default 'homologacao' check (ambiente in ('homologacao','producao'))`, `atualizado_por uuid`, `atualizado_em timestamptz not null default now()`. Insira a linha. RLS: `select` só administrador.
- Em `shop9_envios` (mensagem 20): coluna nova `reservado_ate timestamptz` e `conector_id uuid references conectores(id)`.

## 2. Funções do administrador (tela Configurações > Integrações)
- `admin_conector_gerar_token(_conector_id uuid, _nome text) returns jsonb`: gera `token = encode(gen_random_bytes(32), 'hex')` (extensão `pgcrypto`). Se `_conector_id` é nulo, cria o conector com `_nome`; senão **gira** o token do existente (também reativa um revogado: `ativo = true`, `revogado_em = null`). Grava só `token_hash = encode(digest(token, 'sha256'), 'hex')`. Devolve `{conector_id, token}` — **única** vez que o token aparece. Evento `token_gerado` e auditoria `conector_token_gerado` (sem o token).
- `admin_conector_revogar(_conector_id uuid)`: `ativo = false`, `revogado_em = now()`; evento `token_revogado` e auditoria. O próximo pedido do conector já recebe 401.
- `admin_shop9_configurar(_modo text, _ambiente text)`: atualiza a linha de `shop9_integracao`; evento `configuracao` e auditoria `shop9_configuracao` com antigo/novo.
- `admin_shop9_status() returns jsonb` (`stable`): `{modo, ambiente, conectores: [{id, nome, ativo, ultimo_contato, versao}], eventos: [{id, criado_em, tipo, ok, mensagem}]}` com os 30 eventos mais recentes. **Sem** `token_hash`.

## 3. Funções do conector (só `service_role`)
O servidor confere a assinatura HMAC e a janela de 5 minutos **antes** de chamar `conector_registrar_pedido`; as demais funções só rodam depois dela.
- `conector_chave(_conector_id uuid) returns text` (`stable`): `token_hash` se o conector existe e está `ativo`; senão `null`.
- `conector_registrar_pedido(_conector_id uuid, _nonce text, _acao text)`:
  1. Conector inexistente ou inativo → `RAISE ... USING ERRCODE = '42501'`.
  2. `insert into conector_nonces`; em `unique_violation` → `RAISE EXCEPTION 'Pedido repetido.' USING ERRCODE = 'P0409'` (**proteção contra repetição**).
  3. Se o conector fez mais de **120** pedidos no último minuto → `RAISE EXCEPTION 'Limite de pedidos.' USING ERRCODE = 'P0429'` (**limite de taxa**).
  4. `update conectores set ultimo_contato = now()`.
  5. Apaga nonces com mais de 1 dia (a janela é de 5 minutos; guardar 1 dia sobra).
- `conector_heartbeat(_conector_id uuid, _versao text, _shop9_ok boolean) returns jsonb`: grava `versao` e `shop9_ok`; devolve `{modo, ambiente}` de `shop9_integracao`.
- `conector_trabalhos(_conector_id uuid, _limite int) returns jsonb`: se `modo <> 'conector'` → `{trabalhos: []}`. Senão pega até `least(_limite, 50)` linhas de `shop9_envios` com `estado in ('pendente','erro')`, `proxima_tentativa <= now()` e (`reservado_ate` nulo ou `< now()`), mais antigas primeiro, com `for update skip locked`; marca `reservado_ate = now() + interval '5 minutes'` e `conector_id`. Devolve `{trabalhos: [{envio_id, empresa_id, chave_idempotencia, cliente_codigo, data, vendedor_email, itens: [...]}]}` no **mesmo formato** de `shop9_pendentes` (reaproveite a mesma consulta).
- `conector_resultado(_conector_id uuid, _envio_id uuid, _ok boolean, _codigo_shop9 text, _erro text) returns jsonb`:
  - Envio já `enviado`/`confirmado` com o **mesmo** código → devolve `{ok: true}` sem mudar nada (**idempotente**). Com código diferente → P0001.
  - Senão aplica a mesma regra de `shop9_registrar_tentativa` (mensagem 20): sucesso → `enviado`, `codigo_shop9`, `enviado_em`, `orcamentos.envio_codigo_shop9`; erro → `erro`, `tentativas + 1`, `ultimo_erro` (máx. 300 caracteres), `proxima_tentativa = now() + least(60, 2 ^ tentativas) * interval '1 minute'`. Sempre `reservado_ate = null`.
  - Evento `envio_orcamento` (`ok`, mensagem = código Shop9 ou erro) e auditoria `shop9_envio_conector`.
- `conector_sincronizar(_conector_id uuid, _tipo text, _empresa_id uuid, _lote_id text, _linhas jsonb) returns jsonb`:
  1. Se já existe `conector_lotes (conector_id, lote_id)` → devolve o `resultado` gravado (**idempotente**, nada é regravado).
  2. Até 5.000 linhas. Grava com **a mesma lógica** de `importar_clientes/importar_vendas/importar_orcamentos/importar_produtos` (upsert por `(empresa_id, codigo_shop9)`; vendas com itens; orçamento da Rota confirmado pelo `envio_codigo_shop9`, como na mensagem 20), com `origem = 'integracao'` (amplie o enum `origem_dado` se faltar) e registro em `importacoes` com `arquivo = 'conector:' || _lote_id`. Para isso, extraia o miolo de cada `importar_*` numa função interna (`_importar_<tipo>_linhas(_empresa_id, _linhas)`, sem `execute` para `authenticated`) e faça a função pública e esta chamarem o mesmo miolo: as checagens de papel e de setor continuam **só** na pública.
  3. Grava `conector_lotes` com o resultado `{importacao_id, inseridas, atualizadas, ignoradas, erros}` e evento `sincronizacao` (só contagens). Devolve o resultado.

## 4. Tipos
Regenere `src/integrations/supabase/types.ts`.

## Como conferir (salve como `tests/test_conector_shop9.py`, no padrão dos outros testes, e rode)
Usuários: administrador A, diretoria D, vendedor V1. Apague tudo no fim.
1. **Token:** A `admin_conector_gerar_token(null, 'Teste')` → devolve `token` de 64 caracteres; em `conectores` só existe `token_hash = sha256(token)`; A lendo `select token_hash from conectores` → **recusado** (privilégio de coluna). Girar → hash muda; o token antigo deixa de valer em `conector_chave` (o novo vale).
2. **RLS:** D e V1 → 0 linhas em `conectores`, `conector_eventos`, `conector_lotes`, `shop9_integracao` e 42501 em todas as `admin_*` desta mensagem; `anon` → nada. A, D e V1 chamando qualquer `conector_*` → **recusado** (só `service_role`).
3. **Revogado:** A `admin_conector_revogar` → `conector_chave` devolve `null` e `conector_registrar_pedido` → 42501.
4. **Repetição:** (`service_role`) `conector_registrar_pedido(c, 'nonce-aaaaaaaaaaaaaaaa', 'heartbeat')` ok; de novo com o mesmo nonce → P0409. 121 nonces distintos no mesmo minuto → o 121º dá P0429.
5. **Fila:** com o modo `manual`, `conector_trabalhos` → vazio. A muda para `conector`; um orçamento da Rota pendente aparece **uma** vez (segunda chamada imediata → vazio, por causa da reserva). `conector_resultado(ok, 'ORC-9')` → `enviado`; repetir igual → ok sem mudar; com 'ORC-8' → P0001. Resultado de erro 2 vezes → `tentativas = 2`, `proxima_tentativa ≈ now + 4 min`.
6. **Lotes:** `conector_sincronizar` de 2 clientes com `lote_id = 'clientes:x:0:2'` → 2 inseridos; repetir o mesmo `lote_id` → **mesmo** resultado e nenhuma linha nova; outro lote com um cliente alterado → 1 atualizado. Importar orçamento com `codigo_shop9 = 'ORC-9'` → o orçamento da Rota fica `confirmado` (nenhum novo).
7. **Status:** A `admin_shop9_status()` traz modo, ambiente, o conector (sem hash) e os eventos acima, sem nome nem telefone de cliente.

Na resposta, **liste**: a migração criada, as funções e o resultado de cada item acima.

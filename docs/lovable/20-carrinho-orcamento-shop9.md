Migração nova, sem editar migrações antigas e sem alterar telas em `src/` (regenere só os tipos). Cria a **base** de catálogo de produtos, carrinho do vendedor, orçamento gerado pela Rota, fila de envio ao Shop9 e limites de desconto. Funciona **sem** API do Shop9 (lançamento manual) e fica pronta para ligar a API depois.

Regras que valem para tudo abaixo:
- Toda tabela nova tem `empresa_id uuid not null references empresas(id)`, `created_at timestamptz not null default now()`, `origem origem_dado not null default 'manual'` e `demo boolean not null default false`, RLS ligada e **nada** para `anon`.
- Dinheiro em `numeric(14,2)`, percentuais em `numeric(5,2)` com `check (x between 0 and 100)`, quantidade em `numeric(14,3)` com `check (quantidade > 0)`.
- **Arredondamento único:** `total_item = round(preco_unit * quantidade * (1 - desconto_pct/100), 2)` (meio para cima); total do carrinho/orçamento = **soma dos itens já arredondados**. Sempre calculado no servidor; o app nunca manda total.
- Toda tabela comercial nova ganha a política `setor_comercial` **AS RESTRICTIVE** com `(select public.tem_setor('comercial'))`, igual à mensagem 18. **Nunca** consulte a lista de setores direto: use só `tem_setor()` (que já inclui `usuarios.acesso_total`).
- Toda função `security definer` nova: `search_path = public`, `execute` só para `authenticated`, e começa com a checagem de setor da mensagem 18 (`IF auth.uid() IS NOT NULL AND NOT public.tem_setor('comercial') THEN RAISE EXCEPTION 'Sem acesso ao setor Comercial.' USING ERRCODE = '42501'; END IF;`). Administrador continua **sem** dado comercial (as funções recusam com 42501 quem não pode ver o vendedor, via `pode_ver_vendedor`).
- Todo `RAISE` de regra de negócio usa `ERRCODE = 'P0001'` e mensagem em português para a tela mostrar.

## 1. Catálogo `produtos`
Colunas: `id uuid pk`, `empresa_id`, `codigo_shop9 text not null`, `descricao text not null`, `unidade text not null default 'UN'`, `preco_tabela numeric(14,2) not null check (preco_tabela >= 0)`, `ativo boolean not null default true`, `atualizado_em timestamptz not null default now()` + colunas padrão. `unique (empresa_id, codigo_shop9)`.

Busca:
- Extensões `unaccent` e `pg_trgm` (se ainda não houver). Função `imutavel_unaccent(text)` `immutable` (wrapper de `unaccent('unaccent', $1)`).
- Índices: `(empresa_id, codigo_shop9 text_pattern_ops)` (exato e prefixo); `gin (imutavel_unaccent(lower(descricao)) gin_trgm_ops)` (descrição sem acento, tolerante).
- Função `buscar_produtos(_empresa_id uuid, _termo text, _limite int default 30) returns setof produtos`, `stable security invoker`: só `ativo`; código igual primeiro, depois prefixo de código, depois descrição por `similarity` / `ilike '%termo%'` sem acento. Limite máximo 100.

RLS: `select` para `authenticated` com `tem_empresa(empresa_id)`. **Sem** `insert/update/delete` para `authenticated`: só a importação grava.

Importação: `importar_produtos(_empresa_id, _arquivo, _linhas)` no **mesmo padrão** de `importar_clientes` (mensagem 11: só diretoria/administrador como hoje, checagem de setor, até 5.000 linhas, uma transação, grava em `importacoes` com `tipo = 'produtos'` — amplie o `check` de `tipo` se houver — e auditoria `importacao_produtos`, devolve `{importacao_id, inseridas, atualizadas, ignoradas, erros}`). Cada linha: `codigo_shop9`, `descricao`, `unidade`, `preco_tabela`, `ativo`. Upsert por `(empresa_id, codigo_shop9)` atualizando `descricao`, `unidade`, `preco_tabela`, `ativo`, `atualizado_em = now()`, `origem = 'importacao'`. Produto que some da planilha **não** é apagado.

"Produtos que o cliente já comprou": função `produtos_comprados(_cliente_id uuid, _limite int default 20)` `stable security invoker` que agrupa `itens_venda` do cliente por `codigo_produto` (ignora nulos), junta com `produtos` da mesma empresa (`left join`, para mostrar mesmo sem cadastro) e devolve `codigo_shop9, descricao, unidade, preco_tabela, ativo, vezes (count distinct venda_id), quantidade_total, ultima_compra (max data_faturamento da venda)`, ordenado por `ultima_compra desc, vezes desc`. Índice `itens_venda (cliente_id, codigo_produto)` se não houver.

## 2. Limites de desconto
- `configuracoes_regras` (por empresa): chaves novas `carrinho_max_abertos = 3`, `desconto_padrao_vendedor = 5`, `desconto_padrao_supervisor = 10`, `desconto_teto_supervisor = 15` (teto que supervisor pode dar a alguém da equipe). Insira para cada empresa existente (`on conflict do nothing`).
- Tabela `limites_desconto`: `id`, `empresa_id`, `vendedor_id uuid not null references usuarios(id)`, `limite_pct numeric(5,2)`, `vigencia_inicio timestamptz not null default now()`, `vigencia_fim timestamptz` (nulo = sem fim), `definido_por uuid not null references usuarios(id)`, `motivo text` + padrão. Nunca apaga: alterar = encerrar a vigência anterior e criar nova linha.
- `limite_desconto(_vendedor_id uuid, _empresa_id uuid) returns numeric` `stable security definer`: limite vigente (linha com `now()` entre início e fim, a mais recente) ou o padrão do papel (`desconto_padrao_supervisor` se o vendedor tem papel supervisor nessa empresa, senão `desconto_padrao_vendedor`).
- `definir_limite_desconto(_vendedor_id, _empresa_id, _limite_pct, _vigencia_fim timestamptz default null, _motivo text default null) returns uuid`: **diretoria** qualquer valor 0–100; **supervisor** só para vendedor da própria equipe (`equipes.supervisor_id = meu_usuario_id()`) e até `desconto_teto_supervisor` (acima → P0001 "Acima do teto definido pela diretoria."); outros → 42501. Trava `pg_advisory_xact_lock(hashtext('limite:'||_vendedor_id))`, encerra a vigente, insere a nova e audita `alteracao_limite_desconto` com antigo/novo.
- RLS de `limites_desconto`: `select` para quem `pode_ver_vendedor(vendedor_id)`; sem escrita direta.

## 3. Liberação de desconto
Tabela `liberacoes_desconto`: `id`, `empresa_id`, `vendedor_id`, `cliente_id uuid not null`, `carrinho_id uuid` (nulo = vale para o cliente), `produto_id uuid` (nulo = qualquer item), `desconto_pct numeric(5,2) not null`, `motivo text not null check (length(btrim(motivo)) >= 5)`, `estado text not null default 'pendente' check (estado in ('pendente','aprovada','negada'))`, `pct_aprovado numeric(5,2)`, `valida_ate timestamptz`, `decidido_por uuid`, `decidido_em timestamptz`, `observacao_decisao text` + padrão.

- `solicitar_liberacao_desconto(_cliente_id, _desconto_pct, _motivo, _carrinho_id default null, _produto_id default null) returns uuid`: o próprio vendedor dono do cliente; audita `solicitacao_desconto`.
- `decidir_liberacao_desconto(_id, _aprovar boolean, _pct_aprovado numeric default null, _valida_ate timestamptz default null, _observacao text default null)`: supervisor da equipe do vendedor ou diretoria (outros → 42501; o próprio solicitante nunca decide). Aprovar exige `_valida_ate > now()` (padrão `now() + interval '7 days'`) e `_pct_aprovado` (padrão o pedido; pode ser **maior** que o pedido). Supervisor fica limitado ao `desconto_teto_supervisor`; diretoria não. Só decide se `estado = 'pendente'` (`for update`). Audita `decisao_desconto`.
- RLS: `select` por `pode_ver_vendedor(vendedor_id)`; sem escrita direta.

`validar_desconto(_vendedor_id, _empresa_id, _cliente_id, _carrinho_id, _produto_id, _desconto_pct) returns boolean` `stable security definer`: verdadeiro se `_desconto_pct <= limite_desconto(...)` ou se existe liberação `aprovada`, `valida_ate >= now()`, `pct_aprovado >= _desconto_pct`, do mesmo vendedor e cliente, com `carrinho_id` nulo ou igual e `produto_id` nulo ou igual. Usada nas funções do carrinho; quando falso elas fazem `RAISE ... 'Desconto acima do seu limite: peça liberação.' USING ERRCODE = 'P0001'`.

## 4. Carrinho
- `motivos_cancelamento_carrinho`: `id`, `empresa_id`, `texto text not null`, `exige_texto boolean not null default false`, `ativo boolean default true`, `ordem int default 0` + padrão. Semente por empresa: "Cliente desistiu", "Preço", "Prazo de entrega", "Sem estoque", "Comprou com concorrente", "Outro" (este com `exige_texto = true`). RLS: `select` com `tem_empresa`; escrita só diretoria.
- `carrinhos`: `id`, `empresa_id`, `vendedor_id uuid not null references usuarios(id)`, `cliente_id uuid not null references clientes(id)`, `estado text not null default 'aberto' check (estado in ('aberto','concluido','cancelado'))`, `total numeric(14,2) not null default 0`, `motivo_cancelamento_id uuid references motivos_cancelamento_carrinho(id)`, `motivo_cancelamento_texto text`, `orcamento_id uuid references orcamentos(id)`, `concluido_em`, `cancelado_em`, `atualizado_em` + padrão. `check (estado <> 'cancelado' or motivo_cancelamento_id is not null)`.
  - Índice único parcial `(vendedor_id, cliente_id) where estado = 'aberto'` (**1 aberto por cliente por vendedor**, garantido pelo banco).
  - Índice `(vendedor_id) where estado = 'aberto'`.
- `itens_carrinho`: `id`, `empresa_id`, `carrinho_id uuid not null references carrinhos(id) on delete cascade`, `produto_id uuid not null references produtos(id)`, `codigo_shop9`, `descricao`, `unidade` (cópias do produto), `preco_unit numeric(14,2) not null` (**snapshot** de `preco_tabela` na hora de adicionar), `quantidade`, `desconto_pct numeric(5,2) not null default 0`, `total numeric(14,2) not null` + padrão. `unique (carrinho_id, produto_id)`.
- RLS de `carrinhos` e `itens_carrinho`: só `select`, por `pode_ver_vendedor(vendedor_id)` (vendedor os próprios, supervisor a equipe, diretoria tudo; administrador nada). **Sem** `insert/update/delete` para `authenticated`: só as funções abaixo gravam.

Funções (`security definer`, checagem de setor no começo; quem grava é sempre o **vendedor dono** e o cliente precisa ser da carteira dele, `clientes.vendedor_id = meu_usuario_id()`; supervisor e diretoria só leem):
- `abrir_carrinho(_cliente_id uuid) returns uuid`:
  1. `pg_advisory_xact_lock(hashtext('carrinho:' || meu_usuario_id()))` — **trava por vendedor**: dois cliques ou duas abas ao mesmo tempo esperam um pelo outro.
  2. Se já há carrinho aberto desse vendedor para o cliente → devolve o **mesmo id** (idempotente, não é erro).
  3. Conta os abertos do vendedor; se `>= carrinho_max_abertos` da empresa do cliente → P0001 "Você já tem N carrinhos abertos. Conclua ou cancele um." (N = valor configurado).
  4. Insere e devolve o id. O índice único parcial é a segunda barreira (em `unique_violation`, devolva o id existente).
- `adicionar_item_carrinho(_carrinho_id, _produto_id, _quantidade numeric, _desconto_pct numeric default 0) returns uuid`: carrinho `aberto` do chamador (`for update`), produto `ativo` da mesma empresa, `validar_desconto(...)`; se o produto já está no carrinho, **soma** a quantidade e mantém o preço snapshot original. Recalcula o total do item e do carrinho.
- `alterar_item_carrinho(_item_id, _quantidade numeric, _desconto_pct numeric)`: mesmas checagens; o preço **não** muda.
- `remover_item_carrinho(_item_id)`.
- `cancelar_carrinho(_carrinho_id, _motivo_id uuid, _texto text default null)`: motivo ativo da empresa obrigatório; se `exige_texto`, `_texto` com pelo menos 5 caracteres. Grava `cancelado_em`, audita `cancelamento_carrinho`.
- `concluir_carrinho(_carrinho_id) returns uuid` (id do orçamento):
  1. `for update` no carrinho. Já `concluido` → devolve o `orcamento_id` existente (**idempotente**). `cancelado` → P0001.
  2. Pelo menos 1 item; **revalida o desconto de todos os itens** com `validar_desconto` (liberação vencida depois de adicionar bloqueia aqui).
  3. Cria o orçamento (item 5) com `chave_idempotencia = 'rota:carrinho:' || _carrinho_id` por `insert ... on conflict (chave_idempotencia) do nothing` + `select`, copia os itens, cria a linha da fila (item 6) e marca o carrinho `concluido` com `orcamento_id` e `concluido_em`. Tudo numa transação. Audita `conclusao_carrinho`.
- Todas atualizam `atualizado_em` e recalculam `carrinhos.total = sum(itens.total)`.

## 5. Orçamento da Rota
Em `orcamentos` (os estados `aberto`/`ganho`/`perdido` e as permissões de coluna atuais **não mudam**):
- `origem_rota boolean not null default false` (verdadeiro = criado pela Rota; o enum `origem_dado` não muda).
- `chave_idempotencia text unique` (nula nos importados).
- `carrinho_id uuid references carrinhos(id)`.
- `envio_estado text check (envio_estado in ('pendente','enviado','erro','confirmado'))` (nulo nos importados) — estado **separado** de `status`.
- `envio_codigo_shop9 text` (código que o Shop9 deu ao lançamento).

O orçamento da Rota nasce com `status = 'aberto'`, `data = current_date` em America/Maceio, `valor` = total do carrinho, `vendedor_id` e `cliente_id` do carrinho, `envio_estado = 'pendente'`.

`itens_orcamento`: `id`, `empresa_id`, `orcamento_id uuid not null references orcamentos(id) on delete cascade`, `produto_id`, `codigo_shop9`, `descricao`, `unidade`, `preco_unit`, `quantidade`, `desconto_pct`, `total` + padrão. RLS: `select` por `pode_ver_vendedor` do vendedor do orçamento; sem escrita direta; política `setor_comercial`.

**Confirmação pela importação:** em `importar_orcamentos`, se a linha tiver `codigo_shop9` igual ao `envio_codigo_shop9` de um orçamento da Rota da mesma empresa, **atualize esse orçamento** (não crie outro): `codigo_shop9`, `status` e `valor` vindos da planilha e envio `confirmado`. Assim o lançamento manual nunca duplica o orçamento.

## 6. Fila de envio ao Shop9 (outbox)
`shop9_envios`: `id`, `empresa_id`, `orcamento_id uuid not null unique references orcamentos(id)`, `chave_idempotencia text not null unique` (a mesma do orçamento: **é ela que vai ao ERP** para nunca duplicar), `estado text not null default 'pendente' check (estado in ('pendente','enviado','erro','confirmado'))`, `tentativas int not null default 0`, `ultimo_erro text`, `proxima_tentativa timestamptz not null default now()`, `codigo_shop9 text`, `enviado_em`, `confirmado_em`, `atualizado_em` + padrão. Índice `(estado, proxima_tentativa) where estado in ('pendente','erro')`. Gatilho mantém `orcamentos.envio_estado` igual a `shop9_envios.estado`. Transições permitidas: pendente→enviado|erro, erro→enviado|erro, enviado→confirmado|erro; `confirmado` é final.
RLS: `select` por `pode_ver_vendedor` do vendedor do orçamento; sem escrita direta.

Funções:
- `shop9_pendentes(_empresa_id uuid) returns jsonb` (`stable security definer`, só **diretoria**): lista de `{id (do orçamento), chave_idempotencia, cliente_codigo, data, vendedor_email, itens: [{codigo_produto, descricao, unidade, quantidade, preco_unit, desconto_pct, total}]}` com envio `pendente` ou `erro`, mais antigos primeiro. É o que o app exporta em CSV.
- `shop9_marcar_enviado(_orcamento_id uuid, _codigo_shop9 text)` (só diretoria): código obrigatório (`btrim` não vazio); recusa código já usado em outro orçamento da empresa; grava `estado = 'enviado'`, `codigo_shop9`, `enviado_em` e `orcamentos.envio_codigo_shop9`. Repetir com o **mesmo** código é idempotente; com outro código depois de `enviado` → P0001. Audita `shop9_envio_manual`.
- `shop9_registrar_tentativa(_envio_id uuid, _ok boolean, _codigo_shop9 text default null, _erro text default null)`: **só `service_role`** (`revoke execute` de `authenticated` e `public`) — é para o futuro envio automático. Sucesso → `enviado` com código; erro → `erro`, `tentativas + 1`, `ultimo_erro`, `proxima_tentativa = now() + least(60, 2 ^ tentativas) * interval '1 minute'`.
- Segredos futuros (`SHOP9_API_URL`, `SHOP9_API_TOKEN`) **só** em Secrets do servidor. **Não** crie o envio automático agora.

## 7. Tipos
Regenere `src/integrations/supabase/types.ts` (tabelas e funções novas, colunas novas de `orcamentos`).

## Como conferir (salve como `tests/test_carrinho_shop9.py`, no padrão dos outros testes, e rode)
Usuários de teste na CENTERFRIOS: vendedor V1 e V2 (equipe do supervisor S), diretoria D, administrador A, vendedor V3 **sem** setor comercial, e U com `acesso_total` sem linha em `usuario_setores`. Todas as chamadas como `authenticated` com o JWT de cada um (nunca `service_role`, salvo no item 9). Apague tudo no fim.

1. **Catálogo:** D importa 3 produtos (um com preço inválido) → 2 inseridos, 1 erro; reimportar → 0 inseridos, 2 atualizados. V1 lê `produtos` e `buscar_produtos(empresa, 'frezer')` acha "Freezer" (sem acento e com erro de digitação); `buscar_produtos(empresa, 'P1')` traz o código exato primeiro. V1 `insert/update/delete` em `produtos` → **recusado**; V1 `importar_produtos` → 42501.
2. **Comprados:** com 2 vendas do cliente (produto X 2 vezes, Y 1 vez mais recente), `produtos_comprados` → Y primeiro (mais recente), depois X, com `vezes` certo.
3. **Limite de 3:** V1 abre carrinhos para clientes C1, C2, C3 → ok; C4 → P0001. `abrir_carrinho(C1)` de novo → devolve o **mesmo id**. Cancelar um e abrir C4 → ok.
4. **Corrida:** com V1 tendo 2 abertos, dispare **5 chamadas simultâneas** de `abrir_carrinho` (5 conexões em threads, clientes diferentes) → exatamente **1** sucesso e 4 P0001; `count(*) where estado = 'aberto'` = 3. Dispare 2 simultâneas para o **mesmo** cliente → mesmo id nas duas, 1 linha.
5. **Totais e arredondamento:** item preço 33,33 × 3 com 10% → `total` 89,99; dois itens de 0,335 × 1 → carrinho 0,68 (soma dos itens arredondados). Alterar `preco_tabela` do produto depois → o item **mantém** o preço antigo. V1 `update itens_carrinho set total = 1` → **recusado**.
6. **Desconto:** limite padrão 5%. Item com 5% → ok; 6% → P0001. V1 solicita 12%; S aprova 15% com validade amanhã → adicionar com 12% ok. S tenta aprovar 20% (teto 15%) → P0001; D aprova 20% → ok. S define limite de V1 em 16% (acima do teto) → P0001; D define 30% → ok e aparece em `registro_auditoria`. Liberação com `valida_ate` no passado → `concluir_carrinho` com item acima do limite → P0001. V1 decide a própria liberação → 42501. S tenta definir limite de vendedor de outra equipe → 42501.
7. **Concluir e idempotência:** `concluir_carrinho` cria 1 orçamento (`origem_rota`, `status = 'aberto'`, `envio_estado = 'pendente'`, itens copiados, `valor` = total) e 1 linha em `shop9_envios`; chamar **de novo** (e 2 chamadas simultâneas) devolve o **mesmo** orçamento: continua 1 orçamento e 1 envio. Concluir carrinho vazio ou cancelado → P0001. Cancelar sem motivo, ou com "Outro" sem texto → recusado.
8. **Envio manual:** D `shop9_pendentes` lista o orçamento; `shop9_marcar_enviado(orc, 'ORC-123')` → `enviado`; repetir igual → ok; outro código → P0001; mesmo código em outro orçamento → P0001. V1 chama `shop9_pendentes`/`shop9_marcar_enviado` → 42501. D importa planilha de orçamentos com `ORC-123` → o **mesmo** orçamento fica `confirmado` com `codigo_shop9 = 'ORC-123'` (nenhum orçamento novo).
9. **Fila (service_role):** `shop9_registrar_tentativa(envio, false, null, 'timeout')` 2 vezes → `erro`, `tentativas = 2`, `proxima_tentativa` ≈ now + 4 min. V1 e D chamam essa função → **recusado**.
10. **RLS:** V1 vê só os próprios carrinhos, itens, orçamentos da Rota, envios e liberações; V2 não vê os de V1; S vê os de V1 e V2; D vê tudo; A vê **0 linhas** em `carrinhos`, `itens_orcamento`, `shop9_envios`, `liberacoes_desconto` e recebe 42501 em `abrir_carrinho`. S e D chamando `abrir_carrinho` para cliente de V1 → recusado (não é carteira deles).
11. **Setor:** V3 (sem `comercial`) → 0 linhas em todas as tabelas novas e 42501 em todas as funções novas. U (`acesso_total`, sem linha de setor) → acesso igual ao do seu papel.
12. **Inválidos diretos:** qualquer `authenticated` faz `insert/update/delete` em `carrinhos`, `itens_carrinho`, `itens_orcamento`, `shop9_envios`, `limites_desconto`, `liberacoes_desconto` → **recusado**; `anon` → nada.

Na resposta, **liste**: as migrações criadas, as funções com a checagem de setor e o resultado de cada item acima.

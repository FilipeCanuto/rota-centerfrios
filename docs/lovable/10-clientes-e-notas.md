Migração nova, sem editar migrações antigas e sem alterar telas em `src/` (mantenha a regeneração de `src/integrations/supabase/types.ts`). Base para Clientes (ficha 360) e para a importação do Shop9.

## 1. Códigos do Shop9 e etiquetas
- `clientes`: adicione `codigo_shop9 text`, `documento text` (CPF/CNPJ só dígitos), `email text`, `etiquetas text[] not null default '{}'`. Índice único parcial em `(empresa_id, codigo_shop9)` quando `codigo_shop9` não for nulo. Índice GIN em `etiquetas`.
- `vendas`: adicione `codigo_shop9 text` (número da nota/pedido), com índice único parcial em `(empresa_id, codigo_shop9)`.
- `orcamentos`: adicione `codigo_shop9 text` (índice único parcial igual), `proximo_followup date` e `observacao text`.
- O vendedor pode alterar só `etiquetas` dos clientes da própria carteira (permissão por coluna + política de update com carteira visível; supervisor e diretoria também). As demais colunas continuam sem update pela API.
- O vendedor pode alterar `proximo_followup` e `observacao` dos orçamentos visíveis (some às permissões por coluna que já existem).

## 2. Itens das vendas
Tabela `itens_venda`: `id`, `empresa_id`, `venda_id` (→ vendas, cascade), `cliente_id`, `vendedor_id`, `produto text not null`, `codigo_produto text`, `quantidade numeric not null default 1`, `valor_total numeric not null default 0`, `origem`, `demo`, `created_at`. RLS: leitura com carteira visível (`tem_empresa` + `pode_ver_vendedor`); escrita só por `service_role` e pelas funções de importação. Índices em `(cliente_id)` e `(venda_id)`. Inclua em `apagar_dados_demo()`.

## 3. Notas do cliente
Tabela `notas_cliente`: `id`, `empresa_id`, `cliente_id`, `vendedor_id` (dono da carteira), `autor_id` (→ usuarios, padrão `meu_usuario_id()`), `texto text not null` (até 2.000 caracteres), `origem`, `demo`, `created_at`. RLS: ler com carteira visível; inserir com carteira visível e `autor_id = meu_usuario_id()`; apagar só o próprio autor nas primeiras 24 h. Inclua em `apagar_dados_demo()`.

## 4. Ficha 360 em uma chamada
Função `ficha_cliente(_cliente_id uuid, _hoje date)` (`security invoker`, `stable`), que devolve `jsonb`: dados do cliente; `compras` (até 24 últimas vendas com data, valor e itens); `total_12m`, `qtd_12m`, `ticket_medio_12m`; `itens_mais_comprados` (top 10 por quantidade em 12 meses); `orcamentos` (todos, com status); `interacoes` (últimas 30, com dia local em America/Maceio); `notas` (últimas 30, com nome do autor). A RLS do chamador vale para tudo.

## Como conferir
1. Vendedor de teste altera `etiquetas` de cliente próprio: funciona; de cliente de outro: 0 linhas; tenta alterar `nome`: recusado.
2. `ficha_cliente` de cliente próprio devolve todos os blocos; de cliente de outro vendedor devolve nulo/vazio.
3. Nota: o autor apaga a própria nota; outro usuário não.
Apague os dados de teste.

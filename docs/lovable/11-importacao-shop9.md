Migração nova, sem editar migrações antigas e sem alterar telas em `src/` (mantenha os tipos regenerados). Importação das planilhas do Shop9 feita pela tela do app; o banco recebe linhas já mapeadas e validadas pelo app e grava tudo numa transação.

## 1. Registro dos lotes
Tabela `importacoes`: `id`, `empresa_id`, `usuario_id` (padrão `meu_usuario_id()`), `tipo text` (`clientes`, `vendas`, `orcamentos`), `arquivo text`, `total_linhas int`, `inseridas int`, `atualizadas int`, `ignoradas int`, `erros jsonb not null default '[]'` (lista `{linha, campo, mensagem}`), `origem` (`importacao`), `created_at`. RLS: ler e inserir só `diretoria`.

## 2. Funções de importação
Três funções `security definer`, executáveis por `authenticated`, permitidas **só para `diretoria`** na empresa informada (`has_role` de três parâmetros):
- `importar_clientes(_empresa_id uuid, _arquivo text, _linhas jsonb)`: cada linha tem `codigo_shop9`, `nome`, `telefone`, `documento`, `email`, `segmento`, `cidade`, `vendedor_email`. Faz upsert por `(empresa_id, codigo_shop9)`. O vendedor é achado por e-mail entre os usuários com vínculo na empresa; se não achar, grava a linha em `erros` e não importa o cliente. Na atualização, **não muda** `vendedor_id` de cliente existente (troca de carteira só por `remanejar_cliente`).
- `importar_vendas(_empresa_id, _arquivo, _linhas)`: cada linha tem `codigo_shop9` (nota), `cliente_codigo`, `data_faturamento`, `valor` e `itens` (lista opcional `{produto, codigo_produto, quantidade, valor_total}`). O vendedor da venda é o dono atual do cliente. Upsert por `(empresa_id, codigo_shop9)`, substituindo os itens. Atualiza `clientes.data_ultima_compra` quando a venda for mais recente.
- `importar_orcamentos(_empresa_id, _arquivo, _linhas)`: `codigo_shop9`, `cliente_codigo`, `data`, `valor`, `status` (`aberto`, `ganho`, `perdido`). Upsert por `(empresa_id, codigo_shop9)`, sem apagar `ultimo_followup`, `proximo_followup` nem `observacao` já registrados.

Regras comuns: `origem = 'importacao'`, `demo = false`; linha com cliente inexistente vai para `erros`; tudo numa transação; grava a linha em `importacoes` e uma auditoria "importacao_<tipo>" com os totais; devolve `{importacao_id, inseridas, atualizadas, ignoradas, erros}`. Limite de 5.000 linhas por chamada.

## Como conferir
1. Diretoria importa 3 clientes (um com vendedor inexistente): 2 inseridos, 1 erro com o número da linha.
2. Reimportar o mesmo arquivo: 0 inseridos, 2 atualizados, sem duplicar.
3. Venda com itens: aparece em `vendas` e `itens_venda`, e `data_ultima_compra` do cliente é atualizada.
4. Vendedor ou administrador chamando qualquer função: recusado.
5. `importacoes` e `registro_auditoria` têm os lotes.
Apague os dados de teste.

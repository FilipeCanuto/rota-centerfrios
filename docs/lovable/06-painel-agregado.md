Agora uma função no banco que entrega os números do painel já somados. Hoje a tela baixa vendas e interações linha a linha, e a API corta em 1.000 linhas: com a carteira real, o faturado sai errado sem aviso. Faça numa **migração nova**, sem editar migrações antigas e **sem alterar as telas em `src/`**. A tela passa a usar a função num outro ramo. Só regenere `src/integrations/supabase/types.ts`.

## 1. Função `public.painel_vendedor(_empresa_id uuid, _vendedor_id uuid, _hoje date)`
- `security invoker` (as regras de RLS de quem chama continuam valendo), `stable`, com execução liberada para `authenticated`.
- Se `_hoje` vier nulo, usar a data de hoje em `America/Maceio`.
- **Todas as datas de eventos** (`interacoes.data`, `timestamptz`) devem ser convertidas para o dia local com `(data at time zone 'America/Maceio')::date`.
- Não aplica regras de negócio (dias úteis, limites, status): só devolve os dados agregados. As regras ficam no código do app, que é testado.

Devolve um único `jsonb` com:

| Campo | Conteúdo |
| --- | --- |
| `faturado_mes` | soma de `vendas.valor` do vendedor na empresa, de 1º do mês de `_hoje` até `_hoje` |
| `faturado_hoje` | soma de `vendas.valor` com `data_faturamento = _hoje` |
| `meta` | a linha de `metas` do mês (`meta_vendas`, `meta_orcamentos`, `meta_cobertura`, `meta_reativacao`) ou nulo |
| `orcamentos_mes` | quantidade de orçamentos com `data` no mês até `_hoje` |
| `orcamentos_hoje` | quantidade com `data = _hoje` |
| `pontos_hoje` | soma de `pontos.pontos` com `data = _hoje` |
| `clientes` | lista, um item por cliente da carteira (`vendedor_id = _vendedor_id`, empresa `_empresa_id`), com os campos abaixo |

Cada item de `clientes`:
- `id`, `nome`, `telefone`, `segmento`, `cidade`, `empresa_id`, `data_ultima_compra`;
- `compras`: as datas distintas de `data_faturamento` das **últimas 12 compras** (mais recentes primeiro);
- `comprou_no_mes`: verdadeiro se tem venda entre 1º do mês e `_hoje`;
- `ultima_interacao`: o dia local da interação mais recente, de qualquer tipo;
- `ultima_interacao_qualificada`: o dia local da interação qualificada mais recente. É qualificada quando `cliente_respondeu = true`, **ou** quando `tipo` é `visita` ou `ligacao` e `resultado` não está vazio;
- `qualificada_hoje`: verdadeiro se houve interação qualificada com dia local igual a `_hoje`;
- `qualificada_no_mes`: verdadeiro se houve interação qualificada entre 1º do mês e `_hoje`;
- `orcamentos_abertos`: lista de `{ id, valor, data, ultimo_followup }` com `status = 'aberto'`.

**Não** misture a compra na `ultima_interacao_qualificada`: o app junta as duas fontes (compra e interação) numa regra testada.

## 2. Função leve `public.cobertura_vendedor(_empresa_id uuid, _vendedor_id uuid, _hoje date)`
Para o selo de cobertura do cabeçalho, sem carregar o painel inteiro: devolve `{ total, cobertos }`. `total` é a quantidade de clientes da carteira; `cobertos` são os clientes da carteira com venda no mês **ou** interação qualificada no mês, contados uma vez cada. Mesmas regras de fuso, segurança e permissão da função anterior.

## 3. Feriados
A função **não** calcula dias úteis. O app lê a tabela `feriados` (mensagem 04) e faz as contas.

## Como conferir
1. Para um vendedor de demonstração, compare `painel_vendedor(...)->>'faturado_mes'` com `select sum(valor) from vendas where ...` no mesmo mês: devem ser iguais.
2. Crie como teste um vendedor com **1.500 vendas** no mês e confira que `faturado_mes` soma todas (não para em 1.000). Apague o teste.
3. Crie uma interação qualificada com `data = '2026-11-10 23:30-03'` e confira que ela conta para o dia 10/11, e não para 11/11.
4. Como vendedor de teste, chame a função passando o id de **outro** vendedor: a lista `clientes` vem vazia e as somas vêm zeradas (efeito da RLS).
5. `cobertura_vendedor` dá o mesmo `cobertos` que contar, a partir de `painel_vendedor`, os clientes com `comprou_no_mes` ou `qualificada_no_mes`.

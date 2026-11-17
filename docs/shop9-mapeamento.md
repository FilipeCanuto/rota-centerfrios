# Shop9 ↔ Rota — mapeamento campo a campo e perguntas à Idealsoft

Base: documentação oficial resumida em [shop9-api-referencia.md](shop9-api-referencia.md). Código: `conector-shop9/src/shop9/mapear.js` (Shop9 → linha) e as funções do banco do [texto 22](lovable/22-conector-shop9-adaptador.md) (linha → tabela). Sem a API, a Rota segue com planilha (Configurações → Importação) e CSV de orçamento.

## Onde fica cada configuração
| Dado | Onde | Por quê |
|---|---|---|
| Série, senha do módulo, endereço do módulo | `config.json` no computador do conector | Segredo; produção só na rede local |
| Código da filial, operação de orçamento (código e sigla), siglas de venda, tabela de preço, caixa | Rota: Configurações → Integrações → Códigos por empresa (`shop9_empresas`) | Não sensível; o administrador ajusta sem mexer no computador |
| Vendedor do Shop9 → pessoa da Rota | Rota: Vendedores do Shop9 (`shop9_vendedores`) | Automático pelo e-mail; correção manual prevalece |
| Posição da sincronização | Rota (`shop9_cursores`), gravada junto com o lote | Reinstalar o conector não recomeça do zero |

## Campo a campo (Shop9 → Rota)
| Recurso Shop9 | Campo Shop9 | Rota | Observação |
|---|---|---|---|
| Funcionários (`vendedor=true`) | `codigo` | `shop9_vendedores.codigo` | |
| | `apelido` ou `nome` | `shop9_vendedores.nome` | |
| | `email` | liga a `usuarios` da empresa | Só se não houver vínculo manual |
| | `inativo` / `vendedor` | `shop9_vendedores.ativo` | |
| Clientes | `codigo` | `clientes.codigo_shop9` | |
| | `nome` (ou `fantasia`) | `clientes.nome` | |
| | `cpfCnpj` | `clientes.documento` (só dígitos) | |
| | `telefone1`/`telefone2` | `clientes.telefone` | Não apaga o que já existe |
| | `cidade`/`uf` | `clientes.cidade` ("Maceió/AL") | |
| | `vendedor1.codigo` | `clientes.vendedor_id` **só no cliente novo** | A carteira é da Rota |
| | `limiteCredito`, `dataValidadeCredito`, `bloqueado` | `clientes.shop9_limite_credito`, `shop9_credito_validade`, `shop9_bloqueado` | Ficha 360 |
| Crédito (`/credito/cliente/saldos`) | `codigoCliFor`, `saldo` | `clientes.shop9_saldo_credito` | |
| Produtos | `codigo`, `nome`, `nomeUnidadeVendas` | `produtos.codigo_shop9`, `descricao`, `unidade` | |
| | `precos[tabela = configurada].preco` | `produtos.preco_tabela` | |
| | `inativo` ou `bloquearVenda` | `produtos.ativo = false` | |
| Preços (`/v3/precos`) | `codigo_Prod_Serv`, `preco_Original` da tabela configurada | `produtos.preco_tabela` | Promoção ignorada |
| Estoque (`/v2/estoque`) | `estoqueFiliais[codigoFilial = filial].estoqueAtual` | `produtos.estoque` | Soma cor/tamanho |
| Motivos de desconto | `codigo`, `descricao` (**suposto**) | `shop9_motivos_desconto` | Exemplo da documentação vazio |
| Saídas (`/saidas`, siglas configuradas) | `ordem` | `vendas.shop9_ordem`; `codigo_shop9 = s<ordem>-<vendedor>` | Uma linha por vendedor |
| | `codigo_Cliente` | `vendas.cliente_id` | Cliente precisa existir |
| | `efetivadoFinanceiro` e não `desefetivadoFinanceiro` | entra na meta; senão sai | |
| | dia da janela com `tipodata=E` | `vendas.data_faturamento` | Não há campo de data de efetivação |
| | `total_Com_Desconto` dividido por item: `codigo_Vendedor_1`; com `codigo_Vendedor_2`, metade para cada | `vendas.valor` por vendedor | Centavos, sobra pelo maior resto |
| | `produtos[codigo, quantidade, preco_Final_Com_Desconto]` | `itens_venda` | Descrição pelo cadastro de produtos |
| Devoluções (`/devolucao`) | mesmos campos da saída (**suposto**) | `vendas` com valor **negativo**, `shop9_tipo = devolucao` | Desconta da meta de quem vendeu |

## Rota → Shop9 (orçamento da fila)
| Rota | Shop9 (`POST /saidas`) |
|---|---|
| `clientes.codigo_shop9` | `codigoCliente` |
| Códigos por empresa: operação de orçamento | `codigoOperacao` |
| `ROTA:<id do envio>` | `observacao` e `ReferenciaInterna` (busca anti-duplicidade) |
| vendedor do orçamento → `shop9_vendedores.codigo` | `codigoVendedor_1` |
| Códigos por empresa: caixa, tabela | `codigoCaixa`, `tabelaPreco` |
| `itens_orcamento.codigo_shop9`, `quantidade`, `preco_unit` | `produtos[].codigo`, `quantidade`, `precoUnitario` |
| `preco_unit × desconto_pct` (centavos) | `produtos[].descontoUnitario` |
| ordem achada pela marca | `orcamentos.envio_codigo_shop9` |

Não chamamos `efetivarestoque` nem `efetivarfinanceiro`: o orçamento não mexe em estoque nem financeiro.

## Perguntas abertas à Idealsoft
1. **Operação de orçamento**: qual código e sigla usar (ORC ou DAV)? Um `POST /saidas` com essa operação efetiva estoque ou financeiro sozinho?
2. **Timestamp** da assinatura: segundos Unix, milissegundos ou data? Qual a tolerância de relógio? (Hoje: segundos.)
3. **Trim do corpo**: em que casos o `trim` "remove espaços" e exige exceção? (Hoje mandamos JSON sem espaços nas pontas.)
4. **Ordem criada**: o `POST /saidas` síncrono pode devolver a `ordem`? Ou o recibo do `POST /vendas` é o caminho recomendado? (Hoje buscamos a saída pela marca em `ReferenciaInterna`/`observacao`.)
5. **Busca por referência**: existe filtro por `ReferenciaInterna`? Qual o tamanho máximo dela e da `observacao`?
6. **Data de efetivação**: há um campo com a data/hora em que a saída foi efetivada? (Hoje usamos o dia da janela com `tipodata=E`.)
7. **Devoluções**: campos da resposta de `/devolucao` (vendedores, valor, saída de origem).
8. **Venda compartilhada**: a regra de divisão entre `codigo_Vendedor_1` e `codigo_Vendedor_2` é meio a meio? Existe percentual por vendedor? (Também confirmar com a CENTERFRIOS.)
9. **Motivos de desconto**: campos da resposta.
10. **Token**: duração e se há limite de tokens ativos por filial.
11. **Limites**: requisições por minuto, tamanho máximo de corpo e de página; tempo de resposta esperado.
12. **Credenciais de teste** (série, filial, senha) para a CENTERFRIOS e a 381, e a porta padrão do módulo na rede local.
13. **Cliente bloqueado / sem crédito**: o `POST /saidas` recusa? Com qual `tipo` de erro?

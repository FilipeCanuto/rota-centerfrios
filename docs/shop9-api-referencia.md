# API do módulo Integrações do Shop9 — resumo técnico

Fonte: documentação oficial https://www.idealsoft.com.br/integracoes/ ("Documentação gerada em 05/08/2026"), lida inteira em 16/11/2026.
Só o que o conector usa. Onde a página não diz, está escrito **não consta** (vira pergunta em [shop9-mapeamento.md](shop9-mapeamento.md)).

## Geral
- Módulo só para Shop Control 9 **Corporate**; ativação em base real tem custo (comercial@idealsoft.com.br).
- Base URL: `{{server}}` = endereço fornecido pela Idealsoft. Servidor de **teste**: `http://idealsoftexportaweb.eastus.cloudapp.azure.com:60500/` (série, filial de teste e senha pedidas a suporte@idealsoft.com.br). Endereço do módulo local de produção: não consta (é o computador onde o módulo roda).
- **HTTP 200 sempre**, inclusive em erro. Envelope:
  `{ "sucesso": bool, "mensagem": string, "tipo": string, "complementoTipo": string, "statusCode": int, "dados": json }`.
  `sucesso=false` → `dados` vazio; `statusCode` traz o código HTTP do problema (ex.: 401 token inválido, 400 campo, 404 não encontrado).
- `tipo` possíveis: `EXCECAO_SERVIDOR`, `AUTENTICACAO_INVALIDA`, `HEADER_INVALIDO`, `BODY_INVALIDO`, `CAMPO_INVALIDO`, `LICENCA_EXPIRADA_OU_INVALIDA`, `FIM_DE_PAGINA`, `REGISTRO_NAO_ENCONTRADO`, `TIPO_BUSCA_INVALIDO`.
- Limite de taxa e timeout: não consta.

## Autenticação
- `GET {{server}}/auth/?serie=[string]&codfilial=[integer]` (sem os cabeçalhos de assinatura).
- `dados`: `token`, `expireAt` (UTC, `YYYY-MM-DDTHH:MM:SS.0000000+00:00`). Duração: não consta. Token **por filial** (o cabeçalho `CodFilial` é "a filial para a qual o token foi gerado").
- Demais chamadas, cabeçalhos:
  - `Authorization: Token <token>`
  - `CodFilial: <código da filial>`
  - `Timestamp: <o mesmo usado na assinatura>` — formato (segundos, milissegundos, data) **não consta**.
  - `Signature`:
    ```
    conteudo  = metodoHttpMinusculo + timestamp + base64(trim(body))
    signature = base64( HMACSHA256(conteudo, senhaDoModulo) )
    ```
    Sem corpo (GET): a página diz "Conteúdo do BODY (se houver)" → só `metodo + timestamp`. Codificação UTF-8 assumida (não consta). Aviso da página: o `trim` pode exigir exceção quando remove espaços significativos.

## Convenções
- Paginação no caminho: `/recurso/{pagina}`, a partir de 1, até `tipo = FIM_DE_PAGINA`. Até 20 registros por página (10 em alguns).
- `datade` / `dataate`: data de **alteração**, formato `YYYY-MM-DD HH:MM:SS`. Exceções nos exemplos: `/v3/precos` usa `DD-MM-YYYY`; `/motivos_desconto` usa `YYYY-MM-DD`; `/credito/cliente/saldos` usa `dataAte` (A maiúsculo).
- `tipodata` (saídas, devoluções, entradas): `A` alteração, `C` criação, `E` efetivação.

## Recursos usados
| Recurso | Caminho | Filtros | Campos usados |
|---|---|---|---|
| Filiais | `GET /filiais/{p}` | `ativo`, `datade`, `dataate` | `codigo`, `nome`, `cNPJ` |
| Funcionários | `GET /funcionarios/{p}` | `ativo`, `vendedor=true`, `tecnico` | `codigo`, `nome`, `apelido`, `email`, `inativo`, `vendedor`, `codigoFilial`, `dataAlteracao` |
| Clientes | `GET /clientes/{p}` | `datade`, `dataate`, `ativo=A/I` | `codigo`, `nome`, `fantasia`, `cpfCnpj`, `cidade`, `uf`, `telefone1`, `telefone2`, `vendedor1.codigo`, `vendedor2.codigo`, `limiteCredito`, `dataValidadeCredito`, `bloqueado`, `inativo`, `dataAlteracao`; e-mail fica em `contatos` (não usado) |
| Produtos | `GET /produtos/{p}` | `datade`, `dataate` | `codigo`, `nome`, `nomeUnidadeVendas`, `inativo`, `bloquearVenda`, `precos[{tabela, preco, promocional}]`, `estoqueAtual` |
| Preços | `GET /v3/precos/{p}` | `datade`/`dataate` (`DD-MM-YYYY`), `considerarPromocoesAlteradas` | `dados.codigo`, `dados.precos[{codigo_Prod_Serv, tabela, preco_Original, promocional, preco_Promocional, dataInicio, dataFim}]` — `dados` é objeto, não lista |
| Tabelas de preço | `GET /tabelasprecos/{p}` | `datade`, `dataate`, `ativo` | exemplo vazio: campos não constam |
| Estoque | `GET /v2/estoque/{p}` | `datade`, `dataate` | `codigo`, `estoqueFiliais[{codigoFilial, estoqueAtual, codigoCor, codigoTamanho}]` |
| Saídas | `GET /saidas/{p}` | `tipodata`, `datade`, `dataate`, `tiposoperacao` (`VND, FPV, TRS, AJS, GRS, ORC, DAV, DOS, DVF, RSV, VEF, PVN, CNS, VPC, DCS, EVF, OTS, EPA, TCS`) | `ordem`, `sequencia`, `tipo_Operacao`, `codigoOperacao`, `codigo_Cliente`, `codigo_Vendedor_1`, `codigo_Vendedor_2`, `data`, `total_Com_Desconto`, `observacao`, `referenciaInterna`, `efetivadoFinanceiro`, `desefetivadoFinanceiro`, `dataAlteracao`, `produtos[{codigo, quantidade, preco_Final, preco_Final_Com_Desconto, codigo_Vendedor_1, codigo_Vendedor_2}]`. **Não há campo com a data de efetivação** na resposta (só o filtro `tipodata=E`). |
| Saída detalhada | `GET /saidas/detalhes/{ordem}` | — | exemplo devolve `dados: null`; campos não constam |
| Criar saída | `POST /saidas` (síncrono) ou `POST /vendas` (assíncrono, recibo; consulta `GET /vendas/{recibo}`) | — | corpo: `codigoCliente`, `cpfCnpj`, `codigoOperacao`, `usarValoresTabelaPrecos`, `desconto_Total_Geral`, `observacao`, `codigoVendedor_1`, `codigoVendedor_2`, `ReferenciaInterna`, `codigoCaixa`, `tabelaPreco`, `data` (`YYYY-MM-DD HH:MM:SS`), `produtos[{codigo, quantidade, precoUnitario, descontoUnitario}]`, `recebimentos[]`, `dadosEntrega{}`. Resposta: `dados: "Registro criado com sucesso."` — **a ordem criada não volta**. Efetivar estoque/financeiro são chamadas à parte (`PATCH /saidas/{ordem}/efetivarestoque` e `/efetivarfinanceiro`). |
| Devoluções | `GET /devolucao/{p}`, `GET /devolucao/detalhes/{ordem}` | `tipodata`, `datade`, `dataate` | exemplo vazio: **campos não constam** |
| Crédito do cliente | `GET /credito/cliente/saldos/{p}/` | `datade`, `dataAte` | `saldo`, `ordemCliFor`, `codigoCliFor`, `dataAlteracao`; avulso: `GET /credito/cliente/saldo/{codigo}` → `{saldo}` |
| Motivos de desconto | `GET /motivos_desconto` (sem página nos exemplos) | `datade`, `dataate` (`YYYY-MM-DD`) | exemplo vazio: **campos não constam** |

## Como o conector usa (ver `conector-shop9/src/shop9/`)
- Um token por filial, renovado 2 min antes de `expireAt`; em `AUTENTICACAO_INVALIDA` renova e repete **uma** vez.
- Paginação até `FIM_DE_PAGINA` (ou lista vazia), com teto de segurança.
- Incremental por recurso e filial, janela `[cursor − 2 min, agora]` cortada na meia-noite; o cursor é gravado na Rota junto com o último lote (atômico).
- Venda faturada = saída `efetivadoFinanceiro` e não `desefetivadoFinanceiro`; data de faturamento = dia da janela em que ela aparece com `tipodata=E`.
- Orçamento: `POST /saidas` com o código de operação configurado, sem chamar as efetivações; marca `ROTA:<id>` em `observacao` e `ReferenciaInterna`; antes de criar e depois de criar, procura a saída pela marca (a resposta não traz a ordem).

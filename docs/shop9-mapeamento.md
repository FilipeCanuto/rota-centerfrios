# Shop9 — o que pedir à Idealsoft na homologação

Hoje a Rota funciona sem API: produtos, clientes, vendas e orçamentos entram por planilha (Configurações → Importação) e os orçamentos gerados pela Rota saem em CSV para lançamento manual (`integracoes.envioShop9`). Para ligar o envio automático (conector local, `conector-shop9/`) precisamos das respostas abaixo, **por empresa** (CENTERFRIOS e 381 Distribuidora).

## 1. Acesso
- [ ] Ambiente de homologação (URL) e de produção; são bancos separados por empresa ou um só com código de empresa/filial?
- [ ] Forma de autenticação (token fixo, OAuth, usuário/senha), validade e como renovar. Um usuário técnico só para a Rota, com permissão mínima (ler cadastros e vendas; criar orçamento/pedido).
- [ ] O módulo Integrações aceita chamadas de outro processo **no mesmo computador/rede local**? (O conector roda ao lado dele e só faz saída HTTPS para a Rota; nenhuma porta é aberta para a internet.)
- [ ] Autenticação do módulo Integrações: formato exato de token, timestamp e signature (hoje suposto em `conector-shop9/src/shop9/adaptador.js`).
- [ ] Limites: requisições por minuto, tamanho de página, tamanho máximo do corpo.
- [ ] Documentação da API (OpenAPI/Swagger ou PDF) e exemplos de requisição e resposta.

## 2. Produtos e preços
- [ ] Endpoint de produtos com: código, descrição, unidade, preço de tabela, ativo, data da última alteração.
- [ ] Filtro "alterados desde" (para sincronizar só o que mudou).
- [ ] Existe mais de uma tabela de preço (por cliente, região, forma de pagamento)? Qual vale para a Rota?
- [ ] Estoque disponível por produto (opcional, para avisar no carrinho).
- [ ] Código do produto é único por empresa? Pode mudar?

## 3. Clientes
- [ ] Endpoint com: código, nome/razão social, CPF/CNPJ, telefone, e-mail, cidade, segmento, vendedor responsável (código **e** e-mail), data de alteração.
- [ ] Como o Shop9 identifica o vendedor: código interno? Conseguimos o e-mail corporativo?

## 4. Vendas faturadas
- [ ] Endpoint de notas/vendas com: número, cliente, data de faturamento, valor total, vendedor, itens (código do produto, quantidade, valor do item) e situação (cancelada?).
- [ ] Filtro por período e "alterados desde"; como chegam devoluções e cancelamentos.

## 5. Orçamentos e pedidos (envio da Rota)
- [ ] A Rota deve criar **orçamento** ou **pedido**? Qual é o endpoint e o formato (JSON/XML) do corpo?
- [ ] Campos obrigatórios: cliente, vendedor, data, condição de pagamento, forma de entrega, observação, itens (produto, quantidade, preço unitário, desconto % ou valor).
- [ ] O Shop9 aceita o **nosso preço e desconto** ou recalcula pela tabela? Há limite de desconto no Shop9 que precisamos respeitar?
- [ ] **Idempotência:** existe campo para uma chave externa nossa (`rota:carrinho:<id>`) que impeça duplicar se reenviarmos? Se não houver, como consultar "já existe orçamento com esta chave/observação"?
- [ ] Resposta de sucesso: traz o número do orçamento/pedido gerado? É síncrona?
- [ ] Códigos de erro e mensagens (cliente bloqueado, produto inativo, preço abaixo do mínimo) para mostrar à pessoa.
- [ ] Endpoint de consulta da situação (aberto, convertido em venda, cancelado) para atualizar ganho/perdido na Rota.

## 6. Formato de dados
- [ ] Datas (fuso e formato), separador decimal, casas decimais de preço e quantidade, regra de arredondamento do total do item (a Rota usa 2 casas, meio para cima, por item; total = soma dos itens).
- [ ] Codificação de texto (UTF-8?).

## Como a Rota já está preparada
- Fila `shop9_envios` com tentativas, último erro, próxima tentativa (1, 2, 4… até 60 min) e chave de idempotência única por orçamento.
- Estado de envio separado do estado comercial: pendente → enviado → confirmado (ou erro).
- Lançamento manual: CSV com uma linha por item (`chave_rota;data;cliente_codigo;vendedor_email;produto_codigo;descricao;unidade;quantidade;preco_unitario;desconto_pct;total_item`); quem lança informa o número do Shop9 e a próxima importação de orçamentos confirma.
- Credenciais do Shop9 **não** ficam na Rota: só no computador do conector (`C:\ProgramData\ConectorShop9\config.json`, protegido). Guia: [guia-conector-shop9-cit.md](guia-conector-shop9-cit.md).

## Fluxo do conector
1. A cada minuto o conector chama `POST /api/conector/heartbeat` (versão, Shop9 acessível) e recebe o **modo** (manual | conector) e o **ambiente** (homologação | produção) escolhidos em Configurações → Integrações.
2. Modo conector: `trabalhos` devolve orçamentos pendentes da fila `shop9_envios` (reservados por 5 min); o conector cria cada um no Shop9 com a chave `rota:carrinho:<id>` e devolve o número em `resultado` (ou o erro; a Rota reagenda com espera progressiva).
3. Sempre: `sincronizar` envia, em lotes, clientes, produtos, vendas faturadas com itens e orçamentos alterados desde a última posição (cursor local). Cada lote tem `lote_id` determinístico: reenviar o mesmo lote não grava nada de novo.
4. Segurança de cada chamada: assinatura **Ed25519** de `data/hora + nonce + método + caminho + hash do corpo`. A chave privada nasce e fica só no computador do conector (`npm run gerar-chave`); a Rota guarda só a pública, cadastrada pelo administrador (troca e revogação na tela). Janela de 5 min, nonce único (repetição recusada) e limite de 120 pedidos/min. Banco: [lovable/21-conector-shop9.md](lovable/21-conector-shop9.md).
5. Enquanto a documentação não chega, o **simulador** (`conector-shop9/src/shop9/simulador.js`) faz o papel do Shop9 nos testes; o mapeamento de campos fica em `MAPA` do adaptador.

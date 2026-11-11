# Painel agregado

Aplicada a migração nova `0008_painel_vendedor_agregado.sql`. As duas funções são STABLE e SECURITY INVOKER, liberadas para authenticated e serviço privilegiado, sem acesso anônimo. Os tipos foram regenerados e mantidos; telas e migrações anteriores preservadas.

| Cenário | Resultado |
|---|---|
| Humberto/CENTERFRIOS, 01–10/11/2026 | painel faturado_mes = soma SQL direta = 33428,42 |
| 1.500 vendas de 10 no mês | faturado_mes e faturado_hoje = 15000, todas incluídas |
| Interação 10/11/2026 23:30-03 | Dia local 10/11; qualificada_hoje true no dia 10 e false no dia 11 |
| Vendedor autenticado consulta Humberto | clientes vazio; meta nula; faturamento, orçamentos, pontos e cobertura zero |
| Cobertura leve versus painel | Mesmo resultado: 2 cobertos em 3 clientes |

Também verificados: 12 datas de compra distintas em ordem decrescente; compra não preenche ultima_interacao_qualificada; resultado composto só de espaços não qualifica ligação; meta e orçamento aberto corretos; pontos somados; hoje nulo equivale à data atual de America/Maceio. Nove testes de integração passaram.

A comparação demo usou a ferramenta de leitura para a soma direta e a API com papel de serviço para chamar a função sobre os dados demo. A ferramenta de leitura não tem EXECUTE nessa função; nenhuma permissão foi ampliada para contornar isso. Os testes de 1.500 vendas, fuso e isolamento foram executados com sessão authenticated real do vendedor temporário.

As consultas mensais restringem vendedor/empresa/período. Históricos por cliente restringem empresa e mantêm RLS, inclusive quando o cliente foi remanejado. Somente indicadores de mês/hoje restringem as datas até hoje; os campos de histórico consideram toda a história visível.

Não foi feito cálculo de dias úteis, status ou limites. Nenhuma tela passa a usar as funções nesta etapa; isso fica para o outro ramo.

Limpeza: conta de autenticação, vendedor, três clientes, 1.500 vendas mensais e 14 históricas, duas interações, orçamento, pontos, meta, vínculo e auditorias temporárias removidos.
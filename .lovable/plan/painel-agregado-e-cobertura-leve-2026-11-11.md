# Painel agregado e cobertura leve

- Criar duas funções `stable`, `security invoker`, com execução autenticada e RLS preservada, em uma migração nova.
- Somar faturamento, orçamentos e pontos no banco, sem limite de 1.000 registros; devolver meta mensal e carteira com históricos resumidos.
- Usar America/Maceio para a data atual e todas as interações; manter compra separada da interação qualificada.
- Retornar até 12 datas distintas de compra por cliente, mais recentes primeiro, e listas vazias/valores zero quando não houver dados visíveis.
- Cobertura leve conta cada cliente uma vez, por compra ou interação qualificada no mês, sem carregar o restante do painel.
- Não calcular dias úteis, limites ou status; nenhuma tela alterada. Manter os tipos gerados.
- Verificar comparação com soma direta, 1.500 vendas, interação às 23h30 locais, acesso a outro vendedor e equivalência da cobertura; limpar dados temporários.

## Critérios de dados
- Eventos mensais ficam entre o primeiro dia do mês e `_hoje`, inclusive.
- Resultado não vazio significa texto com conteúdo após remover espaços nas pontas.
- Histórico de compras e última interação consideram todo o histórico disponível; somente os indicadores de hoje/mês são limitados por `_hoje`.
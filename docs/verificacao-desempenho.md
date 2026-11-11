# Índices e políticas

Aplicada somente a migração nova `0007_indices_politicas_otimizadas.sql`. SHA-256 confirmou zero alterações em src/ e nas migrações SQL anteriores. A geração automática dos tipos foi revertida aos bytes originais.

## Índices confirmados

| Tabela | Índices solicitados presentes/cobertos |
|---|---|
| clientes | clientes_empresa_vendedor_idx (empresa_id,vendedor_id) |
| vendas | vendas_empresa_vendedor_data_idx (empresa_id,vendedor_id,data_faturamento); vendas_cliente_data_idx (cliente_id,data_faturamento) |
| interacoes | interacoes_empresa_vendedor_data_idx (empresa_id,vendedor_id,data) |
| orcamentos | orcamentos_empresa_vendedor_status_idx (empresa_id,vendedor_id,status); orcamentos_cliente_idx (cliente_id) |
| tarefas_agenda | tarefas_empresa_vendedor_data_idx (empresa_id,vendedor_id,data); tarefas_cliente_idx (cliente_id) |
| alertas | alertas_empresa_vendedor_data_idx (empresa_id,vendedor_id,data) |
| pontos | pontos_empresa_vendedor_data_idx (empresa_id,vendedor_id,data) |
| selos | selos_empresa_vendedor_idx (empresa_id,vendedor_id) |
| metas | Restrição única existente (empresa_id,vendedor_id,mes), sem índice novo |
| usuario_empresas | usuario_empresas_empresa_idx (empresa_id) |
| user_roles | Restrição única existente (user_id,role,empresa_id) cobre o prefixo (user_id,role), sem duplicação |
| equipes | equipes_supervisor_idx (supervisor_id) |
| usuarios | usuarios_equipe_idx (equipe_id) |
| registro_auditoria | auditoria_empresa_created_idx (empresa_id,created_at); auditoria_vendedor_created_idx (vendedor_id,created_at) |

Apagado: vendas_cliente_id_idx, redundante pelo prefixo do índice vendas_cliente_data_idx.
Preservados: clientes_vendedor_id_idx, orcamentos_vendedor_id_status_idx e vendas_vendedor_id_data_faturamento_idx. Um índice começando por empresa não substitui filtros iniciados apenas em vendedor.

## Políticas

ALTER POLICY preservou ações, papéis e predicados, alterando somente as quatro chamadas constantes para subconsultas. Chamadas dependentes da linha permaneceram iguais. Todos os sete auxiliares/assinaturas estão STABLE. Consultas ao catálogo confirmaram subconsultas nas políticas modificadas.

## Testes reais com authenticated

| Perfil | Resultado |
|---|---|
| Vendedor | 2 clientes próprios; meta 0 alterações; venda e equipe recusadas; tema escuro aceito |
| Supervisor | 2 clientes da equipe, 0 de outras; UPDATE direto em clientes bloqueado |
| Diretoria | Todos os 62 clientes durante teste (60 existentes + 2 temporários); meta e regra alteradas |
| Administrador | 0 clientes/vendas/metas; somente auditoria técnica conforme regra da 0005; cria usuário/vínculo/papel/link; não altera regras |
| Papel por empresa | Supervisor CENTERFRIOS false, 381 true |
| Feriados | 20 |

As contas, vínculos, clientes, equipe, meta, regra, orçamento, alerta, link e auditorias temporárias foram apagados. Zero contas/usuários/auditorias de teste ao final. Os 17 testes existentes passaram e compilação build OK.

## Pendências explícitas

- Não foi incluída a carga INSERT dos 20 feriados na migração: a ferramenta de migração exige DDL e só permite DML quando for backfill de mudança estrutural. O calendário existente permanece com 20 registros; não afirmar que bancos novos passam a receber essa carga.
- EXPLAIN foi solicitado pela API com token real do vendedor nas duas consultas; ambas responderam HTTP 406 porque o formato de planos não está disponível. Não houve plano coletado; não é possível afirmar index scan nem seq scan. O teste registra esta verificação como indisponível, não como desempenho confirmado.
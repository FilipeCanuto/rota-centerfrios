# Desempenho sem mudança de permissões

- Criar uma migração nova, preservando as antigas e todo `src/` (inclusive os tipos atuais).
- Incluir as 20 datas nacionais com conflito ignorado para garantir a carga em novos ambientes.
- Criar somente índices ainda não cobertos por índices equivalentes ou por prefixos existentes; a restrição de `user_roles` já cobre `(user_id, role)`.
- Remover `vendas_cliente_id_idx`, coberto por `(cliente_id, data_faturamento)`. Preservar índices iniciados em vendedor: índices iniciados em empresa não substituem filtros apenas por vendedor.
- Alterar todas as políticas existentes para executar as quatro chamadas constantes em subconsultas, sem alterar predicados, ações ou permissões. Confirmar auxiliares `stable`.
- Verificar índices, planos das duas consultas com identidade de vendedor e repetir os quatro perfis usando somente dados temporários.
- A auditoria segue a regra atual da migração 0005: administrador vê ações técnicas, mas não comerciais.
- Confirmar 20 feriados, limpar testes e apresentar os resultados; se a ferramenta não permitir EXPLAIN autenticado, explicitar essa limitação.
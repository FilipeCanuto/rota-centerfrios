# Permissões por empresa e separação de funções

- Aplicar uma única migração nova, preservando as anteriores e os logins existentes.
- Adicionar empresa, origem e data aos papéis; preservar o escopo dos convites no primeiro acesso.
- Separar diretoria de administrador e substituir as políticas conforme a tabela solicitada, incluindo leitura de auditoria apenas para diretoria.
- Restringir alterações de colunas e criar uma função administrativa para atualizar usuários completos.
- Preservar papéis não-vendedor antes de retirar o perfil antigo, incluindo o supervisor Marcos ainda sem login.
- Regenerar os tipos e retirar apenas `perfil` da consulta e do tipo da sessão, se necessário.
- Testar os quatro perfis via API autenticada, apresentar uma tabela de resultados e apagar todas as contas e registros temporários.

## Detalhes técnicos
- `has_role` com três parâmetros aceita papel global ou da empresa informada; a assinatura antiga consulta apenas papéis globais, conforme solicitado.
- `pode_ver_vendedor` e `tem_empresa` permanecem iguais; passam a depender do novo `ve_tudo`.
- A exclusão de tarefas exige acesso à empresa e identidade do vendedor ou supervisão da equipe, sem conceder exclusão automática à diretoria.
- A remoção física de colunas depende da permissão para alterações incompatíveis. Se bloqueada, marcar as colunas como obsoletas e parar de consultar `perfil`, informando a limitação.
- Não alterar telas, configurações de autenticação nem arquivos em `src/`, exceto tipos gerados e a retirada mínima de `perfil` expressamente autorizada.
# Proteção da atualização administrativa

Aplicada `0011_proteger_atualizacao_administrativa_usuario` sem editar migrações antigas. `CREATE OR REPLACE` preserva retorno `usuarios`, `SECURITY DEFINER`, `search_path` e permissões de execução existentes. Tipos regenerados automaticamente, sem diferença; nenhum arquivo em `src/` mudou.

Campos aceitos: `nome`, `email`, `empresa_id`, `equipe_id`, `apelido_copiloto`, `tema`, `origem`. A checagem de e-mail ocorre após bloquear a linha com `FOR UPDATE`, evitando corrida com a associação do convite. E-mail inalterado é permitido; alteração em conta com login é recusada. Chamadas bem-sucedidas geram auditoria atômica com dados antigos e novos e ator da sessão.

## Resultados

`python3 -B tests/test_admin_atualizar_usuario.py`: **9 testes autenticados passaram**.

| Verificação | Resultado |
|---|---|
| Administrador envia auth_user_id | Recusado: Campo de usuário não permitido. |
| Administrador envia created_at | Recusado: Campo de usuário não permitido. |
| Administrador envia demo | Recusado: Campo de usuário não permitido. |
| Administrador envia perfil | Recusado: Campo de usuário não permitido. |
| nome = Novo nome, equipe_id = null | Funciona; login, created_at e demo preservados |
| Auditoria da alteração | alteracao_usuario, tabela usuarios, ator correto, antigo/novo iguais aos registros lidos |
| Trocar email de conta com login | Recusado: Não é possível trocar o e-mail de um usuário que já tem login. |
| Trocar email de pré-cadastro sem login | Funciona e gera auditoria |
| Vendedor chama a função | Recusado, 42501 |
| Chamadas recusadas | Não geram auditoria nem alteram o usuário |
| git ls-files tests/__pycache__ | Vazio após remoção dos seis arquivos |

Os dois logins temporários, três cadastros e suas auditorias foram apagados. 16 testes existentes passaram; compilação automática `build OK`.

## Limitação do arquivo de exclusões

A ferramenta recusou a edição de `.gitignore` porque é gerenciado pela plataforma. O arquivo ficou intacto; não foi utilizado outro meio para contornar o bloqueio. Falta o usuário acrescentar:

```gitignore
__pycache__/
*.pyc
```

Os caches versionados já foram removidos. Os testes desta correção foram executados com `python3 -B` para não gerar novos caches.
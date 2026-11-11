# Correção das duas contas existentes — 11/11/2026

Somente ajustes de linhas, pela ferramenta de dados, e chamadas autenticadas às funções existentes. Não foi necessária alteração de estrutura: nenhuma migração nova nem regeneração de tipos foi feita. Todos os arquivos de `src/` e todas as migrações anteriores foram preservados por comparação SHA-256.

## Ordem executada

1. `apagar_dados_demo()` executada com sessão autenticada de Filipe, então administrador. Resumo devolvido:

```json
{"links":2,"metas":4,"selos":4,"pontos":4,"vendas":676,"alertas":0,"equipes":0,"clientes":60,"usuarios":0,"interacoes":59,"orcamentos":16,"tarefas_agenda":4,"usuario_empresas":0,"papeis_pre_cadastro":0}
```

2. As duas linhas receberam nome, primeiro nome como apelido, equipe nula e `demo=false`. Não houve alteração de `auth_user_id`, email ou vínculos empresariais.
3. Removidos os dois papéis vendedor; mantido o administrador global de Filipe, acrescentados diretoria global para Filipe e administrador global para Willames. Os ajustes foram atômicos e condicionados à presença das identidades esperadas e à limpeza da demonstração.
4. `carregar_dados_demo()` chamada sem parâmetros com sessão autenticada de Filipe. Retorno: `{"clientes":60,"empresas":2,"vendedores":2}`.

## Resultado autenticado

| Conta | Nome | Papéis globais | Clientes próprios | Clientes visíveis |
|---|---|---|---:|---:|
| filipecanuto@centerfrios.com | Filipe Canuto | administrador + diretoria | 0 | 60 |
| adm@centerfrios.com | Willames Costa | administrador | 0 | 0 |

Willames também recebeu listas vazias para vendas e metas. Os vínculos às duas empresas mantiveram os mesmos valores e datas de criação. As duas identidades autenticadas mantiveram os mesmos ids e emails.

Humberto Demo e Clara Demo possuem 30 clientes cada. Supervisor Demo supervisiona a equipe fictícia. Os três têm `demo=true` e `auth_user_id` nulo.

## Auditoria

Quatro linhas `alteracao_permissao` registraram os dois papéis vendedor removidos e os dois novos papéis acrescentados, com valores antigos/novos. O papel administrador já existente de Filipe não foi regravado. Como os ajustes de linhas foram feitos pela ferramenta de dados sem sessão, o ator dessas quatro linhas é nulo; não foi forjada identidade. Limpeza e recriação ocorreram autenticadas.

## Verificações

- `PYTHONDONTWRITEBYTECODE=1 python3 tests/test_identidades_contas.py -v`: sete testes autenticados de leitura passaram, sem criar ou alterar contas temporárias.
- 17 testes existentes de regras e roteamento passaram.
- As duas sessões abriram `/inicio` com os nomes corretos e zero erros JavaScript. Foram usadas uma sessão existente e uma sessão emitida para o solicitante; não foi realizado novo login por senha/Google nem alterada qualquer credencial.
- Última verificação automática: `build OK`.

**Limitação de tela preexistente:** o painel atual filtra os dados pelo id do usuário, mesmo para diretoria. Portanto Filipe tem acesso aos 60 clientes pela API autenticada/RLS, mas o painel pessoal mostra zero porque ele não é vendedor. A página Clientes ainda é uma tela vazia preexistente. Nenhuma tela foi alterada, conforme solicitado.
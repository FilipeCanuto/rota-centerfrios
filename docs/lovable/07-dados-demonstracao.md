Por último, os dados de demonstração. Hoje eles estão nas migrações `0001_dados_demonstracao` e `0002_equilibrar_demo`, que rodam em todo ambiente, e as empresas reais foram criadas como demonstração. Faça numa **migração nova**. **Não edite nem apague as migrações 0001 e 0002**: elas já fazem parte do histórico. Não altere telas em `src/`; só regenere `src/integrations/supabase/types.ts`.

## 1. Empresas reais
- `update empresas set demo = false` para "CENTERFRIOS" e "381 Distribuidora". As empresas nunca são dados de demonstração.
- As linhas de `configuracoes_regras` continuam sendo dados reais (não são demonstração).

## 2. `public.apagar_dados_demo()` refeita
`security definer`, executável por `authenticated`, permitida só para `administrador` ou `diretoria`. Apaga **somente** linhas com `demo = true`, nesta ordem: `interacoes`, `vendas`, `orcamentos`, `tarefas_agenda`, `alertas`, `pontos`, `selos`, `metas`, `links`, `clientes`, `equipes` (as que têm `demo = true`). Depois:
- remove de `usuario_empresas` e de `papeis_pre_cadastro` os vínculos de usuários com `demo = true` e sem `auth_user_id`;
- apaga os `usuarios` com `demo = true` e sem `auth_user_id`;
- usuários com `demo = true` **e** com `auth_user_id` (gente real que entrou numa conta de demonstração) ficam, com `demo = false`;
- grava em `registro_auditoria`, pela função `auditar`, a ação "apagar_dados_demo", com a quantidade de linhas apagadas de cada tabela em `detalhes`;
- devolve esse mesmo resumo em `jsonb`.

## 3. `public.carregar_dados_demo()` nova
`security definer`, permitida só para `administrador` ou `diretoria`. Recusa com "Já existem dados de demonstração." se houver algum cliente com `demo = true`. Cria os mesmos dados da migração 0001, com estas mudanças:
- usa as empresas existentes (não cria empresas);
- marca `demo = true` em **tudo** que criar, inclusive equipe e usuários;
- cidades de Alagoas (Maceió, Arapiraca, Rio Largo, Marechal Deodoro, Palmeira dos Índios, São Miguel dos Campos) e telefones com DDD 82;
- inclui também: 2 clientes com **apenas 2 compras** (recompra "sem histórico"), 2 clientes que **nunca compraram**, 1 cliente que comprou ontem sem nenhuma interação registrada (não pode aparecer como esquecido), 1 orçamento com último contato numa sexta-feira e 1 interação qualificada às 23h30 (horário de Maceió) do dia anterior;
- não vincula esses vendedores a ninguém: são usuários fictícios sem login.

Esse é o caminho para recriar a demonstração em homologação depois de apagar.

## Observação para produção
Como 0001 e 0002 continuam no histórico, um banco novo nasce com os dados de demonstração. O passo de entrada em produção é chamar `apagar_dados_demo()` antes do primeiro uso real. Registre isso como comentário na migração.

## Como conferir
1. `select nome, demo from empresas` → as duas com `demo = false`.
2. Conte as linhas reais (`demo = false`) de `clientes`, `vendas`, `interacoes`, `metas`, `configuracoes_regras`, `empresas` e `usuarios`. Chame `apagar_dados_demo()` como administrador e mostre o resumo devolvido. Conte de novo: os números reais **não mudam**, e não sobra nenhuma linha com `demo = true` em nenhuma tabela.
3. Chame `carregar_dados_demo()`: os clientes voltam, com cidades de Alagoas; chamar de novo é recusado.
4. Um vendedor chamando `apagar_dados_demo()` ou `carregar_dados_demo()` → recusado.
5. Existem as duas linhas "apagar_dados_demo" em `registro_auditoria`.

Agora preciso corrigir as permissões (RLS). Faça tudo numa **migração nova**, sem editar migrações antigas, e **sem alterar arquivos em `src/`**, exceto o arquivo de tipos gerado (`src/integrations/supabase/types.ts`), que deve ser regenerado.

## 1. Papéis por empresa (`user_roles`)
- Adicione em `public.user_roles` as colunas `empresa_id uuid` (nula = vale para todas as empresas; referência a `empresas.id`), `origem origem_dado not null default 'manual'` e `created_at timestamptz not null default now()`.
- Troque a restrição única `(user_id, role)` por `(user_id, role, empresa_id)`, tratando nulo como "todas" (use `nulls not distinct`).
- Crie a função `public.has_role(_user_id uuid, _role app_role, _empresa_id uuid)`: verdadeira quando existe o papel com `empresa_id` igual a `_empresa_id` **ou** nulo. Mantenha a versão antiga de dois parâmetros, chamando a nova com empresa nula, para não quebrar nada.
- Atualize também a tabela `papeis_pre_cadastro` da mensagem anterior, se ainda não tiver `empresa_id`, e faça a cópia para `user_roles` levar a empresa junto.

## 2. Diretoria vê tudo; administrador não vê dados comerciais
- `public.ve_tudo()` passa a ser verdadeira **só** para `diretoria`. O administrador sai dela.
- Crie `public.eh_admin()` = papel `administrador`.
- `pode_ver_vendedor` e `tem_empresa` continuam iguais, mas passam a usar o novo `ve_tudo()`.

## 3. Políticas por tabela
Apague as políticas atuais das tabelas abaixo e crie estas, para o papel `authenticated`. "Carteira visível" significa `tem_empresa(empresa_id) and pode_ver_vendedor(vendedor_id)`.

| Tabela | Ler | Inserir | Alterar | Apagar |
| --- | --- | --- | --- | --- |
| `clientes` | carteira visível | ninguém (vem da integração ou importação) | ninguém pela API; remanejamento só pela função da mensagem 03 | ninguém |
| `vendas` | carteira visível | ninguém | ninguém | ninguém |
| `orcamentos` | carteira visível | ninguém | só a coluna `ultimo_followup`, com carteira visível | ninguém |
| `interacoes` | carteira visível | o próprio vendedor (`vendedor_id = meu_usuario_id()`) e com `tem_empresa` | ninguém | ninguém |
| `tarefas_agenda` | carteira visível | carteira visível | carteira visível | o próprio vendedor ou o supervisor da equipe |
| `alertas` | carteira visível | ninguém (gerados pelo servidor) | só a coluna `lido`, com carteira visível | ninguém |
| `metas` | carteira visível | diretoria | diretoria | diretoria |
| `pontos` | carteira visível | ninguém (só funções do servidor) | ninguém | ninguém |
| `selos` | carteira visível | ninguém (só funções do servidor) | ninguém | ninguém |
| `configuracoes_regras` | `tem_empresa(empresa_id)` | diretoria | diretoria | diretoria |
| `links` | `tem_empresa(empresa_id)` | diretoria ou administrador | diretoria ou administrador | diretoria ou administrador |
| `empresas` | `tem_empresa(id)` ou administrador | administrador | administrador | ninguém |
| `equipes` | `tem_empresa(empresa_id)` ou administrador | administrador | administrador | administrador |
| `usuarios` | o próprio, `pode_ver_vendedor(id)` ou administrador | administrador | o próprio (só `apelido_copiloto` e `tema`) ou administrador | administrador |
| `usuario_empresas` | o próprio, diretoria ou administrador | administrador | administrador | administrador |
| `user_roles` | o próprio, diretoria ou administrador | administrador | administrador | administrador |

Detalhes:
- "Ninguém" significa nenhuma política para essa ação. O `service_role` (integrações e funções do servidor) continua com acesso total.
- Para limitar colunas, use permissão por coluna: revogue `update` da tabela para `authenticated` e conceda `update` só nas colunas citadas (`usuarios`: `apelido_copiloto`, `tema`; `orcamentos`: `ultimo_followup`; `alertas`: `lido`). Para o administrador alterar `usuarios` por completo, crie a função `public.admin_atualizar_usuario(...)` (`security definer`, conferindo `eh_admin()`), já que a permissão por coluna vale para todos.
- Remova a coluna `usuarios.perfil`. O papel vem só de `user_roles`. Antes, garanta que todo usuário com `perfil` diferente de `vendedor` tenha o papel correspondente em `user_roles`.
- Na tabela `empresas`, remova a coluna `empresa_id`: a empresa é a própria linha.
- A função `apagar_dados_demo()` continua exigindo `administrador` (será refeita na mensagem 07).

## 4. Regenerar tipos
Regenere `src/integrations/supabase/types.ts`. Se algum arquivo em `src/` deixar de compilar por causa da coluna `usuarios.perfil` removida (por exemplo `src/modulos/sessao/sessao.tsx`), **apenas tire a coluna da consulta**, sem outras mudanças.

## Como conferir
Crie quatro usuários de teste pré-cadastrados (vendedor, supervisor da equipe do vendedor, diretoria e administrador, com e-mails `@centerfrios.com` de teste) e, com cada um, rode as consultas abaixo pelo papel `authenticated`. Mostre o resultado em tabela:
1. Vendedor: `select count(*) from clientes` → só os dele; `update metas set meta_vendas = 1` → 0 linhas; `insert into vendas ...` → recusado; `update usuarios set equipe_id = null where auth_user_id = auth.uid()` → recusado; `update usuarios set tema = 'escuro' ...` → funciona.
2. Supervisor: vê os clientes da equipe e não os de outras equipes; `update clientes set vendedor_id = ...` → recusado.
3. Diretoria: vê todos os clientes das duas empresas; consegue alterar `metas` e `configuracoes_regras`.
4. Administrador: `select count(*) from clientes`, `vendas`, `metas` e `registro_auditoria` → **0**; consegue criar `usuarios`, `usuario_empresas`, `user_roles` e `links`; não consegue alterar `configuracoes_regras`.
5. Papel por empresa: dê ao usuário de teste o papel `supervisor` só na 381 e confira que `has_role(id, 'supervisor', <id da CENTERFRIOS>)` é falso e que, com a empresa da 381, é verdadeiro.
Depois, apague os usuários de teste.

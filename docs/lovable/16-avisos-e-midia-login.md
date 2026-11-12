Migração nova, sem editar migrações antigas e sem alterar telas em `src/` (mantenha os tipos regenerados). Base do quadro de avisos e da mídia da tela de login. Toda regra abaixo vale no banco (RLS, funções e políticas de armazenamento), não só na tela.

## 1. Permissão "Pode publicar avisos"
- Em `usuarios`, adicione `pode_publicar_avisos boolean not null default false`.
- Crie `public.pode_publicar_avisos()` (`stable`, `security definer`, `search_path = public`): verdadeira se `eh_admin()` **ou** existe `usuarios` com `auth_user_id = auth.uid()` e `pode_publicar_avisos = true`. Conceda `execute` só a `authenticated`.
- Atualize `admin_atualizar_usuario` para aceitar também o campo `pode_publicar_avisos` (boolean; qualquer outro tipo é recusado). Mantenha a lista de campos já protegida (`auth_user_id`, `created_at`, `demo` e `perfil` continuam recusados) e a auditoria atômica ("alteracao_permissao" quando esse campo mudar).
- O usuário comum **não** consegue ligar a própria permissão: a permissão de coluna de `usuarios` continua liberando só `apelido_copiloto` e `tema`. Confirme que `pode_publicar_avisos` **não** entrou nessa lista.

## 2. Tabela `avisos`
Colunas: `id uuid pk default gen_random_uuid()`, `titulo text not null`, `texto_alternativo text not null` (com `check (length(btrim(texto_alternativo)) > 0)`), `arquivo_path text not null`, `tipo text not null check (tipo in ('imagem','animacao','video'))`, `link text` (opcional; `check (link is null or link ~* '^https?://')`), `empresa text not null default 'ambas' check (empresa in ('CENTERFRIOS','381','ambas'))`, `inicio timestamptz`, `fim timestamptz` (`check (fim is null or inicio is null or fim > inicio)`), `ordem int not null default 0`, `ativo boolean not null default true`, `criado_por uuid references usuarios(id)` (preenchido por gatilho com o `usuarios.id` de quem inseriu; o cliente não consegue mudar), `created_at`, `updated_at` (gatilho de atualização).

RLS ligada, para `authenticated`:
- **ler:** qualquer usuário logado. O app filtra por empresa, data e `ativo` na exibição; administrador e quem publica veem todos.
- **inserir:** `pode_publicar_avisos()`.
- **alterar e apagar:** `eh_admin()` **ou** (`pode_publicar_avisos()` e `criado_por = meu_usuario_id()`).
- Nenhuma política para `anon`.

## 3. Tabela `midia_login`
Colunas: `id`, `arquivo_path text not null`, `tipo` (mesmos três valores), `texto_alternativo text not null` (mesmo `check` não vazio), `ordem int not null default 0`, `ativo boolean not null default true`, `criado_por` (como acima), `created_at`, `updated_at`.

RLS ligada:
- **ler:** `anon` e `authenticated` veem só `ativo = true`; `eh_admin()` vê todas.
- **inserir, alterar e apagar:** só `eh_admin()`. Quem tem apenas "Pode publicar avisos" **não** mexe aqui.

## 4. Armazenamento (dois buckets privados)
Formatos aceitos nos dois: `image/jpeg`, `image/png`, `image/webp`, `image/avif`, `image/gif`, `video/mp4`, `video/webm`. Configure `allowed_mime_types` e `file_size_limit` do bucket em **25 MB** (o teto do vídeo). Como o bucket só tem um limite, o limite de **5 MB para imagem e GIF** vai numa política de `insert`/`update` em `storage.objects`: recuse quando `(metadata->>'size')::bigint > 5242880` e o tipo (`metadata->>'mimetype'`) começa com `image/`. Valide o tipo na mesma política (lista acima), para recusar mesmo que o cliente ignore o aviso da tela.

**Bucket `avisos`** (privado):
- **ler:** qualquer `authenticated`.
- **enviar:** `pode_publicar_avisos()`.
- **substituir e apagar:** `eh_admin()` ou (`pode_publicar_avisos()` e `owner = auth.uid()`).

**Bucket `midia-login`** (privado, **não** marque como público):
- **ler:** `anon` e `authenticated`, só arquivos que estejam em `midia_login` com `ativo = true` (`exists (select 1 from midia_login m where m.arquivo_path = storage.objects.name and m.ativo)`); `eh_admin()` lê qualquer um. O app usa links assinados curtos, que dependem dessa política.
- **enviar, substituir e apagar:** só `eh_admin()`.

## 5. Tipos
Regenere `src/integrations/supabase/types.ts` (tabelas novas, coluna nova e função `pode_publicar_avisos`).

## Como conferir (testes de RLS pelo papel `authenticated`/`anon`)
Crie quatro usuários de teste: vendedor sem permissão, vendedor com `pode_publicar_avisos = true` (A), outro vendedor com a permissão (B) e administrador. Depois apague tudo.
1. **Vendedor sem permissão:** `insert into avisos ...` → **recusado**; enviar arquivo ao bucket `avisos` → **recusado**; `update usuarios set pode_publicar_avisos = true` na própria linha → **recusado**; `select` em `avisos` → funciona.
2. **A (com permissão):** insere um aviso e envia arquivo → funciona; edita e apaga o próprio → funciona; edita ou apaga o aviso de **B** → 0 linhas / recusado; escrever em `midia_login` e no bucket `midia-login` → **recusado**.
3. **Administrador:** edita e apaga qualquer aviso; liga e desliga a permissão de A por `admin_atualizar_usuario(_usuario_id, '{"pode_publicar_avisos": true}')` e a mudança aparece em `registro_auditoria`; envia, edita e apaga em `midia_login` e no bucket `midia-login`.
4. **Visitante sem login (`anon`):** `select` em `midia_login` → só as ativas; `select` em `avisos` → 0 linhas; ler arquivo ativo do `midia-login` → funciona, arquivo de linha inativa → recusado; ler qualquer arquivo do bucket `avisos` → recusado.
5. **Validação:** enviar PDF ou `.exe`, imagem de 6 MB, vídeo de 26 MB → recusados; imagem de 4 MB e MP4 de 20 MB → aceitos. Aviso com `texto_alternativo` vazio, `fim` antes de `inicio` ou `link` sem `http` → recusados.

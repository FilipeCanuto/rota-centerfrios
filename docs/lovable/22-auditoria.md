Aplique exatamente o SQL abaixo como UMA migração nova. Não investigue o projeto, não reescreva nem otimize o SQL, não crie testes em Python. Depois rode o bloco de testes em SQL. Se algo falhar, PARE e copie o erro na resposta, sem tentar corrigir. Regenere os tipos.

Pré-requisito: mensagem 21 já aplicada (migração 0030).

## SQL

```sql
-- 22: correções da auditoria (docs/auditoria-fable.md: S1, S2, S3, S4, S5, R3).

-- S1. Papéis, vínculos e pré-cadastro só por função checada; ninguém se dá um papel novo.
REVOKE INSERT, UPDATE, DELETE ON public.user_roles, public.usuario_empresas, public.papeis_pre_cadastro FROM authenticated;

CREATE FUNCTION public.proteger_papel_proprio() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
 IF NEW.user_id = auth.uid()
    AND NOT EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = NEW.user_id AND r.role = NEW.role AND r.empresa_id IS NOT DISTINCT FROM NEW.empresa_id)
    AND NOT EXISTS (SELECT 1 FROM public.usuarios u WHERE u.auth_user_id = auth.uid() AND u.acesso_total AND u.ativo) THEN
  RAISE EXCEPTION 'Você não pode dar um papel novo a si mesmo. Peça a outro administrador.' USING ERRCODE = '42501';
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.proteger_papel_proprio() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER user_roles_proteger_papel_proprio BEFORE INSERT ON public.user_roles
 FOR EACH ROW EXECUTE FUNCTION public.proteger_papel_proprio();

-- S2. Contato: só de cliente da carteira visível, na mesma empresa, com data de agora e sem marcas forjadas.
DROP POLICY inserir ON public.interacoes;
CREATE POLICY inserir ON public.interacoes FOR INSERT TO authenticated WITH CHECK (
 vendedor_id = (select public.meu_usuario_id()) AND public.tem_empresa(empresa_id)
 AND demo = false AND origem = 'manual'
 AND data BETWEEN now() - interval '1 day' AND now() + interval '5 minutes'
 AND EXISTS (SELECT 1 FROM public.clientes c WHERE c.id = cliente_id AND c.empresa_id = interacoes.empresa_id AND public.pode_ver_vendedor(c.vendedor_id)));

-- S3. Auditoria comercial exige o setor Comercial; a auditoria administrativa continua com o administrador.
CREATE POLICY setor_comercial ON public.registro_auditoria AS RESTRICTIVE FOR SELECT TO authenticated USING (
 tabela IN ('usuarios','usuario_empresas','user_roles','papeis_pre_cadastro','links','equipes')
 OR (select public.tem_setor('comercial')));

-- S4. Post do Instagram: endereço http(s), data dos últimos 7 dias e sem repetir o mesmo post.
ALTER TABLE public.posts_instagram ADD CONSTRAINT posts_instagram_url_http CHECK (url ~* '^https?://') NOT VALID;
DROP POLICY inserir ON public.posts_instagram;
CREATE POLICY inserir ON public.posts_instagram FOR INSERT TO authenticated WITH CHECK (
 vendedor_id = (select public.meu_usuario_id()) AND (select public.tem_empresa(empresa_id)) AND status = 'pendente'
 AND data_post BETWEEN (now() AT TIME ZONE 'America/Maceio')::date - 7 AND (now() AT TIME ZONE 'America/Maceio')::date
 AND NOT EXISTS (SELECT 1 FROM public.posts_instagram p WHERE p.vendedor_id = posts_instagram.vendedor_id AND p.url = posts_instagram.url));

-- S5. Carga de demonstração só pelo servidor (como apagar_dados_demo).
REVOKE EXECUTE ON FUNCTION public.carregar_dados_demo(uuid[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.carregar_dados_demo(uuid[]) TO service_role;

-- R3. Reimportar uma venda não troca o vendedor dela (o faturamento fica com quem vendeu).
CREATE OR REPLACE FUNCTION public.importar_vendas(_empresa_id uuid, _arquivo text, _linhas jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE l jsonb; n int; cod text; cli public.clientes; vid uuid; vend uuid; ins int:=0; upd int:=0; erros jsonb:='[]'; dt date;
BEGIN
 PERFORM public.importacao_validar(_empresa_id,_linhas);
 IF auth.uid() IS NOT NULL AND NOT public.tem_setor('comercial') THEN RAISE EXCEPTION 'Sem acesso ao setor Comercial.' USING ERRCODE = '42501'; END IF;
 FOR l IN SELECT * FROM jsonb_array_elements(_linhas) LOOP
  n:=(l->>'linha')::int; cod:=nullif(btrim(l->>'codigo_shop9'),''); dt:=(l->>'data_faturamento')::date;
  IF cod IS NULL THEN erros:=erros||jsonb_build_object('linha',n,'campo','codigo_shop9','mensagem','Número da nota vazio.'); CONTINUE; END IF;
  SELECT * INTO cli FROM public.clientes WHERE empresa_id=_empresa_id AND codigo_shop9=btrim(l->>'cliente_codigo');
  IF NOT FOUND THEN erros:=erros||jsonb_build_object('linha',n,'campo','cliente_codigo','mensagem','Cliente não encontrado.'); CONTINUE; END IF;
  vid:=NULL; vend:=NULL;
  SELECT id, vendedor_id INTO vid, vend FROM public.vendas WHERE empresa_id=_empresa_id AND codigo_shop9=cod;
  IF vid IS NULL THEN
   vend:=cli.vendedor_id;
   INSERT INTO public.vendas(empresa_id,cliente_id,vendedor_id,codigo_shop9,data_faturamento,valor,origem,demo)
   VALUES(_empresa_id,cli.id,vend,cod,dt,(l->>'valor')::numeric,'importacao',false) RETURNING id INTO vid; ins:=ins+1;
  ELSE
   UPDATE public.vendas SET cliente_id=cli.id,data_faturamento=dt,valor=(l->>'valor')::numeric,origem='importacao' WHERE id=vid;
   DELETE FROM public.itens_venda WHERE venda_id=vid; upd:=upd+1;
  END IF;
  INSERT INTO public.itens_venda(empresa_id,venda_id,cliente_id,vendedor_id,produto,codigo_produto,quantidade,valor_total,origem,demo)
  SELECT _empresa_id,vid,cli.id,vend,i->>'produto',nullif(i->>'codigo_produto',''),coalesce((i->>'quantidade')::numeric,1),coalesce((i->>'valor_total')::numeric,0),'importacao',false
  FROM jsonb_array_elements(coalesce(l->'itens','[]')) i WHERE nullif(btrim(i->>'produto'),'') IS NOT NULL;
  UPDATE public.clientes SET data_ultima_compra=dt WHERE id=cli.id AND (data_ultima_compra IS NULL OR data_ultima_compra<dt);
 END LOOP;
 RETURN public.importacao_registrar(_empresa_id,'vendas',_arquivo,jsonb_array_length(_linhas),ins,upd,erros);
END $$;
```

## Testes (SQL puro, nada fica gravado)

```sql
BEGIN;
DO $t$
DECLARE
  emp uuid; n int; ok boolean;
  x_id uuid := gen_random_uuid(); x_auth uuid := gen_random_uuid();  -- administrador sem acesso total
  d_id uuid := gen_random_uuid(); d_auth uuid := gen_random_uuid();  -- diretoria, começa sem setor
  v_id uuid := gen_random_uuid(); v_auth uuid := gen_random_uuid();  -- vendedor com setor Comercial
  v2_id uuid := gen_random_uuid();                                  -- outro vendedor (sem login)
  c1 uuid := gen_random_uuid(); c2 uuid := gen_random_uuid();
BEGIN
  SELECT id INTO emp FROM public.empresas WHERE nome = 'CENTERFRIOS';
  IF emp IS NULL THEN RAISE EXCEPTION 'FALHA 0: empresa não encontrada'; END IF;
  INSERT INTO public.usuarios(id, nome, email, empresa_id) VALUES
   (x_id, 'Admin teste 22', 'teste22.admin@centerfrios.com', emp),
   (d_id, 'Diretoria teste 22', 'teste22.diretoria@centerfrios.com', emp),
   (v_id, 'Vendedor teste 22', 'teste22.vendedor@centerfrios.com', emp),
   (v2_id, 'Vendedor 2 teste 22', 'teste22.vendedor2@centerfrios.com', emp);
  INSERT INTO public.usuario_empresas(usuario_id, empresa_id) VALUES (x_id, emp), (d_id, emp), (v_id, emp);
  INSERT INTO public.papeis_pre_cadastro(usuario_id, role, empresa_id) VALUES
   (x_id, 'administrador', NULL), (d_id, 'diretoria', NULL), (v_id, 'vendedor', emp);
  INSERT INTO public.usuario_setores(usuario_id, setor) VALUES (v_id, 'comercial');
  INSERT INTO auth.users(id, instance_id, aud, role, email, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at) VALUES
   (x_auth, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'teste22.admin@centerfrios.com', now(), '{}', '{}', now(), now()),
   (d_auth, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'teste22.diretoria@centerfrios.com', now(), '{}', '{}', now(), now()),
   (v_auth, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'teste22.vendedor@centerfrios.com', now(), '{}', '{}', now(), now());
  INSERT INTO public.clientes(id, empresa_id, vendedor_id, nome, codigo_shop9) VALUES
   (c1, emp, v_id, 'Cliente 1 teste 22', 'T22C1'), (c2, emp, v2_id, 'Cliente 2 teste 22', 'T22C2');
  INSERT INTO public.registro_auditoria(empresa_id, acao, tabela, registro_id) VALUES
   (emp, 'teste22', 'clientes', c1), (emp, 'teste22', 'usuarios', x_id);

  -- 1 (S1). Administrador sem acesso total não grava papel direto nem se dá diretoria; dá a outra pessoa.
  PERFORM set_config('request.jwt.claims', json_build_object('sub', x_auth, 'role', 'authenticated')::text, true);
  EXECUTE 'set local role authenticated';
  ok := false; BEGIN INSERT INTO public.user_roles(user_id, role) VALUES (x_auth, 'diretoria'); EXCEPTION WHEN insufficient_privilege THEN ok := true; END;
  IF NOT ok THEN RAISE EXCEPTION 'FALHA 1a: gravou papel direto em user_roles'; END IF;
  ok := false; BEGIN INSERT INTO public.usuario_empresas(usuario_id, empresa_id) VALUES (v2_id, emp); EXCEPTION WHEN insufficient_privilege THEN ok := true; END;
  IF NOT ok THEN RAISE EXCEPTION 'FALHA 1b: gravou vínculo direto'; END IF;
  ok := false; BEGIN PERFORM public.admin_salvar_acessos(x_id, ARRAY['administrador','diretoria']::public.app_role[], ARRAY[emp], ARRAY['comercial']); EXCEPTION WHEN insufficient_privilege THEN ok := true; END;
  IF NOT ok THEN RAISE EXCEPTION 'FALHA 1c: administrador se deu diretoria'; END IF;
  PERFORM public.admin_salvar_acessos(v_id, ARRAY['vendedor']::public.app_role[], ARRAY[emp], ARRAY['comercial']);
  EXECUTE 'reset role';

  -- 3 (S3). Sem o setor Comercial, a auditoria comercial some; a administrativa continua para o administrador.
  PERFORM set_config('request.jwt.claims', json_build_object('sub', d_auth, 'role', 'authenticated')::text, true);
  EXECUTE 'set local role authenticated';
  SELECT count(*) INTO n FROM public.registro_auditoria WHERE acao = 'teste22' AND tabela = 'clientes';
  IF n <> 0 THEN RAISE EXCEPTION 'FALHA 3a: diretoria sem setor leu auditoria comercial'; END IF;
  EXECUTE 'reset role';
  INSERT INTO public.usuario_setores(usuario_id, setor) VALUES (d_id, 'comercial');
  EXECUTE 'set local role authenticated';
  SELECT count(*) INTO n FROM public.registro_auditoria WHERE acao = 'teste22' AND tabela = 'clientes';
  IF n <> 1 THEN RAISE EXCEPTION 'FALHA 3b: diretoria com setor não leu auditoria comercial'; END IF;
  EXECUTE 'reset role';
  PERFORM set_config('request.jwt.claims', json_build_object('sub', x_auth, 'role', 'authenticated')::text, true);
  EXECUTE 'set local role authenticated';
  SELECT count(*) INTO n FROM public.registro_auditoria WHERE acao = 'teste22' AND tabela = 'usuarios';
  IF n <> 1 THEN RAISE EXCEPTION 'FALHA 3c: administrador perdeu a auditoria administrativa'; END IF;
  EXECUTE 'reset role';

  -- 2 (S2). Contato só de cliente da carteira, com data de agora e sem marca de demonstração.
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_auth, 'role', 'authenticated')::text, true);
  EXECUTE 'set local role authenticated';
  INSERT INTO public.interacoes(empresa_id, cliente_id, vendedor_id, tipo, cliente_respondeu) VALUES (emp, c1, v_id, 'whatsapp', true);
  ok := false; BEGIN INSERT INTO public.interacoes(empresa_id, cliente_id, vendedor_id, tipo) VALUES (emp, c2, v_id, 'whatsapp'); EXCEPTION WHEN insufficient_privilege THEN ok := true; END;
  IF NOT ok THEN RAISE EXCEPTION 'FALHA 2a: contato em cliente de outra carteira'; END IF;
  ok := false; BEGIN INSERT INTO public.interacoes(empresa_id, cliente_id, vendedor_id, tipo, data) VALUES (emp, c1, v_id, 'visita', now() - interval '10 days'); EXCEPTION WHEN insufficient_privilege THEN ok := true; END;
  IF NOT ok THEN RAISE EXCEPTION 'FALHA 2b: contato com data antiga'; END IF;
  ok := false; BEGIN INSERT INTO public.interacoes(empresa_id, cliente_id, vendedor_id, tipo, demo) VALUES (emp, c1, v_id, 'visita', true); EXCEPTION WHEN insufficient_privilege THEN ok := true; END;
  IF NOT ok THEN RAISE EXCEPTION 'FALHA 2c: contato marcado como demonstração'; END IF;

  -- 4 (S4). Post: só http(s), dos últimos 7 dias e sem repetir.
  INSERT INTO public.posts_instagram(empresa_id, vendedor_id, url, legenda, data_post)
   VALUES (emp, v_id, 'https://instagram.com/p/teste22', '@centerfriosoficial', (now() AT TIME ZONE 'America/Maceio')::date);
  ok := false; BEGIN INSERT INTO public.posts_instagram(empresa_id, vendedor_id, url, legenda, data_post)
   VALUES (emp, v_id, 'https://instagram.com/p/teste22', '@centerfriosoficial', (now() AT TIME ZONE 'America/Maceio')::date); EXCEPTION WHEN insufficient_privilege THEN ok := true; END;
  IF NOT ok THEN RAISE EXCEPTION 'FALHA 4a: post repetido'; END IF;
  ok := false; BEGIN INSERT INTO public.posts_instagram(empresa_id, vendedor_id, url, legenda, data_post)
   VALUES (emp, v_id, 'javascript:alert(1)', '@centerfriosoficial', (now() AT TIME ZONE 'America/Maceio')::date); EXCEPTION WHEN check_violation THEN ok := true; END;
  IF NOT ok THEN RAISE EXCEPTION 'FALHA 4b: endereço que não é http(s)'; END IF;
  ok := false; BEGIN INSERT INTO public.posts_instagram(empresa_id, vendedor_id, url, legenda, data_post)
   VALUES (emp, v_id, 'https://instagram.com/p/teste22b', '@centerfriosoficial', (now() AT TIME ZONE 'America/Maceio')::date - 30); EXCEPTION WHEN insufficient_privilege THEN ok := true; END;
  IF NOT ok THEN RAISE EXCEPTION 'FALHA 4c: post de 30 dias atrás'; END IF;
  EXECUTE 'reset role';

  -- 5 (S5). Carga de demonstração só pelo servidor.
  IF has_function_privilege('authenticated', 'public.carregar_dados_demo(uuid[])', 'EXECUTE') THEN
    RAISE EXCEPTION 'FALHA 5: authenticated ainda carrega demonstração'; END IF;

  -- 6 (R3). Reimportar a nota depois de trocar a carteira mantém o vendedor da venda.
  PERFORM set_config('request.jwt.claims', json_build_object('sub', d_auth, 'role', 'authenticated')::text, true);
  EXECUTE 'set local role authenticated';
  PERFORM public.importar_vendas(emp, 'teste22.csv', jsonb_build_array(jsonb_build_object('linha', 2, 'codigo_shop9', 'T22N1',
   'cliente_codigo', 'T22C1', 'data_faturamento', '2026-11-10', 'valor', 100, 'itens', jsonb_build_array(jsonb_build_object('produto', 'Item teste', 'quantidade', 1, 'valor_total', 100)))));
  EXECUTE 'reset role';
  PERFORM set_config('request.jwt.claims', json_build_object('role', 'service_role')::text, true);
  EXECUTE 'set local role service_role';
  UPDATE public.clientes SET vendedor_id = v2_id WHERE id = c1;
  EXECUTE 'reset role';
  PERFORM set_config('request.jwt.claims', json_build_object('sub', d_auth, 'role', 'authenticated')::text, true);
  EXECUTE 'set local role authenticated';
  PERFORM public.importar_vendas(emp, 'teste22.csv', jsonb_build_array(jsonb_build_object('linha', 2, 'codigo_shop9', 'T22N1',
   'cliente_codigo', 'T22C1', 'data_faturamento', '2026-11-10', 'valor', 120, 'itens', jsonb_build_array(jsonb_build_object('produto', 'Item teste', 'quantidade', 1, 'valor_total', 120)))));
  EXECUTE 'reset role';
  SELECT count(*) INTO n FROM public.vendas WHERE empresa_id = emp AND codigo_shop9 = 'T22N1' AND vendedor_id = v_id AND valor = 120;
  IF n <> 1 THEN RAISE EXCEPTION 'FALHA 6a: reimportação trocou o vendedor ou não atualizou o valor'; END IF;
  SELECT count(*) INTO n FROM public.itens_venda i JOIN public.vendas v ON v.id = i.venda_id WHERE v.codigo_shop9 = 'T22N1' AND v.empresa_id = emp AND i.vendedor_id = v_id;
  IF n <> 1 THEN RAISE EXCEPTION 'FALHA 6b: itens com outro vendedor'; END IF;

  RAISE NOTICE 'Texto 22: testes 1 a 6 passaram.';
END $t$;
ROLLBACK;
```

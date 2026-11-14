-- Teste de acesso total. Roda tudo numa transação que termina com erro proposital
-- ("RESULTADO OK ...") para desfazer todos os dados de teste automaticamente.
DO $t$
DECLARE
  f_auth uuid; f_id uuid; a_auth uuid; a_id uuid;
  x_id uuid := gen_random_uuid(); x_auth uuid := gen_random_uuid();
  emp uuid; n int; ok boolean; msg text := ''; s text[];
BEGIN
  SELECT auth_user_id, id INTO f_auth, f_id FROM public.usuarios WHERE email = 'filipecanuto@centerfrios.com';
  SELECT auth_user_id, id INTO a_auth, a_id FROM public.usuarios WHERE email = 'adm@centerfrios.com';
  SELECT id INTO emp FROM public.empresas WHERE nome = 'CENTERFRIOS';
  -- setor novo criado no teste e administrador comum temporário
  INSERT INTO public.setores(chave, nome, icone) VALUES ('teste_total', 'Teste total', 'users');
  INSERT INTO public.usuarios(id, nome, email, empresa_id) VALUES (x_id, 'Admin comum teste', 'teste.acessototal@centerfrios.com', emp);
  INSERT INTO public.usuario_empresas(usuario_id, empresa_id) VALUES (x_id, emp);
  INSERT INTO public.papeis_pre_cadastro(usuario_id, role) VALUES (x_id, 'administrador');
  INSERT INTO public.usuario_setores(usuario_id, setor) VALUES (x_id, 'comercial');
  INSERT INTO auth.users(id, instance_id, aud, role, email, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
   VALUES (x_auth, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'teste.acessototal@centerfrios.com', now(), '{}', '{}', now(), now());

  -- 1. as duas contas enxergam todos os setores ativos, inclusive o novo
  FOR n IN 1..2 LOOP
    PERFORM set_config('request.jwt.claims', json_build_object('sub', CASE n WHEN 1 THEN f_auth ELSE a_auth END, 'role', 'authenticated')::text, true);
    EXECUTE 'set local role authenticated';
    s := public.meus_setores();
    IF NOT (s @> (SELECT array_agg(chave) FROM public.setores WHERE ativo)) OR NOT ('teste_total' = ANY(s)) OR NOT public.tem_setor('teste_total') THEN
      RAISE EXCEPTION 'FALHA 1: conta % sem todos os setores', n; END IF;
    EXECUTE 'reset role';
  END LOOP;
  msg := msg || '1 ok; ';

  -- 2. administrador comum não ganha acesso total nem consegue conceder
  PERFORM set_config('request.jwt.claims', json_build_object('sub', x_auth, 'role', 'authenticated')::text, true);
  EXECUTE 'set local role authenticated';
  IF public.tem_setor('teste_total') OR NOT public.eh_admin() THEN RAISE EXCEPTION 'FALHA 2a'; END IF;
  ok := false; BEGIN PERFORM public.definir_acesso_total(x_id, true); EXCEPTION WHEN insufficient_privilege THEN ok := true; END;
  IF NOT ok THEN RAISE EXCEPTION 'FALHA 2b: admin comum concedeu'; END IF;
  ok := false; BEGIN UPDATE public.usuarios SET acesso_total = true WHERE id = x_id; EXCEPTION WHEN insufficient_privilege THEN ok := true; END;
  IF NOT ok THEN RAISE EXCEPTION 'FALHA 2c: update direto'; END IF;
  ok := false; BEGIN PERFORM public.admin_atualizar_usuario(x_id, '{"acesso_total": true}'); EXCEPTION WHEN OTHERS THEN ok := true; END;
  IF NOT ok THEN RAISE EXCEPTION 'FALHA 2d: admin_atualizar_usuario'; END IF;
  ok := false; BEGIN PERFORM public.definir_acesso_total(f_id, false); EXCEPTION WHEN insufficient_privilege THEN ok := true; END;
  IF NOT ok THEN RAISE EXCEPTION 'FALHA 2e: admin comum retirou'; END IF;
  EXECUTE 'reset role';
  IF (SELECT acesso_total FROM public.usuarios WHERE id = x_id) THEN RAISE EXCEPTION 'FALHA 2f'; END IF;
  msg := msg || '2 ok; ';

  -- 3. concessão e remoção por titular ficam na auditoria
  PERFORM set_config('request.jwt.claims', json_build_object('sub', f_auth, 'role', 'authenticated')::text, true);
  EXECUTE 'set local role authenticated';
  PERFORM public.definir_acesso_total(x_id, true);
  EXECUTE 'reset role';
  PERFORM set_config('request.jwt.claims', json_build_object('sub', x_auth, 'role', 'authenticated')::text, true);
  EXECUTE 'set local role authenticated';
  IF NOT public.tem_setor('teste_total') THEN RAISE EXCEPTION 'FALHA 3a'; END IF;
  EXECUTE 'reset role';
  PERFORM set_config('request.jwt.claims', json_build_object('sub', f_auth, 'role', 'authenticated')::text, true);
  EXECUTE 'set local role authenticated';
  PERFORM public.definir_acesso_total(x_id, false);
  EXECUTE 'reset role';
  SELECT count(*) INTO n FROM public.registro_auditoria WHERE registro_id = x_id AND detalhes->>'permissao' = 'acesso_total'
    AND usuario_id = f_id AND ((detalhes->>'antigo')::boolean <> (detalhes->>'novo')::boolean);
  IF n <> 2 THEN RAISE EXCEPTION 'FALHA 3b: % registros de auditoria', n; END IF;
  msg := msg || '3 ok (2 registros antes/depois); ';

  -- 4. último titular
  PERFORM set_config('request.jwt.claims', json_build_object('sub', f_auth, 'role', 'authenticated')::text, true);
  EXECUTE 'set local role authenticated';
  PERFORM public.definir_acesso_total(a_id, false);          -- sobra só o Filipe
  ok := false; BEGIN PERFORM public.definir_acesso_total(f_id, false); EXCEPTION WHEN insufficient_privilege THEN ok := true; END;
  IF NOT ok THEN RAISE EXCEPTION 'FALHA 4a: removeu último titular'; END IF;
  EXECUTE 'reset role';
  PERFORM set_config('request.jwt.claims', json_build_object('sub', a_auth, 'role', 'authenticated')::text, true);
  EXECUTE 'set local role authenticated';
  ok := false; BEGIN PERFORM public.admin_atualizar_usuario(f_id, '{"ativo": false}'); EXCEPTION WHEN insufficient_privilege THEN ok := true; END;
  IF NOT ok THEN RAISE EXCEPTION 'FALHA 4b: desativou último titular'; END IF;
  EXECUTE 'reset role';
  ok := false; BEGIN DELETE FROM public.usuarios WHERE id = f_id; EXCEPTION WHEN insufficient_privilege THEN ok := true; END;
  IF NOT ok THEN RAISE EXCEPTION 'FALHA 4c: apagou último titular'; END IF;
  msg := msg || '4 ok; ';

  RAISE EXCEPTION 'RESULTADO OK: %', msg;
END $t$;

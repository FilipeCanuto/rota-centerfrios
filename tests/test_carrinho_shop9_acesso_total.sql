-- Item 11 (U): conta com acesso_total e SEM linha em usuario_setores usa carrinho como vendedor.
-- Termina com erro proposital ("RESULTADO OK ...") para desfazer todos os dados de teste.
DO $t$
DECLARE u uuid:=gen_random_uuid(); ua uuid:=gen_random_uuid(); c uuid:=gen_random_uuid(); emp uuid; k uuid; n int; ok boolean;
BEGIN
  SELECT id INTO emp FROM public.empresas WHERE nome='CENTERFRIOS';
  PERFORM set_config('app.acesso_total_ok','sim',true);
  INSERT INTO public.usuarios(id,nome,email,empresa_id,acesso_total) VALUES (u,'U total','carrinho.u.teste@centerfrios.com',emp,true)
   ON CONFLICT (id) DO NOTHING;
  SELECT id INTO u FROM public.usuarios WHERE email='carrinho.u.teste@centerfrios.com';
  INSERT INTO public.usuario_empresas(usuario_id,empresa_id) VALUES (u,emp) ON CONFLICT DO NOTHING;
  INSERT INTO public.papeis_pre_cadastro(usuario_id,role,empresa_id) VALUES (u,'vendedor',emp);
  INSERT INTO auth.users(id,instance_id,aud,role,email,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
   VALUES (ua,'00000000-0000-0000-0000-000000000000','authenticated','authenticated','carrinho.u.teste@centerfrios.com',now(),'{}','{}',now(),now());
  DELETE FROM public.usuario_setores WHERE usuario_id=u;
  INSERT INTO public.clientes(id,empresa_id,vendedor_id,nome) VALUES (c,emp,u,'Cliente U');
  PERFORM set_config('request.jwt.claims',json_build_object('sub',ua,'role','authenticated')::text,true);
  EXECUTE 'set local role authenticated';
  IF NOT public.tem_setor('comercial') THEN RAISE EXCEPTION 'FALHA: sem setor'; END IF;
  k:=public.abrir_carrinho(c);
  SELECT count(*) INTO n FROM public.carrinhos WHERE id=k;
  IF n<>1 THEN RAISE EXCEPTION 'FALHA: não vê o próprio carrinho'; END IF;
  SELECT count(*) INTO n FROM public.carrinhos WHERE vendedor_id<>u;
  IF n<>0 THEN RAISE EXCEPTION 'FALHA: vendedor vê carrinho alheio (%)',n; END IF;
  BEGIN PERFORM public.shop9_pendentes(emp); ok:=false; EXCEPTION WHEN insufficient_privilege THEN ok:=true; END;
  IF NOT ok THEN RAISE EXCEPTION 'FALHA: vendedor U viu a fila do Shop9'; END IF;
  EXECUTE 'reset role';
  RAISE EXCEPTION 'RESULTADO OK: acesso_total sem linha de setor abriu carrinho, viu só o próprio e não acessou a fila (papel vendedor)';
END $t$;

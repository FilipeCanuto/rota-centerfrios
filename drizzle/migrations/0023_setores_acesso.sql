ALTER TABLE public.usuarios ADD COLUMN ativo boolean NOT NULL DEFAULT true;

CREATE TABLE public.usuario_setores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id uuid NOT NULL REFERENCES public.usuarios(id) ON DELETE CASCADE,
  setor text NOT NULL CHECK (setor ~ '^[a-z][a-z_]{1,30}$'),
  empresa_id uuid REFERENCES public.empresas(id),
  ativo boolean NOT NULL DEFAULT true,
  liberado_por uuid REFERENCES public.usuarios(id),
  liberado_em timestamptz NOT NULL DEFAULT now(),
  origem public.origem_dado NOT NULL DEFAULT 'manual',
  UNIQUE NULLS NOT DISTINCT (usuario_id, setor, empresa_id)
);
CREATE INDEX usuario_setores_ativo_idx ON public.usuario_setores(usuario_id, setor) WHERE ativo;
REVOKE ALL ON public.usuario_setores FROM anon, authenticated;
GRANT SELECT ON public.usuario_setores TO authenticated;
GRANT ALL ON public.usuario_setores TO service_role;
ALTER TABLE public.usuario_setores ENABLE ROW LEVEL SECURITY;

CREATE FUNCTION public.tem_setor(_usuario_id uuid, _setor text) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.usuario_setores s JOIN public.usuarios u ON u.id = s.usuario_id
    WHERE s.usuario_id = _usuario_id AND s.setor = _setor AND s.ativo AND u.ativo)
$$;
CREATE FUNCTION public.tem_setor(_setor text) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.tem_setor(public.meu_usuario_id(), _setor)
$$;
CREATE FUNCTION public.meus_setores() RETURNS text[]
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT coalesce(array_agg(DISTINCT s.setor ORDER BY s.setor), '{}')
  FROM public.usuario_setores s JOIN public.usuarios u ON u.id = s.usuario_id
  WHERE s.usuario_id = public.meu_usuario_id() AND s.ativo AND u.ativo
$$;
REVOKE ALL ON FUNCTION public.tem_setor(uuid, text), public.tem_setor(text), public.meus_setores() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.tem_setor(uuid, text), public.tem_setor(text), public.meus_setores() TO authenticated, service_role;

CREATE POLICY usuario_setores_leitura ON public.usuario_setores FOR SELECT TO authenticated
  USING (usuario_id = (select public.meu_usuario_id()) OR (select public.eh_admin()));

CREATE POLICY setor_comercial_arquivos ON storage.objects AS RESTRICTIVE FOR ALL TO authenticated
  USING (bucket_id <> 'arquivos' OR (select public.tem_setor('comercial')))
  WITH CHECK (bucket_id <> 'arquivos' OR (select public.tem_setor('comercial')));

DO $do$
DECLARE t text;
BEGIN
 FOREACH t IN ARRAY ARRAY['clientes','vendas','itens_venda','orcamentos','interacoes','tarefas_agenda','alertas','metas','pontos','selos','notas_cliente','importacoes','posts_instagram','links','notificacoes','preferencias_notificacao'] LOOP
  EXECUTE format('CREATE POLICY setor_comercial ON public.%I AS RESTRICTIVE FOR ALL TO authenticated USING ((select public.tem_setor(''comercial''))) WITH CHECK ((select public.tem_setor(''comercial'')))', t);
 END LOOP;
END $do$;

DO $do$
DECLARE f text; d text; chk text := ' IF auth.uid() IS NOT NULL AND NOT public.tem_setor(''comercial'') THEN RAISE EXCEPTION ''Sem acesso ao setor Comercial.'' USING ERRCODE = ''42501''; END IF;' || chr(10);
BEGIN
 FOREACH f IN ARRAY ARRAY['importar_clientes','importar_vendas','importar_orcamentos','remanejar_cliente','calcular_pontos_dia','atualizar_selos','registrar_notificacoes','ranking','validar_post_instagram'] LOOP
  SELECT pg_get_functiondef(p.oid) INTO d FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname = 'public' AND p.proname = f;
  IF position('Sem acesso ao setor Comercial' IN d) > 0 THEN CONTINUE; END IF;
  IF f = 'validar_post_instagram' THEN
   d := regexp_replace(d, '(pode validar este post\.'' USING ERRCODE=''42501''; END IF;\n)', '\1' || replace(chk, '\', '\\'));
  ELSE
   d := regexp_replace(d, '(\nBEGIN\n[^\n]*\n)', '\1' || replace(chk, '\', '\\'));
  END IF;
  IF position('Sem acesso ao setor Comercial' IN d) = 0 THEN RAISE EXCEPTION 'Não foi possível incluir a checagem de setor em %', f; END IF;
  EXECUTE d;
 END LOOP;
END $do$;

CREATE OR REPLACE FUNCTION public.admin_salvar_acessos(_usuario_id uuid, _papeis public.app_role[], _empresas uuid[], _setores text[])
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $function$
DECLARE u public.usuarios; eu uuid := public.meu_usuario_id(); antigo jsonb; novo jsonb;
BEGIN
 IF NOT public.eh_admin() THEN RAISE EXCEPTION 'Apenas administradores.' USING ERRCODE = '42501'; END IF;
 IF _papeis IS NULL OR cardinality(_papeis) = 0 THEN RAISE EXCEPTION 'Marque pelo menos um papel.' USING ERRCODE='22023'; END IF;
 IF _empresas IS NULL OR cardinality(_empresas) = 0 THEN RAISE EXCEPTION 'Marque pelo menos uma empresa.' USING ERRCODE='22023'; END IF;
 IF _setores IS NULL OR cardinality(_setores) = 0 THEN RAISE EXCEPTION 'Marque pelo menos um setor.' USING ERRCODE='22023'; END IF;
 IF EXISTS (SELECT 1 FROM unnest(_setores) s WHERE s IS NULL OR s !~ '^[a-z][a-z_]{1,30}$') THEN RAISE EXCEPTION 'Setor inválido.' USING ERRCODE='22023'; END IF;
 IF EXISTS (SELECT 1 FROM unnest(_empresas) e WHERE e IS NULL OR NOT EXISTS (SELECT 1 FROM public.empresas x WHERE x.id = e)) THEN RAISE EXCEPTION 'Empresa não encontrada.' USING ERRCODE='22023'; END IF;
 SELECT * INTO u FROM public.usuarios WHERE id = _usuario_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Usuário não encontrado.' USING ERRCODE='22023'; END IF;
 IF _usuario_id = eu AND NOT ('administrador' = ANY(_papeis)) THEN RAISE EXCEPTION 'Você não pode tirar o próprio papel de administrador.' USING ERRCODE='42501'; END IF;

 antigo := jsonb_build_object(
  'papeis', CASE WHEN u.auth_user_id IS NOT NULL
    THEN (SELECT coalesce(jsonb_agg(DISTINCT role ORDER BY role), '[]') FROM public.user_roles WHERE user_id = u.auth_user_id AND empresa_id IS NULL)
    ELSE (SELECT coalesce(jsonb_agg(DISTINCT role ORDER BY role), '[]') FROM public.papeis_pre_cadastro WHERE usuario_id = u.id AND empresa_id IS NULL) END,
  'empresas', (SELECT coalesce(jsonb_agg(empresa_id ORDER BY empresa_id), '[]') FROM public.usuario_empresas WHERE usuario_id = u.id),
  'setores', (SELECT coalesce(jsonb_agg(setor ORDER BY setor), '[]') FROM public.usuario_setores WHERE usuario_id = u.id AND empresa_id IS NULL AND ativo));

 IF u.auth_user_id IS NOT NULL THEN
  DELETE FROM public.user_roles WHERE user_id = u.auth_user_id AND empresa_id IS NULL AND NOT (role = ANY(_papeis));
  INSERT INTO public.user_roles(user_id, role, empresa_id) SELECT DISTINCT u.auth_user_id, r, NULL::uuid FROM unnest(_papeis) r
   ON CONFLICT (user_id, role, empresa_id) DO NOTHING;
 ELSE
  DELETE FROM public.papeis_pre_cadastro WHERE usuario_id = u.id AND empresa_id IS NULL AND NOT (role = ANY(_papeis));
  INSERT INTO public.papeis_pre_cadastro(usuario_id, role, empresa_id) SELECT DISTINCT u.id, r, NULL::uuid FROM unnest(_papeis) r
   ON CONFLICT (usuario_id, role, empresa_id) DO NOTHING;
 END IF;

 DELETE FROM public.usuario_empresas WHERE usuario_id = u.id AND NOT (empresa_id = ANY(_empresas));
 INSERT INTO public.usuario_empresas(usuario_id, empresa_id) SELECT DISTINCT u.id, e FROM unnest(_empresas) e ON CONFLICT DO NOTHING;

 UPDATE public.usuario_setores SET ativo = false WHERE usuario_id = u.id AND empresa_id IS NULL AND ativo AND NOT (setor = ANY(_setores));
 UPDATE public.usuario_setores SET ativo = true, liberado_por = eu, liberado_em = now() WHERE usuario_id = u.id AND empresa_id IS NULL AND NOT ativo AND setor = ANY(_setores);
 INSERT INTO public.usuario_setores(usuario_id, setor, empresa_id, liberado_por, liberado_em)
  SELECT DISTINCT u.id, s, NULL::uuid, eu, now() FROM unnest(_setores) s ON CONFLICT (usuario_id, setor, empresa_id) DO NOTHING;

 novo := jsonb_build_object(
  'papeis', (SELECT jsonb_agg(DISTINCT r ORDER BY r) FROM unnest(_papeis) r),
  'empresas', (SELECT jsonb_agg(DISTINCT e ORDER BY e) FROM unnest(_empresas) e),
  'setores', (SELECT jsonb_agg(DISTINCT s ORDER BY s) FROM unnest(_setores) s));
 PERFORM public.auditar('alteracao_acessos', 'usuarios', _usuario_id, u.empresa_id, _usuario_id, jsonb_build_object('antigo', antigo, 'novo', novo));
END $function$;

CREATE OR REPLACE FUNCTION public.admin_pre_cadastrar(_nome text, _email text, _papeis public.app_role[], _empresas uuid[], _setores text[], _pode_publicar_avisos boolean DEFAULT false)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $function$
DECLARE e text := lower(btrim(_email)); novo_id uuid;
BEGIN
 IF NOT public.eh_admin() THEN RAISE EXCEPTION 'Apenas administradores.' USING ERRCODE = '42501'; END IF;
 IF _nome IS NULL OR btrim(_nome) = '' THEN RAISE EXCEPTION 'Informe o nome.' USING ERRCODE='22023'; END IF;
 IF e IS NULL OR e !~ '^[^@]+@(centerfrios\.com|grupo381\.com\.br)$' THEN RAISE EXCEPTION 'Acesso restrito a e-mails da CENTERFRIOS e da 381 Distribuidora.' USING ERRCODE='22023'; END IF;
 IF EXISTS (SELECT 1 FROM public.usuarios WHERE lower(btrim(email)) = e) THEN RAISE EXCEPTION 'Já existe usuário com este e-mail.' USING ERRCODE='23505'; END IF;
 IF _empresas IS NULL OR cardinality(_empresas) = 0 THEN RAISE EXCEPTION 'Marque pelo menos uma empresa.' USING ERRCODE='22023'; END IF;
 INSERT INTO public.usuarios(nome, email, empresa_id, pode_publicar_avisos, ativo, auth_user_id)
  VALUES (btrim(_nome), e, _empresas[1], coalesce(_pode_publicar_avisos, false), true, NULL) RETURNING id INTO novo_id;
 PERFORM public.admin_salvar_acessos(novo_id, _papeis, _empresas, _setores);
 PERFORM public.auditar('pre_cadastro', 'usuarios', novo_id, _empresas[1], novo_id,
  jsonb_build_object('nome', btrim(_nome), 'email', e, 'papeis', to_jsonb(_papeis), 'empresas', to_jsonb(_empresas), 'setores', to_jsonb(_setores), 'pode_publicar_avisos', coalesce(_pode_publicar_avisos, false)));
 RETURN novo_id;
END $function$;

REVOKE ALL ON FUNCTION public.admin_salvar_acessos(uuid, public.app_role[], uuid[], text[]), public.admin_pre_cadastrar(text, text, public.app_role[], uuid[], text[], boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_salvar_acessos(uuid, public.app_role[], uuid[], text[]), public.admin_pre_cadastrar(text, text, public.app_role[], uuid[], text[], boolean) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_atualizar_usuario(_usuario_id uuid, _dados jsonb)
 RETURNS usuarios LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE atual public.usuarios; novo public.usuarios;
BEGIN
 IF NOT public.eh_admin() THEN RAISE EXCEPTION 'Apenas administradores podem atualizar usuários.' USING ERRCODE='42501'; END IF;
 IF jsonb_typeof(_dados) IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'Dados do usuário devem ser um objeto.'; END IF;
 IF EXISTS(SELECT 1 FROM jsonb_object_keys(_dados) AS k(chave) WHERE chave NOT IN ('nome','email','empresa_id','equipe_id','apelido_copiloto','tema','origem','pode_publicar_avisos','ativo')) THEN RAISE EXCEPTION 'Campo de usuário não permitido.'; END IF;
 IF _dados ? 'pode_publicar_avisos' AND jsonb_typeof(_dados->'pode_publicar_avisos') IS DISTINCT FROM 'boolean' THEN RAISE EXCEPTION 'pode_publicar_avisos deve ser verdadeiro ou falso.'; END IF;
 IF _dados ? 'ativo' AND jsonb_typeof(_dados->'ativo') IS DISTINCT FROM 'boolean' THEN RAISE EXCEPTION 'ativo deve ser verdadeiro ou falso.'; END IF;
 SELECT * INTO atual FROM public.usuarios WHERE id=_usuario_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Usuário não encontrado.'; END IF;
 novo:=jsonb_populate_record(atual,_dados);
 IF _usuario_id = public.meu_usuario_id() AND NOT novo.ativo THEN RAISE EXCEPTION 'Você não pode desativar a própria conta.' USING ERRCODE='42501'; END IF;
 IF atual.auth_user_id IS NOT NULL AND novo.email IS DISTINCT FROM atual.email THEN RAISE EXCEPTION 'Não é possível trocar o e-mail de um usuário que já tem login.'; END IF;
 UPDATE public.usuarios SET nome=novo.nome,email=novo.email,empresa_id=novo.empresa_id,equipe_id=novo.equipe_id,apelido_copiloto=novo.apelido_copiloto,tema=novo.tema,origem=novo.origem,pode_publicar_avisos=novo.pode_publicar_avisos,ativo=novo.ativo WHERE id=_usuario_id RETURNING * INTO novo;
 PERFORM public.auditar('alteracao_usuario','usuarios',novo.id,novo.empresa_id,novo.id,jsonb_build_object('antigo',to_jsonb(atual),'novo',to_jsonb(novo)));
 IF novo.pode_publicar_avisos IS DISTINCT FROM atual.pode_publicar_avisos THEN
   PERFORM public.auditar('alteracao_permissao','usuarios',novo.id,novo.empresa_id,novo.id,jsonb_build_object('permissao','pode_publicar_avisos','antigo',atual.pode_publicar_avisos,'novo',novo.pode_publicar_avisos));
 END IF;
 IF novo.ativo IS DISTINCT FROM atual.ativo THEN
   PERFORM public.auditar('alteracao_permissao','usuarios',novo.id,novo.empresa_id,novo.id,jsonb_build_object('permissao','ativo','antigo',atual.ativo,'novo',novo.ativo));
 END IF;
 RETURN novo;
END $function$;

INSERT INTO public.usuario_setores(usuario_id, setor, empresa_id, liberado_por)
 SELECT id, 'comercial', NULL, NULL FROM public.usuarios ON CONFLICT (usuario_id, setor, empresa_id) DO NOTHING;
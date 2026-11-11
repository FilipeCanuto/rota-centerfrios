-- Papéis por empresa. As colunas legadas permanecem obsoletas por proteção do app publicado.
ALTER TABLE public.user_roles ADD COLUMN empresa_id uuid REFERENCES public.empresas(id), ADD COLUMN origem public.origem_dado NOT NULL DEFAULT 'manual', ADD COLUMN created_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE public.user_roles DROP CONSTRAINT user_roles_user_id_role_key;
ALTER TABLE public.user_roles ADD CONSTRAINT user_roles_user_id_role_empresa_key UNIQUE NULLS NOT DISTINCT (user_id,role,empresa_id);
INSERT INTO public.user_roles(user_id,role,empresa_id) SELECT auth_user_id,perfil,NULL FROM public.usuarios WHERE auth_user_id IS NOT NULL AND perfil<>'vendedor' ON CONFLICT (user_id,role,empresa_id) DO NOTHING;
INSERT INTO public.papeis_pre_cadastro(usuario_id,role,empresa_id) SELECT id,perfil,NULL FROM public.usuarios WHERE auth_user_id IS NULL AND perfil<>'vendedor' ON CONFLICT (usuario_id,role,empresa_id) DO NOTHING;
COMMENT ON COLUMN public.usuarios.perfil IS 'DEPRECATED: replaced by public.user_roles and public.papeis_pre_cadastro; never use for authorization.';
COMMENT ON COLUMN public.empresas.empresa_id IS 'DEPRECATED: the company is identified by public.empresas.id.';
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid,_role public.app_role,_empresa_id uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$ SELECT EXISTS(SELECT 1 FROM public.user_roles WHERE user_id=_user_id AND role=_role AND (empresa_id=_empresa_id OR empresa_id IS NULL)); $$;
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid,_role public.app_role) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$ SELECT public.has_role(_user_id,_role,NULL::uuid); $$;
CREATE OR REPLACE FUNCTION public.ve_tudo() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$ SELECT public.has_role(auth.uid(),'diretoria'); $$;
CREATE OR REPLACE FUNCTION public.eh_admin() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$ SELECT public.has_role(auth.uid(),'administrador'); $$;
CREATE OR REPLACE FUNCTION public.ao_criar_usuario() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $function$
DECLARE v_usuario_id uuid;
BEGIN
 IF new.email IS NULL OR lower(new.email) !~ '^[^@]+@(centerfrios\.com|grupo381\.com\.br)$' THEN RAISE EXCEPTION 'Acesso restrito a e-mails da CENTERFRIOS e da 381 Distribuidora.'; END IF;
 SELECT u.id INTO v_usuario_id FROM public.usuarios u WHERE lower(u.email)=lower(new.email) AND u.auth_user_id IS NULL ORDER BY u.id LIMIT 1 FOR UPDATE;
 IF v_usuario_id IS NULL THEN RAISE EXCEPTION 'Seu acesso ainda não foi liberado. Peça o convite ao administrador.'; END IF;
 UPDATE public.usuarios SET auth_user_id=new.id WHERE id=v_usuario_id;
 WITH papeis_consumidos AS (DELETE FROM public.papeis_pre_cadastro WHERE usuario_id=v_usuario_id RETURNING role,empresa_id,origem,created_at)
 INSERT INTO public.user_roles(user_id,role,empresa_id,origem,created_at) SELECT new.id,role,empresa_id,origem,created_at FROM papeis_consumidos ON CONFLICT (user_id,role,empresa_id) DO NOTHING;
 RETURN new;
END;
$function$;
REVOKE EXECUTE ON FUNCTION public.ao_criar_usuario() FROM PUBLIC,anon,authenticated;
COMMENT ON COLUMN public.papeis_pre_cadastro.empresa_id IS 'NULL = papel global; copiado para user_roles no cadastro. Vínculos definidos pelo administrador em usuario_empresas.';
DO $policies$
DECLARE p record; t text; a text; expr text; clausula text;
BEGIN
 FOR p IN SELECT tablename,policyname FROM pg_policies WHERE schemaname='public' AND tablename=ANY(ARRAY['clientes','vendas','orcamentos','interacoes','tarefas_agenda','alertas','metas','pontos','selos','configuracoes_regras','links','empresas','equipes','usuarios','usuario_empresas','user_roles']) LOOP EXECUTE format('DROP POLICY %I ON public.%I',p.policyname,p.tablename); END LOOP;
 FOREACH t IN ARRAY ARRAY['clientes','vendas','orcamentos','interacoes','tarefas_agenda','alertas','metas','pontos','selos'] LOOP
  EXECUTE format('CREATE POLICY leitura ON public.%I FOR SELECT TO authenticated USING (public.tem_empresa(empresa_id) AND public.pode_ver_vendedor(vendedor_id))',t);
 END LOOP;
 FOREACH t IN ARRAY ARRAY['orcamentos','alertas','tarefas_agenda'] LOOP
  EXECUTE format('CREATE POLICY alterar ON public.%I FOR UPDATE TO authenticated USING (public.tem_empresa(empresa_id) AND public.pode_ver_vendedor(vendedor_id)) WITH CHECK (public.tem_empresa(empresa_id) AND public.pode_ver_vendedor(vendedor_id))',t);
 END LOOP;
 FOREACH t IN ARRAY ARRAY['metas','configuracoes_regras','links','empresas','equipes','usuarios','usuario_empresas','user_roles'] LOOP
  expr:=CASE t WHEN 'links' THEN 'public.ve_tudo() OR public.eh_admin()' WHEN 'metas' THEN 'public.ve_tudo()' WHEN 'configuracoes_regras' THEN 'public.ve_tudo()' ELSE 'public.eh_admin()' END;
  FOREACH a IN ARRAY ARRAY['INSERT','UPDATE','DELETE'] LOOP
   IF (t='empresas' AND a='DELETE') OR (t='usuarios' AND a='UPDATE') THEN CONTINUE; END IF;
   clausula:=CASE a WHEN 'INSERT' THEN format('WITH CHECK (%s)',expr) WHEN 'UPDATE' THEN format('USING (%s) WITH CHECK (%s)',expr,expr) ELSE format('USING (%s)',expr) END;
   EXECUTE format('CREATE POLICY %I ON public.%I FOR %s TO authenticated %s',lower(a),t,a,clausula);
  END LOOP;
 END LOOP;
 FOREACH t IN ARRAY ARRAY['configuracoes_regras','links','empresas','equipes','usuarios','usuario_empresas','user_roles'] LOOP
  expr:=CASE t WHEN 'empresas' THEN 'public.tem_empresa(id) OR public.eh_admin()' WHEN 'equipes' THEN 'public.tem_empresa(empresa_id) OR public.eh_admin()' WHEN 'usuarios' THEN 'auth_user_id=auth.uid() OR public.pode_ver_vendedor(id) OR public.eh_admin()' WHEN 'usuario_empresas' THEN 'usuario_id=public.meu_usuario_id() OR public.ve_tudo() OR public.eh_admin()' WHEN 'user_roles' THEN 'user_id=auth.uid() OR public.ve_tudo() OR public.eh_admin()' ELSE 'public.tem_empresa(empresa_id)' END;
  EXECUTE format('CREATE POLICY leitura ON public.%I FOR SELECT TO authenticated USING (%s)',t,expr);
 END LOOP;
END;
$policies$;
CREATE POLICY inserir ON public.interacoes FOR INSERT TO authenticated WITH CHECK (vendedor_id=public.meu_usuario_id() AND public.tem_empresa(empresa_id));
CREATE POLICY inserir ON public.tarefas_agenda FOR INSERT TO authenticated WITH CHECK (public.tem_empresa(empresa_id) AND public.pode_ver_vendedor(vendedor_id));
CREATE POLICY apagar ON public.tarefas_agenda FOR DELETE TO authenticated USING (public.tem_empresa(empresa_id) AND (vendedor_id=public.meu_usuario_id() OR (public.has_role(auth.uid(),'supervisor') AND EXISTS (SELECT 1 FROM public.usuarios v JOIN public.equipes e ON e.id=v.equipe_id WHERE v.id=tarefas_agenda.vendedor_id AND e.supervisor_id=public.meu_usuario_id()))));
CREATE POLICY alterar ON public.usuarios FOR UPDATE TO authenticated USING (auth_user_id=auth.uid() OR public.eh_admin()) WITH CHECK (auth_user_id=auth.uid() OR public.eh_admin());
DO $grants$
DECLARE t text; c record;
BEGIN
 FOREACH t IN ARRAY ARRAY['clientes','vendas','orcamentos','interacoes','tarefas_agenda','alertas','metas','pontos','selos','configuracoes_regras','links','empresas','equipes','usuarios','usuario_empresas','user_roles'] LOOP
  EXECUTE format('REVOKE ALL ON TABLE public.%I FROM anon,authenticated',t);
  EXECUTE format('GRANT SELECT,INSERT,UPDATE,DELETE ON TABLE public.%I TO authenticated',t);
  EXECUTE format('GRANT ALL ON TABLE public.%I TO service_role',t);
  EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',t);
 END LOOP;
 FOREACH t IN ARRAY ARRAY['usuarios','orcamentos','alertas'] LOOP
  EXECUTE format('REVOKE UPDATE ON TABLE public.%I FROM authenticated',t);
  FOR c IN SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name=t LOOP EXECUTE format('REVOKE UPDATE (%I) ON public.%I FROM authenticated',c.column_name,t); END LOOP;
 END LOOP;
END;
$grants$;
GRANT UPDATE(apelido_copiloto,tema) ON public.usuarios TO authenticated;
GRANT UPDATE(ultimo_followup) ON public.orcamentos TO authenticated;
GRANT UPDATE(lido) ON public.alertas TO authenticated;
CREATE OR REPLACE FUNCTION public.admin_atualizar_usuario(_usuario_id uuid,_dados jsonb) RETURNS public.usuarios LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $function$
DECLARE atual public.usuarios; novo public.usuarios;
BEGIN
 IF NOT public.eh_admin() THEN RAISE EXCEPTION 'Apenas administradores podem atualizar usuários.' USING ERRCODE='42501'; END IF;
 IF jsonb_typeof(_dados) IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'Dados do usuário devem ser um objeto.'; END IF;
 IF EXISTS(SELECT 1 FROM jsonb_object_keys(_dados) AS k(chave) WHERE chave NOT IN ('auth_user_id','empresa_id','nome','email','equipe_id','apelido_copiloto','tema','origem','demo','created_at')) THEN RAISE EXCEPTION 'Campo de usuário não permitido.'; END IF;
 SELECT * INTO atual FROM public.usuarios WHERE id=_usuario_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Usuário não encontrado.'; END IF;
 novo:=jsonb_populate_record(atual,_dados);
 UPDATE public.usuarios SET auth_user_id=novo.auth_user_id,empresa_id=novo.empresa_id,nome=novo.nome,email=novo.email,equipe_id=novo.equipe_id,apelido_copiloto=novo.apelido_copiloto,tema=novo.tema,origem=novo.origem,demo=novo.demo,created_at=novo.created_at WHERE id=_usuario_id RETURNING * INTO novo;
 RETURN novo;
END;
$function$;
REVOKE ALL ON FUNCTION public.admin_atualizar_usuario(uuid,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.admin_atualizar_usuario(uuid,jsonb) TO authenticated,service_role;
REVOKE ALL ON FUNCTION public.has_role(uuid,public.app_role,uuid),public.has_role(uuid,public.app_role),public.eh_admin(),public.ve_tudo() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid,public.app_role,uuid),public.has_role(uuid,public.app_role),public.eh_admin(),public.ve_tudo() TO authenticated,service_role;
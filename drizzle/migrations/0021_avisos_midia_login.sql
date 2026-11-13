ALTER TABLE public.usuarios ADD COLUMN IF NOT EXISTS pode_publicar_avisos boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.pode_publicar_avisos() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.eh_admin() OR EXISTS (SELECT 1 FROM public.usuarios WHERE auth_user_id = auth.uid() AND pode_publicar_avisos);
$$;
REVOKE ALL ON FUNCTION public.pode_publicar_avisos() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.pode_publicar_avisos() TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_atualizar_usuario(_usuario_id uuid, _dados jsonb)
 RETURNS usuarios LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE atual public.usuarios; novo public.usuarios;
BEGIN
 IF NOT public.eh_admin() THEN RAISE EXCEPTION 'Apenas administradores podem atualizar usuários.' USING ERRCODE='42501'; END IF;
 IF jsonb_typeof(_dados) IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'Dados do usuário devem ser um objeto.'; END IF;
 IF EXISTS(SELECT 1 FROM jsonb_object_keys(_dados) AS k(chave) WHERE chave NOT IN ('nome','email','empresa_id','equipe_id','apelido_copiloto','tema','origem','pode_publicar_avisos')) THEN RAISE EXCEPTION 'Campo de usuário não permitido.'; END IF;
 IF _dados ? 'pode_publicar_avisos' AND jsonb_typeof(_dados->'pode_publicar_avisos') IS DISTINCT FROM 'boolean' THEN RAISE EXCEPTION 'pode_publicar_avisos deve ser verdadeiro ou falso.'; END IF;
 SELECT * INTO atual FROM public.usuarios WHERE id=_usuario_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Usuário não encontrado.'; END IF;
 novo:=jsonb_populate_record(atual,_dados);
 IF atual.auth_user_id IS NOT NULL AND novo.email IS DISTINCT FROM atual.email THEN RAISE EXCEPTION 'Não é possível trocar o e-mail de um usuário que já tem login.'; END IF;
 UPDATE public.usuarios SET nome=novo.nome,email=novo.email,empresa_id=novo.empresa_id,equipe_id=novo.equipe_id,apelido_copiloto=novo.apelido_copiloto,tema=novo.tema,origem=novo.origem,pode_publicar_avisos=novo.pode_publicar_avisos WHERE id=_usuario_id RETURNING * INTO novo;
 PERFORM public.auditar('alteracao_usuario','usuarios',novo.id,novo.empresa_id,novo.id,jsonb_build_object('antigo',to_jsonb(atual),'novo',to_jsonb(novo)));
 IF novo.pode_publicar_avisos IS DISTINCT FROM atual.pode_publicar_avisos THEN
   PERFORM public.auditar('alteracao_permissao','usuarios',novo.id,novo.empresa_id,novo.id,jsonb_build_object('permissao','pode_publicar_avisos','antigo',atual.pode_publicar_avisos,'novo',novo.pode_publicar_avisos));
 END IF;
 RETURN novo;
END $function$;

CREATE OR REPLACE FUNCTION public.preencher_criado_por() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.criado_por := public.meu_usuario_id();
    NEW.created_at := now();
  ELSE
    NEW.criado_por := OLD.criado_por;
    NEW.created_at := OLD.created_at;
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.preencher_criado_por() FROM PUBLIC, anon, authenticated;

CREATE TABLE public.avisos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo text NOT NULL,
  texto_alternativo text NOT NULL CHECK (length(btrim(texto_alternativo)) > 0),
  arquivo_path text NOT NULL,
  tipo text NOT NULL CHECK (tipo IN ('imagem','animacao','video')),
  link text CHECK (link IS NULL OR link ~* '^https?://'),
  empresa text NOT NULL DEFAULT 'ambas' CHECK (empresa IN ('CENTERFRIOS','381','ambas')),
  inicio timestamptz,
  fim timestamptz,
  ordem int NOT NULL DEFAULT 0,
  ativo boolean NOT NULL DEFAULT true,
  criado_por uuid REFERENCES public.usuarios(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (fim IS NULL OR inicio IS NULL OR fim > inicio)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.avisos TO authenticated;
GRANT ALL ON public.avisos TO service_role;
ALTER TABLE public.avisos ENABLE ROW LEVEL SECURITY;
CREATE POLICY avisos_ler ON public.avisos FOR SELECT TO authenticated USING (true);
CREATE POLICY avisos_inserir ON public.avisos FOR INSERT TO authenticated WITH CHECK ((SELECT public.pode_publicar_avisos()));
CREATE POLICY avisos_alterar ON public.avisos FOR UPDATE TO authenticated
  USING ((SELECT public.eh_admin()) OR ((SELECT public.pode_publicar_avisos()) AND criado_por = (SELECT public.meu_usuario_id())))
  WITH CHECK ((SELECT public.eh_admin()) OR ((SELECT public.pode_publicar_avisos()) AND criado_por = (SELECT public.meu_usuario_id())));
CREATE POLICY avisos_apagar ON public.avisos FOR DELETE TO authenticated
  USING ((SELECT public.eh_admin()) OR ((SELECT public.pode_publicar_avisos()) AND criado_por = (SELECT public.meu_usuario_id())));
CREATE TRIGGER avisos_criado_por BEFORE INSERT OR UPDATE ON public.avisos FOR EACH ROW EXECUTE FUNCTION public.preencher_criado_por();
CREATE INDEX avisos_ordem_idx ON public.avisos (ativo, ordem);

CREATE TABLE public.midia_login (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  arquivo_path text NOT NULL,
  tipo text NOT NULL CHECK (tipo IN ('imagem','animacao','video')),
  texto_alternativo text NOT NULL CHECK (length(btrim(texto_alternativo)) > 0),
  ordem int NOT NULL DEFAULT 0,
  ativo boolean NOT NULL DEFAULT true,
  criado_por uuid REFERENCES public.usuarios(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.midia_login TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.midia_login TO authenticated;
GRANT ALL ON public.midia_login TO service_role;
ALTER TABLE public.midia_login ENABLE ROW LEVEL SECURITY;
CREATE POLICY midia_login_ler_anon ON public.midia_login FOR SELECT TO anon USING (ativo);
CREATE POLICY midia_login_ler ON public.midia_login FOR SELECT TO authenticated USING (ativo OR (SELECT public.eh_admin()));
CREATE POLICY midia_login_inserir ON public.midia_login FOR INSERT TO authenticated WITH CHECK ((SELECT public.eh_admin()));
CREATE POLICY midia_login_alterar ON public.midia_login FOR UPDATE TO authenticated USING ((SELECT public.eh_admin())) WITH CHECK ((SELECT public.eh_admin()));
CREATE POLICY midia_login_apagar ON public.midia_login FOR DELETE TO authenticated USING ((SELECT public.eh_admin()));
CREATE TRIGGER midia_login_criado_por BEFORE INSERT OR UPDATE ON public.midia_login FOR EACH ROW EXECUTE FUNCTION public.preencher_criado_por();
CREATE INDEX midia_login_arquivo_idx ON public.midia_login (arquivo_path) WHERE ativo;

-- Tipo e tamanho: usa os metadados quando existirem; a extensão do nome também precisa ser permitida.
CREATE OR REPLACE FUNCTION public.midia_arquivo_valido(_nome text, _metadata jsonb) RETURNS boolean
LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT lower(_nome) ~ '\.(jpe?g|png|webp|avif|gif|mp4|webm)$'
    AND (_metadata->>'mimetype' IS NULL OR _metadata->>'mimetype' IN ('image/jpeg','image/png','image/webp','image/avif','image/gif','video/mp4','video/webm'))
    AND NOT (coalesce(_metadata->>'mimetype','') LIKE 'image/%' AND coalesce((_metadata->>'size')::bigint,0) > 5242880)
    AND NOT (lower(_nome) ~ '\.(jpe?g|png|webp|avif|gif)$' AND coalesce((_metadata->>'size')::bigint,0) > 5242880)
    AND coalesce((_metadata->>'size')::bigint,0) <= 26214400;
$$;
GRANT EXECUTE ON FUNCTION public.midia_arquivo_valido(text, jsonb) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.midia_login_arquivo_ativo(_nome text) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.midia_login m WHERE m.arquivo_path = _nome AND m.ativo);
$$;
GRANT EXECUTE ON FUNCTION public.midia_login_arquivo_ativo(text) TO anon, authenticated;

CREATE POLICY avisos_arquivos_ler ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'avisos');
CREATE POLICY avisos_arquivos_enviar ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'avisos' AND (SELECT public.pode_publicar_avisos()) AND public.midia_arquivo_valido(name, metadata));
CREATE POLICY avisos_arquivos_substituir ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'avisos' AND ((SELECT public.eh_admin()) OR ((SELECT public.pode_publicar_avisos()) AND owner = auth.uid())))
  WITH CHECK (bucket_id = 'avisos' AND ((SELECT public.eh_admin()) OR ((SELECT public.pode_publicar_avisos()) AND owner = auth.uid())) AND public.midia_arquivo_valido(name, metadata));
CREATE POLICY avisos_arquivos_apagar ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'avisos' AND ((SELECT public.eh_admin()) OR ((SELECT public.pode_publicar_avisos()) AND owner = auth.uid())));

CREATE POLICY midia_login_arquivos_ler_anon ON storage.objects FOR SELECT TO anon
  USING (bucket_id = 'midia-login' AND public.midia_login_arquivo_ativo(name));
CREATE POLICY midia_login_arquivos_ler ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'midia-login' AND (public.midia_login_arquivo_ativo(name) OR (SELECT public.eh_admin())));
CREATE POLICY midia_login_arquivos_enviar ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'midia-login' AND (SELECT public.eh_admin()) AND public.midia_arquivo_valido(name, metadata));
CREATE POLICY midia_login_arquivos_substituir ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'midia-login' AND (SELECT public.eh_admin()))
  WITH CHECK (bucket_id = 'midia-login' AND (SELECT public.eh_admin()) AND public.midia_arquivo_valido(name, metadata));
CREATE POLICY midia_login_arquivos_apagar ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'midia-login' AND (SELECT public.eh_admin()));
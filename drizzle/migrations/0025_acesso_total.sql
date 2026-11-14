ALTER TABLE public.usuarios ADD COLUMN acesso_total boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.proteger_acesso_total()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.acesso_total AND coalesce(current_setting('app.acesso_total_ok', true), '') <> 'sim' THEN
      RAISE EXCEPTION 'Acesso total só pode ser concedido pela função própria.' USING ERRCODE = '42501';
    END IF;
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' AND NEW.acesso_total IS DISTINCT FROM OLD.acesso_total
     AND coalesce(current_setting('app.acesso_total_ok', true), '') <> 'sim' THEN
    RAISE EXCEPTION 'Acesso total só pode ser alterado pela função própria.' USING ERRCODE = '42501';
  END IF;
  IF OLD.acesso_total AND OLD.ativo AND (TG_OP = 'DELETE' OR NOT NEW.acesso_total OR NOT NEW.ativo)
     AND NOT EXISTS (SELECT 1 FROM public.usuarios WHERE acesso_total AND ativo AND id <> OLD.id) THEN
    RAISE EXCEPTION 'Não é possível remover ou desativar o último titular de acesso total.' USING ERRCODE = '42501';
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END $$;

-- marcar as duas contas antes de ativar o gatilho
UPDATE public.usuarios SET acesso_total = true
 WHERE lower(email) IN ('filipecanuto@centerfrios.com', 'adm@centerfrios.com');

CREATE TRIGGER usuarios_proteger_acesso_total
BEFORE INSERT OR UPDATE OR DELETE ON public.usuarios
FOR EACH ROW EXECUTE FUNCTION public.proteger_acesso_total();

CREATE OR REPLACE FUNCTION public.tem_setor(_usuario_id uuid, _setor text)
 RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT EXISTS (SELECT 1 FROM public.usuario_setores s JOIN public.usuarios u ON u.id = s.usuario_id
      WHERE s.usuario_id = _usuario_id AND s.setor = _setor AND s.ativo AND u.ativo)
   OR EXISTS (SELECT 1 FROM public.usuarios u JOIN public.setores st ON st.chave = _setor AND st.ativo
      WHERE u.id = _usuario_id AND u.acesso_total AND u.ativo)
$function$;

CREATE OR REPLACE FUNCTION public.meus_setores()
 RETURNS text[] LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT coalesce(array_agg(DISTINCT x.setor ORDER BY x.setor), '{}') FROM (
    SELECT s.setor FROM public.usuario_setores s JOIN public.usuarios u ON u.id = s.usuario_id
     WHERE s.usuario_id = public.meu_usuario_id() AND s.ativo AND u.ativo
    UNION
    SELECT st.chave FROM public.setores st JOIN public.usuarios u ON u.id = public.meu_usuario_id()
     WHERE st.ativo AND u.acesso_total AND u.ativo
  ) x
$function$;

CREATE OR REPLACE FUNCTION public.definir_acesso_total(_usuario_id uuid, _acesso_total boolean)
 RETURNS public.usuarios LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE atual public.usuarios; novo public.usuarios; eu uuid := public.meu_usuario_id();
BEGIN
  IF eu IS NULL OR NOT EXISTS (SELECT 1 FROM public.usuarios WHERE id = eu AND acesso_total AND ativo) THEN
    RAISE EXCEPTION 'Apenas quem tem acesso total pode alterar esse acesso.' USING ERRCODE = '42501';
  END IF;
  IF _acesso_total IS NULL THEN RAISE EXCEPTION 'Informe verdadeiro ou falso.' USING ERRCODE = '22023'; END IF;
  SELECT * INTO atual FROM public.usuarios WHERE id = _usuario_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Usuário não encontrado.' USING ERRCODE = '22023'; END IF;
  IF atual.acesso_total = _acesso_total THEN RETURN atual; END IF;
  PERFORM set_config('app.acesso_total_ok', 'sim', true);
  UPDATE public.usuarios SET acesso_total = _acesso_total WHERE id = _usuario_id RETURNING * INTO novo;
  PERFORM set_config('app.acesso_total_ok', '', true);
  PERFORM public.auditar('alteracao_permissao', 'usuarios', novo.id, novo.empresa_id, novo.id,
    jsonb_build_object('permissao', 'acesso_total', 'antigo', atual.acesso_total, 'novo', novo.acesso_total));
  RETURN novo;
END $function$;

REVOKE ALL ON FUNCTION public.definir_acesso_total(uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.definir_acesso_total(uuid, boolean) TO authenticated;
REVOKE ALL ON FUNCTION public.proteger_acesso_total() FROM PUBLIC, anon, authenticated;
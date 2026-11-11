-- Bloqueia reassociação de login e campos internos via atualização administrativa.
CREATE OR REPLACE FUNCTION public.admin_atualizar_usuario(_usuario_id uuid, _dados jsonb)
RETURNS public.usuarios LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE atual public.usuarios; novo public.usuarios;
BEGIN
 IF NOT public.eh_admin() THEN RAISE EXCEPTION 'Apenas administradores podem atualizar usuários.' USING ERRCODE='42501'; END IF;
 IF jsonb_typeof(_dados) IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'Dados do usuário devem ser um objeto.'; END IF;
 IF EXISTS(SELECT 1 FROM jsonb_object_keys(_dados) AS k(chave) WHERE chave NOT IN ('nome','email','empresa_id','equipe_id','apelido_copiloto','tema','origem')) THEN RAISE EXCEPTION 'Campo de usuário não permitido.'; END IF;
 SELECT * INTO atual FROM public.usuarios WHERE id=_usuario_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Usuário não encontrado.'; END IF;
 novo:=jsonb_populate_record(atual,_dados);
 IF atual.auth_user_id IS NOT NULL AND novo.email IS DISTINCT FROM atual.email THEN RAISE EXCEPTION 'Não é possível trocar o e-mail de um usuário que já tem login.'; END IF;
 UPDATE public.usuarios SET nome=novo.nome,email=novo.email,empresa_id=novo.empresa_id,equipe_id=novo.equipe_id,apelido_copiloto=novo.apelido_copiloto,tema=novo.tema,origem=novo.origem WHERE id=_usuario_id RETURNING * INTO novo;
 PERFORM public.auditar('alteracao_usuario','usuarios',novo.id,novo.empresa_id,novo.id,jsonb_build_object('antigo',to_jsonb(atual),'novo',to_jsonb(novo)));
 RETURN novo;
END $$;
-- CREATE OR REPLACE conserva o retorno, SECURITY DEFINER e os privilégios existentes.

EM CONSTRUÇÃO — NÃO COLAR AINDA (vai ganhar as seções 2 a 4 e os testes).

## SQL

```sql
-- 22: conector do Shop9 — pareamento por código, troca de chave com transição, mapeamento por empresa,
-- vendedores do Shop9, cursores e sincronização das saídas (vendas compartilhadas e devoluções).

-- 1. Ed25519: pareamento por código de uso único e troca de chave com transição de 10 minutos.
ALTER TABLE public.conectores
 ADD COLUMN chave_anterior text CHECK (chave_anterior ~ '^[A-Za-z0-9_-]{43}$'),
 ADD COLUMN anterior_ate timestamptz;

CREATE TABLE public.conector_pareamentos(
 codigo_hash text PRIMARY KEY,
 conector_id uuid REFERENCES public.conectores(id) ON DELETE CASCADE,
 nome text NOT NULL CHECK (length(btrim(nome)) BETWEEN 1 AND 60),
 criado_por uuid REFERENCES public.usuarios(id),
 expira_em timestamptz NOT NULL,
 usado_em timestamptz,
 created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.conector_pareamentos ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.conector_pareamentos FROM anon, authenticated;
-- sem política: só funções SECURITY DEFINER.

DROP FUNCTION public.admin_conector_registrar_chave(uuid, text, text);
DROP FUNCTION public.conector_chave(uuid);

-- Gera o código (8 caracteres sem 0/O/1/I, de gen_random_uuid = gerador forte). Só o hash fica gravado.
CREATE FUNCTION public.admin_conector_gerar_codigo(_conector_id uuid, _nome text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE alfabeto text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; b bytea := uuid_send(gen_random_uuid()); cod text := ''; i int; ate timestamptz := now() + interval '10 minutes';
BEGIN
 IF NOT public.eh_admin() THEN RAISE EXCEPTION 'Só administradores.' USING ERRCODE='42501'; END IF;
 IF _conector_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.conectores WHERE id = _conector_id) THEN
  RAISE EXCEPTION 'Conector não encontrado.' USING ERRCODE='P0001'; END IF;
 IF (SELECT count(*) FROM public.conector_pareamentos WHERE usado_em IS NULL AND expira_em > now()) >= 5 THEN
  RAISE EXCEPTION 'Muitos códigos abertos; espere 10 minutos.' USING ERRCODE='P0001'; END IF;
 FOR i IN 0..7 LOOP cod := cod || substr(alfabeto, get_byte(b, i) % 32 + 1, 1); END LOOP;
 INSERT INTO public.conector_pareamentos(codigo_hash, conector_id, nome, criado_por, expira_em)
 VALUES (encode(sha256(convert_to(cod, 'UTF8')), 'hex'), _conector_id, coalesce(nullif(btrim(_nome), ''), 'Conector'), public.meu_usuario_id(), ate);
 INSERT INTO public.conector_eventos(conector_id, tipo, ok) VALUES (_conector_id, 'codigo_pareamento', true);
 PERFORM public.auditar('conector_codigo_gerado', 'conectores', _conector_id, NULL, NULL, jsonb_build_object('expira_em', ate));
 RETURN jsonb_build_object('codigo', cod, 'expira_em', ate);
END $$;

CREATE OR REPLACE FUNCTION public.admin_conector_revogar(_conector_id uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF NOT public.eh_admin() THEN RAISE EXCEPTION 'Só administradores.' USING ERRCODE='42501'; END IF;
 UPDATE public.conectores SET ativo = false, revogado_em = now(), chave_anterior = NULL, anterior_ate = NULL WHERE id = _conector_id AND ativo;
 IF FOUND THEN
  UPDATE public.conector_pareamentos SET usado_em = now() WHERE conector_id = _conector_id AND usado_em IS NULL;
  INSERT INTO public.conector_eventos(conector_id, tipo, ok) VALUES (_conector_id, 'conector_revogado', true);
  PERFORM public.auditar('conector_revogado', 'conectores', _conector_id, NULL, NULL, '{}'::jsonb);
 END IF;
END $$;

-- Só service_role: o servidor já conferiu que o pedido foi assinado com _chave_publica.
CREATE FUNCTION public.conector_parear(_codigo text, _chave_publica text, _nome text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE p public.conector_pareamentos; cid uuid;
BEGIN
 SELECT * INTO p FROM public.conector_pareamentos
 WHERE codigo_hash = encode(sha256(convert_to(upper(_codigo), 'UTF8')), 'hex') AND usado_em IS NULL AND expira_em > now() FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Código inválido, vencido ou já usado.' USING ERRCODE='P0001'; END IF;
 IF _chave_publica !~ '^[A-Za-z0-9_-]{43}$' OR EXISTS (SELECT 1 FROM public.conectores WHERE chave_publica = _chave_publica OR chave_anterior = _chave_publica) THEN
  RAISE EXCEPTION 'Chave pública inválida.' USING ERRCODE='P0001'; END IF;
 IF p.conector_id IS NULL THEN
  INSERT INTO public.conectores(nome, chave_publica, criado_por) VALUES (coalesce(nullif(btrim(_nome), ''), p.nome), _chave_publica, p.criado_por) RETURNING id INTO cid;
 ELSE
  UPDATE public.conectores SET chave_publica = _chave_publica, chave_anterior = NULL, anterior_ate = NULL, ativo = true, revogado_em = NULL
  WHERE id = p.conector_id RETURNING id INTO cid;
 END IF;
 UPDATE public.conector_pareamentos SET usado_em = now(), conector_id = cid WHERE codigo_hash = p.codigo_hash;
 INSERT INTO public.conector_eventos(conector_id, tipo, ok) VALUES (cid, 'conector_pareado', true);
 PERFORM public.auditar('conector_pareado', 'conectores', cid, NULL, NULL, jsonb_build_object('novo', p.conector_id IS NULL));
 RETURN jsonb_build_object('conector_id', cid);
END $$;

-- Rotação pedida pelo próprio conector (assinada com a chave atual): a anterior vale mais 10 minutos.
CREATE FUNCTION public.conector_trocar_chave(_conector_id uuid, _chave_publica text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF _chave_publica !~ '^[A-Za-z0-9_-]{43}$' OR EXISTS (SELECT 1 FROM public.conectores WHERE chave_publica = _chave_publica OR chave_anterior = _chave_publica) THEN
  RAISE EXCEPTION 'Chave pública inválida.' USING ERRCODE='P0001'; END IF;
 UPDATE public.conectores SET chave_anterior = chave_publica, anterior_ate = now() + interval '10 minutes', chave_publica = _chave_publica
 WHERE id = _conector_id AND ativo;
 IF NOT FOUND THEN RAISE EXCEPTION 'Conector inativo.' USING ERRCODE='P0001'; END IF;
 INSERT INTO public.conector_eventos(conector_id, tipo, ok) VALUES (_conector_id, 'chave_trocada', true);
 PERFORM public.auditar('conector_chave_trocada', 'conectores', _conector_id, NULL, NULL, '{}'::jsonb);
 RETURN jsonb_build_object('ok', true);
END $$;

-- Chaves válidas agora (atual e, durante a transição, a anterior). Nulo = inexistente ou revogado.
CREATE FUNCTION public.conector_chaves(_conector_id uuid) RETURNS text[]
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT array_remove(ARRAY[chave_publica, CASE WHEN anterior_ate > now() THEN chave_anterior END], NULL)
 FROM public.conectores WHERE id = _conector_id AND ativo;
$$;

REVOKE ALL ON FUNCTION public.admin_conector_gerar_codigo(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_conector_gerar_codigo(uuid, text) TO authenticated;
REVOKE ALL ON FUNCTION public.conector_parear(text, text, text), public.conector_trocar_chave(uuid, text), public.conector_chaves(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.conector_parear(text, text, text), public.conector_trocar_chave(uuid, text), public.conector_chaves(uuid) TO service_role;
```

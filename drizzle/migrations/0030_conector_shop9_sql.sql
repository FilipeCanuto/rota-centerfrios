-- 21: conector local do Shop9 (Ed25519). Só a chave PÚBLICA fica no banco.
CREATE TABLE public.conectores(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 nome text NOT NULL CHECK (length(btrim(nome)) BETWEEN 1 AND 60),
 chave_publica text NOT NULL UNIQUE CHECK (chave_publica ~ '^[A-Za-z0-9_-]{43}$'),
 ativo boolean NOT NULL DEFAULT true,
 ultimo_contato timestamptz,
 versao text,
 shop9_ok boolean,
 revogado_em timestamptz,
 criado_por uuid REFERENCES public.usuarios(id),
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.conector_nonces(
 nonce text PRIMARY KEY,
 conector_id uuid NOT NULL REFERENCES public.conectores(id) ON DELETE CASCADE,
 acao text NOT NULL,
 criado_em timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX conector_nonces_conector_criado ON public.conector_nonces(conector_id, criado_em);
CREATE TABLE public.conector_lotes(
 conector_id uuid NOT NULL REFERENCES public.conectores(id),
 lote_id text NOT NULL,
 tipo text NOT NULL CHECK (tipo IN ('clientes','produtos','vendas','orcamentos')),
 empresa_id uuid NOT NULL REFERENCES public.empresas(id),
 resultado jsonb NOT NULL,
 criado_em timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY (conector_id, lote_id)
);
CREATE TABLE public.conector_eventos(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 conector_id uuid REFERENCES public.conectores(id),
 empresa_id uuid REFERENCES public.empresas(id),
 tipo text NOT NULL,
 ok boolean NOT NULL,
 mensagem text CHECK (length(mensagem) <= 300),
 criado_em timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX conector_eventos_criado ON public.conector_eventos(criado_em DESC);
CREATE TABLE public.shop9_integracao(
 id boolean PRIMARY KEY DEFAULT true CHECK (id),
 modo text NOT NULL DEFAULT 'manual' CHECK (modo IN ('manual','conector')),
 ambiente text NOT NULL DEFAULT 'homologacao' CHECK (ambiente IN ('homologacao','producao')),
 atualizado_por uuid REFERENCES public.usuarios(id),
 atualizado_em timestamptz NOT NULL DEFAULT now()
);
INSERT INTO public.shop9_integracao DEFAULT VALUES;
ALTER TABLE public.shop9_envios ADD COLUMN reservado_ate timestamptz, ADD COLUMN conector_id uuid REFERENCES public.conectores(id);

ALTER TABLE public.conectores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conector_nonces ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conector_lotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conector_eventos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shop9_integracao ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.conectores, public.conector_nonces, public.conector_lotes, public.conector_eventos, public.shop9_integracao FROM anon, authenticated;
GRANT SELECT ON public.conectores, public.conector_lotes, public.conector_eventos, public.shop9_integracao TO authenticated;
CREATE POLICY conectores_admin ON public.conectores FOR SELECT TO authenticated USING ((select public.eh_admin()));
CREATE POLICY conector_lotes_admin ON public.conector_lotes FOR SELECT TO authenticated USING ((select public.eh_admin()));
CREATE POLICY conector_eventos_admin ON public.conector_eventos FOR SELECT TO authenticated USING ((select public.eh_admin()));
CREATE POLICY shop9_integracao_admin ON public.shop9_integracao FOR SELECT TO authenticated USING ((select public.eh_admin()));
-- conector_nonces: sem política (só service_role).

-- Administrador (tela Configurações > Integrações). Nenhum segredo passa por aqui.
CREATE FUNCTION public.admin_conector_registrar_chave(_conector_id uuid, _nome text, _chave_publica text) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE cid uuid; chave text := btrim(_chave_publica);
BEGIN
 IF NOT public.eh_admin() THEN RAISE EXCEPTION 'Só administradores.' USING ERRCODE='42501'; END IF;
 IF chave !~ '^[A-Za-z0-9_-]{43}$' THEN RAISE EXCEPTION 'Chave pública inválida.' USING ERRCODE='P0001'; END IF;
 IF _conector_id IS NULL THEN
  INSERT INTO public.conectores(nome, chave_publica, criado_por) VALUES (btrim(_nome), chave, public.meu_usuario_id()) RETURNING id INTO cid;
 ELSE
  UPDATE public.conectores SET chave_publica = chave, ativo = true, revogado_em = NULL WHERE id = _conector_id RETURNING id INTO cid;
  IF cid IS NULL THEN RAISE EXCEPTION 'Conector não encontrado.' USING ERRCODE='P0001'; END IF;
 END IF;
 INSERT INTO public.conector_eventos(conector_id, tipo, ok, mensagem) VALUES (cid, 'chave_registrada', true, NULL);
 PERFORM public.auditar('conector_chave_registrada', 'conectores', cid, NULL, NULL, jsonb_build_object('novo', _conector_id IS NULL));
 RETURN cid;
END $$;

CREATE FUNCTION public.admin_conector_revogar(_conector_id uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF NOT public.eh_admin() THEN RAISE EXCEPTION 'Só administradores.' USING ERRCODE='42501'; END IF;
 UPDATE public.conectores SET ativo = false, revogado_em = now() WHERE id = _conector_id AND ativo;
 IF FOUND THEN
  INSERT INTO public.conector_eventos(conector_id, tipo, ok) VALUES (_conector_id, 'conector_revogado', true);
  PERFORM public.auditar('conector_revogado', 'conectores', _conector_id, NULL, NULL, '{}'::jsonb);
 END IF;
END $$;

CREATE FUNCTION public.admin_shop9_configurar(_modo text, _ambiente text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE antigo jsonb;
BEGIN
 IF NOT public.eh_admin() THEN RAISE EXCEPTION 'Só administradores.' USING ERRCODE='42501'; END IF;
 SELECT jsonb_build_object('modo', modo, 'ambiente', ambiente) INTO antigo FROM public.shop9_integracao;
 UPDATE public.shop9_integracao SET modo = _modo, ambiente = _ambiente, atualizado_por = public.meu_usuario_id(), atualizado_em = now();
 INSERT INTO public.conector_eventos(tipo, ok, mensagem) VALUES ('configuracao', true, _modo || ' / ' || _ambiente);
 PERFORM public.auditar('shop9_configuracao', 'shop9_integracao', NULL, NULL, NULL,
  jsonb_build_object('antigo', antigo, 'novo', jsonb_build_object('modo', _modo, 'ambiente', _ambiente)));
END $$;

CREATE FUNCTION public.admin_shop9_status() RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF NOT public.eh_admin() THEN RAISE EXCEPTION 'Só administradores.' USING ERRCODE='42501'; END IF;
 RETURN (SELECT jsonb_build_object(
  'modo', i.modo, 'ambiente', i.ambiente,
  'conectores', coalesce((SELECT jsonb_agg(jsonb_build_object('id', c.id, 'nome', c.nome, 'ativo', c.ativo,
     'ultimo_contato', c.ultimo_contato, 'versao', c.versao) ORDER BY c.created_at) FROM public.conectores c), '[]'),
  'eventos', coalesce((SELECT jsonb_agg(e ORDER BY e.criado_em DESC) FROM (SELECT id, criado_em, tipo, ok, mensagem
     FROM public.conector_eventos ORDER BY criado_em DESC LIMIT 30) e), '[]'))
  FROM public.shop9_integracao i);
END $$;

REVOKE ALL ON FUNCTION public.admin_conector_registrar_chave(uuid,text,text), public.admin_conector_revogar(uuid),
 public.admin_shop9_configurar(text,text), public.admin_shop9_status() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_conector_registrar_chave(uuid,text,text), public.admin_conector_revogar(uuid),
 public.admin_shop9_configurar(text,text), public.admin_shop9_status() TO authenticated;

-- Conector (só service_role; o servidor já conferiu a assinatura Ed25519 e a janela de 5 min).
CREATE FUNCTION public.conector_chave(_conector_id uuid) RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT chave_publica FROM public.conectores WHERE id = _conector_id AND ativo;
$$;

CREATE FUNCTION public.conector_registrar_pedido(_conector_id uuid, _nonce text, _acao text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF NOT EXISTS (SELECT 1 FROM public.conectores WHERE id = _conector_id AND ativo) THEN
  RAISE EXCEPTION 'Conector inativo.' USING ERRCODE='42501'; END IF;
 BEGIN
  INSERT INTO public.conector_nonces(nonce, conector_id, acao) VALUES (_nonce, _conector_id, _acao);
 EXCEPTION WHEN unique_violation THEN
  RAISE EXCEPTION 'Pedido repetido.' USING ERRCODE='P0409';
 END;
 IF (SELECT count(*) FROM public.conector_nonces WHERE conector_id = _conector_id AND criado_em > now() - interval '1 minute') > 120 THEN
  RAISE EXCEPTION 'Limite de pedidos.' USING ERRCODE='P0429'; END IF;
 UPDATE public.conectores SET ultimo_contato = now() WHERE id = _conector_id;
 DELETE FROM public.conector_nonces WHERE conector_id = _conector_id AND criado_em < now() - interval '1 day';
END $$;

CREATE FUNCTION public.conector_heartbeat(_conector_id uuid, _versao text, _shop9_ok boolean) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 UPDATE public.conectores SET versao = left(_versao, 40), shop9_ok = _shop9_ok, ultimo_contato = now() WHERE id = _conector_id;
 RETURN (SELECT jsonb_build_object('modo', modo, 'ambiente', ambiente) FROM public.shop9_integracao);
END $$;

CREATE FUNCTION public.conector_trabalhos(_conector_id uuid, _limite int) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE r jsonb;
BEGIN
 IF (SELECT modo FROM public.shop9_integracao) <> 'conector' THEN RETURN jsonb_build_object('trabalhos', '[]'::jsonb); END IF;
 WITH alvo AS (
  SELECT e.id FROM public.shop9_envios e
  WHERE e.estado IN ('pendente','erro') AND e.proxima_tentativa <= now() AND (e.reservado_ate IS NULL OR e.reservado_ate < now())
  ORDER BY e.created_at LIMIT least(greatest(coalesce(_limite, 10), 1), 50) FOR UPDATE SKIP LOCKED
 ), marcados AS (
  UPDATE public.shop9_envios e SET reservado_ate = now() + interval '5 minutes', conector_id = _conector_id
  FROM alvo WHERE e.id = alvo.id RETURNING e.*
 )
 SELECT jsonb_build_object('trabalhos', coalesce(jsonb_agg(jsonb_build_object(
   'envio_id', m.id, 'empresa_id', m.empresa_id, 'chave_idempotencia', m.chave_idempotencia,
   'cliente_codigo', c.codigo_shop9, 'data', o.data, 'vendedor_email', u.email,
   'itens', (SELECT coalesce(jsonb_agg(jsonb_build_object('codigo_produto', i.codigo_shop9, 'descricao', i.descricao,
      'unidade', i.unidade, 'quantidade', i.quantidade, 'preco_unit', i.preco_unit, 'desconto_pct', i.desconto_pct,
      'total', i.total) ORDER BY i.created_at), '[]') FROM public.itens_orcamento i WHERE i.orcamento_id = o.id))
   ORDER BY m.created_at), '[]'))
 INTO r
 FROM marcados m JOIN public.orcamentos o ON o.id = m.orcamento_id
 JOIN public.clientes c ON c.id = o.cliente_id LEFT JOIN public.usuarios u ON u.id = o.vendedor_id;
 RETURN r;
END $$;

CREATE FUNCTION public.conector_resultado(_conector_id uuid, _envio_id uuid, _ok boolean, _codigo_shop9 text, _erro text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE e public.shop9_envios; cod text := nullif(btrim(_codigo_shop9), '');
BEGIN
 SELECT * INTO e FROM public.shop9_envios WHERE id = _envio_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Envio não encontrado.' USING ERRCODE='P0001'; END IF;
 IF e.estado IN ('enviado','confirmado') THEN
  IF _ok AND e.codigo_shop9 = cod THEN RETURN jsonb_build_object('ok', true, 'repetido', true); END IF;
  RAISE EXCEPTION 'Envio já registrado com outro código.' USING ERRCODE='P0001';
 END IF;
 IF _ok THEN
  IF cod IS NULL THEN RAISE EXCEPTION 'Código do Shop9 vazio.' USING ERRCODE='P0001'; END IF;
  IF EXISTS (SELECT 1 FROM public.orcamentos WHERE empresa_id = e.empresa_id AND envio_codigo_shop9 = cod AND id <> e.orcamento_id) THEN
   RAISE EXCEPTION 'Código do Shop9 já usado em outro orçamento.' USING ERRCODE='P0001'; END IF;
  UPDATE public.shop9_envios SET estado = 'enviado', codigo_shop9 = cod, enviado_em = now(), reservado_ate = NULL, atualizado_em = now() WHERE id = e.id;
  UPDATE public.orcamentos SET envio_codigo_shop9 = cod WHERE id = e.orcamento_id;
 ELSE
  UPDATE public.shop9_envios SET estado = 'erro', tentativas = tentativas + 1, ultimo_erro = left(coalesce(_erro, 'Erro sem mensagem'), 300),
   proxima_tentativa = now() + least(60, power(2, tentativas + 1)) * interval '1 minute', reservado_ate = NULL, atualizado_em = now()
  WHERE id = e.id;
 END IF;
 INSERT INTO public.conector_eventos(conector_id, empresa_id, tipo, ok, mensagem)
 VALUES (_conector_id, e.empresa_id, 'envio_orcamento', _ok, CASE WHEN _ok THEN cod ELSE left(_erro, 300) END);
 PERFORM public.auditar('shop9_envio_conector', 'shop9_envios', e.id, e.empresa_id, NULL,
  jsonb_build_object('ok', _ok, 'codigo_shop9', cod, 'conector_id', _conector_id));
 RETURN jsonb_build_object('ok', true);
END $$;

-- Sincronização: reaproveita importar_<tipo> sem reescrevê-las. A única porta delas é importacao_validar,
-- que passa a aceitar a chamada do servidor (service_role) feita de dentro de conector_sincronizar.
CREATE OR REPLACE FUNCTION public.importacao_validar(_empresa_id uuid, _linhas jsonb) RETURNS void
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE pelo_conector boolean := coalesce(current_setting('rota.conector_sync', true), '') <> ''
  AND coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb->>'role', '') = 'service_role';
BEGIN
 IF NOT pelo_conector AND (auth.uid() IS NULL OR _empresa_id IS NULL OR NOT public.has_role(auth.uid(),'diretoria',_empresa_id)) THEN
  RAISE EXCEPTION 'Apenas a diretoria da empresa pode importar dados.' USING ERRCODE='42501'; END IF;
 IF _empresa_id IS NULL THEN RAISE EXCEPTION 'Empresa obrigatória.' USING ERRCODE='22023'; END IF;
 IF jsonb_typeof(_linhas) IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'As linhas devem ser uma lista.' USING ERRCODE='22023'; END IF;
 IF jsonb_array_length(_linhas)>5000 THEN RAISE EXCEPTION 'Limite de 5.000 linhas por importação.' USING ERRCODE='22023'; END IF;
END $$;
REVOKE ALL ON FUNCTION public.importacao_validar(uuid,jsonb) FROM PUBLIC, anon, authenticated;

CREATE FUNCTION public.conector_sincronizar(_conector_id uuid, _tipo text, _empresa_id uuid, _lote_id text, _linhas jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE r jsonb; numeradas jsonb;
BEGIN
 PERFORM pg_advisory_xact_lock(hashtext('conector_lote:' || _conector_id || ':' || _lote_id));
 SELECT resultado INTO r FROM public.conector_lotes WHERE conector_id = _conector_id AND lote_id = _lote_id;
 IF FOUND THEN RETURN r; END IF;
 IF _tipo NOT IN ('clientes','produtos','vendas','orcamentos') THEN RAISE EXCEPTION 'Tipo inválido.' USING ERRCODE='P0001'; END IF;
 IF jsonb_typeof(_linhas) IS DISTINCT FROM 'array' OR jsonb_array_length(_linhas) > 5000 THEN
  RAISE EXCEPTION 'Lote inválido (lista de até 5.000 linhas).' USING ERRCODE='P0001'; END IF;
 SELECT coalesce(jsonb_agg(l.v || jsonb_build_object('linha', l.n) ORDER BY l.n), '[]') INTO numeradas
 FROM jsonb_array_elements(_linhas) WITH ORDINALITY AS l(v, n);
 PERFORM set_config('rota.conector_sync', _conector_id::text, true);
 EXECUTE format('SELECT public.importar_%s($1, $2, $3)', _tipo) INTO r USING _empresa_id, 'conector:' || _lote_id, numeradas;
 PERFORM set_config('rota.conector_sync', '', true);
 INSERT INTO public.conector_lotes(conector_id, lote_id, tipo, empresa_id, resultado) VALUES (_conector_id, _lote_id, _tipo, _empresa_id, r);
 INSERT INTO public.conector_eventos(conector_id, empresa_id, tipo, ok, mensagem)
 VALUES (_conector_id, _empresa_id, 'sincronizacao', true,
  _tipo || ': ' || coalesce(r->>'inseridas','0') || ' novas, ' || coalesce(r->>'atualizadas','0') || ' atualizadas, ' || coalesce(r->>'ignoradas','0') || ' ignoradas');
 RETURN r;
END $$;

REVOKE ALL ON FUNCTION public.conector_chave(uuid), public.conector_registrar_pedido(uuid,text,text),
 public.conector_heartbeat(uuid,text,boolean), public.conector_trabalhos(uuid,int),
 public.conector_resultado(uuid,uuid,boolean,text,text), public.conector_sincronizar(uuid,text,uuid,text,jsonb)
 FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.conector_chave(uuid), public.conector_registrar_pedido(uuid,text,text),
 public.conector_heartbeat(uuid,text,boolean), public.conector_trabalhos(uuid,int),
 public.conector_resultado(uuid,uuid,boolean,text,text), public.conector_sincronizar(uuid,text,uuid,text,jsonb)
 TO service_role;
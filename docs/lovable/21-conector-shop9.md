Aplique exatamente o SQL abaixo como UMA migração nova. Não investigue o projeto, não reescreva nem otimize o SQL, não crie testes em Python. Depois rode o bloco de testes em SQL. Se algo falhar, PARE e copie o erro na resposta, sem tentar corrigir. Regenere os tipos.

Pré-requisito: mensagem 20 já aplicada (`shop9_envios`, `itens_orcamento`, `importar_produtos`).

## SQL

```sql
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
```

## Testes (SQL, tudo desfeito no fim)

```sql
BEGIN;
DO $t$
DECLARE
  a_auth uuid; emp uuid;
  d_id uuid := gen_random_uuid(); d_auth uuid := gen_random_uuid();
  v_id uuid := gen_random_uuid(); v_auth uuid := gen_random_uuid();
  cli uuid := gen_random_uuid(); o1 uuid := gen_random_uuid(); o2 uuid := gen_random_uuid();
  e1 uuid; e2 uuid; con uuid; n int; ok boolean; r jsonb; r2 jsonb; t text;
  chave text := 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';
  chave2 text := 'BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB';
BEGIN
  SELECT auth_user_id INTO a_auth FROM public.usuarios WHERE email = 'adm@centerfrios.com';
  SELECT id INTO emp FROM public.empresas WHERE nome = 'CENTERFRIOS';
  IF a_auth IS NULL OR emp IS NULL THEN RAISE EXCEPTION 'FALHA 0: administrador ou empresa não encontrados'; END IF;
  -- diretoria D e vendedor V temporários (mesmo caminho do cadastro real)
  INSERT INTO public.usuarios(id, nome, email, empresa_id) VALUES
   (d_id, 'Diretoria teste 21', 'teste21.diretoria@centerfrios.com', emp), (v_id, 'Vendedor teste 21', 'teste21.vendedor@centerfrios.com', emp);
  INSERT INTO public.usuario_empresas(usuario_id, empresa_id) VALUES (d_id, emp), (v_id, emp);
  INSERT INTO public.papeis_pre_cadastro(usuario_id, role, empresa_id) VALUES (d_id, 'diretoria', emp), (v_id, 'vendedor', emp);
  INSERT INTO public.usuario_setores(usuario_id, setor) VALUES (d_id, 'comercial'), (v_id, 'comercial');
  INSERT INTO auth.users(id, instance_id, aud, role, email, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at) VALUES
   (d_auth, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'teste21.diretoria@centerfrios.com', now(), '{}', '{}', now(), now()),
   (v_auth, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'teste21.vendedor@centerfrios.com', now(), '{}', '{}', now(), now());

  -- 1. administrador cadastra a chave pública; diretoria e vendedor não veem nem gerenciam
  PERFORM set_config('request.jwt.claims', json_build_object('sub', a_auth, 'role', 'authenticated')::text, true);
  EXECUTE 'set local role authenticated';
  ok := false; BEGIN PERFORM public.admin_conector_registrar_chave(NULL, 'X', 'curta'); EXCEPTION WHEN raise_exception THEN ok := true; END;
  IF NOT ok THEN RAISE EXCEPTION 'FALHA 1a: aceitou chave inválida'; END IF;
  con := public.admin_conector_registrar_chave(NULL, 'Teste 21', chave);
  r := public.admin_shop9_status();
  IF NOT (r->'conectores') @> jsonb_build_array(jsonb_build_object('id', con)) OR r::text LIKE '%' || chave || '%' THEN
    RAISE EXCEPTION 'FALHA 1b: status sem o conector ou expondo a chave'; END IF;
  ok := false; BEGIN PERFORM public.conector_chave(con); EXCEPTION WHEN insufficient_privilege THEN ok := true; END;
  IF NOT ok THEN RAISE EXCEPTION 'FALHA 1c: authenticated chamou função do conector'; END IF;
  EXECUTE 'reset role';
  FOREACH t IN ARRAY ARRAY[d_auth::text, v_auth::text] LOOP
    PERFORM set_config('request.jwt.claims', json_build_object('sub', t, 'role', 'authenticated')::text, true);
    EXECUTE 'set local role authenticated';
    SELECT count(*) INTO n FROM public.conectores; IF n <> 0 THEN RAISE EXCEPTION 'FALHA 1d: não-admin vê conectores'; END IF;
    SELECT count(*) INTO n FROM public.conector_eventos; IF n <> 0 THEN RAISE EXCEPTION 'FALHA 1e: não-admin vê eventos'; END IF;
    ok := false; BEGIN PERFORM public.admin_shop9_status(); EXCEPTION WHEN insufficient_privilege THEN ok := true; END;
    IF NOT ok THEN RAISE EXCEPTION 'FALHA 1f: não-admin leu status'; END IF;
    ok := false; BEGIN PERFORM public.admin_conector_revogar(con); EXCEPTION WHEN insufficient_privilege THEN ok := true; END;
    IF NOT ok THEN RAISE EXCEPTION 'FALHA 1g: não-admin revogou'; END IF;
    ok := false; BEGIN INSERT INTO public.conectores(nome, chave_publica) VALUES ('x', chave2); EXCEPTION WHEN insufficient_privilege THEN ok := true; END;
    IF NOT ok THEN RAISE EXCEPTION 'FALHA 1h: escrita direta'; END IF;
    EXECUTE 'reset role';
  END LOOP;

  -- 2. repetição e limite de taxa (como o servidor: service_role)
  PERFORM set_config('request.jwt.claims', json_build_object('role', 'service_role')::text, true);
  EXECUTE 'set local role service_role';
  IF public.conector_chave(con) IS DISTINCT FROM chave THEN RAISE EXCEPTION 'FALHA 2a: chave'; END IF;
  PERFORM public.conector_registrar_pedido(con, 'nonce-teste-000000000', 'heartbeat');
  ok := false; BEGIN PERFORM public.conector_registrar_pedido(con, 'nonce-teste-000000000', 'heartbeat'); EXCEPTION WHEN SQLSTATE 'P0409' THEN ok := true; END;
  IF NOT ok THEN RAISE EXCEPTION 'FALHA 2b: repetição aceita'; END IF;
  ok := false;
  n := 0;
  FOR i IN 1..130 LOOP
    BEGIN PERFORM public.conector_registrar_pedido(con, 'nonce-teste-' || lpad(i::text, 9, '0') || 'x', 'heartbeat');
    EXCEPTION WHEN SQLSTATE 'P0429' THEN ok := true; n := i; EXIT; END;
  END LOOP;
  IF NOT ok OR n <> 120 THEN RAISE EXCEPTION 'FALHA 2c: limite não bateu no 121º pedido (parou em %)', n; END IF;
  EXECUTE 'reset role';

  -- 3. fila: só no modo conector, reserva, resultado idempotente e espera progressiva
  INSERT INTO public.clientes(id, empresa_id, vendedor_id, codigo_shop9, nome, origem) VALUES (cli, emp, v_id, 'T21-C1', 'Cliente teste 21', 'manual');
  INSERT INTO public.orcamentos(id, empresa_id, cliente_id, vendedor_id, data, valor, status, origem, origem_rota, chave_idempotencia, envio_estado)
   VALUES (o1, emp, cli, v_id, current_date, 10, 'aberto', 'manual', true, 'rota:teste21:1', 'pendente'),
          (o2, emp, cli, v_id, current_date, 20, 'aberto', 'manual', true, 'rota:teste21:2', 'pendente');
  INSERT INTO public.shop9_envios(empresa_id, orcamento_id, chave_idempotencia) VALUES (emp, o1, 'rota:teste21:1') RETURNING id INTO e1;
  INSERT INTO public.shop9_envios(empresa_id, orcamento_id, chave_idempotencia) VALUES (emp, o2, 'rota:teste21:2') RETURNING id INTO e2;
  -- deixa só os dois envios do teste disponíveis
  UPDATE public.shop9_envios SET reservado_ate = now() + interval '1 hour' WHERE id NOT IN (e1, e2);
  UPDATE public.shop9_integracao SET modo = 'manual';
  PERFORM set_config('request.jwt.claims', json_build_object('role', 'service_role')::text, true);
  EXECUTE 'set local role service_role';
  r := public.conector_trabalhos(con, 10);
  IF jsonb_array_length(r->'trabalhos') <> 0 THEN RAISE EXCEPTION 'FALHA 3a: modo manual entregou trabalho'; END IF;
  EXECUTE 'reset role';
  UPDATE public.shop9_integracao SET modo = 'conector';
  EXECUTE 'set local role service_role';
  r := public.conector_trabalhos(con, 10);
  IF jsonb_array_length(r->'trabalhos') <> 2 OR r->'trabalhos'->0->>'cliente_codigo' <> 'T21-C1'
     OR r->'trabalhos'->0->>'vendedor_email' <> 'teste21.vendedor@centerfrios.com' THEN
    RAISE EXCEPTION 'FALHA 3b: trabalhos %', r; END IF;
  IF jsonb_array_length(public.conector_trabalhos(con, 10)->'trabalhos') <> 0 THEN RAISE EXCEPTION 'FALHA 3c: reserva não segurou'; END IF;
  PERFORM public.conector_resultado(con, e1, true, 'ORC-T21', NULL);
  PERFORM public.conector_resultado(con, e1, true, 'ORC-T21', NULL);
  ok := false; BEGIN PERFORM public.conector_resultado(con, e1, true, 'ORC-OUTRO', NULL); EXCEPTION WHEN raise_exception THEN ok := true; END;
  IF NOT ok THEN RAISE EXCEPTION 'FALHA 3d: aceitou outro código'; END IF;
  PERFORM public.conector_resultado(con, e2, false, NULL, 'timeout');
  PERFORM public.conector_resultado(con, e2, false, NULL, 'timeout');
  EXECUTE 'reset role';
  IF (SELECT estado || '/' || codigo_shop9 FROM public.shop9_envios WHERE id = e1) <> 'enviado/ORC-T21'
     OR (SELECT envio_codigo_shop9 FROM public.orcamentos WHERE id = o1) <> 'ORC-T21' THEN RAISE EXCEPTION 'FALHA 3e: envio 1'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.shop9_envios WHERE id = e2 AND estado = 'erro' AND tentativas = 2
     AND proxima_tentativa BETWEEN now() + interval '3 minutes' AND now() + interval '5 minutes' AND reservado_ate IS NULL) THEN
    RAISE EXCEPTION 'FALHA 3f: espera progressiva'; END IF;

  -- 4. lotes idempotentes reaproveitando importar_clientes
  PERFORM set_config('request.jwt.claims', json_build_object('role', 'service_role')::text, true);
  EXECUTE 'set local role service_role';
  r := public.conector_sincronizar(con, 'clientes', emp, 'clientes:teste21:0:2', jsonb_build_array(
    jsonb_build_object('codigo_shop9', 'T21-C2', 'nome', 'Cliente dois', 'vendedor_email', 'teste21.vendedor@centerfrios.com'),
    jsonb_build_object('codigo_shop9', 'T21-C3', 'nome', 'Cliente três', 'vendedor_email', 'teste21.vendedor@centerfrios.com')));
  r2 := public.conector_sincronizar(con, 'clientes', emp, 'clientes:teste21:0:2', '[]'::jsonb);
  EXECUTE 'reset role';
  IF (r->>'inseridas')::int <> 2 OR r <> r2 THEN RAISE EXCEPTION 'FALHA 4a: lote % / repetição %', r, r2; END IF;
  SELECT count(*) INTO n FROM public.clientes WHERE empresa_id = emp AND codigo_shop9 IN ('T21-C2', 'T21-C3');
  IF n <> 2 THEN RAISE EXCEPTION 'FALHA 4b: % clientes', n; END IF;
  -- marcador forjado por usuário comum não abre a importação
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_auth, 'role', 'authenticated')::text, true);
  EXECUTE 'set local role authenticated';
  PERFORM set_config('rota.conector_sync', 'forjado', true);
  ok := false; BEGIN PERFORM public.importar_clientes(emp, 'x', '[]'::jsonb); EXCEPTION WHEN insufficient_privilege THEN ok := true; END;
  PERFORM set_config('rota.conector_sync', '', true);
  IF NOT ok THEN RAISE EXCEPTION 'FALHA 4c: vendedor importou com marcador forjado'; END IF;
  EXECUTE 'reset role';

  -- 5. revogação corta na hora; nova chave reativa
  PERFORM set_config('request.jwt.claims', json_build_object('sub', a_auth, 'role', 'authenticated')::text, true);
  EXECUTE 'set local role authenticated';
  PERFORM public.admin_conector_revogar(con);
  EXECUTE 'reset role';
  PERFORM set_config('request.jwt.claims', json_build_object('role', 'service_role')::text, true);
  EXECUTE 'set local role service_role';
  IF public.conector_chave(con) IS NOT NULL THEN RAISE EXCEPTION 'FALHA 5a: revogado ainda tem chave'; END IF;
  ok := false; BEGIN PERFORM public.conector_registrar_pedido(con, 'nonce-teste-revogado00', 'heartbeat'); EXCEPTION WHEN insufficient_privilege THEN ok := true; END;
  IF NOT ok THEN RAISE EXCEPTION 'FALHA 5b: revogado registrou pedido'; END IF;
  EXECUTE 'reset role';
  PERFORM set_config('request.jwt.claims', json_build_object('sub', a_auth, 'role', 'authenticated')::text, true);
  EXECUTE 'set local role authenticated';
  PERFORM public.admin_conector_registrar_chave(con, 'Teste 21', chave2);
  EXECUTE 'reset role';
  IF (SELECT chave_publica FROM public.conectores WHERE id = con AND ativo) IS DISTINCT FROM chave2 THEN RAISE EXCEPTION 'FALHA 5c: troca de chave'; END IF;

  RAISE NOTICE 'RESULTADO OK: 1 a 5 passaram';
END $t$;
ROLLBACK;
```

Na resposta, copie a linha `RESULTADO OK` (ou o erro exato, se parou).

Aplique exatamente o SQL abaixo como UMA migração nova. Não investigue o projeto, não reescreva nem otimize o SQL, não crie testes em Python. Depois rode o bloco de testes em SQL. Se algo falhar, PARE e copie o erro na resposta, sem tentar corrigir. Regenere os tipos.

Pré-requisito: mensagem 21 já aplicada (migração 0030: `conectores`, `conector_lotes`, `shop9_integracao`).

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

-- 2. Mapeamento não sensível por empresa (série, senha e endereço ficam só no computador do conector).
CREATE TABLE public.shop9_empresas(
 empresa_id uuid PRIMARY KEY REFERENCES public.empresas(id),
 codfilial text CHECK (codfilial ~ '^\d{1,9}$'),
 codigo_operacao_orcamento text CHECK (codigo_operacao_orcamento ~ '^\d{1,9}$'),
 tipo_operacao_orcamento text NOT NULL DEFAULT 'ORC' CHECK (tipo_operacao_orcamento ~ '^[A-Z]{3}$'),
 tipos_venda text NOT NULL DEFAULT 'VND' CHECK (tipos_venda ~ '^[A-Z]{3}(,[A-Z]{3})*$'),
 tabela_preco text CHECK (length(tabela_preco) <= 40),
 codigo_caixa text CHECK (codigo_caixa ~ '^\d{1,9}$'),
 atualizado_por uuid REFERENCES public.usuarios(id),
 atualizado_em timestamptz NOT NULL DEFAULT now()
);
-- Funcionários marcados como vendedor no Shop9 → usuário da Rota (automático pelo e-mail; o administrador corrige).
CREATE TABLE public.shop9_vendedores(
 empresa_id uuid NOT NULL REFERENCES public.empresas(id),
 codigo text NOT NULL,
 nome text NOT NULL,
 email text,
 ativo boolean NOT NULL DEFAULT true,
 usuario_id uuid REFERENCES public.usuarios(id),
 manual boolean NOT NULL DEFAULT false,
 atualizado_em timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY (empresa_id, codigo)
);
CREATE TABLE public.shop9_motivos_desconto(
 empresa_id uuid NOT NULL REFERENCES public.empresas(id),
 codigo text NOT NULL,
 descricao text NOT NULL,
 ativo boolean NOT NULL DEFAULT true,
 PRIMARY KEY (empresa_id, codigo)
);
-- Cursor da sincronização incremental por empresa e recurso (sobrevive a reinstalar ou parear de novo).
CREATE TABLE public.shop9_cursores(
 empresa_id uuid NOT NULL REFERENCES public.empresas(id),
 tipo text NOT NULL,
 cursor text NOT NULL CHECK (length(cursor) <= 40),
 atualizado_em timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY (empresa_id, tipo)
);
ALTER TABLE public.conector_lotes DROP CONSTRAINT conector_lotes_tipo_check;
ALTER TABLE public.conector_lotes ADD CONSTRAINT conector_lotes_tipo_check CHECK (tipo IN
 ('funcionarios','clientes','produtos','precos','estoque','credito','motivos_desconto','vendas','devolucoes','orcamentos'));
ALTER TABLE public.produtos ADD COLUMN estoque numeric(14,3), ADD COLUMN estoque_em timestamptz;
-- Crédito do cliente no Shop9 (ficha 360).
ALTER TABLE public.clientes
 ADD COLUMN shop9_limite_credito numeric(14,2), ADD COLUMN shop9_saldo_credito numeric(14,2),
 ADD COLUMN shop9_credito_validade date, ADD COLUMN shop9_bloqueado boolean, ADD COLUMN shop9_credito_em timestamptz;
-- Cada saída vira uma linha por vendedor (venda compartilhada); devolução entra com valor negativo.
ALTER TABLE public.vendas
 ADD COLUMN shop9_ordem text, ADD COLUMN shop9_tipo text CHECK (shop9_tipo IN ('saida','devolucao')),
 ADD COLUMN shop9_vendedor_codigo text, ADD COLUMN shop9_saida_origem text;
CREATE INDEX vendas_shop9_ordem_idx ON public.vendas(empresa_id, shop9_tipo, shop9_ordem) WHERE shop9_ordem IS NOT NULL;

ALTER TABLE public.shop9_empresas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shop9_vendedores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shop9_motivos_desconto ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shop9_cursores ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.shop9_empresas, public.shop9_vendedores, public.shop9_motivos_desconto, public.shop9_cursores FROM anon, authenticated;
GRANT SELECT ON public.shop9_empresas, public.shop9_vendedores, public.shop9_motivos_desconto TO authenticated;
CREATE POLICY shop9_empresas_admin ON public.shop9_empresas FOR SELECT TO authenticated USING ((select public.eh_admin()));
CREATE POLICY shop9_vendedores_admin ON public.shop9_vendedores FOR SELECT TO authenticated USING ((select public.eh_admin()));
CREATE POLICY shop9_motivos_empresa ON public.shop9_motivos_desconto FOR SELECT TO authenticated USING (public.tem_empresa(empresa_id));
-- shop9_cursores: sem política (só funções).

-- 3. Administrador: códigos por empresa e vendedores (Configurações > Integrações).
CREATE FUNCTION public.admin_shop9_empresa_salvar(_empresa_id uuid, _codfilial text, _codigo_operacao_orcamento text,
 _tipo_operacao_orcamento text, _tipos_venda text, _tabela_preco text, _codigo_caixa text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE antigo jsonb;
BEGIN
 IF NOT public.eh_admin() THEN RAISE EXCEPTION 'Só administradores.' USING ERRCODE='42501'; END IF;
 SELECT to_jsonb(e) INTO antigo FROM public.shop9_empresas e WHERE empresa_id = _empresa_id;
 INSERT INTO public.shop9_empresas AS e(empresa_id, codfilial, codigo_operacao_orcamento, tipo_operacao_orcamento, tipos_venda, tabela_preco, codigo_caixa, atualizado_por, atualizado_em)
 VALUES (_empresa_id, nullif(btrim(_codfilial), ''), nullif(btrim(_codigo_operacao_orcamento), ''), coalesce(nullif(upper(btrim(_tipo_operacao_orcamento)), ''), 'ORC'),
  coalesce(nullif(upper(replace(_tipos_venda, ' ', '')), ''), 'VND'), nullif(btrim(_tabela_preco), ''), nullif(btrim(_codigo_caixa), ''), public.meu_usuario_id(), now())
 ON CONFLICT (empresa_id) DO UPDATE SET codfilial = EXCLUDED.codfilial, codigo_operacao_orcamento = EXCLUDED.codigo_operacao_orcamento,
  tipo_operacao_orcamento = EXCLUDED.tipo_operacao_orcamento, tipos_venda = EXCLUDED.tipos_venda, tabela_preco = EXCLUDED.tabela_preco,
  codigo_caixa = EXCLUDED.codigo_caixa, atualizado_por = EXCLUDED.atualizado_por, atualizado_em = now();
 PERFORM public.auditar('shop9_empresa', 'shop9_empresas', NULL, _empresa_id, NULL,
  jsonb_build_object('antigo', antigo, 'novo', (SELECT to_jsonb(e) FROM public.shop9_empresas e WHERE empresa_id = _empresa_id)));
END $$;

-- _usuario_id nulo = sem vínculo (as vendas dele vão para o vendedor da carteira do cliente).
CREATE FUNCTION public.admin_shop9_vendedor_mapear(_empresa_id uuid, _codigo text, _usuario_id uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF NOT public.eh_admin() THEN RAISE EXCEPTION 'Só administradores.' USING ERRCODE='42501'; END IF;
 IF _usuario_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.usuario_empresas WHERE usuario_id = _usuario_id AND empresa_id = _empresa_id) THEN
  RAISE EXCEPTION 'Usuário não é desta empresa.' USING ERRCODE='P0001'; END IF;
 UPDATE public.shop9_vendedores SET usuario_id = _usuario_id, manual = true, atualizado_em = now() WHERE empresa_id = _empresa_id AND codigo = _codigo;
 IF NOT FOUND THEN RAISE EXCEPTION 'Vendedor do Shop9 não encontrado.' USING ERRCODE='P0001'; END IF;
 PERFORM public.auditar('shop9_vendedor_mapeado', 'shop9_vendedores', NULL, _empresa_id, NULL, jsonb_build_object('codigo', _codigo, 'usuario_id', _usuario_id));
END $$;

CREATE OR REPLACE FUNCTION public.admin_shop9_status() RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF NOT public.eh_admin() THEN RAISE EXCEPTION 'Só administradores.' USING ERRCODE='42501'; END IF;
 RETURN (SELECT jsonb_build_object(
  'modo', i.modo, 'ambiente', i.ambiente,
  'conectores', coalesce((SELECT jsonb_agg(jsonb_build_object('id', c.id, 'nome', c.nome, 'ativo', c.ativo,
     'ultimo_contato', c.ultimo_contato, 'versao', c.versao) ORDER BY c.created_at) FROM public.conectores c), '[]'),
  'eventos', coalesce((SELECT jsonb_agg(e ORDER BY e.criado_em DESC) FROM (SELECT id, criado_em, tipo, ok, mensagem
     FROM public.conector_eventos ORDER BY criado_em DESC LIMIT 30) e), '[]'),
  'empresas', coalesce((SELECT jsonb_agg(jsonb_build_object('empresa_id', em.id, 'nome', em.nome,
     'codfilial', s.codfilial, 'codigo_operacao_orcamento', s.codigo_operacao_orcamento,
     'tipo_operacao_orcamento', coalesce(s.tipo_operacao_orcamento, 'ORC'), 'tipos_venda', coalesce(s.tipos_venda, 'VND'),
     'tabela_preco', s.tabela_preco, 'codigo_caixa', s.codigo_caixa,
     'vendedores', coalesce((SELECT jsonb_agg(jsonb_build_object('codigo', v.codigo, 'nome', v.nome, 'ativo', v.ativo,
        'usuario_id', v.usuario_id, 'manual', v.manual) ORDER BY v.nome) FROM public.shop9_vendedores v WHERE v.empresa_id = em.id), '[]'),
     'usuarios', coalesce((SELECT jsonb_agg(jsonb_build_object('id', u.id, 'nome', u.nome) ORDER BY u.nome)
        FROM public.usuarios u JOIN public.usuario_empresas ue ON ue.usuario_id = u.id AND ue.empresa_id = em.id), '[]'))
     ORDER BY em.nome) FROM public.empresas em LEFT JOIN public.shop9_empresas s ON s.empresa_id = em.id), '[]'))
  FROM public.shop9_integracao i);
END $$;

REVOKE ALL ON FUNCTION public.admin_shop9_empresa_salvar(uuid,text,text,text,text,text,text), public.admin_shop9_vendedor_mapear(uuid,text,uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_shop9_empresa_salvar(uuid,text,text,text,text,text,text), public.admin_shop9_vendedor_mapear(uuid,text,uuid) TO authenticated;

-- 4. Conector: o heartbeat entrega os códigos por empresa e os cursores; o trabalho leva o código do vendedor no Shop9.
CREATE OR REPLACE FUNCTION public.conector_heartbeat(_conector_id uuid, _versao text, _shop9_ok boolean) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 UPDATE public.conectores SET versao = left(_versao, 40), shop9_ok = _shop9_ok, ultimo_contato = now() WHERE id = _conector_id;
 RETURN (SELECT jsonb_build_object('modo', i.modo, 'ambiente', i.ambiente,
  'empresas', coalesce((SELECT jsonb_agg(jsonb_build_object('empresa_id', s.empresa_id, 'codfilial', s.codfilial,
     'codigo_operacao_orcamento', s.codigo_operacao_orcamento, 'tipo_operacao_orcamento', s.tipo_operacao_orcamento,
     'tipos_venda', s.tipos_venda, 'tabela_preco', s.tabela_preco, 'codigo_caixa', s.codigo_caixa))
     FROM public.shop9_empresas s WHERE s.codfilial IS NOT NULL), '[]'),
  'cursores', coalesce((SELECT jsonb_object_agg(c.tipo || ':' || c.empresa_id, c.cursor) FROM public.shop9_cursores c), '{}'))
  FROM public.shop9_integracao i);
END $$;

CREATE OR REPLACE FUNCTION public.conector_trabalhos(_conector_id uuid, _limite int) RETURNS jsonb
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
   'cliente_codigo', c.codigo_shop9, 'data', o.data,
   'vendedor_codigo_shop9', (SELECT v.codigo FROM public.shop9_vendedores v
      WHERE v.empresa_id = m.empresa_id AND v.usuario_id = o.vendedor_id AND v.ativo ORDER BY v.manual DESC, v.codigo LIMIT 1),
   'itens', (SELECT coalesce(jsonb_agg(jsonb_build_object('codigo_produto', i.codigo_shop9, 'descricao', i.descricao,
      'unidade', i.unidade, 'quantidade', i.quantidade, 'preco_unit', i.preco_unit, 'desconto_pct', i.desconto_pct,
      'total', i.total) ORDER BY i.created_at), '[]') FROM public.itens_orcamento i WHERE i.orcamento_id = o.id))
   ORDER BY m.created_at), '[]'))
 INTO r
 FROM marcados m JOIN public.orcamentos o ON o.id = m.orcamento_id
 JOIN public.clientes c ON c.id = o.cliente_id;
 RETURN r;
END $$;

-- 5. Gravação dos cadastros vindos do conector (internas; só chamadas por conector_sincronizar).
CREATE FUNCTION public.conector_gravar_cadastros(_empresa_id uuid, _tipo text, _linhas jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE l jsonb; n int := 0; cod text; ins int := 0; upd int := 0; erros jsonb := '[]'; vend uuid;
BEGIN
 FOR l IN SELECT * FROM jsonb_array_elements(_linhas) LOOP
  n := n + 1; cod := nullif(btrim(l->>'codigo_shop9'), '');
  IF cod IS NULL THEN erros := erros || jsonb_build_object('linha', n, 'mensagem', 'Código vazio.'); CONTINUE; END IF;
  IF _tipo = 'funcionarios' THEN
   INSERT INTO public.shop9_vendedores AS v(empresa_id, codigo, nome, email, ativo, usuario_id)
   VALUES (_empresa_id, cod, left(coalesce(nullif(btrim(l->>'nome'), ''), cod), 120), lower(nullif(btrim(l->>'email'), '')),
    coalesce((l->>'ativo')::boolean, true) AND coalesce((l->>'vendedor')::boolean, true),
    (SELECT u.id FROM public.usuarios u JOIN public.usuario_empresas ue ON ue.usuario_id = u.id AND ue.empresa_id = _empresa_id
     WHERE lower(u.email) = lower(nullif(btrim(l->>'email'), '')) LIMIT 1))
   ON CONFLICT (empresa_id, codigo) DO UPDATE SET nome = EXCLUDED.nome, email = EXCLUDED.email, ativo = EXCLUDED.ativo,
    usuario_id = CASE WHEN v.manual THEN v.usuario_id ELSE EXCLUDED.usuario_id END, atualizado_em = now();
   ins := ins + 1;
  ELSIF _tipo = 'clientes' THEN
   IF nullif(btrim(l->>'nome'), '') IS NULL THEN erros := erros || jsonb_build_object('linha', n, 'mensagem', 'Nome vazio.'); CONTINUE; END IF;
   -- cliente existente: atualiza cadastro e crédito, nunca a carteira (o vendedor da Rota manda)
   UPDATE public.clientes SET nome = btrim(l->>'nome'), documento = coalesce(nullif(l->>'documento', ''), documento),
    telefone = coalesce(nullif(l->>'telefone', ''), telefone), cidade = coalesce(nullif(l->>'cidade', ''), cidade),
    shop9_limite_credito = (l->>'limite_credito_centavos')::numeric / 100, shop9_credito_validade = nullif(l->>'credito_validade', '')::date,
    shop9_bloqueado = (l->>'bloqueado')::boolean, shop9_credito_em = now()
   WHERE empresa_id = _empresa_id AND codigo_shop9 = cod;
   IF FOUND THEN upd := upd + 1; CONTINUE; END IF;
   SELECT v.usuario_id INTO vend FROM public.shop9_vendedores v WHERE v.empresa_id = _empresa_id AND v.codigo = l->>'vendedor_codigo' AND v.usuario_id IS NOT NULL;
   IF vend IS NULL THEN erros := erros || jsonb_build_object('linha', n, 'campo', 'vendedor_codigo', 'mensagem', 'Vendedor do Shop9 sem usuário na Rota.'); CONTINUE; END IF;
   INSERT INTO public.clientes(empresa_id, vendedor_id, codigo_shop9, nome, telefone, documento, cidade, origem, demo,
    shop9_limite_credito, shop9_credito_validade, shop9_bloqueado, shop9_credito_em)
   VALUES (_empresa_id, vend, cod, btrim(l->>'nome'), nullif(l->>'telefone', ''), nullif(l->>'documento', ''), nullif(l->>'cidade', ''), 'importacao', false,
    (l->>'limite_credito_centavos')::numeric / 100, nullif(l->>'credito_validade', '')::date, (l->>'bloqueado')::boolean, now());
   ins := ins + 1;
  ELSIF _tipo = 'precos' THEN
   UPDATE public.produtos SET preco_tabela = (l->>'preco_centavos')::numeric / 100, atualizado_em = now() WHERE empresa_id = _empresa_id AND codigo_shop9 = cod;
   IF FOUND THEN upd := upd + 1; ELSE erros := erros || jsonb_build_object('linha', n, 'mensagem', 'Produto não encontrado.'); END IF;
  ELSIF _tipo = 'estoque' THEN
   UPDATE public.produtos SET estoque = (l->>'quantidade')::numeric, estoque_em = now() WHERE empresa_id = _empresa_id AND codigo_shop9 = cod;
   IF FOUND THEN upd := upd + 1; ELSE erros := erros || jsonb_build_object('linha', n, 'mensagem', 'Produto não encontrado.'); END IF;
  ELSIF _tipo = 'credito' THEN
   UPDATE public.clientes SET shop9_saldo_credito = (l->>'saldo_centavos')::numeric / 100, shop9_credito_em = now() WHERE empresa_id = _empresa_id AND codigo_shop9 = cod;
   IF FOUND THEN upd := upd + 1; ELSE erros := erros || jsonb_build_object('linha', n, 'mensagem', 'Cliente não encontrado.'); END IF;
  ELSIF _tipo = 'motivos_desconto' THEN
   INSERT INTO public.shop9_motivos_desconto AS m(empresa_id, codigo, descricao, ativo)
   VALUES (_empresa_id, cod, left(coalesce(nullif(btrim(l->>'descricao'), ''), cod), 120), coalesce((l->>'ativo')::boolean, true))
   ON CONFLICT (empresa_id, codigo) DO UPDATE SET descricao = EXCLUDED.descricao, ativo = EXCLUDED.ativo;
   ins := ins + 1;
  END IF;
 END LOOP;
 RETURN jsonb_build_object('inseridas', ins, 'atualizadas', upd, 'ignoradas', jsonb_array_length(erros), 'erros', erros);
END $$;

-- 6. Saídas (vendas) e devoluções. Uma linha de vendas por vendedor; a devolução entra negativa e desconta
-- da meta de quem vendeu. Só saída faturada conta; desfeita ou cancelada sai da meta. A data de faturamento
-- vem da leitura por data de efetivação; a leitura por alteração (data nula) mantém a já gravada.
CREATE FUNCTION public.conector_gravar_saidas(_empresa_id uuid, _tipo text, _linhas jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE l jsonb; p jsonb; n int := 0; ordem text; cli public.clientes; dt date; vid uuid; primeira uuid; vend uuid;
 sinal int := CASE WHEN _tipo = 'devolucoes' THEN -1 ELSE 1 END; st text := CASE WHEN _tipo = 'devolucoes' THEN 'devolucao' ELSE 'saida' END;
 ins int := 0; upd int := 0; erros jsonb := '[]'; novo boolean;
BEGIN
 FOR l IN SELECT * FROM jsonb_array_elements(_linhas) LOOP
  n := n + 1; ordem := nullif(btrim(l->>'codigo_shop9'), '');
  IF ordem IS NULL THEN erros := erros || jsonb_build_object('linha', n, 'mensagem', 'Ordem vazia.'); CONTINUE; END IF;
  SELECT min(data_faturamento) INTO dt FROM public.vendas WHERE empresa_id = _empresa_id AND shop9_tipo = st AND shop9_ordem = ordem;
  novo := dt IS NULL;
  DELETE FROM public.vendas WHERE empresa_id = _empresa_id AND shop9_tipo = st AND shop9_ordem = ordem;
  IF NOT coalesce((l->>'faturada')::boolean, false) THEN CONTINUE; END IF;
  SELECT * INTO cli FROM public.clientes WHERE empresa_id = _empresa_id AND codigo_shop9 = btrim(l->>'cliente_codigo');
  IF NOT FOUND THEN erros := erros || jsonb_build_object('linha', n, 'campo', 'cliente_codigo', 'mensagem', 'Cliente não encontrado.'); CONTINUE; END IF;
  dt := coalesce(nullif(l->>'data_faturamento', '')::date, dt, nullif(l->>'data_emissao', '')::date);
  IF dt IS NULL THEN erros := erros || jsonb_build_object('linha', n, 'mensagem', 'Sem data de faturamento.'); CONTINUE; END IF;
  primeira := NULL;
  FOR p IN SELECT * FROM jsonb_array_elements(coalesce(l->'partes', '[]')) LOOP
   SELECT v.usuario_id INTO vend FROM public.shop9_vendedores v WHERE v.empresa_id = _empresa_id AND v.codigo = p->>'vendedor_codigo';
   INSERT INTO public.vendas(empresa_id, cliente_id, vendedor_id, codigo_shop9, data_faturamento, valor, origem, demo,
    shop9_ordem, shop9_tipo, shop9_vendedor_codigo, shop9_saida_origem)
   VALUES (_empresa_id, cli.id, coalesce(vend, cli.vendedor_id), left(st, 1) || ordem || '-' || coalesce(p->>'vendedor_codigo', '0'), dt,
    sinal * (p->>'valor_centavos')::numeric / 100, 'importacao', false, ordem, st, p->>'vendedor_codigo', nullif(l->>'saida_origem', ''))
   RETURNING id INTO vid;
   primeira := coalesce(primeira, vid);
  END LOOP;
  IF primeira IS NULL THEN erros := erros || jsonb_build_object('linha', n, 'mensagem', 'Sem vendedor.'); CONTINUE; END IF;
  INSERT INTO public.itens_venda(empresa_id, venda_id, cliente_id, vendedor_id, produto, codigo_produto, quantidade, valor_total, origem, demo)
  SELECT _empresa_id, primeira, cli.id, (SELECT vendedor_id FROM public.vendas WHERE id = primeira),
   coalesce((SELECT pr.descricao FROM public.produtos pr WHERE pr.empresa_id = _empresa_id AND pr.codigo_shop9 = i->>'codigo_produto'), i->>'codigo_produto'),
   i->>'codigo_produto', sinal * coalesce((i->>'quantidade')::numeric, 0), sinal * coalesce((i->>'valor_centavos')::numeric, 0) / 100, 'importacao', false
  FROM jsonb_array_elements(coalesce(l->'itens', '[]')) i WHERE nullif(btrim(i->>'codigo_produto'), '') IS NOT NULL;
  IF sinal = 1 THEN
   UPDATE public.clientes SET data_ultima_compra = dt WHERE id = cli.id AND (data_ultima_compra IS NULL OR data_ultima_compra < dt);
  END IF;
  IF novo THEN ins := ins + 1; ELSE upd := upd + 1; END IF;
 END LOOP;
 RETURN jsonb_build_object('inseridas', ins, 'atualizadas', upd, 'ignoradas', jsonb_array_length(erros), 'erros', erros);
END $$;

-- 7. Sincronização: um lote por chamada, idempotente por lote_id (hash do conteúdo, gerado no conector);
-- o cursor do recurso é gravado na mesma transação das linhas.
DROP FUNCTION public.conector_sincronizar(uuid, text, uuid, text, jsonb);
CREATE FUNCTION public.conector_sincronizar(_conector_id uuid, _tipo text, _empresa_id uuid, _lote_id text, _linhas jsonb, _cursor text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE r jsonb; numeradas jsonb;
BEGIN
 PERFORM pg_advisory_xact_lock(hashtext('conector_lote:' || _conector_id || ':' || _lote_id));
 SELECT resultado INTO r FROM public.conector_lotes WHERE conector_id = _conector_id AND lote_id = _lote_id;
 IF FOUND THEN RETURN r; END IF;
 IF _tipo NOT IN ('funcionarios','clientes','produtos','precos','estoque','credito','motivos_desconto','vendas','devolucoes','orcamentos') THEN
  RAISE EXCEPTION 'Tipo inválido.' USING ERRCODE='P0001'; END IF;
 IF NOT EXISTS (SELECT 1 FROM public.shop9_empresas WHERE empresa_id = _empresa_id AND codfilial IS NOT NULL) THEN
  RAISE EXCEPTION 'Empresa sem filial do Shop9 configurada.' USING ERRCODE='P0001'; END IF;
 IF jsonb_typeof(_linhas) IS DISTINCT FROM 'array' OR jsonb_array_length(_linhas) > 5000 THEN
  RAISE EXCEPTION 'Lote inválido (lista de até 5.000 linhas).' USING ERRCODE='P0001'; END IF;
 IF jsonb_array_length(_linhas) = 0 THEN
  r := jsonb_build_object('inseridas', 0, 'atualizadas', 0, 'ignoradas', 0, 'erros', '[]'::jsonb);
 ELSIF _tipo IN ('vendas','devolucoes') THEN
  r := public.conector_gravar_saidas(_empresa_id, _tipo, _linhas);
 ELSIF _tipo IN ('produtos','orcamentos') THEN
  SELECT coalesce(jsonb_agg(l.v || jsonb_build_object('linha', l.n) ORDER BY l.n), '[]') INTO numeradas
  FROM jsonb_array_elements(_linhas) WITH ORDINALITY AS l(v, n);
  PERFORM set_config('rota.conector_sync', _conector_id::text, true);
  EXECUTE format('SELECT public.importar_%s($1, $2, $3)', _tipo) INTO r USING _empresa_id, 'conector:' || left(_lote_id, 60), numeradas;
  PERFORM set_config('rota.conector_sync', '', true);
 ELSE
  r := public.conector_gravar_cadastros(_empresa_id, _tipo, _linhas);
 END IF;
 IF _cursor IS NOT NULL THEN
  INSERT INTO public.shop9_cursores(empresa_id, tipo, cursor) VALUES (_empresa_id, _tipo, left(_cursor, 40))
  ON CONFLICT (empresa_id, tipo) DO UPDATE SET cursor = EXCLUDED.cursor, atualizado_em = now();
 END IF;
 INSERT INTO public.conector_lotes(conector_id, lote_id, tipo, empresa_id, resultado) VALUES (_conector_id, _lote_id, _tipo, _empresa_id, r);
 IF jsonb_array_length(_linhas) > 0 THEN
  INSERT INTO public.conector_eventos(conector_id, empresa_id, tipo, ok, mensagem)
  VALUES (_conector_id, _empresa_id, 'sincronizacao', coalesce((r->>'ignoradas')::int, 0) = 0,
   _tipo || ': ' || coalesce(r->>'inseridas','0') || ' novas, ' || coalesce(r->>'atualizadas','0') || ' atualizadas, ' || coalesce(r->>'ignoradas','0') || ' ignoradas');
 END IF;
 DELETE FROM public.conector_lotes WHERE conector_id = _conector_id AND criado_em < now() - interval '30 days';
 RETURN r;
END $$;

REVOKE ALL ON FUNCTION public.conector_gravar_cadastros(uuid,text,jsonb), public.conector_gravar_saidas(uuid,text,jsonb),
 public.conector_sincronizar(uuid,text,uuid,text,jsonb,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.conector_sincronizar(uuid,text,uuid,text,jsonb,text) TO service_role;
```

## Testes (SQL, tudo desfeito no fim)

```sql
BEGIN;
DO $t$
DECLARE
  a_auth uuid; emp uuid; con uuid; r jsonb; ok boolean; cod text; ks text[]; n int; s numeric;
  v_id uuid := gen_random_uuid(); v_auth uuid := gen_random_uuid();
  k1 text := 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA1';
  k2 text := 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA2';
  k3 text := 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA3';
BEGIN
  SELECT auth_user_id INTO a_auth FROM public.usuarios WHERE email = 'adm@centerfrios.com';
  SELECT id INTO emp FROM public.empresas WHERE nome = 'CENTERFRIOS';
  IF a_auth IS NULL OR emp IS NULL THEN RAISE EXCEPTION 'FALHA 0: administrador ou empresa não encontrados'; END IF;
  INSERT INTO public.usuarios(id, nome, email, empresa_id) VALUES (v_id, 'Vendedora teste 22', 'teste22.vendedora@centerfrios.com', emp);
  INSERT INTO public.usuario_empresas(usuario_id, empresa_id) VALUES (v_id, emp);
  INSERT INTO public.papeis_pre_cadastro(usuario_id, role, empresa_id) VALUES (v_id, 'vendedor', emp);
  INSERT INTO public.usuario_setores(usuario_id, setor) VALUES (v_id, 'comercial');
  INSERT INTO auth.users(id, instance_id, aud, role, email, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at) VALUES
   (v_auth, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'teste22.vendedora@centerfrios.com', now(), '{}', '{}', now(), now());

  -- 1. Pareamento: só o administrador gera o código; o código vale uma vez; vendedor não gera
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_auth, 'role', 'authenticated')::text, true);
  EXECUTE 'set local role authenticated';
  ok := false; BEGIN PERFORM public.admin_conector_gerar_codigo(NULL, 'X'); EXCEPTION WHEN insufficient_privilege THEN ok := true; END;
  IF NOT ok THEN RAISE EXCEPTION 'FALHA 1a: vendedor gerou código'; END IF;
  EXECUTE 'reset role';
  PERFORM set_config('request.jwt.claims', json_build_object('sub', a_auth, 'role', 'authenticated')::text, true);
  EXECUTE 'set local role authenticated';
  r := public.admin_conector_gerar_codigo(NULL, 'Teste 22');
  cod := r->>'codigo';
  IF cod !~ '^[A-HJ-NP-Z2-9]{8}$' THEN RAISE EXCEPTION 'FALHA 1b: código fora do formato: %', cod; END IF;
  ok := false; BEGIN PERFORM public.conector_parear(cod, k1, 'X'); EXCEPTION WHEN insufficient_privilege THEN ok := true; END;
  IF NOT ok THEN RAISE EXCEPTION 'FALHA 1c: authenticated chamou conector_parear'; END IF;
  EXECUTE 'reset role';
  IF EXISTS (SELECT 1 FROM public.conector_pareamentos WHERE codigo_hash = cod) THEN RAISE EXCEPTION 'FALHA 1d: código gravado em claro'; END IF;

  PERFORM set_config('request.jwt.claims', json_build_object('role', 'service_role')::text, true);
  EXECUTE 'set local role service_role';
  con := (public.conector_parear(lower(cod), k1, 'Teste 22')->>'conector_id')::uuid;
  ok := false; BEGIN PERFORM public.conector_parear(cod, k2, 'Outro'); EXCEPTION WHEN raise_exception THEN ok := true; END;
  IF NOT ok THEN RAISE EXCEPTION 'FALHA 1e: código reutilizado'; END IF;
  ok := false; BEGIN PERFORM public.conector_parear('ZZZZZZZZ', k2, 'Outro'); EXCEPTION WHEN raise_exception THEN ok := true; END;
  IF NOT ok THEN RAISE EXCEPTION 'FALHA 1f: código inexistente aceito'; END IF;
  IF public.conector_chaves(con) <> ARRAY[k1] THEN RAISE EXCEPTION 'FALHA 1g: chaves após pareamento'; END IF;

  -- 2. Troca com transição: atual + anterior por 10 min; depois só a nova; chave repetida recusada
  PERFORM public.conector_trocar_chave(con, k2);
  IF public.conector_chaves(con) <> ARRAY[k2, k1] THEN RAISE EXCEPTION 'FALHA 2a: transição sem as duas chaves'; END IF;
  ok := false; BEGIN PERFORM public.conector_trocar_chave(con, k1); EXCEPTION WHEN raise_exception THEN ok := true; END;
  IF NOT ok THEN RAISE EXCEPTION 'FALHA 2b: aceitou chave já usada'; END IF;
  EXECUTE 'reset role';
  UPDATE public.conectores SET anterior_ate = now() - interval '1 second' WHERE id = con;
  EXECUTE 'set local role service_role';
  IF public.conector_chaves(con) <> ARRAY[k2] THEN RAISE EXCEPTION 'FALHA 2c: anterior valeu após a transição'; END IF;
  PERFORM public.conector_trocar_chave(con, k3);
  EXECUTE 'reset role';

  -- 3. Revogação imediata, inclusive da chave em transição
  PERFORM set_config('request.jwt.claims', json_build_object('sub', a_auth, 'role', 'authenticated')::text, true);
  EXECUTE 'set local role authenticated';
  PERFORM public.admin_conector_revogar(con);
  EXECUTE 'reset role';
  PERFORM set_config('request.jwt.claims', json_build_object('role', 'service_role')::text, true);
  EXECUTE 'set local role service_role';
  IF public.conector_chaves(con) IS NOT NULL THEN RAISE EXCEPTION 'FALHA 3: revogado ainda tem chave'; END IF;
  ok := false; BEGIN PERFORM public.conector_registrar_pedido(con, 'nonce-teste-22-0000000', 'heartbeat'); EXCEPTION WHEN insufficient_privilege THEN ok := true; END;
  IF NOT ok THEN RAISE EXCEPTION 'FALHA 3b: revogado registrou pedido'; END IF;
  EXECUTE 'reset role';
  UPDATE public.conectores SET ativo = true, revogado_em = NULL WHERE id = con; -- reativa para as próximas etapas
  -- (continua no bloco 4)

  -- 4. Mapeamento da empresa (administrador) e vendedores vindos do Shop9 (vínculo pelo e-mail)
  PERFORM set_config('request.jwt.claims', json_build_object('sub', a_auth, 'role', 'authenticated')::text, true);
  EXECUTE 'set local role authenticated';
  PERFORM public.admin_shop9_empresa_salvar(emp, '1', '209', 'orc', 'VND, VEF', 'VAREJISTA', '1');
  r := public.admin_shop9_status();
  IF NOT (r->'empresas') @> jsonb_build_array(jsonb_build_object('empresa_id', emp, 'codfilial', '1', 'tipos_venda', 'VND,VEF', 'tipo_operacao_orcamento', 'ORC')) THEN
    RAISE EXCEPTION 'FALHA 4a: status sem o mapeamento da empresa'; END IF;
  EXECUTE 'reset role';
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_auth, 'role', 'authenticated')::text, true);
  EXECUTE 'set local role authenticated';
  ok := false; BEGIN PERFORM public.admin_shop9_empresa_salvar(emp, '2', NULL, NULL, NULL, NULL, NULL); EXCEPTION WHEN insufficient_privilege THEN ok := true; END;
  IF NOT ok THEN RAISE EXCEPTION 'FALHA 4b: vendedor alterou o mapeamento'; END IF;
  IF EXISTS (SELECT 1 FROM public.shop9_empresas) THEN RAISE EXCEPTION 'FALHA 4c: vendedor lê o mapeamento'; END IF;
  EXECUTE 'reset role';

  PERFORM set_config('request.jwt.claims', json_build_object('role', 'service_role')::text, true);
  EXECUTE 'set local role service_role';
  r := public.conector_sincronizar(con, 'funcionarios', emp, 'f-22-0001', jsonb_build_array(
    jsonb_build_object('codigo_shop9', '6', 'nome', 'Ana', 'email', 'TESTE22.vendedora@centerfrios.com', 'vendedor', true, 'ativo', true),
    jsonb_build_object('codigo_shop9', '9', 'nome', 'Sem usuário', 'email', null, 'vendedor', true, 'ativo', true)), NULL);
  IF (SELECT usuario_id FROM public.shop9_vendedores WHERE empresa_id = emp AND codigo = '6') IS DISTINCT FROM v_id THEN
    RAISE EXCEPTION 'FALHA 4d: vendedor do Shop9 não foi ligado pelo e-mail'; END IF;
  r := public.conector_heartbeat(con, '0.2.0', true);
  IF NOT (r->'empresas') @> jsonb_build_array(jsonb_build_object('empresa_id', emp, 'codigo_operacao_orcamento', '209')) OR r::text LIKE '%senha%' THEN
    RAISE EXCEPTION 'FALHA 4e: heartbeat sem códigos da empresa'; END IF;

  -- 5. Cliente novo vai para a carteira do vendedor mapeado; crédito do Shop9 gravado; cursor gravado com o lote
  r := public.conector_sincronizar(con, 'clientes', emp, 'c-22-0001', jsonb_build_array(jsonb_build_object(
    'codigo_shop9', 'T22-C1', 'nome', 'Cliente teste 22', 'vendedor_codigo', '6', 'limite_credito_centavos', 60000, 'bloqueado', false)), '2026-11-16 10:00:00');
  IF (SELECT vendedor_id FROM public.clientes WHERE empresa_id = emp AND codigo_shop9 = 'T22-C1') IS DISTINCT FROM v_id
   OR (SELECT shop9_limite_credito FROM public.clientes WHERE empresa_id = emp AND codigo_shop9 = 'T22-C1') <> 600 THEN
    RAISE EXCEPTION 'FALHA 5a: cliente sem carteira ou crédito'; END IF;
  IF (public.conector_heartbeat(con, '0.2.0', true)->'cursores'->>('clientes:' || emp)) <> '2026-11-16 10:00:00' THEN
    RAISE EXCEPTION 'FALHA 5b: cursor não gravado'; END IF;
  r := public.conector_sincronizar(con, 'credito', emp, 'k-22-0001', '[{"codigo_shop9":"T22-C1","saldo_centavos":26550}]', NULL);
  IF (SELECT shop9_saldo_credito FROM public.clientes WHERE empresa_id = emp AND codigo_shop9 = 'T22-C1') <> 265.50 THEN
    RAISE EXCEPTION 'FALHA 5c: saldo de crédito'; END IF;

  -- 6. Venda compartilhada: uma linha por vendedor, soma = total; sem usuário vai para a carteira do cliente
  r := public.conector_sincronizar(con, 'vendas', emp, 'v-22-0001', '[{"codigo_shop9":"T22-500","cliente_codigo":"T22-C1","faturada":true,
    "data_faturamento":"2026-11-16","data_emissao":"2026-11-10","partes":[{"vendedor_codigo":"6","valor_centavos":50001},{"vendedor_codigo":"9","valor_centavos":50000}],
    "itens":[{"codigo_produto":"X1","quantidade":1,"valor_centavos":100001}]}]', NULL);
  SELECT count(*), sum(valor) INTO n, s FROM public.vendas WHERE empresa_id = emp AND shop9_ordem = 'T22-500';
  IF n <> 2 OR s <> 1000.01 OR EXISTS (SELECT 1 FROM public.vendas WHERE shop9_ordem = 'T22-500' AND (vendedor_id IS DISTINCT FROM v_id OR data_faturamento <> '2026-11-16')) THEN
    RAISE EXCEPTION 'FALHA 6a: divisão da venda (n=%, soma=%)', n, s; END IF;
  -- leitura por alteração (data nula) não muda a data de efetivação; lote repetido não duplica
  r := public.conector_sincronizar(con, 'vendas', emp, 'v-22-0002', '[{"codigo_shop9":"T22-500","cliente_codigo":"T22-C1","faturada":true,"data_faturamento":null,
    "partes":[{"vendedor_codigo":"6","valor_centavos":100001}],"itens":[]}]', NULL);
  r := public.conector_sincronizar(con, 'vendas', emp, 'v-22-0002', '[]', NULL);
  IF (SELECT count(*) FROM public.vendas WHERE shop9_ordem = 'T22-500') <> 1 OR (SELECT data_faturamento FROM public.vendas WHERE shop9_ordem = 'T22-500') <> '2026-11-16' THEN
    RAISE EXCEPTION 'FALHA 6b: atualização da venda'; END IF;

  -- 7. Devolução desconta da meta; venda desfeita sai da meta
  r := public.conector_sincronizar(con, 'devolucoes', emp, 'd-22-0001', '[{"codigo_shop9":"T22-70","cliente_codigo":"T22-C1","faturada":true,
    "data_faturamento":"2026-11-17","saida_origem":"T22-500","partes":[{"vendedor_codigo":"6","valor_centavos":10000}],"itens":[]}]', NULL);
  IF (SELECT sum(valor) FROM public.vendas WHERE empresa_id = emp AND vendedor_id = v_id) <> 900.01 THEN RAISE EXCEPTION 'FALHA 7a: devolução não descontou'; END IF;
  r := public.conector_sincronizar(con, 'vendas', emp, 'v-22-0003', '[{"codigo_shop9":"T22-500","cliente_codigo":"T22-C1","faturada":false,"partes":[],"itens":[]}]', NULL);
  IF EXISTS (SELECT 1 FROM public.vendas WHERE shop9_ordem = 'T22-500') THEN RAISE EXCEPTION 'FALHA 7b: venda desfeita continuou na meta'; END IF;
  EXECUTE 'reset role';
  RAISE NOTICE 'Testes do texto 22: tudo certo.';
END $t$;
ROLLBACK;
```

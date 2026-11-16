-- Mensagem 20: catálogo de produtos, carrinho do vendedor, orçamento da Rota, fila Shop9 e limites de desconto.
CREATE EXTENSION IF NOT EXISTS unaccent WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA extensions;

CREATE OR REPLACE FUNCTION public.imutavel_unaccent(text) RETURNS text
LANGUAGE sql IMMUTABLE PARALLEL SAFE STRICT SET search_path = public, extensions
AS $$ SELECT extensions.unaccent('extensions.unaccent'::regdictionary, $1) $$;

-- 1. Produtos
CREATE TABLE public.produtos (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 empresa_id uuid NOT NULL REFERENCES public.empresas(id),
 codigo_shop9 text NOT NULL,
 descricao text NOT NULL,
 unidade text NOT NULL DEFAULT 'UN',
 preco_tabela numeric(14,2) NOT NULL CHECK (preco_tabela >= 0),
 ativo boolean NOT NULL DEFAULT true,
 atualizado_em timestamptz NOT NULL DEFAULT now(),
 created_at timestamptz NOT NULL DEFAULT now(),
 origem public.origem_dado NOT NULL DEFAULT 'manual',
 demo boolean NOT NULL DEFAULT false,
 UNIQUE (empresa_id, codigo_shop9)
);
REVOKE ALL ON public.produtos FROM anon, authenticated, public;
GRANT SELECT ON public.produtos TO authenticated;
GRANT ALL ON public.produtos TO service_role;
ALTER TABLE public.produtos ENABLE ROW LEVEL SECURITY;
CREATE POLICY leitura ON public.produtos FOR SELECT TO authenticated USING ((select public.tem_empresa(empresa_id)));
CREATE INDEX produtos_empresa_codigo_idx ON public.produtos (empresa_id, codigo_shop9 text_pattern_ops);
CREATE INDEX produtos_descricao_trgm_idx ON public.produtos USING gin (public.imutavel_unaccent(lower(descricao)) extensions.gin_trgm_ops);

CREATE OR REPLACE FUNCTION public.buscar_produtos(_empresa_id uuid, _termo text, _limite int DEFAULT 30)
RETURNS SETOF public.produtos LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public, extensions
AS $$
 WITH x AS (SELECT btrim(coalesce(_termo,'')) t),
 y AS (SELECT t, regexp_replace(t,'([\\%_])','\\\1','g') e, public.imutavel_unaccent(lower(t)) d FROM x)
 SELECT p.* FROM public.produtos p, y
 WHERE p.empresa_id=_empresa_id AND p.ativo AND y.t<>''
   AND (p.codigo_shop9=y.t OR p.codigo_shop9 LIKE y.e||'%' OR p.codigo_shop9 LIKE upper(y.e)||'%'
        OR y.d <% public.imutavel_unaccent(lower(p.descricao))
        OR public.imutavel_unaccent(lower(p.descricao)) LIKE '%'||regexp_replace(y.d,'([\\%_])','\\\1','g')||'%')
 ORDER BY CASE WHEN p.codigo_shop9=y.t OR upper(p.codigo_shop9)=upper(y.t) THEN 0
               WHEN upper(p.codigo_shop9) LIKE upper(y.e)||'%' THEN 1 ELSE 2 END,
          word_similarity(y.d, public.imutavel_unaccent(lower(p.descricao))) DESC, p.descricao
 LIMIT least(greatest(coalesce(_limite,30),1),100)
$$;

ALTER TABLE public.importacoes DROP CONSTRAINT importacoes_tipo_check;
ALTER TABLE public.importacoes ADD CONSTRAINT importacoes_tipo_check CHECK (tipo IN ('clientes','vendas','orcamentos','produtos'));

CREATE OR REPLACE FUNCTION public.importar_produtos(_empresa_id uuid, _arquivo text, _linhas jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE l jsonb; n int; cod text; des text; preco text; at text; ativo_ boolean; ins int:=0; upd int:=0; erros jsonb:='[]';
BEGIN
 IF auth.uid() IS NOT NULL AND NOT public.tem_setor('comercial') THEN RAISE EXCEPTION 'Sem acesso ao setor Comercial.' USING ERRCODE = '42501'; END IF;
 PERFORM public.importacao_validar(_empresa_id,_linhas);
 FOR l IN SELECT * FROM jsonb_array_elements(_linhas) LOOP
  n:=(l->>'linha')::int; cod:=nullif(btrim(l->>'codigo_shop9'),''); des:=nullif(btrim(l->>'descricao'),'');
  preco:=replace(btrim(coalesce(l->>'preco_tabela','')),',','.'); at:=lower(btrim(coalesce(l->>'ativo','')));
  IF cod IS NULL THEN erros:=erros||jsonb_build_object('linha',n,'campo','codigo_shop9','mensagem','Código do produto vazio.'); CONTINUE; END IF;
  IF des IS NULL THEN erros:=erros||jsonb_build_object('linha',n,'campo','descricao','mensagem','Descrição do produto vazia.'); CONTINUE; END IF;
  IF preco !~ '^\d{1,12}(\.\d{1,2})?$' THEN erros:=erros||jsonb_build_object('linha',n,'campo','preco_tabela','mensagem','Preço inválido: use um número igual ou maior que zero, com até 2 casas.'); CONTINUE; END IF;
  IF at IN ('','true','sim','s','1') THEN ativo_:=true; ELSIF at IN ('false','não','nao','n','0') THEN ativo_:=false;
  ELSE erros:=erros||jsonb_build_object('linha',n,'campo','ativo','mensagem','Ativo deve ser sim ou não.'); CONTINUE; END IF;
  IF EXISTS(SELECT 1 FROM public.produtos WHERE empresa_id=_empresa_id AND codigo_shop9=cod) THEN
   UPDATE public.produtos SET descricao=des, unidade=coalesce(nullif(btrim(l->>'unidade'),''),'UN'), preco_tabela=preco::numeric, ativo=ativo_, atualizado_em=now(), origem='importacao'
    WHERE empresa_id=_empresa_id AND codigo_shop9=cod; upd:=upd+1;
  ELSE
   INSERT INTO public.produtos(empresa_id,codigo_shop9,descricao,unidade,preco_tabela,ativo,origem,demo)
   VALUES(_empresa_id,cod,des,coalesce(nullif(btrim(l->>'unidade'),''),'UN'),preco::numeric,ativo_,'importacao',false); ins:=ins+1;
  END IF;
 END LOOP;
 RETURN public.importacao_registrar(_empresa_id,'produtos',_arquivo,jsonb_array_length(_linhas),ins,upd,erros);
END $$;

CREATE INDEX IF NOT EXISTS itens_venda_cliente_codigo_idx ON public.itens_venda (cliente_id, codigo_produto);

CREATE OR REPLACE FUNCTION public.produtos_comprados(_cliente_id uuid, _limite int DEFAULT 20)
RETURNS TABLE(codigo_shop9 text, descricao text, unidade text, preco_tabela numeric, ativo boolean, vezes int, quantidade_total numeric, ultima_compra date)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public
AS $$
 SELECT i.codigo_produto, coalesce(max(p.descricao), max(i.produto)), max(p.unidade), max(p.preco_tabela), bool_or(p.ativo),
        count(DISTINCT i.venda_id)::int, sum(i.quantidade), max(v.data_faturamento)
 FROM public.itens_venda i
 JOIN public.vendas v ON v.id=i.venda_id
 LEFT JOIN public.produtos p ON p.empresa_id=i.empresa_id AND p.codigo_shop9=i.codigo_produto
 WHERE i.cliente_id=_cliente_id AND i.codigo_produto IS NOT NULL
 GROUP BY i.codigo_produto
 ORDER BY max(v.data_faturamento) DESC, count(DISTINCT i.venda_id) DESC
 LIMIT least(greatest(coalesce(_limite,20),1),100)
$$;

-- 2. Limites de desconto
CREATE TABLE public.limites_desconto (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 empresa_id uuid NOT NULL REFERENCES public.empresas(id),
 vendedor_id uuid NOT NULL REFERENCES public.usuarios(id),
 limite_pct numeric(5,2) NOT NULL CHECK (limite_pct BETWEEN 0 AND 100),
 vigencia_inicio timestamptz NOT NULL DEFAULT now(),
 vigencia_fim timestamptz,
 definido_por uuid NOT NULL REFERENCES public.usuarios(id),
 motivo text,
 created_at timestamptz NOT NULL DEFAULT now(),
 origem public.origem_dado NOT NULL DEFAULT 'manual',
 demo boolean NOT NULL DEFAULT false
);
REVOKE ALL ON public.limites_desconto FROM anon, authenticated, public;
GRANT SELECT ON public.limites_desconto TO authenticated;
GRANT ALL ON public.limites_desconto TO service_role;
ALTER TABLE public.limites_desconto ENABLE ROW LEVEL SECURITY;
CREATE POLICY leitura ON public.limites_desconto FOR SELECT TO authenticated USING ((select public.tem_empresa(empresa_id)) AND public.pode_ver_vendedor(vendedor_id));
CREATE INDEX limites_desconto_vendedor_idx ON public.limites_desconto (vendedor_id, empresa_id, vigencia_inicio DESC);

CREATE OR REPLACE FUNCTION public.com_supervisiona(_vendedor_id uuid, _empresa_id uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
 SELECT public.has_role(auth.uid(),'supervisor',_empresa_id) AND EXISTS(
  SELECT 1 FROM public.usuarios v JOIN public.equipes e ON e.id=v.equipe_id
  WHERE v.id=_vendedor_id AND e.supervisor_id=public.meu_usuario_id() AND v.id<>public.meu_usuario_id())
$$;

CREATE OR REPLACE FUNCTION public.limite_desconto(_vendedor_id uuid, _empresa_id uuid) RETURNS numeric
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v numeric;
BEGIN
 IF auth.uid() IS NOT NULL AND NOT public.tem_setor('comercial') THEN RAISE EXCEPTION 'Sem acesso ao setor Comercial.' USING ERRCODE = '42501'; END IF;
 IF auth.uid() IS NOT NULL AND NOT public.pode_ver_vendedor(_vendedor_id) THEN RAISE EXCEPTION 'Sem permissão para ver este vendedor.' USING ERRCODE = '42501'; END IF;
 SELECT limite_pct INTO v FROM public.limites_desconto
  WHERE vendedor_id=_vendedor_id AND empresa_id=_empresa_id AND vigencia_inicio<=now() AND (vigencia_fim IS NULL OR vigencia_fim>now())
  ORDER BY vigencia_inicio DESC, created_at DESC LIMIT 1;
 IF v IS NOT NULL THEN RETURN v; END IF;
 IF EXISTS(SELECT 1 FROM public.user_roles r JOIN public.usuarios u ON u.auth_user_id=r.user_id
           WHERE u.id=_vendedor_id AND r.role='supervisor' AND (r.empresa_id=_empresa_id OR r.empresa_id IS NULL)) THEN
  RETURN public.gam_regra(_empresa_id,'desconto_padrao_supervisor',10);
 END IF;
 RETURN public.gam_regra(_empresa_id,'desconto_padrao_vendedor',5);
END $$;

CREATE OR REPLACE FUNCTION public.definir_limite_desconto(_vendedor_id uuid, _empresa_id uuid, _limite_pct numeric, _vigencia_fim timestamptz DEFAULT NULL, _motivo text DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE antigo numeric; novo uuid; dir boolean;
BEGIN
 IF auth.uid() IS NOT NULL AND NOT public.tem_setor('comercial') THEN RAISE EXCEPTION 'Sem acesso ao setor Comercial.' USING ERRCODE = '42501'; END IF;
 dir:=public.has_role(auth.uid(),'diretoria',_empresa_id);
 IF NOT dir AND NOT public.com_supervisiona(_vendedor_id,_empresa_id) THEN RAISE EXCEPTION 'Sem permissão para definir o limite deste vendedor.' USING ERRCODE='42501'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.usuario_empresas WHERE usuario_id=_vendedor_id AND empresa_id=_empresa_id) THEN RAISE EXCEPTION 'Vendedor não pertence a esta empresa.' USING ERRCODE='P0001'; END IF;
 IF _limite_pct IS NULL OR _limite_pct<0 OR _limite_pct>100 THEN RAISE EXCEPTION 'O limite deve ficar entre 0 e 100%%.' USING ERRCODE='P0001'; END IF;
 IF NOT dir AND _limite_pct>public.gam_regra(_empresa_id,'desconto_teto_supervisor',15) THEN RAISE EXCEPTION 'Acima do teto definido pela diretoria.' USING ERRCODE='P0001'; END IF;
 IF _vigencia_fim IS NOT NULL AND _vigencia_fim<=now() THEN RAISE EXCEPTION 'O fim da vigência precisa ser no futuro.' USING ERRCODE='P0001'; END IF;
 PERFORM pg_advisory_xact_lock(hashtext('limite:'||_vendedor_id));
 antigo:=public.limite_desconto(_vendedor_id,_empresa_id);
 UPDATE public.limites_desconto SET vigencia_fim=now()
  WHERE vendedor_id=_vendedor_id AND empresa_id=_empresa_id AND (vigencia_fim IS NULL OR vigencia_fim>now());
 INSERT INTO public.limites_desconto(empresa_id,vendedor_id,limite_pct,vigencia_fim,definido_por,motivo)
 VALUES(_empresa_id,_vendedor_id,_limite_pct,_vigencia_fim,public.meu_usuario_id(),nullif(btrim(_motivo),'')) RETURNING id INTO novo;
 PERFORM public.auditar('alteracao_limite_desconto','limites_desconto',novo,_empresa_id,_vendedor_id,
  jsonb_build_object('antigo',antigo,'novo',_limite_pct,'vigencia_fim',_vigencia_fim,'motivo',_motivo));
 RETURN novo;
END $$;

-- 4a. Motivos e carrinhos
CREATE TABLE public.motivos_cancelamento_carrinho (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 empresa_id uuid NOT NULL REFERENCES public.empresas(id),
 texto text NOT NULL,
 exige_texto boolean NOT NULL DEFAULT false,
 ativo boolean NOT NULL DEFAULT true,
 ordem int NOT NULL DEFAULT 0,
 created_at timestamptz NOT NULL DEFAULT now(),
 origem public.origem_dado NOT NULL DEFAULT 'manual',
 demo boolean NOT NULL DEFAULT false,
 UNIQUE (empresa_id, texto)
);
REVOKE ALL ON public.motivos_cancelamento_carrinho FROM anon, authenticated, public;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.motivos_cancelamento_carrinho TO authenticated;
GRANT ALL ON public.motivos_cancelamento_carrinho TO service_role;
ALTER TABLE public.motivos_cancelamento_carrinho ENABLE ROW LEVEL SECURITY;
CREATE POLICY leitura ON public.motivos_cancelamento_carrinho FOR SELECT TO authenticated USING ((select public.tem_empresa(empresa_id)));
CREATE POLICY diretoria_insere ON public.motivos_cancelamento_carrinho FOR INSERT TO authenticated WITH CHECK (public.has_role((select auth.uid()),'diretoria',empresa_id));
CREATE POLICY diretoria_altera ON public.motivos_cancelamento_carrinho FOR UPDATE TO authenticated USING (public.has_role((select auth.uid()),'diretoria',empresa_id)) WITH CHECK (public.has_role((select auth.uid()),'diretoria',empresa_id));
CREATE POLICY diretoria_apaga ON public.motivos_cancelamento_carrinho FOR DELETE TO authenticated USING (public.has_role((select auth.uid()),'diretoria',empresa_id));

CREATE TABLE public.carrinhos (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 empresa_id uuid NOT NULL REFERENCES public.empresas(id),
 vendedor_id uuid NOT NULL REFERENCES public.usuarios(id),
 cliente_id uuid NOT NULL REFERENCES public.clientes(id),
 estado text NOT NULL DEFAULT 'aberto' CHECK (estado IN ('aberto','concluido','cancelado')),
 total numeric(14,2) NOT NULL DEFAULT 0,
 motivo_cancelamento_id uuid REFERENCES public.motivos_cancelamento_carrinho(id),
 motivo_cancelamento_texto text,
 orcamento_id uuid REFERENCES public.orcamentos(id),
 concluido_em timestamptz,
 cancelado_em timestamptz,
 atualizado_em timestamptz NOT NULL DEFAULT now(),
 created_at timestamptz NOT NULL DEFAULT now(),
 origem public.origem_dado NOT NULL DEFAULT 'manual',
 demo boolean NOT NULL DEFAULT false,
 CHECK (estado <> 'cancelado' OR motivo_cancelamento_id IS NOT NULL)
);
REVOKE ALL ON public.carrinhos FROM anon, authenticated, public;
GRANT SELECT ON public.carrinhos TO authenticated;
GRANT ALL ON public.carrinhos TO service_role;
ALTER TABLE public.carrinhos ENABLE ROW LEVEL SECURITY;
CREATE POLICY leitura ON public.carrinhos FOR SELECT TO authenticated USING ((select public.tem_empresa(empresa_id)) AND public.pode_ver_vendedor(vendedor_id));
CREATE UNIQUE INDEX carrinhos_um_aberto_uidx ON public.carrinhos (vendedor_id, cliente_id) WHERE estado='aberto';
CREATE INDEX carrinhos_abertos_idx ON public.carrinhos (vendedor_id) WHERE estado='aberto';
CREATE INDEX carrinhos_cliente_idx ON public.carrinhos (cliente_id);

CREATE TABLE public.itens_carrinho (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 empresa_id uuid NOT NULL REFERENCES public.empresas(id),
 carrinho_id uuid NOT NULL REFERENCES public.carrinhos(id) ON DELETE CASCADE,
 produto_id uuid NOT NULL REFERENCES public.produtos(id),
 codigo_shop9 text NOT NULL,
 descricao text NOT NULL,
 unidade text NOT NULL,
 preco_unit numeric(14,2) NOT NULL CHECK (preco_unit >= 0),
 quantidade numeric(14,3) NOT NULL CHECK (quantidade > 0),
 desconto_pct numeric(5,2) NOT NULL DEFAULT 0 CHECK (desconto_pct BETWEEN 0 AND 100),
 total numeric(14,2) NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 origem public.origem_dado NOT NULL DEFAULT 'manual',
 demo boolean NOT NULL DEFAULT false,
 UNIQUE (carrinho_id, produto_id)
);
REVOKE ALL ON public.itens_carrinho FROM anon, authenticated, public;
GRANT SELECT ON public.itens_carrinho TO authenticated;
GRANT ALL ON public.itens_carrinho TO service_role;
ALTER TABLE public.itens_carrinho ENABLE ROW LEVEL SECURITY;
CREATE POLICY leitura ON public.itens_carrinho FOR SELECT TO authenticated USING ((select public.tem_empresa(empresa_id)) AND EXISTS(SELECT 1 FROM public.carrinhos c WHERE c.id=carrinho_id AND public.pode_ver_vendedor(c.vendedor_id)));
CREATE INDEX itens_carrinho_produto_idx ON public.itens_carrinho (produto_id);

-- 3. Liberações
CREATE TABLE public.liberacoes_desconto (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 empresa_id uuid NOT NULL REFERENCES public.empresas(id),
 vendedor_id uuid NOT NULL REFERENCES public.usuarios(id),
 cliente_id uuid NOT NULL REFERENCES public.clientes(id),
 carrinho_id uuid REFERENCES public.carrinhos(id) ON DELETE CASCADE,
 produto_id uuid REFERENCES public.produtos(id),
 desconto_pct numeric(5,2) NOT NULL CHECK (desconto_pct BETWEEN 0 AND 100),
 motivo text NOT NULL CHECK (length(btrim(motivo)) >= 5),
 estado text NOT NULL DEFAULT 'pendente' CHECK (estado IN ('pendente','aprovada','negada')),
 pct_aprovado numeric(5,2) CHECK (pct_aprovado BETWEEN 0 AND 100),
 valida_ate timestamptz,
 decidido_por uuid REFERENCES public.usuarios(id),
 decidido_em timestamptz,
 observacao_decisao text,
 created_at timestamptz NOT NULL DEFAULT now(),
 origem public.origem_dado NOT NULL DEFAULT 'manual',
 demo boolean NOT NULL DEFAULT false
);
REVOKE ALL ON public.liberacoes_desconto FROM anon, authenticated, public;
GRANT SELECT ON public.liberacoes_desconto TO authenticated;
GRANT ALL ON public.liberacoes_desconto TO service_role;
ALTER TABLE public.liberacoes_desconto ENABLE ROW LEVEL SECURITY;
CREATE POLICY leitura ON public.liberacoes_desconto FOR SELECT TO authenticated USING ((select public.tem_empresa(empresa_id)) AND public.pode_ver_vendedor(vendedor_id));
CREATE INDEX liberacoes_desconto_busca_idx ON public.liberacoes_desconto (vendedor_id, cliente_id, estado);

CREATE OR REPLACE FUNCTION public.solicitar_liberacao_desconto(_cliente_id uuid, _desconto_pct numeric, _motivo text, _carrinho_id uuid DEFAULT NULL, _produto_id uuid DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE cli public.clientes; eu uuid:=public.meu_usuario_id(); novo uuid;
BEGIN
 IF auth.uid() IS NOT NULL AND NOT public.tem_setor('comercial') THEN RAISE EXCEPTION 'Sem acesso ao setor Comercial.' USING ERRCODE = '42501'; END IF;
 SELECT * INTO cli FROM public.clientes WHERE id=_cliente_id;
 IF NOT FOUND OR eu IS NULL OR cli.vendedor_id IS DISTINCT FROM eu THEN RAISE EXCEPTION 'Só o vendedor dono do cliente pode pedir liberação.' USING ERRCODE='42501'; END IF;
 IF _desconto_pct IS NULL OR _desconto_pct<=0 OR _desconto_pct>100 THEN RAISE EXCEPTION 'O desconto deve ficar entre 0 e 100%%.' USING ERRCODE='P0001'; END IF;
 IF length(btrim(coalesce(_motivo,'')))<5 THEN RAISE EXCEPTION 'Explique o motivo com pelo menos 5 caracteres.' USING ERRCODE='P0001'; END IF;
 IF _carrinho_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.carrinhos WHERE id=_carrinho_id AND vendedor_id=eu AND cliente_id=_cliente_id) THEN RAISE EXCEPTION 'Carrinho não encontrado para este cliente.' USING ERRCODE='P0001'; END IF;
 IF _produto_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.produtos WHERE id=_produto_id AND empresa_id=cli.empresa_id) THEN RAISE EXCEPTION 'Produto não encontrado nesta empresa.' USING ERRCODE='P0001'; END IF;
 INSERT INTO public.liberacoes_desconto(empresa_id,vendedor_id,cliente_id,carrinho_id,produto_id,desconto_pct,motivo)
 VALUES(cli.empresa_id,eu,_cliente_id,_carrinho_id,_produto_id,_desconto_pct,btrim(_motivo)) RETURNING id INTO novo;
 PERFORM public.auditar('solicitacao_desconto','liberacoes_desconto',novo,cli.empresa_id,eu,jsonb_build_object('cliente_id',_cliente_id,'desconto_pct',_desconto_pct,'carrinho_id',_carrinho_id,'produto_id',_produto_id));
 RETURN novo;
END $$;

CREATE OR REPLACE FUNCTION public.decidir_liberacao_desconto(_id uuid, _aprovar boolean, _pct_aprovado numeric DEFAULT NULL, _valida_ate timestamptz DEFAULT NULL, _observacao text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE lib public.liberacoes_desconto; dir boolean; pct numeric; ate timestamptz;
BEGIN
 IF auth.uid() IS NOT NULL AND NOT public.tem_setor('comercial') THEN RAISE EXCEPTION 'Sem acesso ao setor Comercial.' USING ERRCODE = '42501'; END IF;
 SELECT * INTO lib FROM public.liberacoes_desconto WHERE id=_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Pedido de liberação não encontrado.' USING ERRCODE='P0001'; END IF;
 IF lib.vendedor_id=public.meu_usuario_id() THEN RAISE EXCEPTION 'Quem pediu a liberação não pode decidir.' USING ERRCODE='42501'; END IF;
 dir:=public.has_role(auth.uid(),'diretoria',lib.empresa_id);
 IF NOT dir AND NOT public.com_supervisiona(lib.vendedor_id,lib.empresa_id) THEN RAISE EXCEPTION 'Sem permissão para decidir este pedido.' USING ERRCODE='42501'; END IF;
 IF lib.estado<>'pendente' THEN RAISE EXCEPTION 'Este pedido já foi decidido.' USING ERRCODE='P0001'; END IF;
 IF _aprovar IS NULL THEN RAISE EXCEPTION 'Informe se aprova ou nega.' USING ERRCODE='P0001'; END IF;
 IF _aprovar THEN
  pct:=coalesce(_pct_aprovado,lib.desconto_pct); ate:=coalesce(_valida_ate,now()+interval '7 days');
  IF pct<=0 OR pct>100 THEN RAISE EXCEPTION 'O desconto aprovado deve ficar entre 0 e 100%%.' USING ERRCODE='P0001'; END IF;
  IF ate<=now() THEN RAISE EXCEPTION 'A validade precisa ser no futuro.' USING ERRCODE='P0001'; END IF;
  IF NOT dir AND pct>public.gam_regra(lib.empresa_id,'desconto_teto_supervisor',15) THEN RAISE EXCEPTION 'Acima do teto definido pela diretoria.' USING ERRCODE='P0001'; END IF;
  UPDATE public.liberacoes_desconto SET estado='aprovada',pct_aprovado=pct,valida_ate=ate,decidido_por=public.meu_usuario_id(),decidido_em=now(),observacao_decisao=nullif(btrim(_observacao),'') WHERE id=_id;
 ELSE
  UPDATE public.liberacoes_desconto SET estado='negada',decidido_por=public.meu_usuario_id(),decidido_em=now(),observacao_decisao=nullif(btrim(_observacao),'') WHERE id=_id;
 END IF;
 PERFORM public.auditar('decisao_desconto','liberacoes_desconto',_id,lib.empresa_id,lib.vendedor_id,jsonb_build_object('aprovada',_aprovar,'pedido',lib.desconto_pct,'aprovado',pct,'valida_ate',ate));
END $$;

CREATE OR REPLACE FUNCTION public.validar_desconto(_vendedor_id uuid, _empresa_id uuid, _cliente_id uuid, _carrinho_id uuid, _produto_id uuid, _desconto_pct numeric)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
 IF auth.uid() IS NOT NULL AND NOT public.tem_setor('comercial') THEN RAISE EXCEPTION 'Sem acesso ao setor Comercial.' USING ERRCODE = '42501'; END IF;
 IF auth.uid() IS NOT NULL AND NOT public.pode_ver_vendedor(_vendedor_id) THEN RAISE EXCEPTION 'Sem permissão para ver este vendedor.' USING ERRCODE = '42501'; END IF;
 IF coalesce(_desconto_pct,0)<=public.limite_desconto(_vendedor_id,_empresa_id) THEN RETURN true; END IF;
 RETURN EXISTS(SELECT 1 FROM public.liberacoes_desconto
  WHERE vendedor_id=_vendedor_id AND empresa_id=_empresa_id AND cliente_id=_cliente_id AND estado='aprovada'
    AND valida_ate>=now() AND pct_aprovado>=_desconto_pct
    AND (carrinho_id IS NULL OR carrinho_id=_carrinho_id) AND (produto_id IS NULL OR produto_id=_produto_id));
END $$;

-- 5. Orçamento da Rota
ALTER TABLE public.orcamentos
 ADD COLUMN origem_rota boolean NOT NULL DEFAULT false,
 ADD COLUMN chave_idempotencia text UNIQUE,
 ADD COLUMN carrinho_id uuid REFERENCES public.carrinhos(id),
 ADD COLUMN envio_estado text CHECK (envio_estado IN ('pendente','enviado','erro','confirmado')),
 ADD COLUMN envio_codigo_shop9 text;
CREATE INDEX orcamentos_envio_codigo_idx ON public.orcamentos (empresa_id, envio_codigo_shop9) WHERE envio_codigo_shop9 IS NOT NULL;

CREATE TABLE public.itens_orcamento (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 empresa_id uuid NOT NULL REFERENCES public.empresas(id),
 orcamento_id uuid NOT NULL REFERENCES public.orcamentos(id) ON DELETE CASCADE,
 produto_id uuid REFERENCES public.produtos(id),
 codigo_shop9 text NOT NULL,
 descricao text NOT NULL,
 unidade text NOT NULL,
 preco_unit numeric(14,2) NOT NULL,
 quantidade numeric(14,3) NOT NULL CHECK (quantidade > 0),
 desconto_pct numeric(5,2) NOT NULL DEFAULT 0 CHECK (desconto_pct BETWEEN 0 AND 100),
 total numeric(14,2) NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 origem public.origem_dado NOT NULL DEFAULT 'manual',
 demo boolean NOT NULL DEFAULT false
);
REVOKE ALL ON public.itens_orcamento FROM anon, authenticated, public;
GRANT SELECT ON public.itens_orcamento TO authenticated;
GRANT ALL ON public.itens_orcamento TO service_role;
ALTER TABLE public.itens_orcamento ENABLE ROW LEVEL SECURITY;
CREATE POLICY leitura ON public.itens_orcamento FOR SELECT TO authenticated USING ((select public.tem_empresa(empresa_id)) AND EXISTS(SELECT 1 FROM public.orcamentos o WHERE o.id=orcamento_id AND public.pode_ver_vendedor(o.vendedor_id)));
CREATE INDEX itens_orcamento_orcamento_idx ON public.itens_orcamento (orcamento_id);

-- 6. Fila Shop9
CREATE TABLE public.shop9_envios (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 empresa_id uuid NOT NULL REFERENCES public.empresas(id),
 orcamento_id uuid NOT NULL UNIQUE REFERENCES public.orcamentos(id),
 chave_idempotencia text NOT NULL UNIQUE,
 estado text NOT NULL DEFAULT 'pendente' CHECK (estado IN ('pendente','enviado','erro','confirmado')),
 tentativas int NOT NULL DEFAULT 0,
 ultimo_erro text,
 proxima_tentativa timestamptz NOT NULL DEFAULT now(),
 codigo_shop9 text,
 enviado_em timestamptz,
 confirmado_em timestamptz,
 atualizado_em timestamptz NOT NULL DEFAULT now(),
 created_at timestamptz NOT NULL DEFAULT now(),
 origem public.origem_dado NOT NULL DEFAULT 'manual',
 demo boolean NOT NULL DEFAULT false
);
REVOKE ALL ON public.shop9_envios FROM anon, authenticated, public;
GRANT SELECT ON public.shop9_envios TO authenticated;
GRANT ALL ON public.shop9_envios TO service_role;
ALTER TABLE public.shop9_envios ENABLE ROW LEVEL SECURITY;
CREATE POLICY leitura ON public.shop9_envios FOR SELECT TO authenticated USING ((select public.tem_empresa(empresa_id)) AND EXISTS(SELECT 1 FROM public.orcamentos o WHERE o.id=orcamento_id AND public.pode_ver_vendedor(o.vendedor_id)));
CREATE INDEX shop9_envios_fila_idx ON public.shop9_envios (estado, proxima_tentativa) WHERE estado IN ('pendente','erro');

CREATE OR REPLACE FUNCTION public.shop9_envio_transicao() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
 IF TG_OP='UPDATE' THEN
  IF NEW.estado IS DISTINCT FROM OLD.estado AND NOT (
     (OLD.estado='pendente' AND NEW.estado IN ('enviado','erro')) OR
     (OLD.estado='erro' AND NEW.estado IN ('enviado','erro')) OR
     (OLD.estado='enviado' AND NEW.estado IN ('confirmado','erro'))) THEN
   RAISE EXCEPTION 'Mudança de situação de envio inválida: % → %.', OLD.estado, NEW.estado USING ERRCODE='P0001';
  END IF;
  NEW.atualizado_em:=now();
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER shop9_envios_transicao BEFORE UPDATE ON public.shop9_envios FOR EACH ROW EXECUTE FUNCTION public.shop9_envio_transicao();

CREATE OR REPLACE FUNCTION public.shop9_envio_espelhar() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
 UPDATE public.orcamentos SET envio_estado=NEW.estado WHERE id=NEW.orcamento_id AND envio_estado IS DISTINCT FROM NEW.estado;
 RETURN NULL;
END $$;
CREATE TRIGGER shop9_envios_espelhar AFTER INSERT OR UPDATE OF estado ON public.shop9_envios FOR EACH ROW EXECUTE FUNCTION public.shop9_envio_espelhar();

-- 4b. Funções do carrinho
CREATE OR REPLACE FUNCTION public.carrinho_recalcular(_carrinho_id uuid) RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
 UPDATE public.carrinhos SET total=coalesce((SELECT sum(total) FROM public.itens_carrinho WHERE carrinho_id=_carrinho_id),0), atualizado_em=now() WHERE id=_carrinho_id;
$$;
CREATE OR REPLACE FUNCTION public.carrinho_travar_aberto(_carrinho_id uuid) RETURNS public.carrinhos LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE c public.carrinhos;
BEGIN
 SELECT * INTO c FROM public.carrinhos WHERE id=_carrinho_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Carrinho não encontrado.' USING ERRCODE='P0001'; END IF;
 IF c.vendedor_id IS DISTINCT FROM public.meu_usuario_id() THEN RAISE EXCEPTION 'Só o vendedor dono pode alterar este carrinho.' USING ERRCODE='42501'; END IF;
 IF c.estado<>'aberto' THEN RAISE EXCEPTION 'Este carrinho não está mais aberto.' USING ERRCODE='P0001'; END IF;
 RETURN c;
END $$;
CREATE OR REPLACE FUNCTION public.carrinho_checar_item(_q numeric, _d numeric) RETURNS void LANGUAGE plpgsql IMMUTABLE SET search_path = public AS $$
BEGIN
 IF _q IS NULL OR _q<=0 THEN RAISE EXCEPTION 'A quantidade precisa ser maior que zero.' USING ERRCODE='P0001'; END IF;
 IF _q<>round(_q,3) THEN RAISE EXCEPTION 'Use no máximo 3 casas na quantidade.' USING ERRCODE='P0001'; END IF;
 IF _d IS NULL OR _d<0 OR _d>100 THEN RAISE EXCEPTION 'O desconto deve ficar entre 0 e 100%%.' USING ERRCODE='P0001'; END IF;
 IF _d<>round(_d,2) THEN RAISE EXCEPTION 'Use no máximo 2 casas no desconto.' USING ERRCODE='P0001'; END IF;
END $$;

CREATE OR REPLACE FUNCTION public.abrir_carrinho(_cliente_id uuid) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE eu uuid:=public.meu_usuario_id(); cli public.clientes; existente uuid; abertos int; maximo numeric; novo uuid;
BEGIN
 IF auth.uid() IS NOT NULL AND NOT public.tem_setor('comercial') THEN RAISE EXCEPTION 'Sem acesso ao setor Comercial.' USING ERRCODE = '42501'; END IF;
 SELECT * INTO cli FROM public.clientes WHERE id=_cliente_id;
 IF NOT FOUND OR eu IS NULL OR cli.vendedor_id IS DISTINCT FROM eu THEN RAISE EXCEPTION 'Só o vendedor dono do cliente pode abrir carrinho.' USING ERRCODE='42501'; END IF;
 PERFORM pg_advisory_xact_lock(hashtext('carrinho:'||eu));
 SELECT id INTO existente FROM public.carrinhos WHERE vendedor_id=eu AND cliente_id=_cliente_id AND estado='aberto';
 IF existente IS NOT NULL THEN RETURN existente; END IF;
 maximo:=public.gam_regra(cli.empresa_id,'carrinho_max_abertos',3);
 SELECT count(*) INTO abertos FROM public.carrinhos WHERE vendedor_id=eu AND estado='aberto';
 IF abertos>=maximo THEN RAISE EXCEPTION 'Você já tem % carrinhos abertos. Conclua ou cancele um.', trim_scale(maximo) USING ERRCODE='P0001'; END IF;
 BEGIN
  INSERT INTO public.carrinhos(empresa_id,vendedor_id,cliente_id) VALUES(cli.empresa_id,eu,_cliente_id) RETURNING id INTO novo;
 EXCEPTION WHEN unique_violation THEN
  SELECT id INTO novo FROM public.carrinhos WHERE vendedor_id=eu AND cliente_id=_cliente_id AND estado='aberto';
 END;
 RETURN novo;
END $$;

CREATE OR REPLACE FUNCTION public.adicionar_item_carrinho(_carrinho_id uuid, _produto_id uuid, _quantidade numeric, _desconto_pct numeric DEFAULT 0)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE c public.carrinhos; p public.produtos; it public.itens_carrinho; q numeric; d numeric:=coalesce(_desconto_pct,0); rid uuid;
BEGIN
 IF auth.uid() IS NOT NULL AND NOT public.tem_setor('comercial') THEN RAISE EXCEPTION 'Sem acesso ao setor Comercial.' USING ERRCODE = '42501'; END IF;
 c:=public.carrinho_travar_aberto(_carrinho_id);
 PERFORM public.carrinho_checar_item(_quantidade,d);
 SELECT * INTO p FROM public.produtos WHERE id=_produto_id AND empresa_id=c.empresa_id AND ativo;
 IF NOT FOUND THEN RAISE EXCEPTION 'Produto não encontrado ou inativo.' USING ERRCODE='P0001'; END IF;
 IF NOT public.validar_desconto(c.vendedor_id,c.empresa_id,c.cliente_id,c.id,p.id,d) THEN RAISE EXCEPTION 'Desconto acima do seu limite: peça liberação.' USING ERRCODE='P0001'; END IF;
 SELECT * INTO it FROM public.itens_carrinho WHERE carrinho_id=c.id AND produto_id=p.id;
 IF FOUND THEN
  q:=it.quantidade+_quantidade;
  UPDATE public.itens_carrinho SET quantidade=q, desconto_pct=d, total=round(it.preco_unit*q*(1-d/100),2) WHERE id=it.id RETURNING id INTO rid;
 ELSE
  INSERT INTO public.itens_carrinho(empresa_id,carrinho_id,produto_id,codigo_shop9,descricao,unidade,preco_unit,quantidade,desconto_pct,total)
  VALUES(c.empresa_id,c.id,p.id,p.codigo_shop9,p.descricao,p.unidade,p.preco_tabela,_quantidade,d,round(p.preco_tabela*_quantidade*(1-d/100),2)) RETURNING id INTO rid;
 END IF;
 PERFORM public.carrinho_recalcular(c.id);
 RETURN rid;
END $$;

CREATE OR REPLACE FUNCTION public.alterar_item_carrinho(_item_id uuid, _quantidade numeric, _desconto_pct numeric)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE it public.itens_carrinho; c public.carrinhos; d numeric:=coalesce(_desconto_pct,0);
BEGIN
 IF auth.uid() IS NOT NULL AND NOT public.tem_setor('comercial') THEN RAISE EXCEPTION 'Sem acesso ao setor Comercial.' USING ERRCODE = '42501'; END IF;
 SELECT * INTO it FROM public.itens_carrinho WHERE id=_item_id;
 IF NOT FOUND THEN RAISE EXCEPTION 'Item não encontrado.' USING ERRCODE='P0001'; END IF;
 c:=public.carrinho_travar_aberto(it.carrinho_id);
 PERFORM public.carrinho_checar_item(_quantidade,d);
 IF NOT public.validar_desconto(c.vendedor_id,c.empresa_id,c.cliente_id,c.id,it.produto_id,d) THEN RAISE EXCEPTION 'Desconto acima do seu limite: peça liberação.' USING ERRCODE='P0001'; END IF;
 UPDATE public.itens_carrinho SET quantidade=_quantidade, desconto_pct=d, total=round(preco_unit*_quantidade*(1-d/100),2) WHERE id=_item_id;
 PERFORM public.carrinho_recalcular(c.id);
END $$;

CREATE OR REPLACE FUNCTION public.remover_item_carrinho(_item_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE it public.itens_carrinho; c public.carrinhos;
BEGIN
 IF auth.uid() IS NOT NULL AND NOT public.tem_setor('comercial') THEN RAISE EXCEPTION 'Sem acesso ao setor Comercial.' USING ERRCODE = '42501'; END IF;
 SELECT * INTO it FROM public.itens_carrinho WHERE id=_item_id;
 IF NOT FOUND THEN RAISE EXCEPTION 'Item não encontrado.' USING ERRCODE='P0001'; END IF;
 c:=public.carrinho_travar_aberto(it.carrinho_id);
 DELETE FROM public.itens_carrinho WHERE id=_item_id;
 PERFORM public.carrinho_recalcular(c.id);
END $$;

CREATE OR REPLACE FUNCTION public.cancelar_carrinho(_carrinho_id uuid, _motivo_id uuid, _texto text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE c public.carrinhos; m public.motivos_cancelamento_carrinho;
BEGIN
 IF auth.uid() IS NOT NULL AND NOT public.tem_setor('comercial') THEN RAISE EXCEPTION 'Sem acesso ao setor Comercial.' USING ERRCODE = '42501'; END IF;
 c:=public.carrinho_travar_aberto(_carrinho_id);
 SELECT * INTO m FROM public.motivos_cancelamento_carrinho WHERE id=_motivo_id AND empresa_id=c.empresa_id AND ativo;
 IF NOT FOUND THEN RAISE EXCEPTION 'Escolha um motivo de cancelamento.' USING ERRCODE='P0001'; END IF;
 IF m.exige_texto AND length(btrim(coalesce(_texto,'')))<5 THEN RAISE EXCEPTION 'Descreva o motivo com pelo menos 5 caracteres.' USING ERRCODE='P0001'; END IF;
 UPDATE public.carrinhos SET estado='cancelado', motivo_cancelamento_id=m.id, motivo_cancelamento_texto=nullif(btrim(_texto),''), cancelado_em=now(), atualizado_em=now() WHERE id=c.id;
 PERFORM public.auditar('cancelamento_carrinho','carrinhos',c.id,c.empresa_id,c.vendedor_id,jsonb_build_object('motivo',m.texto,'texto',nullif(btrim(_texto),''),'total',c.total));
END $$;

CREATE OR REPLACE FUNCTION public.concluir_carrinho(_carrinho_id uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE c public.carrinhos; it record; chave text:='rota:carrinho:'||_carrinho_id; orc uuid; hoje date:=(now() AT TIME ZONE 'America/Maceio')::date;
BEGIN
 IF auth.uid() IS NOT NULL AND NOT public.tem_setor('comercial') THEN RAISE EXCEPTION 'Sem acesso ao setor Comercial.' USING ERRCODE = '42501'; END IF;
 SELECT * INTO c FROM public.carrinhos WHERE id=_carrinho_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Carrinho não encontrado.' USING ERRCODE='P0001'; END IF;
 IF c.vendedor_id IS DISTINCT FROM public.meu_usuario_id() THEN RAISE EXCEPTION 'Só o vendedor dono pode concluir este carrinho.' USING ERRCODE='42501'; END IF;
 IF c.estado='concluido' THEN RETURN c.orcamento_id; END IF;
 IF c.estado='cancelado' THEN RAISE EXCEPTION 'Este carrinho foi cancelado.' USING ERRCODE='P0001'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.itens_carrinho WHERE carrinho_id=c.id) THEN RAISE EXCEPTION 'Adicione pelo menos um item antes de concluir.' USING ERRCODE='P0001'; END IF;
 FOR it IN SELECT * FROM public.itens_carrinho WHERE carrinho_id=c.id LOOP
  IF NOT public.validar_desconto(c.vendedor_id,c.empresa_id,c.cliente_id,c.id,it.produto_id,it.desconto_pct) THEN
   RAISE EXCEPTION 'Desconto acima do seu limite: peça liberação.' USING ERRCODE='P0001'; END IF;
 END LOOP;
 PERFORM public.carrinho_recalcular(c.id);
 SELECT total INTO c.total FROM public.carrinhos WHERE id=c.id;
 INSERT INTO public.orcamentos(empresa_id,cliente_id,vendedor_id,status,data,valor,origem,demo,origem_rota,chave_idempotencia,carrinho_id,envio_estado)
 VALUES(c.empresa_id,c.cliente_id,c.vendedor_id,'aberto',hoje,c.total,'manual',false,true,chave,c.id,'pendente')
 ON CONFLICT (chave_idempotencia) DO NOTHING RETURNING id INTO orc;
 IF orc IS NULL THEN SELECT id INTO orc FROM public.orcamentos WHERE chave_idempotencia=chave;
 ELSE
  INSERT INTO public.itens_orcamento(empresa_id,orcamento_id,produto_id,codigo_shop9,descricao,unidade,preco_unit,quantidade,desconto_pct,total)
  SELECT empresa_id,orc,produto_id,codigo_shop9,descricao,unidade,preco_unit,quantidade,desconto_pct,total FROM public.itens_carrinho WHERE carrinho_id=c.id;
 END IF;
 INSERT INTO public.shop9_envios(empresa_id,orcamento_id,chave_idempotencia) VALUES(c.empresa_id,orc,chave) ON CONFLICT DO NOTHING;
 UPDATE public.carrinhos SET estado='concluido', orcamento_id=orc, concluido_em=now(), atualizado_em=now() WHERE id=c.id;
 PERFORM public.auditar('conclusao_carrinho','carrinhos',c.id,c.empresa_id,c.vendedor_id,jsonb_build_object('orcamento_id',orc,'total',c.total));
 RETURN orc;
END $$;

-- 6b. Funções do Shop9
CREATE OR REPLACE FUNCTION public.shop9_pendentes(_empresa_id uuid) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
 IF auth.uid() IS NOT NULL AND NOT public.tem_setor('comercial') THEN RAISE EXCEPTION 'Sem acesso ao setor Comercial.' USING ERRCODE = '42501'; END IF;
 IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(),'diretoria',_empresa_id) THEN RAISE EXCEPTION 'Apenas a diretoria pode ver a fila do Shop9.' USING ERRCODE='42501'; END IF;
 RETURN coalesce((SELECT jsonb_agg(jsonb_build_object(
   'id',o.id,'chave_idempotencia',e.chave_idempotencia,'cliente_codigo',c.codigo_shop9,'data',o.data,'vendedor_email',u.email,
   'itens',(SELECT coalesce(jsonb_agg(jsonb_build_object('codigo_produto',i.codigo_shop9,'descricao',i.descricao,'unidade',i.unidade,'quantidade',i.quantidade,'preco_unit',i.preco_unit,'desconto_pct',i.desconto_pct,'total',i.total) ORDER BY i.created_at, i.codigo_shop9),'[]') FROM public.itens_orcamento i WHERE i.orcamento_id=o.id)
  ) ORDER BY e.created_at)
  FROM public.shop9_envios e JOIN public.orcamentos o ON o.id=e.orcamento_id JOIN public.clientes c ON c.id=o.cliente_id LEFT JOIN public.usuarios u ON u.id=o.vendedor_id
  WHERE e.empresa_id=_empresa_id AND e.estado IN ('pendente','erro')),'[]'::jsonb);
END $$;

CREATE OR REPLACE FUNCTION public.shop9_marcar_enviado(_orcamento_id uuid, _codigo_shop9 text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE e public.shop9_envios; cod text:=nullif(btrim(_codigo_shop9),'');
BEGIN
 IF auth.uid() IS NOT NULL AND NOT public.tem_setor('comercial') THEN RAISE EXCEPTION 'Sem acesso ao setor Comercial.' USING ERRCODE = '42501'; END IF;
 SELECT * INTO e FROM public.shop9_envios WHERE orcamento_id=_orcamento_id FOR UPDATE;
 IF NOT FOUND THEN
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(),'diretoria') THEN RAISE EXCEPTION 'Apenas a diretoria pode registrar envio ao Shop9.' USING ERRCODE='42501'; END IF;
  RAISE EXCEPTION 'Orçamento não está na fila do Shop9.' USING ERRCODE='P0001';
 END IF;
 IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(),'diretoria',e.empresa_id) THEN RAISE EXCEPTION 'Apenas a diretoria pode registrar envio ao Shop9.' USING ERRCODE='42501'; END IF;
 IF cod IS NULL THEN RAISE EXCEPTION 'Informe o código do orçamento no Shop9.' USING ERRCODE='P0001'; END IF;
 IF e.estado IN ('enviado','confirmado') THEN
  IF e.codigo_shop9=cod THEN RETURN; END IF;
  RAISE EXCEPTION 'Este orçamento já foi enviado com outro código.' USING ERRCODE='P0001';
 END IF;
 IF EXISTS(SELECT 1 FROM public.orcamentos WHERE empresa_id=e.empresa_id AND id<>_orcamento_id AND (codigo_shop9=cod OR envio_codigo_shop9=cod)) THEN
  RAISE EXCEPTION 'Este código do Shop9 já está em outro orçamento.' USING ERRCODE='P0001'; END IF;
 UPDATE public.shop9_envios SET estado='enviado', codigo_shop9=cod, enviado_em=now() WHERE id=e.id;
 UPDATE public.orcamentos SET envio_codigo_shop9=cod WHERE id=_orcamento_id;
 PERFORM public.auditar('shop9_envio_manual','shop9_envios',e.id,e.empresa_id,(SELECT vendedor_id FROM public.orcamentos WHERE id=_orcamento_id),jsonb_build_object('orcamento_id',_orcamento_id,'codigo_shop9',cod,'estado_anterior',e.estado));
END $$;

CREATE OR REPLACE FUNCTION public.shop9_registrar_tentativa(_envio_id uuid, _ok boolean, _codigo_shop9 text DEFAULT NULL, _erro text DEFAULT NULL) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE e public.shop9_envios; cod text:=nullif(btrim(_codigo_shop9),''); t int;
BEGIN
 IF auth.uid() IS NOT NULL AND NOT public.tem_setor('comercial') THEN RAISE EXCEPTION 'Sem acesso ao setor Comercial.' USING ERRCODE = '42501'; END IF;
 SELECT * INTO e FROM public.shop9_envios WHERE id=_envio_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Envio não encontrado.' USING ERRCODE='P0001'; END IF;
 IF _ok THEN
  IF cod IS NULL THEN RAISE EXCEPTION 'Envio com sucesso precisa do código do Shop9.' USING ERRCODE='P0001'; END IF;
  UPDATE public.shop9_envios SET estado='enviado', codigo_shop9=cod, enviado_em=now(), ultimo_erro=NULL WHERE id=e.id;
  UPDATE public.orcamentos SET envio_codigo_shop9=cod WHERE id=e.orcamento_id;
 ELSE
  t:=e.tentativas+1;
  UPDATE public.shop9_envios SET estado='erro', tentativas=t, ultimo_erro=left(coalesce(_erro,'Erro sem detalhe.'),2000),
   proxima_tentativa=now()+least(60,2^t)*interval '1 minute' WHERE id=e.id;
 END IF;
END $$;

-- 5b. Confirmação pela importação de orçamentos
CREATE OR REPLACE FUNCTION public.importar_orcamentos(_empresa_id uuid, _arquivo text, _linhas jsonb)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE l jsonb; n int; cod text; cli public.clientes; oid_ uuid; ins int:=0; upd int:=0; erros jsonb:='[]'; st text;
BEGIN
 PERFORM public.importacao_validar(_empresa_id,_linhas);
 IF auth.uid() IS NOT NULL AND NOT public.tem_setor('comercial') THEN RAISE EXCEPTION 'Sem acesso ao setor Comercial.' USING ERRCODE = '42501'; END IF;
 FOR l IN SELECT * FROM jsonb_array_elements(_linhas) LOOP
  n:=(l->>'linha')::int; cod:=nullif(btrim(l->>'codigo_shop9'),''); st:=lower(btrim(l->>'status'));
  IF cod IS NULL THEN erros:=erros||jsonb_build_object('linha',n,'campo','codigo_shop9','mensagem','Número do orçamento vazio.'); CONTINUE; END IF;
  IF st IS NULL OR st NOT IN ('aberto','ganho','perdido') THEN erros:=erros||jsonb_build_object('linha',n,'campo','status','mensagem','Situação deve ser aberto, ganho ou perdido.'); CONTINUE; END IF;
  SELECT id INTO oid_ FROM public.orcamentos WHERE empresa_id=_empresa_id AND origem_rota AND envio_codigo_shop9=cod LIMIT 1;
  IF oid_ IS NOT NULL THEN
   UPDATE public.orcamentos SET codigo_shop9=cod, status=st, valor=coalesce((l->>'valor')::numeric,valor) WHERE id=oid_;
   UPDATE public.shop9_envios SET estado='confirmado', confirmado_em=now() WHERE orcamento_id=oid_ AND estado='enviado';
   upd:=upd+1; CONTINUE;
  END IF;
  SELECT * INTO cli FROM public.clientes WHERE empresa_id=_empresa_id AND codigo_shop9=btrim(l->>'cliente_codigo');
  IF NOT FOUND THEN erros:=erros||jsonb_build_object('linha',n,'campo','cliente_codigo','mensagem','Cliente não encontrado.'); CONTINUE; END IF;
  SELECT id INTO oid_ FROM public.orcamentos WHERE empresa_id=_empresa_id AND codigo_shop9=cod;
  IF oid_ IS NULL THEN
   INSERT INTO public.orcamentos(empresa_id,cliente_id,vendedor_id,codigo_shop9,data,valor,status,origem,demo)
   VALUES(_empresa_id,cli.id,cli.vendedor_id,cod,(l->>'data')::date,(l->>'valor')::numeric,st,'importacao',false); ins:=ins+1;
  ELSE
   UPDATE public.orcamentos SET cliente_id=cli.id,vendedor_id=cli.vendedor_id,data=(l->>'data')::date,valor=(l->>'valor')::numeric,status=st,origem='importacao' WHERE id=oid_; upd:=upd+1;
  END IF;
 END LOOP;
 RETURN public.importacao_registrar(_empresa_id,'orcamentos',_arquivo,jsonb_array_length(_linhas),ins,upd,erros);
END $function$;

-- Trava RESTRICTIVE do setor Comercial em todas as tabelas novas
CREATE POLICY setor_comercial ON public.produtos AS RESTRICTIVE FOR ALL TO authenticated USING ((select public.tem_setor('comercial'))) WITH CHECK ((select public.tem_setor('comercial')));
CREATE POLICY setor_comercial ON public.limites_desconto AS RESTRICTIVE FOR ALL TO authenticated USING ((select public.tem_setor('comercial'))) WITH CHECK ((select public.tem_setor('comercial')));
CREATE POLICY setor_comercial ON public.liberacoes_desconto AS RESTRICTIVE FOR ALL TO authenticated USING ((select public.tem_setor('comercial'))) WITH CHECK ((select public.tem_setor('comercial')));
CREATE POLICY setor_comercial ON public.motivos_cancelamento_carrinho AS RESTRICTIVE FOR ALL TO authenticated USING ((select public.tem_setor('comercial'))) WITH CHECK ((select public.tem_setor('comercial')));
CREATE POLICY setor_comercial ON public.carrinhos AS RESTRICTIVE FOR ALL TO authenticated USING ((select public.tem_setor('comercial'))) WITH CHECK ((select public.tem_setor('comercial')));
CREATE POLICY setor_comercial ON public.itens_carrinho AS RESTRICTIVE FOR ALL TO authenticated USING ((select public.tem_setor('comercial'))) WITH CHECK ((select public.tem_setor('comercial')));
CREATE POLICY setor_comercial ON public.itens_orcamento AS RESTRICTIVE FOR ALL TO authenticated USING ((select public.tem_setor('comercial'))) WITH CHECK ((select public.tem_setor('comercial')));
CREATE POLICY setor_comercial ON public.shop9_envios AS RESTRICTIVE FOR ALL TO authenticated USING ((select public.tem_setor('comercial'))) WITH CHECK ((select public.tem_setor('comercial')));

-- Permissões de execução
REVOKE ALL ON FUNCTION public.com_supervisiona(uuid,uuid), public.carrinho_recalcular(uuid), public.carrinho_travar_aberto(uuid),
 public.carrinho_checar_item(numeric,numeric), public.shop9_envio_transicao(), public.shop9_envio_espelhar() FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.buscar_produtos(uuid,text,int), public.produtos_comprados(uuid,int), public.importar_produtos(uuid,text,jsonb),
 public.limite_desconto(uuid,uuid), public.definir_limite_desconto(uuid,uuid,numeric,timestamptz,text),
 public.solicitar_liberacao_desconto(uuid,numeric,text,uuid,uuid), public.decidir_liberacao_desconto(uuid,boolean,numeric,timestamptz,text),
 public.validar_desconto(uuid,uuid,uuid,uuid,uuid,numeric), public.abrir_carrinho(uuid), public.adicionar_item_carrinho(uuid,uuid,numeric,numeric),
 public.alterar_item_carrinho(uuid,numeric,numeric), public.remover_item_carrinho(uuid), public.cancelar_carrinho(uuid,uuid,text),
 public.concluir_carrinho(uuid), public.shop9_pendentes(uuid), public.shop9_marcar_enviado(uuid,text), public.imutavel_unaccent(text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.buscar_produtos(uuid,text,int), public.produtos_comprados(uuid,int), public.importar_produtos(uuid,text,jsonb),
 public.limite_desconto(uuid,uuid), public.definir_limite_desconto(uuid,uuid,numeric,timestamptz,text),
 public.solicitar_liberacao_desconto(uuid,numeric,text,uuid,uuid), public.decidir_liberacao_desconto(uuid,boolean,numeric,timestamptz,text),
 public.validar_desconto(uuid,uuid,uuid,uuid,uuid,numeric), public.abrir_carrinho(uuid), public.adicionar_item_carrinho(uuid,uuid,numeric,numeric),
 public.alterar_item_carrinho(uuid,numeric,numeric), public.remover_item_carrinho(uuid), public.cancelar_carrinho(uuid,uuid,text),
 public.concluir_carrinho(uuid), public.shop9_pendentes(uuid), public.shop9_marcar_enviado(uuid,text), public.imutavel_unaccent(text) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.shop9_registrar_tentativa(uuid,boolean,text,text) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.shop9_registrar_tentativa(uuid,boolean,text,text) TO service_role;
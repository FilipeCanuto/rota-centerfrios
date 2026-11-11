-- Base para a ficha 360 de clientes e para a importação do Shop9.
ALTER TABLE public.clientes ADD COLUMN IF NOT EXISTS codigo_shop9 text, ADD COLUMN IF NOT EXISTS documento text, ADD COLUMN IF NOT EXISTS email text, ADD COLUMN IF NOT EXISTS etiquetas text[] NOT NULL DEFAULT '{}';
ALTER TABLE public.clientes ADD CONSTRAINT clientes_documento_digitos CHECK (documento IS NULL OR documento ~ '^[0-9]+$');
CREATE UNIQUE INDEX IF NOT EXISTS clientes_empresa_codigo_shop9_uidx ON public.clientes(empresa_id,codigo_shop9) WHERE codigo_shop9 IS NOT NULL;
CREATE INDEX IF NOT EXISTS clientes_etiquetas_gin ON public.clientes USING gin(etiquetas);
ALTER TABLE public.vendas ADD COLUMN IF NOT EXISTS codigo_shop9 text;
CREATE UNIQUE INDEX IF NOT EXISTS vendas_empresa_codigo_shop9_uidx ON public.vendas(empresa_id,codigo_shop9) WHERE codigo_shop9 IS NOT NULL;
ALTER TABLE public.orcamentos ADD COLUMN IF NOT EXISTS codigo_shop9 text, ADD COLUMN IF NOT EXISTS proximo_followup date, ADD COLUMN IF NOT EXISTS observacao text;
CREATE UNIQUE INDEX IF NOT EXISTS orcamentos_empresa_codigo_shop9_uidx ON public.orcamentos(empresa_id,codigo_shop9) WHERE codigo_shop9 IS NOT NULL;

-- Etiquetas: único campo de clientes alterável pela API, na carteira visível.
REVOKE UPDATE ON public.clientes FROM authenticated;
GRANT UPDATE(etiquetas) ON public.clientes TO authenticated;
CREATE POLICY clientes_update_etiquetas ON public.clientes FOR UPDATE TO authenticated
 USING (public.tem_empresa(empresa_id) AND public.pode_ver_vendedor(vendedor_id))
 WITH CHECK (public.tem_empresa(empresa_id) AND public.pode_ver_vendedor(vendedor_id));
GRANT UPDATE(proximo_followup,observacao) ON public.orcamentos TO authenticated;

-- Itens das vendas (escrita só service_role / funções de importação).
CREATE TABLE public.itens_venda(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 empresa_id uuid NOT NULL REFERENCES public.empresas(id),
 venda_id uuid NOT NULL REFERENCES public.vendas(id) ON DELETE CASCADE,
 cliente_id uuid NOT NULL REFERENCES public.clientes(id),
 vendedor_id uuid REFERENCES public.usuarios(id),
 produto text NOT NULL, codigo_produto text,
 quantidade numeric NOT NULL DEFAULT 1, valor_total numeric NOT NULL DEFAULT 0,
 origem public.origem_dado NOT NULL DEFAULT 'manual', demo boolean NOT NULL DEFAULT false,
 created_at timestamptz NOT NULL DEFAULT now());
GRANT SELECT ON public.itens_venda TO authenticated;
GRANT ALL ON public.itens_venda TO service_role;
ALTER TABLE public.itens_venda ENABLE ROW LEVEL SECURITY;
CREATE POLICY itens_venda_select ON public.itens_venda FOR SELECT TO authenticated USING (public.tem_empresa(empresa_id) AND public.pode_ver_vendedor(vendedor_id));
CREATE INDEX itens_venda_cliente_idx ON public.itens_venda(cliente_id);
CREATE INDEX itens_venda_venda_idx ON public.itens_venda(venda_id);

-- Notas do cliente.
CREATE TABLE public.notas_cliente(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 empresa_id uuid NOT NULL REFERENCES public.empresas(id),
 cliente_id uuid NOT NULL REFERENCES public.clientes(id),
 vendedor_id uuid REFERENCES public.usuarios(id),
 autor_id uuid REFERENCES public.usuarios(id) DEFAULT public.meu_usuario_id(),
 texto text NOT NULL CHECK (char_length(btrim(texto)) BETWEEN 1 AND 2000),
 origem public.origem_dado NOT NULL DEFAULT 'manual', demo boolean NOT NULL DEFAULT false,
 created_at timestamptz NOT NULL DEFAULT now());
GRANT SELECT, INSERT, DELETE ON public.notas_cliente TO authenticated;
GRANT ALL ON public.notas_cliente TO service_role;
ALTER TABLE public.notas_cliente ENABLE ROW LEVEL SECURITY;
CREATE POLICY notas_cliente_select ON public.notas_cliente FOR SELECT TO authenticated USING (public.tem_empresa(empresa_id) AND public.pode_ver_vendedor(vendedor_id));
CREATE POLICY notas_cliente_insert ON public.notas_cliente FOR INSERT TO authenticated WITH CHECK (
 autor_id=(select public.meu_usuario_id()) AND demo=false AND public.tem_empresa(empresa_id) AND public.pode_ver_vendedor(vendedor_id)
 AND EXISTS(SELECT 1 FROM public.clientes c WHERE c.id=cliente_id AND c.empresa_id=notas_cliente.empresa_id AND c.vendedor_id IS NOT DISTINCT FROM notas_cliente.vendedor_id));
CREATE POLICY notas_cliente_delete ON public.notas_cliente FOR DELETE TO authenticated USING (autor_id=(select public.meu_usuario_id()) AND created_at > now()-interval '24 hours');
CREATE INDEX notas_cliente_cliente_idx ON public.notas_cliente(cliente_id, created_at);

-- Limpeza de demonstração inclui itens e notas.
CREATE OR REPLACE FUNCTION public.apagar_dados_demo() RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE resumo jsonb:='{}'; n bigint; t text; ficticios uuid[];
BEGIN
 IF auth.uid() IS NULL OR NOT (public.eh_admin() OR public.ve_tudo()) THEN RAISE EXCEPTION 'Apenas administradores ou diretoria podem apagar dados de demonstração.' USING ERRCODE='42501'; END IF;
 PERFORM pg_advisory_xact_lock(hashtext('rota.dados_demo'));
 SELECT coalesce(array_agg(id),'{}'::uuid[]) INTO ficticios FROM public.usuarios WHERE demo AND auth_user_id IS NULL;
 FOREACH t IN ARRAY ARRAY['interacoes','vendas','orcamentos','tarefas_agenda','alertas','itens_venda','notas_cliente'] LOOP
  EXECUTE format('SELECT count(*) FROM public.%I r JOIN public.clientes c ON c.id=r.cliente_id WHERE NOT r.demo AND c.demo',t) INTO n;
  IF n>0 THEN RAISE EXCEPTION 'Há registros reais em % vinculados a clientes demo. Limpeza cancelada.',t; END IF;
 END LOOP;
 SELECT count(*) INTO n FROM public.itens_venda i JOIN public.vendas v ON v.id=i.venda_id WHERE NOT i.demo AND v.demo;
 IF n>0 THEN RAISE EXCEPTION 'Há itens reais vinculados a vendas demo. Limpeza cancelada.'; END IF;
 FOREACH t IN ARRAY ARRAY['clientes','interacoes','vendas','orcamentos','tarefas_agenda','alertas','pontos','selos','metas','itens_venda','notas_cliente'] LOOP
  EXECUTE format('SELECT count(*) FROM public.%I WHERE NOT demo AND vendedor_id=ANY($1)',t) INTO n USING ficticios;
  IF n>0 THEN RAISE EXCEPTION 'Há registros reais em % vinculados a vendedores fictícios. Limpeza cancelada.',t; END IF;
 END LOOP;
 IF EXISTS(SELECT 1 FROM public.notas_cliente WHERE NOT demo AND autor_id=ANY(ficticios)) THEN RAISE EXCEPTION 'Há notas reais de autor fictício. Limpeza cancelada.'; END IF;
 IF EXISTS(SELECT 1 FROM public.equipes WHERE NOT demo AND supervisor_id=ANY(ficticios)) THEN RAISE EXCEPTION 'Há equipes reais vinculadas a supervisor fictício. Limpeza cancelada.'; END IF;
 FOREACH t IN ARRAY ARRAY['itens_venda','notas_cliente','interacoes','vendas','orcamentos','tarefas_agenda','alertas','pontos','selos','metas','links','clientes','equipes'] LOOP
  EXECUTE format('DELETE FROM public.%I WHERE demo=true',t); GET DIAGNOSTICS n=ROW_COUNT;
  resumo:=resumo||jsonb_build_object(t,n);
 END LOOP;
 DELETE FROM public.usuario_empresas WHERE usuario_id=ANY(ficticios); GET DIAGNOSTICS n=ROW_COUNT; resumo:=resumo||jsonb_build_object('usuario_empresas',n);
 DELETE FROM public.papeis_pre_cadastro WHERE usuario_id=ANY(ficticios); GET DIAGNOSTICS n=ROW_COUNT; resumo:=resumo||jsonb_build_object('papeis_pre_cadastro',n);
 DELETE FROM public.usuarios WHERE demo=true AND auth_user_id IS NULL; GET DIAGNOSTICS n=ROW_COUNT; resumo:=resumo||jsonb_build_object('usuarios',n);
 UPDATE public.usuarios SET demo=false WHERE demo=true AND auth_user_id IS NOT NULL;
 PERFORM public.auditar('apagar_dados_demo',NULL,NULL,NULL,NULL,resumo);
 RETURN resumo;
END $$;

-- Ficha 360 em uma chamada; RLS do chamador vale para tudo.
CREATE FUNCTION public.ficha_cliente(_cliente_id uuid, _hoje date DEFAULT NULL) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path=public AS $$
DECLARE h date:=coalesce(_hoje,(current_timestamp AT TIME ZONE 'America/Maceio')::date); c public.clientes; ini date;
BEGIN
 SELECT * INTO c FROM public.clientes WHERE id=_cliente_id;
 IF NOT FOUND THEN RETURN NULL; END IF;
 ini:=(h - interval '12 months')::date;
 RETURN jsonb_build_object(
  'cliente', jsonb_build_object('id',c.id,'empresa_id',c.empresa_id,'vendedor_id',c.vendedor_id,'nome',c.nome,'telefone',c.telefone,'email',c.email,'documento',c.documento,'segmento',c.segmento,'cidade',c.cidade,'codigo_shop9',c.codigo_shop9,'etiquetas',to_jsonb(c.etiquetas),'data_ultima_compra',c.data_ultima_compra),
  'compras', coalesce((SELECT jsonb_agg(x ORDER BY x->>'data' DESC) FROM (
     SELECT jsonb_build_object('id',v.id,'data',v.data_faturamento,'valor',v.valor,'codigo_shop9',v.codigo_shop9,
       'itens',coalesce((SELECT jsonb_agg(jsonb_build_object('produto',i.produto,'codigo_produto',i.codigo_produto,'quantidade',i.quantidade,'valor_total',i.valor_total) ORDER BY i.produto) FROM public.itens_venda i WHERE i.venda_id=v.id),'[]')) x
     FROM public.vendas v WHERE v.cliente_id=c.id AND v.data_faturamento<=h ORDER BY v.data_faturamento DESC, v.created_at DESC LIMIT 24) s),'[]'),
  'total_12m', (SELECT coalesce(sum(valor),0) FROM public.vendas WHERE cliente_id=c.id AND data_faturamento>ini AND data_faturamento<=h),
  'qtd_12m', (SELECT count(*) FROM public.vendas WHERE cliente_id=c.id AND data_faturamento>ini AND data_faturamento<=h),
  'ticket_medio_12m', (SELECT coalesce(round(avg(valor),2),0) FROM public.vendas WHERE cliente_id=c.id AND data_faturamento>ini AND data_faturamento<=h),
  'itens_mais_comprados', coalesce((SELECT jsonb_agg(jsonb_build_object('produto',produto,'codigo_produto',codigo_produto,'quantidade',qtd,'valor_total',total) ORDER BY qtd DESC, produto) FROM (
     SELECT i.produto, i.codigo_produto, sum(i.quantidade) qtd, sum(i.valor_total) total FROM public.itens_venda i JOIN public.vendas v ON v.id=i.venda_id
     WHERE i.cliente_id=c.id AND v.data_faturamento>ini AND v.data_faturamento<=h GROUP BY i.produto, i.codigo_produto ORDER BY qtd DESC, i.produto LIMIT 10) t),'[]'),
  'orcamentos', coalesce((SELECT jsonb_agg(jsonb_build_object('id',id,'status',status,'data',data,'valor',valor,'ultimo_followup',ultimo_followup,'proximo_followup',proximo_followup,'observacao',observacao,'codigo_shop9',codigo_shop9) ORDER BY data DESC) FROM public.orcamentos WHERE cliente_id=c.id),'[]'),
  'interacoes', coalesce((SELECT jsonb_agg(x ORDER BY x->>'data' DESC) FROM (
     SELECT jsonb_build_object('id',id,'tipo',tipo,'cliente_respondeu',cliente_respondeu,'resultado',resultado,'data',data,'dia_local',(data AT TIME ZONE 'America/Maceio')::date) x
     FROM public.interacoes WHERE cliente_id=c.id ORDER BY data DESC LIMIT 30) s),'[]'),
  'notas', coalesce((SELECT jsonb_agg(x ORDER BY x->>'created_at' DESC) FROM (
     SELECT jsonb_build_object('id',n.id,'texto',n.texto,'autor_id',n.autor_id,'autor_nome',u.nome,'created_at',n.created_at) x
     FROM public.notas_cliente n LEFT JOIN public.usuarios u ON u.id=n.autor_id WHERE n.cliente_id=c.id ORDER BY n.created_at DESC LIMIT 30) s),'[]'));
END $$;
REVOKE ALL ON FUNCTION public.ficha_cliente(uuid,date) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.ficha_cliente(uuid,date) TO authenticated;
/* Gamificação: pontos e selos gravados somente por funções no servidor.
   Configurações de texto (ex.: hashtag_campanha) seguem a mesma RLS/auditoria das regras numéricas.
   Valores iniciais de peso_* aprovados pela diretoria e editáveis por ela. */
CREATE TABLE public.configuracoes_texto(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 empresa_id uuid NOT NULL REFERENCES public.empresas(id),
 chave text NOT NULL, valor text NOT NULL DEFAULT '', descricao text,
 origem public.origem_dado NOT NULL DEFAULT 'manual', created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(empresa_id,chave));
GRANT SELECT,INSERT,UPDATE,DELETE ON public.configuracoes_texto TO authenticated;
GRANT ALL ON public.configuracoes_texto TO service_role;
ALTER TABLE public.configuracoes_texto ENABLE ROW LEVEL SECURITY;
CREATE POLICY leitura ON public.configuracoes_texto FOR SELECT TO authenticated USING ((SELECT public.tem_empresa(empresa_id)));
CREATE POLICY insert ON public.configuracoes_texto FOR INSERT TO authenticated WITH CHECK ((SELECT public.ve_tudo()));
CREATE POLICY update ON public.configuracoes_texto FOR UPDATE TO authenticated USING ((SELECT public.ve_tudo())) WITH CHECK ((SELECT public.ve_tudo()));
CREATE POLICY delete ON public.configuracoes_texto FOR DELETE TO authenticated USING ((SELECT public.ve_tudo()));
CREATE TRIGGER auditar_textos AFTER INSERT OR UPDATE OR DELETE ON public.configuracoes_texto FOR EACH ROW EXECUTE FUNCTION public.auditoria_alteracao('alteracao_texto');

INSERT INTO public.configuracoes_texto(empresa_id,chave,valor,descricao)
SELECT id,'hashtag_campanha','','Hashtag da campanha atual; vazia = só a menção @centerfriosoficial vale' FROM public.empresas WHERE nome IN ('CENTERFRIOS','381 Distribuidora')
ON CONFLICT(empresa_id,chave) DO NOTHING;
INSERT INTO public.configuracoes_regras(empresa_id,chave,valor,descricao)
SELECT e.id,p.chave,p.valor,p.descricao FROM public.empresas e CROSS JOIN (VALUES
 ('peso_vendas',30,'Pontos por meta diária de vendas batida'),('peso_cobertura',20,'Pontos por meta diária de cobertura batida'),
 ('peso_reativacao',20,'Pontos por cliente reativado'),('peso_orcamentos',10,'Pontos por meta diária de orçamentos batida'),
 ('peso_instagram',5,'Pontos por post do Instagram aprovado')) p(chave,valor,descricao)
WHERE e.nome IN ('CENTERFRIOS','381 Distribuidora') AND NOT EXISTS(SELECT 1 FROM public.configuracoes_regras r WHERE r.empresa_id=e.id AND r.chave=p.chave);

-- Pontos idempotentes: soma linhas repetidas antes do índice único.
WITH dup AS (SELECT empresa_id,vendedor_id,data,indicador FROM public.pontos GROUP BY 1,2,3,4 HAVING count(*)>1),
del AS (DELETE FROM public.pontos p USING dup d WHERE p.empresa_id=d.empresa_id AND p.vendedor_id=d.vendedor_id AND p.data=d.data AND p.indicador=d.indicador RETURNING p.*)
INSERT INTO public.pontos(empresa_id,vendedor_id,data,indicador,pontos,origem,demo)
SELECT empresa_id,vendedor_id,data,indicador,sum(pontos),min(origem::text)::public.origem_dado,bool_and(demo) FROM del GROUP BY 1,2,3,4;
CREATE UNIQUE INDEX pontos_dia_indicador_uidx ON public.pontos(empresa_id,vendedor_id,data,indicador);
REVOKE INSERT,UPDATE,DELETE ON public.pontos FROM anon,authenticated;
REVOKE INSERT,UPDATE,DELETE ON public.selos FROM anon,authenticated;

ALTER TABLE public.selos ADD COLUMN referencia text;
CREATE UNIQUE INDEX selos_referencia_uidx ON public.selos(empresa_id,vendedor_id,nome,referencia);

-- Posts do Instagram
CREATE TABLE public.posts_instagram(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 empresa_id uuid NOT NULL REFERENCES public.empresas(id),
 vendedor_id uuid NOT NULL DEFAULT public.meu_usuario_id() REFERENCES public.usuarios(id),
 url text NOT NULL, legenda text NOT NULL, data_post date NOT NULL,
 status text NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente','aprovado','recusado')),
 motivo_recusa text, validado_por uuid REFERENCES public.usuarios(id), validado_em timestamptz,
 origem public.origem_dado NOT NULL DEFAULT 'manual', demo boolean NOT NULL DEFAULT false, created_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX posts_instagram_vendedor_idx ON public.posts_instagram(empresa_id,vendedor_id,data_post);
GRANT SELECT ON public.posts_instagram TO authenticated;
GRANT INSERT(empresa_id,vendedor_id,url,legenda,data_post,status) ON public.posts_instagram TO authenticated;
GRANT ALL ON public.posts_instagram TO service_role;
ALTER TABLE public.posts_instagram ENABLE ROW LEVEL SECURITY;
CREATE POLICY leitura ON public.posts_instagram FOR SELECT TO authenticated USING ((SELECT public.tem_empresa(empresa_id)) AND (SELECT public.pode_ver_vendedor(vendedor_id)));
CREATE POLICY inserir ON public.posts_instagram FOR INSERT TO authenticated WITH CHECK (vendedor_id=(SELECT public.meu_usuario_id()) AND (SELECT public.tem_empresa(empresa_id)) AND status='pendente');

-- Auxiliares internas
CREATE FUNCTION public.gam_regra(_empresa uuid,_chave text,_padrao numeric) RETURNS numeric LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS
$$ SELECT coalesce((SELECT valor FROM public.configuracoes_regras WHERE empresa_id=_empresa AND chave=_chave LIMIT 1),_padrao) $$;
CREATE FUNCTION public.gam_dia_util(_empresa uuid,_dia date) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS
$$ SELECT extract(isodow FROM _dia)<6 AND NOT EXISTS(SELECT 1 FROM public.feriados f WHERE f.data=_dia AND (f.empresa_id IS NULL OR f.empresa_id=_empresa)) $$;
CREATE FUNCTION public.gam_uteis_restantes(_empresa uuid,_dia date) RETURNS integer LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS
$$ SELECT count(*)::int FROM generate_series(_dia,(date_trunc('month',_dia)+interval '1 month -1 day')::date,interval '1 day') g(d) WHERE public.gam_dia_util(_empresa,g.d::date) $$;
CREATE FUNCTION public.gam_vendas_batida(_empresa uuid,_vendedor uuid,_dia date) RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE meta numeric; antes numeric; hoje_v numeric; rest int; ini date:=date_trunc('month',_dia)::date;
BEGIN
 IF NOT public.gam_dia_util(_empresa,_dia) THEN RETURN false; END IF;
 SELECT meta_vendas INTO meta FROM public.metas WHERE empresa_id=_empresa AND vendedor_id=_vendedor AND mes=ini LIMIT 1;
 IF coalesce(meta,0)<=0 THEN RETURN false; END IF;
 SELECT coalesce(sum(valor) FILTER(WHERE data_faturamento<_dia),0),coalesce(sum(valor) FILTER(WHERE data_faturamento=_dia),0) INTO antes,hoje_v
  FROM public.vendas WHERE empresa_id=_empresa AND vendedor_id=_vendedor AND data_faturamento BETWEEN ini AND _dia;
 rest:=public.gam_uteis_restantes(_empresa,_dia);
 IF rest<=0 OR (meta-antes)/rest<=0 THEN RETURN false; END IF;
 RETURN hoje_v>=(meta-antes)/rest;
END $$;
CREATE FUNCTION public.gam_permitido(_empresa uuid,_vendedor uuid) RETURNS void LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF auth.uid() IS NULL OR NOT public.tem_empresa(_empresa) OR NOT (public.ve_tudo() OR _vendedor=public.meu_usuario_id()
  OR (public.has_role(auth.uid(),'supervisor',_empresa) AND EXISTS(SELECT 1 FROM public.usuarios v JOIN public.equipes e ON e.id=v.equipe_id WHERE v.id=_vendedor AND e.supervisor_id=public.meu_usuario_id())))
 THEN RAISE EXCEPTION 'Sem permissão para este vendedor.' USING ERRCODE='42501'; END IF;
END $$;
REVOKE EXECUTE ON FUNCTION public.gam_regra(uuid,text,numeric),public.gam_dia_util(uuid,date),public.gam_uteis_restantes(uuid,date),public.gam_vendas_batida(uuid,uuid,date),public.gam_permitido(uuid,uuid) FROM PUBLIC,anon,authenticated;

CREATE FUNCTION public.calcular_pontos_dia(_empresa_id uuid,_vendedor_id uuid,_dia date) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE util boolean; ini date:=date_trunc('month',_dia)::date; rest int; m public.metas; n_hoje numeric; n_antes numeric; carteira int; alvo numeric; limite numeric;
 p_v int:=0; p_o int:=0; p_c int:=0; p_r int:=0; p_i int:=0; res jsonb;
BEGIN
 PERFORM public.gam_permitido(_empresa_id,_vendedor_id);
 IF _dia IS NULL THEN RAISE EXCEPTION 'Informe o dia.' USING ERRCODE='22023'; END IF;
 util:=public.gam_dia_util(_empresa_id,_dia); rest:=public.gam_uteis_restantes(_empresa_id,_dia);
 SELECT * INTO m FROM public.metas WHERE empresa_id=_empresa_id AND vendedor_id=_vendedor_id AND mes=ini LIMIT 1;
 IF public.gam_vendas_batida(_empresa_id,_vendedor_id,_dia) THEN p_v:=public.gam_regra(_empresa_id,'peso_vendas',30); END IF;
 IF util AND rest>0 AND coalesce(m.meta_orcamentos,0)>0 THEN
  SELECT count(*) FILTER(WHERE data=_dia),count(*) FILTER(WHERE data<_dia) INTO n_hoje,n_antes FROM public.orcamentos WHERE empresa_id=_empresa_id AND vendedor_id=_vendedor_id AND data BETWEEN ini AND _dia;
  alvo:=ceil((m.meta_orcamentos-n_antes)/rest::numeric);
  IF alvo>0 AND n_hoje>=alvo THEN p_o:=public.gam_regra(_empresa_id,'peso_orcamentos',10); END IF;
 END IF;
 IF util AND rest>0 AND coalesce(m.meta_cobertura,0)>0 THEN
  SELECT count(*) INTO carteira FROM public.clientes WHERE empresa_id=_empresa_id AND vendedor_id=_vendedor_id;
  WITH q AS (SELECT i.cliente_id,(i.data AT TIME ZONE 'America/Maceio')::date dia FROM public.interacoes i JOIN public.clientes c ON c.id=i.cliente_id AND c.vendedor_id=_vendedor_id
   WHERE i.empresa_id=_empresa_id AND (i.cliente_respondeu OR (i.tipo IN ('visita','ligacao') AND nullif(btrim(i.resultado),'') IS NOT NULL))
   AND (i.data AT TIME ZONE 'America/Maceio')::date BETWEEN ini AND _dia)
  SELECT count(DISTINCT cliente_id) FILTER(WHERE dia=_dia),count(DISTINCT cliente_id) FILTER(WHERE dia<_dia) INTO n_hoje,n_antes FROM q;
  alvo:=ceil((m.meta_cobertura/100.0*carteira-n_antes)/rest);
  IF alvo>0 AND n_hoje>=alvo THEN p_c:=public.gam_regra(_empresa_id,'peso_cobertura',20); END IF;
 END IF;
 limite:=public.gam_regra(_empresa_id,'cliente_sem_compra_dias',90);
 SELECT count(*) INTO n_hoje FROM (SELECT DISTINCT v.cliente_id FROM public.vendas v WHERE v.empresa_id=_empresa_id AND v.vendedor_id=_vendedor_id AND v.data_faturamento=_dia
  AND _dia-(SELECT max(a.data_faturamento) FROM public.vendas a WHERE a.cliente_id=v.cliente_id AND a.empresa_id=_empresa_id AND a.data_faturamento<_dia)>=limite) r;
 p_r:=n_hoje*public.gam_regra(_empresa_id,'peso_reativacao',20);
 SELECT count(*) INTO n_hoje FROM public.posts_instagram WHERE empresa_id=_empresa_id AND vendedor_id=_vendedor_id AND data_post=_dia AND status='aprovado';
 p_i:=n_hoje*public.gam_regra(_empresa_id,'peso_instagram',5);
 res:=jsonb_build_object('vendas',p_v,'orcamentos',p_o,'cobertura',p_c,'reativacao',p_r,'instagram',p_i);
 INSERT INTO public.pontos(empresa_id,vendedor_id,data,indicador,pontos)
 SELECT _empresa_id,_vendedor_id,_dia,k,v::int FROM jsonb_each_text(res) x(k,v)
 ON CONFLICT(empresa_id,vendedor_id,data,indicador) DO UPDATE SET pontos=EXCLUDED.pontos;
 RETURN res;
END $$;

CREATE FUNCTION public.atualizar_selos(_empresa_id uuid,_vendedor_id uuid,_dia date) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE cob jsonb; d date; k int:=0; novos jsonb:='[]'; r record;
BEGIN
 PERFORM public.gam_permitido(_empresa_id,_vendedor_id);
 cob:=public.cobertura_vendedor(_empresa_id,_vendedor_id,_dia);
 IF (cob->>'total')::int>0 AND (cob->>'cobertos')::int=(cob->>'total')::int THEN
  FOR r IN INSERT INTO public.selos(empresa_id,vendedor_id,nome,descricao,conquistado_em,referencia) VALUES(_empresa_id,_vendedor_id,'Carteira 100%','Cobertura de 100% da carteira no mês',_dia,to_char(_dia,'YYYY-MM'))
   ON CONFLICT(empresa_id,vendedor_id,nome,referencia) DO NOTHING RETURNING nome,referencia LOOP novos:=novos||to_jsonb(r); END LOOP;
 END IF;
 IF public.gam_dia_util(_empresa_id,_dia) THEN
  d:=_dia;
  WHILE k<5 AND d>_dia-60 LOOP
   IF public.gam_dia_util(_empresa_id,d) THEN EXIT WHEN NOT public.gam_vendas_batida(_empresa_id,_vendedor_id,d); k:=k+1; END IF;
   d:=d-1;
  END LOOP;
  IF k=5 THEN
   FOR r IN INSERT INTO public.selos(empresa_id,vendedor_id,nome,descricao,conquistado_em,referencia) VALUES(_empresa_id,_vendedor_id,'5 dias seguidos','Meta de vendas batida em 5 dias úteis seguidos',_dia,_dia::text)
    ON CONFLICT(empresa_id,vendedor_id,nome,referencia) DO NOTHING RETURNING nome,referencia LOOP novos:=novos||to_jsonb(r); END LOOP;
  END IF;
 END IF;
 RETURN novos;
END $$;

CREATE FUNCTION public.ranking(_empresa_id uuid,_inicio date,_fim date) RETURNS TABLE(posicao integer,vendedor_id uuid,nome text,pontos bigint,eh_voce boolean)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE eu uuid:=public.meu_usuario_id(); diretoria boolean:=public.ve_tudo(); sup boolean:=public.has_role(auth.uid(),'supervisor',_empresa_id);
BEGIN
 IF auth.uid() IS NULL OR NOT public.tem_empresa(_empresa_id) THEN RAISE EXCEPTION 'Sem acesso a esta empresa.' USING ERRCODE='42501'; END IF;
 RETURN QUERY
 WITH soma AS (
  SELECT p.vendedor_id vid,sum(p.pontos)::bigint pts FROM public.pontos p WHERE p.empresa_id=_empresa_id AND p.data BETWEEN _inicio AND _fim GROUP BY p.vendedor_id
  UNION ALL SELECT eu,0::bigint WHERE eu IS NOT NULL AND public.has_role(auth.uid(),'vendedor',_empresa_id)
 ), tot AS (SELECT s.vid,sum(s.pts)::bigint pts FROM soma s GROUP BY s.vid),
 pos AS (SELECT rank() OVER (ORDER BY t.pts DESC)::int ps,t.vid,u.nome nm,t.pts,coalesce(t.vid=eu,false) ev,u.equipe_id eq FROM tot t JOIN public.usuarios u ON u.id=t.vid)
 SELECT pos.ps,pos.vid,pos.nm,pos.pts,pos.ev FROM pos
 WHERE diretoria OR (sup AND (pos.ev OR EXISTS(SELECT 1 FROM public.equipes e WHERE e.id=pos.eq AND e.supervisor_id=eu))) OR pos.ps<=3 OR pos.ev
 ORDER BY pos.ps,pos.nm;
END $$;

CREATE FUNCTION public.validar_post_instagram(_post_id uuid,_aprovar boolean,_motivo text) RETURNS public.posts_instagram LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE p public.posts_instagram; eu uuid:=public.meu_usuario_id(); tag text;
BEGIN
 SELECT * INTO p FROM public.posts_instagram WHERE id=_post_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Post não encontrado.' USING ERRCODE='22023'; END IF;
 IF auth.uid() IS NULL OR p.vendedor_id=eu OR NOT public.tem_empresa(p.empresa_id) OR NOT (public.ve_tudo() OR (public.has_role(auth.uid(),'supervisor',p.empresa_id)
  AND EXISTS(SELECT 1 FROM public.usuarios v JOIN public.equipes e ON e.id=v.equipe_id WHERE v.id=p.vendedor_id AND e.supervisor_id=eu)))
 THEN RAISE EXCEPTION 'Somente o supervisor da equipe ou a diretoria pode validar este post.' USING ERRCODE='42501'; END IF;
 IF p.status<>'pendente' THEN RAISE EXCEPTION 'Este post já foi validado.' USING ERRCODE='22023'; END IF;
 IF coalesce(_aprovar,false) THEN
  SELECT nullif(btrim(valor),'') INTO tag FROM public.configuracoes_texto WHERE empresa_id=p.empresa_id AND chave='hashtag_campanha';
  IF strpos(lower(p.legenda),'@centerfriosoficial')=0 AND (tag IS NULL OR strpos(lower(p.legenda),lower(tag))=0) THEN
   RAISE EXCEPTION 'A legenda precisa citar @centerfriosoficial ou a hashtag da campanha.' USING ERRCODE='22023'; END IF;
  UPDATE public.posts_instagram SET status='aprovado',motivo_recusa=NULL,validado_por=eu,validado_em=now() WHERE id=_post_id RETURNING * INTO p;
  PERFORM public.calcular_pontos_dia(p.empresa_id,p.vendedor_id,p.data_post);
 ELSE
  IF nullif(btrim(_motivo),'') IS NULL THEN RAISE EXCEPTION 'Informe o motivo da recusa.' USING ERRCODE='22023'; END IF;
  UPDATE public.posts_instagram SET status='recusado',motivo_recusa=btrim(_motivo),validado_por=eu,validado_em=now() WHERE id=_post_id RETURNING * INTO p;
 END IF;
 PERFORM public.auditar('validacao_instagram','posts_instagram',p.id,p.empresa_id,p.vendedor_id,jsonb_build_object('status',p.status,'motivo',p.motivo_recusa));
 RETURN p;
END $$;
REVOKE EXECUTE ON FUNCTION public.calcular_pontos_dia(uuid,uuid,date),public.atualizar_selos(uuid,uuid,date),public.ranking(uuid,date,date),public.validar_post_instagram(uuid,boolean,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.calcular_pontos_dia(uuid,uuid,date),public.atualizar_selos(uuid,uuid,date),public.ranking(uuid,date,date),public.validar_post_instagram(uuid,boolean,text) TO authenticated,service_role;
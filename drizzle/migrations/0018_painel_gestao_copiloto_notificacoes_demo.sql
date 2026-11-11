-- 1. Painel da gestão (SECURITY INVOKER: a RLS do chamador define os vendedores visíveis)
CREATE FUNCTION public.painel_gestao(_empresa_id uuid,_hoje date DEFAULT NULL) RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path=public AS $$
WITH p AS (SELECT h AS hoje,date_trunc('month',h)::date AS inicio FROM (SELECT coalesce(_hoje,(current_timestamp AT TIME ZONE 'America/Maceio')::date) h) d),
lim AS (SELECT coalesce((SELECT valor FROM public.configuracoes_regras WHERE empresa_id=_empresa_id AND chave='cliente_sem_compra_dias' LIMIT 1),90) sem_compra,
 coalesce((SELECT valor FROM public.configuracoes_regras WHERE empresa_id=_empresa_id AND chave='cliente_esquecido_dias' LIMIT 1),30) esquecido),
vend AS (SELECT u.id,u.nome,e.nome equipe FROM public.usuarios u LEFT JOIN public.equipes e ON e.id=u.equipe_id
 WHERE public.pode_ver_vendedor(u.id) AND (EXISTS(SELECT 1 FROM public.clientes c WHERE c.empresa_id=_empresa_id AND c.vendedor_id=u.id)
  OR (u.auth_user_id IS NOT NULL AND public.has_role(u.auth_user_id,'vendedor',_empresa_id)))),
cli AS (SELECT c.id,c.vendedor_id,c.data_ultima_compra,
 (SELECT max((i.data AT TIME ZONE 'America/Maceio')::date) FROM public.interacoes i WHERE i.cliente_id=c.id AND i.empresa_id=_empresa_id AND (i.cliente_respondeu OR (i.tipo IN ('visita','ligacao') AND nullif(btrim(i.resultado),'') IS NOT NULL))) ult_q,
 (SELECT max(v.data_faturamento) FROM public.vendas v WHERE v.cliente_id=c.id AND v.empresa_id=_empresa_id) ult_v
 FROM public.clientes c JOIN vend ON vend.id=c.vendedor_id WHERE c.empresa_id=_empresa_id)
SELECT coalesce(jsonb_agg(jsonb_build_object(
 'vendedor_id',vd.id,'nome',vd.nome,'equipe',vd.equipe,
 'meta',(SELECT to_jsonb(m) FROM public.metas m WHERE m.empresa_id=_empresa_id AND m.vendedor_id=vd.id AND m.mes=p.inicio LIMIT 1),
 'faturado_mes',(SELECT coalesce(sum(valor),0) FROM public.vendas WHERE empresa_id=_empresa_id AND vendedor_id=vd.id AND data_faturamento BETWEEN p.inicio AND p.hoje),
 'faturado_hoje',(SELECT coalesce(sum(valor),0) FROM public.vendas WHERE empresa_id=_empresa_id AND vendedor_id=vd.id AND data_faturamento=p.hoje),
 'clientes_total',(SELECT count(*) FROM cli WHERE cli.vendedor_id=vd.id),
 'clientes_cobertos',(SELECT count(*) FROM cli WHERE cli.vendedor_id=vd.id AND (
   EXISTS(SELECT 1 FROM public.vendas v WHERE v.cliente_id=cli.id AND v.empresa_id=_empresa_id AND v.data_faturamento BETWEEN p.inicio AND p.hoje)
   OR EXISTS(SELECT 1 FROM public.interacoes i WHERE i.cliente_id=cli.id AND i.empresa_id=_empresa_id AND (i.data AT TIME ZONE 'America/Maceio')::date BETWEEN p.inicio AND p.hoje AND (i.cliente_respondeu OR (i.tipo IN ('visita','ligacao') AND nullif(btrim(i.resultado),'') IS NOT NULL))))),
 'orcamentos_abertos',coalesce((SELECT jsonb_agg(jsonb_build_object('id',o.id,'cliente_id',o.cliente_id,'valor',o.valor,'data',o.data,'ultimo_followup',o.ultimo_followup,
   'ultima_interacao',(SELECT max((i.data AT TIME ZONE 'America/Maceio')::date) FROM public.interacoes i WHERE i.cliente_id=o.cliente_id AND i.empresa_id=_empresa_id)) ORDER BY o.data,o.id)
   FROM public.orcamentos o WHERE o.empresa_id=_empresa_id AND o.vendedor_id=vd.id AND o.status='aberto'),'[]'::jsonb),
 'clientes_sem_compra_90',(SELECT count(*) FROM cli WHERE cli.vendedor_id=vd.id AND (cli.data_ultima_compra IS NULL OR p.hoje-cli.data_ultima_compra>=l.sem_compra)),
 'esquecidos',(SELECT count(*) FROM cli WHERE cli.vendedor_id=vd.id AND coalesce(p.hoje-GREATEST(cli.ult_q,cli.ult_v,cli.data_ultima_compra),2147483647)>=l.esquecido)
) ORDER BY vd.nome,vd.id),'[]'::jsonb) FROM vend vd CROSS JOIN p CROSS JOIN lim l;
$$;
REVOKE EXECUTE ON FUNCTION public.painel_gestao(uuid,date) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.painel_gestao(uuid,date) TO authenticated,service_role;

-- 2. Copiloto
ALTER TABLE public.usuarios ADD COLUMN pinguim_versao text NOT NULL DEFAULT 'consultor' CHECK (pinguim_versao IN ('consultor','panificador','acougueiro','pizzaiolo')),
 ADD COLUMN copiloto_minimizado boolean NOT NULL DEFAULT false;
GRANT SELECT(pinguim_versao,copiloto_minimizado),UPDATE(pinguim_versao,copiloto_minimizado,apelido_copiloto) ON public.usuarios TO authenticated;

-- 3. Notificações internas
CREATE TABLE public.notificacoes(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 usuario_id uuid NOT NULL REFERENCES public.usuarios(id),
 empresa_id uuid REFERENCES public.empresas(id),
 tipo text NOT NULL CHECK (tipo IN ('recompra','orcamento_parado','esquecido','tarefa','meta','selo','instagram','sistema')),
 titulo text NOT NULL, corpo text, link text, lida_em timestamptz, chave text,
 created_at timestamptz NOT NULL DEFAULT now());
CREATE UNIQUE INDEX notificacoes_usuario_chave_uidx ON public.notificacoes(usuario_id,chave);
CREATE INDEX notificacoes_usuario_data_idx ON public.notificacoes(usuario_id,created_at DESC);
GRANT SELECT,UPDATE(lida_em) ON public.notificacoes TO authenticated;
GRANT ALL ON public.notificacoes TO service_role;
ALTER TABLE public.notificacoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY leitura ON public.notificacoes FOR SELECT TO authenticated USING (usuario_id=(SELECT public.meu_usuario_id()));
CREATE POLICY marcar_lida ON public.notificacoes FOR UPDATE TO authenticated USING (usuario_id=(SELECT public.meu_usuario_id())) WITH CHECK (usuario_id=(SELECT public.meu_usuario_id()));

CREATE TABLE public.preferencias_notificacao(
 usuario_id uuid PRIMARY KEY DEFAULT public.meu_usuario_id() REFERENCES public.usuarios(id),
 tipos_desligados text[] NOT NULL DEFAULT '{}',
 expediente_inicio time NOT NULL DEFAULT '08:00', expediente_fim time NOT NULL DEFAULT '18:00',
 sabado_inicio time DEFAULT '08:00', sabado_fim time DEFAULT '12:00',
 created_at timestamptz NOT NULL DEFAULT now(),
 CHECK (expediente_inicio<expediente_fim),
 CHECK ((sabado_inicio IS NULL AND sabado_fim IS NULL) OR (sabado_inicio IS NOT NULL AND sabado_fim IS NOT NULL AND sabado_inicio<sabado_fim)));
GRANT SELECT,INSERT,UPDATE ON public.preferencias_notificacao TO authenticated;
GRANT ALL ON public.preferencias_notificacao TO service_role;
ALTER TABLE public.preferencias_notificacao ENABLE ROW LEVEL SECURITY;
CREATE POLICY propria ON public.preferencias_notificacao FOR ALL TO authenticated USING (usuario_id=(SELECT public.meu_usuario_id())) WITH CHECK (usuario_id=(SELECT public.meu_usuario_id()));

CREATE FUNCTION public.registrar_notificacoes(_itens jsonb) RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE eu uuid:=public.meu_usuario_id(); desligados text[]; i jsonb; n int:=0; k int; emp uuid;
BEGIN
 IF eu IS NULL THEN RAISE EXCEPTION 'É necessário entrar na plataforma.' USING ERRCODE='42501'; END IF;
 IF jsonb_typeof(_itens) IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'Os itens devem ser uma lista.' USING ERRCODE='22023'; END IF;
 SELECT tipos_desligados INTO desligados FROM public.preferencias_notificacao WHERE usuario_id=eu;
 FOR i IN SELECT * FROM jsonb_array_elements(_itens) LOOP
  CONTINUE WHEN (i->>'tipo')=ANY(coalesce(desligados,'{}'));
  emp:=nullif(i->>'empresa_id','')::uuid;
  CONTINUE WHEN emp IS NOT NULL AND NOT public.tem_empresa(emp);
  INSERT INTO public.notificacoes(usuario_id,empresa_id,tipo,titulo,corpo,link,chave)
  VALUES(eu,emp,i->>'tipo',coalesce(nullif(btrim(i->>'titulo'),''),'Aviso'),i->>'corpo',i->>'link',nullif(i->>'chave',''))
  ON CONFLICT(usuario_id,chave) DO NOTHING;
  GET DIAGNOSTICS k=ROW_COUNT; n:=n+k;
 END LOOP;
 RETURN n;
END $$;
REVOKE EXECUTE ON FUNCTION public.registrar_notificacoes(jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.registrar_notificacoes(jsonb) TO authenticated,service_role;

-- 5. Gamificação: compra faturada conta como cobertura; pontos/selos herdam a marca demo do vendedor.
CREATE OR REPLACE FUNCTION public.calcular_pontos_dia(_empresa_id uuid,_vendedor_id uuid,_dia date) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE util boolean; ini date:=date_trunc('month',_dia)::date; rest int; m public.metas; n_hoje numeric; n_antes numeric; carteira int; alvo numeric; limite numeric;
 p_v int:=0; p_o int:=0; p_c int:=0; p_r int:=0; p_i int:=0; res jsonb; eh_demo boolean;
BEGIN
 PERFORM public.gam_permitido(_empresa_id,_vendedor_id);
 IF _dia IS NULL THEN RAISE EXCEPTION 'Informe o dia.' USING ERRCODE='22023'; END IF;
 SELECT demo INTO eh_demo FROM public.usuarios WHERE id=_vendedor_id;
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
  WITH q AS (
   SELECT i.cliente_id,(i.data AT TIME ZONE 'America/Maceio')::date dia FROM public.interacoes i JOIN public.clientes c ON c.id=i.cliente_id AND c.vendedor_id=_vendedor_id AND c.empresa_id=_empresa_id
    WHERE i.empresa_id=_empresa_id AND (i.cliente_respondeu OR (i.tipo IN ('visita','ligacao') AND nullif(btrim(i.resultado),'') IS NOT NULL))
    AND (i.data AT TIME ZONE 'America/Maceio')::date BETWEEN ini AND _dia
   UNION
   SELECT v.cliente_id,v.data_faturamento FROM public.vendas v JOIN public.clientes c ON c.id=v.cliente_id AND c.vendedor_id=_vendedor_id AND c.empresa_id=_empresa_id
    WHERE v.empresa_id=_empresa_id AND v.data_faturamento BETWEEN ini AND _dia)
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
 INSERT INTO public.pontos(empresa_id,vendedor_id,data,indicador,pontos,demo)
 SELECT _empresa_id,_vendedor_id,_dia,k,v::int,coalesce(eh_demo,false) FROM jsonb_each_text(res) x(k,v)
 ON CONFLICT(empresa_id,vendedor_id,data,indicador) DO UPDATE SET pontos=EXCLUDED.pontos;
 RETURN res;
END $$;

-- "Carteira 100%" usa cobertura_vendedor, que já conta compra no mês ou interação qualificada (cada cliente uma vez).
CREATE OR REPLACE FUNCTION public.atualizar_selos(_empresa_id uuid,_vendedor_id uuid,_dia date) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE cob jsonb; d date; k int:=0; novos jsonb:='[]'; r record; eh_demo boolean;
BEGIN
 PERFORM public.gam_permitido(_empresa_id,_vendedor_id);
 SELECT coalesce(demo,false) INTO eh_demo FROM public.usuarios WHERE id=_vendedor_id;
 cob:=public.cobertura_vendedor(_empresa_id,_vendedor_id,_dia);
 IF (cob->>'total')::int>0 AND (cob->>'cobertos')::int=(cob->>'total')::int THEN
  FOR r IN INSERT INTO public.selos(empresa_id,vendedor_id,nome,descricao,conquistado_em,referencia,demo) VALUES(_empresa_id,_vendedor_id,'Carteira 100%','Cobertura de 100% da carteira no mês',_dia,to_char(_dia,'YYYY-MM'),eh_demo)
   ON CONFLICT(empresa_id,vendedor_id,nome,referencia) DO NOTHING RETURNING nome,referencia LOOP novos:=novos||to_jsonb(r); END LOOP;
 END IF;
 IF public.gam_dia_util(_empresa_id,_dia) THEN
  d:=_dia;
  WHILE k<5 AND d>_dia-60 LOOP
   IF public.gam_dia_util(_empresa_id,d) THEN EXIT WHEN NOT public.gam_vendas_batida(_empresa_id,_vendedor_id,d); k:=k+1; END IF;
   d:=d-1;
  END LOOP;
  IF k=5 THEN
   FOR r IN INSERT INTO public.selos(empresa_id,vendedor_id,nome,descricao,conquistado_em,referencia,demo) VALUES(_empresa_id,_vendedor_id,'5 dias seguidos','Meta de vendas batida em 5 dias úteis seguidos',_dia,_dia::text,eh_demo)
    ON CONFLICT(empresa_id,vendedor_id,nome,referencia) DO NOTHING RETURNING nome,referencia LOOP novos:=novos||to_jsonb(r); END LOOP;
  END IF;
 END IF;
 RETURN novos;
END $$;

-- 4. Demonstração completa
CREATE OR REPLACE FUNCTION public.apagar_dados_demo() RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $function$
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
 FOREACH t IN ARRAY ARRAY['clientes','interacoes','vendas','orcamentos','tarefas_agenda','alertas','pontos','selos','metas','itens_venda','notas_cliente','posts_instagram'] LOOP
  EXECUTE format('SELECT count(*) FROM public.%I WHERE NOT demo AND vendedor_id=ANY($1)',t) INTO n USING ficticios;
  IF n>0 THEN RAISE EXCEPTION 'Há registros reais em % vinculados a vendedores fictícios. Limpeza cancelada.',t; END IF;
 END LOOP;
 IF EXISTS(SELECT 1 FROM public.notas_cliente WHERE NOT demo AND autor_id=ANY(ficticios)) THEN RAISE EXCEPTION 'Há notas reais de autor fictício. Limpeza cancelada.'; END IF;
 IF EXISTS(SELECT 1 FROM public.posts_instagram WHERE NOT demo AND validado_por=ANY(ficticios)) THEN RAISE EXCEPTION 'Há posts reais validados por usuário fictício. Limpeza cancelada.'; END IF;
 IF EXISTS(SELECT 1 FROM public.equipes WHERE NOT demo AND supervisor_id=ANY(ficticios)) THEN RAISE EXCEPTION 'Há equipes reais vinculadas a supervisor fictício. Limpeza cancelada.'; END IF;
 FOREACH t IN ARRAY ARRAY['itens_venda','notas_cliente','posts_instagram','interacoes','vendas','orcamentos','tarefas_agenda','alertas','pontos','selos','metas','links','clientes','equipes'] LOOP
  EXECUTE format('DELETE FROM public.%I WHERE demo=true',t); GET DIAGNOSTICS n=ROW_COUNT;
  resumo:=resumo||jsonb_build_object(t,n);
 END LOOP;
 DELETE FROM public.notificacoes WHERE usuario_id=ANY(ficticios); GET DIAGNOSTICS n=ROW_COUNT; resumo:=resumo||jsonb_build_object('notificacoes',n);
 DELETE FROM public.preferencias_notificacao WHERE usuario_id=ANY(ficticios);
 DELETE FROM public.usuario_empresas WHERE usuario_id=ANY(ficticios); GET DIAGNOSTICS n=ROW_COUNT; resumo:=resumo||jsonb_build_object('usuario_empresas',n);
 DELETE FROM public.papeis_pre_cadastro WHERE usuario_id=ANY(ficticios); GET DIAGNOSTICS n=ROW_COUNT; resumo:=resumo||jsonb_build_object('papeis_pre_cadastro',n);
 DELETE FROM public.usuarios WHERE demo=true AND auth_user_id IS NULL; GET DIAGNOSTICS n=ROW_COUNT; resumo:=resumo||jsonb_build_object('usuarios',n);
 UPDATE public.usuarios SET demo=false WHERE demo=true AND auth_user_id IS NOT NULL;
 PERFORM public.auditar('apagar_dados_demo',NULL,NULL,NULL,NULL,resumo);
 RETURN resumo;
END $function$;

CREATE OR REPLACE FUNCTION public.carregar_dados_demo(_vendedores uuid[] DEFAULT NULL::uuid[]) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $function$
DECLARE empresas_ids uuid[]; vendedores uuid[]; e uuid; v uuid; sup uuid; eq uuid; cid uuid; vid uuid; i int; k int; j int; nitens int; valor_venda numeric; ultima date; quantidade int; hoje date:=(current_timestamp AT TIME ZONE 'America/Maceio')::date; sexta date; etq text[];
 cidades text[]:=ARRAY['Maceió','Arapiraca','Rio Largo','Marechal Deodoro','Palmeira dos Índios','São Miguel dos Campos']; segmentos text[]:=ARRAY['Padaria','Açougue','Supermercado','Pizzaria','Lanchonete'];
 produtos text[]:=ARRAY['Câmara fria 2x2','Balcão refrigerado 2 m','Freezer horizontal 500 L','Forno turbo','Expositor de bebidas'];
BEGIN
 IF auth.uid() IS NULL OR NOT (public.eh_admin() OR public.ve_tudo()) THEN RAISE EXCEPTION 'Apenas administradores ou diretoria podem carregar dados de demonstração.' USING ERRCODE='42501'; END IF;
 PERFORM pg_advisory_xact_lock(hashtext('rota.dados_demo'));
 IF EXISTS(SELECT 1 FROM public.clientes WHERE demo=true) THEN RAISE EXCEPTION 'Já existem dados de demonstração.' USING ERRCODE='22023'; END IF;
 SELECT array_agg(id ORDER BY nome) INTO empresas_ids FROM public.empresas WHERE nome IN ('CENTERFRIOS','381 Distribuidora');
 IF cardinality(empresas_ids) IS DISTINCT FROM 2 THEN RAISE EXCEPTION 'As duas empresas reais devem existir.'; END IF;
 IF _vendedores IS NOT NULL THEN
  IF cardinality(_vendedores)=0 OR array_position(_vendedores,NULL) IS NOT NULL THEN RAISE EXCEPTION 'Informe vendedores existentes.'; END IF;
  SELECT array_agg(DISTINCT x) INTO vendedores FROM unnest(_vendedores) x;
  IF EXISTS(SELECT 1 FROM unnest(vendedores) x WHERE NOT EXISTS(SELECT 1 FROM public.usuarios WHERE id=x)) THEN RAISE EXCEPTION 'Vendedor não encontrado.'; END IF;
  IF EXISTS(SELECT 1 FROM unnest(vendedores) AS vend(id) CROSS JOIN unnest(empresas_ids) AS emp(id) WHERE NOT EXISTS(SELECT 1 FROM public.usuario_empresas u WHERE u.usuario_id=vend.id AND u.empresa_id=emp.id)) THEN RAISE EXCEPTION 'Cada vendedor deve ter vínculo com as duas empresas da demonstração.'; END IF;
 ELSE
  INSERT INTO public.usuarios(nome,empresa_id,demo) VALUES('Supervisor Demo',empresas_ids[1],true) RETURNING id INTO sup;
  INSERT INTO public.equipes(nome,empresa_id,supervisor_id,demo) VALUES('Equipe Alagoas Demo',empresas_ids[1],sup,true) RETURNING id INTO eq;
  UPDATE public.usuarios SET equipe_id=eq WHERE id=sup;
  INSERT INTO public.papeis_pre_cadastro(usuario_id,role) VALUES(sup,'supervisor');
  vendedores:='{}'::uuid[];
  FOR i IN 1..2 LOOP
   INSERT INTO public.usuarios(nome,empresa_id,equipe_id,demo) VALUES(CASE WHEN i=1 THEN 'Humberto Demo' ELSE 'Clara Demo' END,empresas_ids[1],eq,true) RETURNING id INTO v;
   vendedores:=array_append(vendedores,v);
   INSERT INTO public.papeis_pre_cadastro(usuario_id,role) VALUES(v,'vendedor');
  END LOOP;
  INSERT INTO public.usuario_empresas(usuario_id,empresa_id) SELECT usr.id,emp.id FROM unnest(array_append(vendedores,sup)) AS usr(id) CROSS JOIN unnest(empresas_ids) AS emp(id);
 END IF;
 sexta:=hoje-1-((extract(isodow FROM hoje-1)::int-5+7)%7);
 FOR i IN 1..60 LOOP
  v:=vendedores[1+((i-1)%cardinality(vendedores))]; e:=empresas_ids[1+((i/2)%2)];
  quantidade:=CASE WHEN i IN (1,2) THEN 2 WHEN i IN (3,4) THEN 0 ELSE 12 END;
  ultima:=CASE WHEN i IN (3,4) THEN NULL WHEN i=5 THEN hoje-1 WHEN i%10=8 THEN hoje-95 WHEN i%10=7 THEN hoje-55 WHEN i%10=6 THEN hoje-35 ELSE hoje-(i%18) END;
  etq:=ARRAY[]::text[];
  IF i%7=0 THEN etq:=etq||'Rede'::text; END IF;
  IF i%11=0 THEN etq:=etq||'Inauguração'::text; END IF;
  IF i%13=0 THEN etq:=etq||'Inadimplente'::text; END IF;
  INSERT INTO public.clientes(empresa_id,vendedor_id,nome,telefone,segmento,cidade,data_ultima_compra,etiquetas,demo) VALUES(e,v,segmentos[1+((i-1)%5)]||' Demo '||lpad(i::text,2,'0'),'55829'||lpad((80000000+i)::text,8,'0'),segmentos[1+((i-1)%5)],cidades[1+((i-1)%6)],ultima,etq,true) RETURNING id INTO cid;
  FOR k IN 1..quantidade LOOP
   valor_venda:=900+i*53+k*17;
   INSERT INTO public.vendas(empresa_id,vendedor_id,cliente_id,data_faturamento,valor,demo) VALUES(e,v,cid,ultima-((k-1)*(12+i%18)),valor_venda,true) RETURNING id INTO vid;
   nitens:=1+((i+k)%3);
   FOR j IN 1..nitens LOOP
    INSERT INTO public.itens_venda(empresa_id,venda_id,cliente_id,vendedor_id,produto,codigo_produto,quantidade,valor_total,demo)
    VALUES(e,vid,cid,v,produtos[1+((i+k+j)%5)],'DEMO-'||(1+((i+k+j)%5)),1+((i+j)%2),round(valor_venda/nitens,2),true);
   END LOOP;
  END LOOP;
  IF i<=10 THEN
   INSERT INTO public.notas_cliente(empresa_id,cliente_id,vendedor_id,autor_id,texto,demo) VALUES(e,cid,v,v,'Cliente prefere contato pela manhã. Nota de demonstração.',true);
  END IF;
  IF i<>5 THEN
   INSERT INTO public.interacoes(empresa_id,vendedor_id,cliente_id,tipo,cliente_respondeu,resultado,data,demo) VALUES(e,v,cid,CASE WHEN i%3=0 THEN 'visita' ELSE 'whatsapp' END,i%4<>0,CASE WHEN i%4=0 THEN 'Sem resposta' ELSE 'Contato de acompanhamento' END,CASE WHEN i=6 THEN ((hoje-1)+time '23:30') AT TIME ZONE 'America/Maceio' ELSE ((hoje-(i%40))+time '10:00') AT TIME ZONE 'America/Maceio' END,true);
  END IF;
  IF i%4=0 OR i=7 THEN
   INSERT INTO public.orcamentos(empresa_id,vendedor_id,cliente_id,status,data,valor,ultimo_followup,proximo_followup,demo) VALUES(e,v,cid,'aberto',CASE WHEN i=7 THEN sexta-2 ELSE hoje-3 END,3000+i*100,CASE WHEN i=7 THEN sexta ELSE hoje-2 END,CASE WHEN i IN (4,8,12) THEN hoje+i/4 END,true);
  END IF;
 END LOOP;
 FOREACH v IN ARRAY vendedores LOOP
  FOREACH e IN ARRAY empresas_ids LOOP
   INSERT INTO public.metas(empresa_id,vendedor_id,mes,meta_vendas,meta_orcamentos,meta_cobertura,meta_reativacao,demo) VALUES(e,v,date_trunc('month',hoje)::date,120000,20,70,3,true) ON CONFLICT(empresa_id,vendedor_id,mes) DO NOTHING;
   INSERT INTO public.pontos(empresa_id,vendedor_id,data,indicador,pontos,demo) VALUES(e,v,hoje,'cobertura',15,true) ON CONFLICT(empresa_id,vendedor_id,data,indicador) DO NOTHING;
   INSERT INTO public.selos(empresa_id,vendedor_id,nome,descricao,conquistado_em,demo) VALUES(e,v,'Carteira Demo','Conquista de demonstração',hoje-1,true);
   INSERT INTO public.tarefas_agenda(empresa_id,vendedor_id,titulo,data,demo) VALUES(e,v,'Acompanhamento Demo',hoje,true);
  END LOOP;
 END LOOP;
 FOR i IN 1..2 LOOP
  INSERT INTO public.posts_instagram(empresa_id,vendedor_id,url,legenda,data_post,demo)
  VALUES(empresas_ids[i],vendedores[1+((i-1)%cardinality(vendedores))],'https://instagram.com/p/demo'||i,CASE WHEN i=1 THEN 'Câmara fria instalada hoje! @centerfriosoficial' ELSE 'Novidades na loja, venha conferir' END,hoje-1,true);
 END LOOP;
 FOREACH e IN ARRAY empresas_ids LOOP
  INSERT INTO public.links(empresa_id,titulo,descricao,url,publico,demo) VALUES(e,'Catálogo Demo','Material de demonstração','https://example.com/catalogo','interno',true);
 END LOOP;
 RETURN jsonb_build_object('clientes',60,'vendedores',cardinality(vendedores),'empresas',2);
END $function$;
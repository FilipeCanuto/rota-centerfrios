-- Correção de aliases locais da função criada em 0009, mantendo migrações anteriores intactas.
CREATE OR REPLACE FUNCTION public.carregar_dados_demo(_vendedores uuid[] DEFAULT NULL) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE empresas_ids uuid[]; vendedores uuid[]; e uuid; v uuid; sup uuid; eq uuid; cid uuid; i int; k int; ultima date; quantidade int; hoje date:=(current_timestamp AT TIME ZONE 'America/Maceio')::date; sexta date; cidades text[]:=ARRAY['Maceió','Arapiraca','Rio Largo','Marechal Deodoro','Palmeira dos Índios','São Miguel dos Campos']; segmentos text[]:=ARRAY['Padaria','Açougue','Supermercado','Pizzaria','Lanchonete'];
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
  INSERT INTO public.clientes(empresa_id,vendedor_id,nome,telefone,segmento,cidade,data_ultima_compra,demo) VALUES(e,v,segmentos[1+((i-1)%5)]||' Demo '||lpad(i::text,2,'0'),'55829'||lpad((80000000+i)::text,8,'0'),segmentos[1+((i-1)%5)],cidades[1+((i-1)%6)],ultima,true) RETURNING id INTO cid;
  FOR k IN 1..quantidade LOOP
   INSERT INTO public.vendas(empresa_id,vendedor_id,cliente_id,data_faturamento,valor,demo) VALUES(e,v,cid,ultima-((k-1)*(12+i%18)),900+i*53+k*17,true);
  END LOOP;
  IF i<>5 THEN
   INSERT INTO public.interacoes(empresa_id,vendedor_id,cliente_id,tipo,cliente_respondeu,resultado,data,demo) VALUES(e,v,cid,CASE WHEN i%3=0 THEN 'visita' ELSE 'whatsapp' END,i%4<>0,CASE WHEN i%4=0 THEN 'Sem resposta' ELSE 'Contato de acompanhamento' END,CASE WHEN i=6 THEN ((hoje-1)+time '23:30') AT TIME ZONE 'America/Maceio' ELSE ((hoje-(i%40))+time '10:00') AT TIME ZONE 'America/Maceio' END,true);
  END IF;
  IF i%4=0 OR i=7 THEN
   INSERT INTO public.orcamentos(empresa_id,vendedor_id,cliente_id,status,data,valor,ultimo_followup,demo) VALUES(e,v,cid,'aberto',CASE WHEN i=7 THEN sexta-2 ELSE hoje-3 END,3000+i*100,CASE WHEN i=7 THEN sexta ELSE hoje-2 END,true);
  END IF;
 END LOOP;
 FOREACH v IN ARRAY vendedores LOOP
  FOREACH e IN ARRAY empresas_ids LOOP
   INSERT INTO public.metas(empresa_id,vendedor_id,mes,meta_vendas,meta_orcamentos,meta_cobertura,meta_reativacao,demo) VALUES(e,v,date_trunc('month',hoje)::date,120000,20,70,3,true) ON CONFLICT(empresa_id,vendedor_id,mes) DO NOTHING;
   INSERT INTO public.pontos(empresa_id,vendedor_id,data,indicador,pontos,demo) VALUES(e,v,hoje,'cobertura',15,true);
   INSERT INTO public.selos(empresa_id,vendedor_id,nome,descricao,conquistado_em,demo) VALUES(e,v,'Carteira Demo','Conquista de demonstração',hoje-1,true);
   INSERT INTO public.tarefas_agenda(empresa_id,vendedor_id,titulo,data,demo) VALUES(e,v,'Acompanhamento Demo',hoje,true);
  END LOOP;
 END LOOP;
 FOREACH e IN ARRAY empresas_ids LOOP
  INSERT INTO public.links(empresa_id,titulo,descricao,url,publico,demo) VALUES(e,'Catálogo Demo','Material de demonstração','https://example.com/catalogo','interno',true);
 END LOOP;
 RETURN jsonb_build_object('clientes',60,'vendedores',cardinality(vendedores),'empresas',2);
END $$;
REVOKE ALL ON FUNCTION public.carregar_dados_demo(uuid[]) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.carregar_dados_demo(uuid[]) TO authenticated;
-- Importação de planilhas do Shop9: o app envia linhas já mapeadas (com "linha" = número na planilha);
-- cada chamada grava tudo numa transação, registra o lote em importacoes e audita "importacao_<tipo>".
CREATE TABLE public.importacoes(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 empresa_id uuid NOT NULL REFERENCES public.empresas(id),
 usuario_id uuid REFERENCES public.usuarios(id) DEFAULT public.meu_usuario_id(),
 tipo text NOT NULL CHECK (tipo IN ('clientes','vendas','orcamentos')),
 arquivo text,
 total_linhas int NOT NULL DEFAULT 0, inseridas int NOT NULL DEFAULT 0, atualizadas int NOT NULL DEFAULT 0, ignoradas int NOT NULL DEFAULT 0,
 erros jsonb NOT NULL DEFAULT '[]',
 origem public.origem_dado NOT NULL DEFAULT 'importacao',
 created_at timestamptz NOT NULL DEFAULT now());
GRANT SELECT, INSERT ON public.importacoes TO authenticated;
GRANT ALL ON public.importacoes TO service_role;
ALTER TABLE public.importacoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY importacoes_select ON public.importacoes FOR SELECT TO authenticated USING (public.has_role((select auth.uid()),'diretoria',empresa_id));
CREATE POLICY importacoes_insert ON public.importacoes FOR INSERT TO authenticated WITH CHECK (public.has_role((select auth.uid()),'diretoria',empresa_id) AND usuario_id=(select public.meu_usuario_id()));
CREATE INDEX importacoes_empresa_created_idx ON public.importacoes(empresa_id, created_at);

-- Interno: valida chamador/lote e registra o resultado.
CREATE FUNCTION public.importacao_validar(_empresa_id uuid, _linhas jsonb) RETURNS void LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF auth.uid() IS NULL OR _empresa_id IS NULL OR NOT public.has_role(auth.uid(),'diretoria',_empresa_id) THEN RAISE EXCEPTION 'Apenas a diretoria da empresa pode importar dados.' USING ERRCODE='42501'; END IF;
 IF jsonb_typeof(_linhas) IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'As linhas devem ser uma lista.' USING ERRCODE='22023'; END IF;
 IF jsonb_array_length(_linhas)>5000 THEN RAISE EXCEPTION 'Limite de 5.000 linhas por importação.' USING ERRCODE='22023'; END IF;
END $$;
CREATE FUNCTION public.importacao_registrar(_empresa_id uuid, _tipo text, _arquivo text, _total int, _ins int, _upd int, _erros jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE iid uuid; ign int:=(SELECT count(DISTINCT e->>'linha') FROM jsonb_array_elements(_erros) e); res jsonb;
BEGIN
 INSERT INTO public.importacoes(empresa_id,usuario_id,tipo,arquivo,total_linhas,inseridas,atualizadas,ignoradas,erros)
 VALUES(_empresa_id,public.meu_usuario_id(),_tipo,_arquivo,_total,_ins,_upd,ign,_erros) RETURNING id INTO iid;
 res:=jsonb_build_object('importacao_id',iid,'inseridas',_ins,'atualizadas',_upd,'ignoradas',ign,'erros',_erros);
 PERFORM public.auditar('importacao_'||_tipo,'importacoes',iid,_empresa_id,NULL,jsonb_build_object('arquivo',_arquivo,'total_linhas',_total,'inseridas',_ins,'atualizadas',_upd,'ignoradas',ign));
 RETURN res;
END $$;
REVOKE ALL ON FUNCTION public.importacao_validar(uuid,jsonb) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.importacao_registrar(uuid,text,text,int,int,int,jsonb) FROM PUBLIC,anon,authenticated;

CREATE FUNCTION public.importar_clientes(_empresa_id uuid, _arquivo text, _linhas jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE l jsonb; n int; cod text; vend uuid; ins int:=0; upd int:=0; erros jsonb:='[]'; existe boolean;
BEGIN
 PERFORM public.importacao_validar(_empresa_id,_linhas);
 FOR l IN SELECT * FROM jsonb_array_elements(_linhas) LOOP
  n:=(l->>'linha')::int; cod:=nullif(btrim(l->>'codigo_shop9'),'');
  IF cod IS NULL THEN erros:=erros||jsonb_build_object('linha',n,'campo','codigo_shop9','mensagem','Código do cliente vazio.'); CONTINUE; END IF;
  IF nullif(btrim(l->>'nome'),'') IS NULL THEN erros:=erros||jsonb_build_object('linha',n,'campo','nome','mensagem','Nome do cliente vazio.'); CONTINUE; END IF;
  existe:=EXISTS(SELECT 1 FROM public.clientes WHERE empresa_id=_empresa_id AND codigo_shop9=cod);
  IF existe THEN
   UPDATE public.clientes SET nome=btrim(l->>'nome'),telefone=nullif(l->>'telefone',''),documento=nullif(regexp_replace(coalesce(l->>'documento',''),'\D','','g'),''),email=nullif(l->>'email',''),segmento=nullif(l->>'segmento',''),cidade=nullif(l->>'cidade',''),origem='importacao'
   WHERE empresa_id=_empresa_id AND codigo_shop9=cod;
   upd:=upd+1;
  ELSE
   SELECT u.id INTO vend FROM public.usuarios u JOIN public.usuario_empresas ue ON ue.usuario_id=u.id AND ue.empresa_id=_empresa_id
    WHERE lower(u.email)=lower(btrim(l->>'vendedor_email')) LIMIT 1;
   IF vend IS NULL THEN erros:=erros||jsonb_build_object('linha',n,'campo','vendedor_email','mensagem','Vendedor não encontrado nesta empresa.'); CONTINUE; END IF;
   INSERT INTO public.clientes(empresa_id,vendedor_id,codigo_shop9,nome,telefone,documento,email,segmento,cidade,origem,demo)
   VALUES(_empresa_id,vend,cod,btrim(l->>'nome'),nullif(l->>'telefone',''),nullif(regexp_replace(coalesce(l->>'documento',''),'\D','','g'),''),nullif(l->>'email',''),nullif(l->>'segmento',''),nullif(l->>'cidade',''),'importacao',false);
   ins:=ins+1;
  END IF;
 END LOOP;
 RETURN public.importacao_registrar(_empresa_id,'clientes',_arquivo,jsonb_array_length(_linhas),ins,upd,erros);
END $$;

CREATE FUNCTION public.importar_vendas(_empresa_id uuid, _arquivo text, _linhas jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE l jsonb; n int; cod text; cli public.clientes; vid uuid; ins int:=0; upd int:=0; erros jsonb:='[]'; dt date;
BEGIN
 PERFORM public.importacao_validar(_empresa_id,_linhas);
 FOR l IN SELECT * FROM jsonb_array_elements(_linhas) LOOP
  n:=(l->>'linha')::int; cod:=nullif(btrim(l->>'codigo_shop9'),''); dt:=(l->>'data_faturamento')::date;
  IF cod IS NULL THEN erros:=erros||jsonb_build_object('linha',n,'campo','codigo_shop9','mensagem','Número da nota vazio.'); CONTINUE; END IF;
  SELECT * INTO cli FROM public.clientes WHERE empresa_id=_empresa_id AND codigo_shop9=btrim(l->>'cliente_codigo');
  IF NOT FOUND THEN erros:=erros||jsonb_build_object('linha',n,'campo','cliente_codigo','mensagem','Cliente não encontrado.'); CONTINUE; END IF;
  SELECT id INTO vid FROM public.vendas WHERE empresa_id=_empresa_id AND codigo_shop9=cod;
  IF vid IS NULL THEN
   INSERT INTO public.vendas(empresa_id,cliente_id,vendedor_id,codigo_shop9,data_faturamento,valor,origem,demo)
   VALUES(_empresa_id,cli.id,cli.vendedor_id,cod,dt,(l->>'valor')::numeric,'importacao',false) RETURNING id INTO vid; ins:=ins+1;
  ELSE
   UPDATE public.vendas SET cliente_id=cli.id,vendedor_id=cli.vendedor_id,data_faturamento=dt,valor=(l->>'valor')::numeric,origem='importacao' WHERE id=vid;
   DELETE FROM public.itens_venda WHERE venda_id=vid; upd:=upd+1;
  END IF;
  INSERT INTO public.itens_venda(empresa_id,venda_id,cliente_id,vendedor_id,produto,codigo_produto,quantidade,valor_total,origem,demo)
  SELECT _empresa_id,vid,cli.id,cli.vendedor_id,i->>'produto',nullif(i->>'codigo_produto',''),coalesce((i->>'quantidade')::numeric,1),coalesce((i->>'valor_total')::numeric,0),'importacao',false
  FROM jsonb_array_elements(coalesce(l->'itens','[]')) i WHERE nullif(btrim(i->>'produto'),'') IS NOT NULL;
  UPDATE public.clientes SET data_ultima_compra=dt WHERE id=cli.id AND (data_ultima_compra IS NULL OR data_ultima_compra<dt);
 END LOOP;
 RETURN public.importacao_registrar(_empresa_id,'vendas',_arquivo,jsonb_array_length(_linhas),ins,upd,erros);
END $$;

CREATE FUNCTION public.importar_orcamentos(_empresa_id uuid, _arquivo text, _linhas jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE l jsonb; n int; cod text; cli public.clientes; oid_ uuid; ins int:=0; upd int:=0; erros jsonb:='[]'; st text;
BEGIN
 PERFORM public.importacao_validar(_empresa_id,_linhas);
 FOR l IN SELECT * FROM jsonb_array_elements(_linhas) LOOP
  n:=(l->>'linha')::int; cod:=nullif(btrim(l->>'codigo_shop9'),''); st:=lower(btrim(l->>'status'));
  IF cod IS NULL THEN erros:=erros||jsonb_build_object('linha',n,'campo','codigo_shop9','mensagem','Número do orçamento vazio.'); CONTINUE; END IF;
  IF st IS NULL OR st NOT IN ('aberto','ganho','perdido') THEN erros:=erros||jsonb_build_object('linha',n,'campo','status','mensagem','Situação deve ser aberto, ganho ou perdido.'); CONTINUE; END IF;
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
END $$;
REVOKE ALL ON FUNCTION public.importar_clientes(uuid,text,jsonb), public.importar_vendas(uuid,text,jsonb), public.importar_orcamentos(uuid,text,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.importar_clientes(uuid,text,jsonb), public.importar_vendas(uuid,text,jsonb), public.importar_orcamentos(uuid,text,jsonb) TO authenticated;
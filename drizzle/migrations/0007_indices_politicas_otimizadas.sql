-- Os 20 feriados já existem. Esta ferramenta aceita DDL, não carga inicial de dados;
-- a reprodução da carga em novos ambientes permanece separada desta migração.
DO $indices$
DECLARE item record; tabela oid; atributos smallint[];
BEGIN
 FOR item IN SELECT * FROM (VALUES
 ('clientes','clientes_empresa_vendedor_idx',ARRAY['empresa_id','vendedor_id']),
 ('vendas','vendas_empresa_vendedor_data_idx',ARRAY['empresa_id','vendedor_id','data_faturamento']),
 ('vendas','vendas_cliente_data_idx',ARRAY['cliente_id','data_faturamento']),
 ('interacoes','interacoes_empresa_vendedor_data_idx',ARRAY['empresa_id','vendedor_id','data']),
 ('orcamentos','orcamentos_empresa_vendedor_status_idx',ARRAY['empresa_id','vendedor_id','status']),
 ('orcamentos','orcamentos_cliente_idx',ARRAY['cliente_id']),
 ('tarefas_agenda','tarefas_empresa_vendedor_data_idx',ARRAY['empresa_id','vendedor_id','data']),
 ('tarefas_agenda','tarefas_cliente_idx',ARRAY['cliente_id']),
 ('alertas','alertas_empresa_vendedor_data_idx',ARRAY['empresa_id','vendedor_id','data']),
 ('pontos','pontos_empresa_vendedor_data_idx',ARRAY['empresa_id','vendedor_id','data']),
 ('selos','selos_empresa_vendedor_idx',ARRAY['empresa_id','vendedor_id']),
 ('usuario_empresas','usuario_empresas_empresa_idx',ARRAY['empresa_id']),
 ('user_roles','user_roles_usuario_papel_idx',ARRAY['user_id','role']),
 ('equipes','equipes_supervisor_idx',ARRAY['supervisor_id']),
 ('usuarios','usuarios_equipe_idx',ARRAY['equipe_id']),
 ('registro_auditoria','auditoria_empresa_created_idx',ARRAY['empresa_id','created_at']),
 ('registro_auditoria','auditoria_vendedor_created_idx',ARRAY['vendedor_id','created_at'])
 ) AS x(nome,indice,colunas) LOOP
  tabela:=format('public.%I',item.nome)::regclass;
  SELECT array_agg(a.attnum ORDER BY c.ord) INTO atributos FROM unnest(item.colunas) WITH ORDINALITY c(nome,ord) JOIN pg_attribute a ON a.attrelid=tabela AND a.attname=c.nome;
  IF NOT EXISTS(SELECT 1 FROM pg_index i JOIN pg_class ci ON ci.oid=i.indexrelid JOIN pg_am am ON am.oid=ci.relam WHERE i.indrelid=tabela AND i.indisvalid AND i.indisready AND i.indpred IS NULL AND i.indexprs IS NULL AND am.amname='btree' AND i.indnkeyatts>=cardinality(atributos) AND ARRAY(SELECT i.indkey[n] FROM generate_series(0,cardinality(atributos)-1) n)=atributos) THEN
   EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON public.%I (%s)',item.indice,item.nome,(SELECT string_agg(format('%I',c),', ') FROM unnest(item.colunas) c));
  END IF;
 END LOOP;
END;
$indices$;
-- Redundante: cliente_id agora é o prefixo do índice composto cliente/data.
DROP INDEX IF EXISTS public.vendas_cliente_id_idx;
-- Índices iniciados por vendedor permanecem: empresa/vendedor não substitui vendedor isolado.
ALTER FUNCTION public.has_role(uuid,public.app_role) STABLE;
ALTER FUNCTION public.has_role(uuid,public.app_role,uuid) STABLE;
ALTER FUNCTION public.meu_usuario_id() STABLE;
ALTER FUNCTION public.ve_tudo() STABLE;
ALTER FUNCTION public.eh_admin() STABLE;
ALTER FUNCTION public.tem_empresa(uuid) STABLE;
ALTER FUNCTION public.pode_ver_vendedor(uuid) STABLE;
DO $politicas$
DECLARE p record; q text; w text; sql text;
BEGIN
 FOR p IN SELECT schemaname,tablename,policyname,qual,with_check FROM pg_policies WHERE schemaname='public' LOOP
  q:=p.qual; w:=p.with_check;
  q:=regexp_replace(q,'\mauth\.uid\(\)','(SELECT auth.uid())','g');
  w:=regexp_replace(w,'\mauth\.uid\(\)','(SELECT auth.uid())','g');
  q:=regexp_replace(q,'\m(public\.)?meu_usuario_id\(\)','(SELECT public.meu_usuario_id())','g');
  w:=regexp_replace(w,'\m(public\.)?meu_usuario_id\(\)','(SELECT public.meu_usuario_id())','g');
  q:=regexp_replace(q,'\m(public\.)?ve_tudo\(\)','(SELECT public.ve_tudo())','g');
  w:=regexp_replace(w,'\m(public\.)?ve_tudo\(\)','(SELECT public.ve_tudo())','g');
  q:=regexp_replace(q,'\m(public\.)?eh_admin\(\)','(SELECT public.eh_admin())','g');
  w:=regexp_replace(w,'\m(public\.)?eh_admin\(\)','(SELECT public.eh_admin())','g');
  IF q IS DISTINCT FROM p.qual OR w IS DISTINCT FROM p.with_check THEN
   sql:=format('ALTER POLICY %I ON %I.%I',p.policyname,p.schemaname,p.tablename);
   IF q IS NOT NULL THEN sql:=sql||format(' USING (%s)',q); END IF;
   IF w IS NOT NULL THEN sql:=sql||format(' WITH CHECK (%s)',w); END IF;
   EXECUTE sql;
  END IF;
 END LOOP;
END;
$politicas$;
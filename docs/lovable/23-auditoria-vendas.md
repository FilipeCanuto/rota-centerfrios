Aplique exatamente o SQL abaixo como UMA migração nova. Não investigue o projeto, não reescreva nem otimize o SQL, não crie testes em Python. Depois rode o bloco de testes em SQL. Se algo falhar, PARE e copie o erro na resposta, sem tentar corrigir. Regenere os tipos.

Pré-requisito: texto 22 do conector já aplicado (`docs/lovable/22-conector-shop9-adaptador.md`: colunas `vendas.shop9_ordem` e `vendas.shop9_tipo`).

## SQL

```sql
-- 23: correções da auditoria (docs/auditoria-fable.md: S1 a S5, R3) e decisões da diretoria de 17/11/2026
-- (D1 venda compartilhada 50/50, D2 devolução e nota cancelada abatem, D3 pontos depois da meta, D4 carrinho com preço do dia),
-- no formato de vendas do texto 22 do conector (uma linha por vendedor, devolução com shop9_tipo = 'devolucao').

-- S1. Papéis, vínculos e pré-cadastro só por função checada; ninguém se dá um papel novo.
REVOKE INSERT, UPDATE, DELETE ON public.user_roles, public.usuario_empresas, public.papeis_pre_cadastro FROM authenticated;

CREATE FUNCTION public.proteger_papel_proprio() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
 IF NEW.user_id = auth.uid()
    AND NOT EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = NEW.user_id AND r.role = NEW.role AND r.empresa_id IS NOT DISTINCT FROM NEW.empresa_id)
    AND NOT EXISTS (SELECT 1 FROM public.usuarios u WHERE u.auth_user_id = auth.uid() AND u.acesso_total AND u.ativo) THEN
  RAISE EXCEPTION 'Você não pode dar um papel novo a si mesmo. Peça a outro administrador.' USING ERRCODE = '42501';
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.proteger_papel_proprio() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER user_roles_proteger_papel_proprio BEFORE INSERT ON public.user_roles
 FOR EACH ROW EXECUTE FUNCTION public.proteger_papel_proprio();

-- S2. Contato: só de cliente da carteira visível, na mesma empresa, com data de agora e sem marcas forjadas.
DROP POLICY inserir ON public.interacoes;
CREATE POLICY inserir ON public.interacoes FOR INSERT TO authenticated WITH CHECK (
 vendedor_id = (select public.meu_usuario_id()) AND public.tem_empresa(empresa_id)
 AND demo = false AND origem = 'manual'
 AND data BETWEEN now() - interval '1 day' AND now() + interval '5 minutes'
 AND EXISTS (SELECT 1 FROM public.clientes c WHERE c.id = cliente_id AND c.empresa_id = interacoes.empresa_id AND public.pode_ver_vendedor(c.vendedor_id)));

-- S3. Auditoria comercial exige o setor Comercial; a auditoria administrativa continua com o administrador.
CREATE POLICY setor_comercial ON public.registro_auditoria AS RESTRICTIVE FOR SELECT TO authenticated USING (
 tabela IN ('usuarios','usuario_empresas','user_roles','papeis_pre_cadastro','links','equipes')
 OR (select public.tem_setor('comercial')));

-- S4. Post do Instagram: endereço http(s), data dos últimos 7 dias e sem repetir o mesmo post.
ALTER TABLE public.posts_instagram ADD CONSTRAINT posts_instagram_url_http CHECK (url ~* '^https?://') NOT VALID;
DROP POLICY inserir ON public.posts_instagram;
CREATE POLICY inserir ON public.posts_instagram FOR INSERT TO authenticated WITH CHECK (
 vendedor_id = (select public.meu_usuario_id()) AND (select public.tem_empresa(empresa_id)) AND status = 'pendente'
 AND data_post BETWEEN (now() AT TIME ZONE 'America/Maceio')::date - 7 AND (now() AT TIME ZONE 'America/Maceio')::date
 AND NOT EXISTS (SELECT 1 FROM public.posts_instagram p WHERE p.vendedor_id = posts_instagram.vendedor_id AND p.url = posts_instagram.url));

-- S5. Carga de demonstração só pelo servidor (como apagar_dados_demo).
REVOKE EXECUTE ON FUNCTION public.carregar_dados_demo(uuid[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.carregar_dados_demo(uuid[]) TO service_role;

-- D1 e D2 no formato do conector (texto 22): uma linha de `vendas` por vendedor, com a parte dele; devolução negativa
-- (`shop9_tipo = 'devolucao'`). As linhas de uma mesma nota têm o mesmo `shop9_ordem`. Assim metas, gestão e pontos somam por
-- `vendedor_id` sem conta extra, e a planilha grava igual ao conector.

-- Quem vê alguma linha de uma nota vê os itens dela (os itens ficam na linha do vendedor 1).
CREATE FUNCTION public.pode_ver_venda(_venda_id uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
 SELECT EXISTS (SELECT 1 FROM public.vendas v JOIN public.vendas w
   ON w.empresa_id = v.empresa_id AND w.shop9_ordem = v.shop9_ordem AND w.shop9_tipo IS NOT DISTINCT FROM v.shop9_tipo
  WHERE v.id = _venda_id AND v.shop9_ordem IS NOT NULL AND public.pode_ver_vendedor(w.vendedor_id))
$$;
REVOKE ALL ON FUNCTION public.pode_ver_venda(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.pode_ver_venda(uuid) TO authenticated, service_role;
DROP POLICY itens_venda_select ON public.itens_venda;
CREATE POLICY itens_venda_select ON public.itens_venda FOR SELECT TO authenticated USING (
 public.tem_empresa(empresa_id) AND (public.pode_ver_vendedor(vendedor_id) OR public.pode_ver_venda(venda_id)));

-- R3 + D1 + D2. Planilha de vendas: reimportar não troca os vendedores; com vendedor 2, uma linha para cada (50%);
-- devolução negativa com os vendedores da nota de origem e sem mexer na última compra; nota cancelada sai.
-- Códigos: vendedor 1 = número da nota (ou DEV:número), vendedor 2 = o mesmo + "/2"; shop9_ordem = 'planilha:' + número.
CREATE OR REPLACE FUNCTION public.importar_vendas(_empresa_id uuid, _arquivo text, _linhas jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE l jsonb; n int; cod text; chave text; tp text; st text; orig text; cli public.clientes;
 vid uuid; vid2 uuid; v1 uuid; v2 uuid; v2_arq uuid; total numeric; p1 numeric;
 ins int:=0; upd int:=0; erros jsonb:='[]'; dt date; k int;
BEGIN
 PERFORM public.importacao_validar(_empresa_id,_linhas);
 IF auth.uid() IS NOT NULL AND NOT public.tem_setor('comercial') THEN RAISE EXCEPTION 'Sem acesso ao setor Comercial.' USING ERRCODE = '42501'; END IF;
 FOR l IN SELECT * FROM jsonb_array_elements(_linhas) LOOP
  n:=(l->>'linha')::int; cod:=nullif(btrim(l->>'codigo_shop9'),''); tp:=coalesce(nullif(l->>'tipo',''),'venda');
  IF cod IS NULL THEN erros:=erros||jsonb_build_object('linha',n,'campo','codigo_shop9','mensagem','Número da nota vazio.'); CONTINUE; END IF;
  IF tp NOT IN ('venda','devolucao') THEN erros:=erros||jsonb_build_object('linha',n,'campo','tipo','mensagem','Tipo deve ser venda ou devolução.'); CONTINUE; END IF;
  st:=CASE tp WHEN 'devolucao' THEN 'devolucao' ELSE 'saida' END;
  chave:=CASE tp WHEN 'devolucao' THEN 'DEV:'||cod ELSE cod END;
  IF coalesce((l->>'cancelada')::boolean,false) THEN
   DELETE FROM public.vendas WHERE empresa_id=_empresa_id AND codigo_shop9 IN (chave, chave||'/2');
   GET DIAGNOSTICS k=ROW_COUNT; upd:=upd+least(k,1); CONTINUE;
  END IF;
  dt:=(l->>'data_faturamento')::date;
  SELECT * INTO cli FROM public.clientes WHERE empresa_id=_empresa_id AND codigo_shop9=btrim(l->>'cliente_codigo');
  IF NOT FOUND THEN erros:=erros||jsonb_build_object('linha',n,'campo','cliente_codigo','mensagem','Cliente não encontrado.'); CONTINUE; END IF;
  v2_arq:=NULL;
  IF nullif(btrim(l->>'vendedor_2_email'),'') IS NOT NULL THEN
   SELECT u.id INTO v2_arq FROM public.usuarios u JOIN public.usuario_empresas ue ON ue.usuario_id=u.id AND ue.empresa_id=_empresa_id
    WHERE lower(u.email)=lower(btrim(l->>'vendedor_2_email')) LIMIT 1;
   IF v2_arq IS NULL THEN erros:=erros||jsonb_build_object('linha',n,'campo','vendedor_2_email','mensagem','Vendedor 2 não encontrado nesta empresa.'); CONTINUE; END IF;
  END IF;
  vid:=NULL; vid2:=NULL; v1:=NULL; v2:=NULL;
  SELECT id, vendedor_id INTO vid, v1 FROM public.vendas WHERE empresa_id=_empresa_id AND codigo_shop9=chave;
  SELECT id, vendedor_id INTO vid2, v2 FROM public.vendas WHERE empresa_id=_empresa_id AND codigo_shop9=chave||'/2';
  IF vid IS NULL THEN
   orig:=nullif(btrim(l->>'nota_origem'),'');
   IF tp='devolucao' AND orig IS NOT NULL THEN
    SELECT vendedor_id INTO v1 FROM public.vendas WHERE empresa_id=_empresa_id AND codigo_shop9=orig;
    SELECT vendedor_id INTO v2 FROM public.vendas WHERE empresa_id=_empresa_id AND codigo_shop9=orig||'/2';
   END IF;
   IF v1 IS NULL THEN v1:=cli.vendedor_id; v2:=v2_arq; END IF;
  ELSE
   v2:=coalesce(v2_arq, v2);
  END IF;
  IF v2 = v1 THEN v2:=NULL; END IF;
  total:=CASE tp WHEN 'devolucao' THEN -abs((l->>'valor')::numeric) ELSE (l->>'valor')::numeric END;
  p1:=CASE WHEN v2 IS NULL THEN total ELSE round(total/2,2) END;
  IF vid IS NULL THEN
   INSERT INTO public.vendas(empresa_id,cliente_id,vendedor_id,codigo_shop9,data_faturamento,valor,origem,demo,shop9_ordem,shop9_tipo)
   VALUES(_empresa_id,cli.id,v1,chave,dt,p1,'importacao',false,'planilha:'||cod,st) RETURNING id INTO vid; ins:=ins+1;
  ELSE
   UPDATE public.vendas SET cliente_id=cli.id,data_faturamento=dt,valor=p1,origem='importacao',shop9_ordem='planilha:'||cod,shop9_tipo=st WHERE id=vid;
   DELETE FROM public.itens_venda WHERE venda_id=vid; upd:=upd+1;
  END IF;
  IF v2 IS NULL THEN
   DELETE FROM public.vendas WHERE id=vid2;
  ELSIF vid2 IS NULL THEN
   INSERT INTO public.vendas(empresa_id,cliente_id,vendedor_id,codigo_shop9,data_faturamento,valor,origem,demo,shop9_ordem,shop9_tipo)
   VALUES(_empresa_id,cli.id,v2,chave||'/2',dt,total-p1,'importacao',false,'planilha:'||cod,st);
  ELSE
   UPDATE public.vendas SET cliente_id=cli.id,vendedor_id=v2,data_faturamento=dt,valor=total-p1,origem='importacao',shop9_ordem='planilha:'||cod,shop9_tipo=st WHERE id=vid2;
  END IF;
  IF tp='venda' THEN
   INSERT INTO public.itens_venda(empresa_id,venda_id,cliente_id,vendedor_id,produto,codigo_produto,quantidade,valor_total,origem,demo)
   SELECT _empresa_id,vid,cli.id,v1,i->>'produto',nullif(i->>'codigo_produto',''),coalesce((i->>'quantidade')::numeric,1),coalesce((i->>'valor_total')::numeric,0),'importacao',false
   FROM jsonb_array_elements(coalesce(l->'itens','[]')) i WHERE nullif(btrim(i->>'produto'),'') IS NOT NULL;
   UPDATE public.clientes SET data_ultima_compra=dt WHERE id=cli.id AND (data_ultima_compra IS NULL OR data_ultima_compra<dt);
  END IF;
 END LOOP;
 RETURN public.importacao_registrar(_empresa_id,'vendas',_arquivo,jsonb_array_length(_linhas),ins,upd,erros);
END $$;

-- Devolução não conta como compra (recompra, cobertura, última compra, reativação); o faturado já vem líquido.
CREATE OR REPLACE FUNCTION public.painel_vendedor(_empresa_id uuid,_vendedor_id uuid,_hoje date) RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path=public AS $function$
WITH periodo AS (
 SELECT hoje,date_trunc('month',hoje)::date AS inicio FROM (SELECT coalesce(_hoje,(current_timestamp AT TIME ZONE 'America/Maceio')::date) AS hoje) d
), carteira AS (
 SELECT c.* FROM public.clientes c WHERE c.empresa_id=_empresa_id AND c.vendedor_id=_vendedor_id
), interacoes_locais AS (
 SELECT i.cliente_id,(i.data AT TIME ZONE 'America/Maceio')::date AS dia,
 (i.cliente_respondeu OR (i.tipo IN ('visita','ligacao') AND nullif(btrim(i.resultado),'') IS NOT NULL)) AS qualificada
 FROM public.interacoes i JOIN carteira c ON c.id=i.cliente_id WHERE i.empresa_id=_empresa_id
), interacoes_resumo AS (
 SELECT i.cliente_id,max(i.dia) AS ultima_interacao,max(i.dia) FILTER (WHERE i.qualificada) AS ultima_interacao_qualificada,
 bool_or(i.qualificada AND i.dia=p.hoje) AS qualificada_hoje,
 bool_or(i.qualificada AND i.dia BETWEEN p.inicio AND p.hoje) AS qualificada_no_mes
 FROM interacoes_locais i CROSS JOIN periodo p GROUP BY i.cliente_id
), clientes_json AS (
 SELECT c.nome,c.id,jsonb_build_object(
 'id',c.id,'nome',c.nome,'telefone',c.telefone,'segmento',c.segmento,'cidade',c.cidade,'empresa_id',c.empresa_id,'data_ultima_compra',c.data_ultima_compra,
 'compras',coalesce((SELECT jsonb_agg(d.data_faturamento ORDER BY d.data_faturamento DESC) FROM (SELECT DISTINCT v.data_faturamento FROM public.vendas v WHERE v.cliente_id=c.id AND v.empresa_id=_empresa_id AND v.shop9_tipo IS DISTINCT FROM 'devolucao' ORDER BY v.data_faturamento DESC LIMIT 12) d),'[]'::jsonb),
 'comprou_no_mes',EXISTS(SELECT 1 FROM public.vendas v CROSS JOIN periodo p WHERE v.cliente_id=c.id AND v.empresa_id=_empresa_id AND v.shop9_tipo IS DISTINCT FROM 'devolucao' AND v.data_faturamento BETWEEN p.inicio AND p.hoje),
 'ultima_interacao',i.ultima_interacao,'ultima_interacao_qualificada',i.ultima_interacao_qualificada,
 'qualificada_hoje',coalesce(i.qualificada_hoje,false),'qualificada_no_mes',coalesce(i.qualificada_no_mes,false),
 'orcamentos_abertos',coalesce((SELECT jsonb_agg(jsonb_build_object('id',o.id,'valor',o.valor,'data',o.data,'ultimo_followup',o.ultimo_followup) ORDER BY o.data,o.id) FROM public.orcamentos o WHERE o.cliente_id=c.id AND o.empresa_id=_empresa_id AND o.status='aberto'),'[]'::jsonb)
 ) AS dados FROM carteira c LEFT JOIN interacoes_resumo i ON i.cliente_id=c.id
), vendas_resumo AS (
 SELECT coalesce(sum(v.valor),0) AS faturado_mes,coalesce(sum(v.valor) FILTER(WHERE v.data_faturamento=p.hoje),0) AS faturado_hoje
 FROM periodo p LEFT JOIN public.vendas v ON v.empresa_id=_empresa_id AND v.vendedor_id=_vendedor_id AND v.data_faturamento BETWEEN p.inicio AND p.hoje
), orcamentos_resumo AS (
 SELECT count(o.id) AS orcamentos_mes,count(o.id) FILTER(WHERE o.data=p.hoje) AS orcamentos_hoje
 FROM periodo p LEFT JOIN public.orcamentos o ON o.empresa_id=_empresa_id AND o.vendedor_id=_vendedor_id AND o.data BETWEEN p.inicio AND p.hoje
)
SELECT jsonb_build_object(
 'faturado_mes',v.faturado_mes,'faturado_hoje',v.faturado_hoje,
 'meta',(SELECT jsonb_build_object('meta_vendas',m.meta_vendas,'meta_orcamentos',m.meta_orcamentos,'meta_cobertura',m.meta_cobertura,'meta_reativacao',m.meta_reativacao) FROM public.metas m CROSS JOIN periodo p WHERE m.empresa_id=_empresa_id AND m.vendedor_id=_vendedor_id AND m.mes=p.inicio LIMIT 1),
 'orcamentos_mes',o.orcamentos_mes,'orcamentos_hoje',o.orcamentos_hoje,
 'pontos_hoje',(SELECT coalesce(sum(pt.pontos),0) FROM public.pontos pt CROSS JOIN periodo p WHERE pt.empresa_id=_empresa_id AND pt.vendedor_id=_vendedor_id AND pt.data=p.hoje),
 'clientes',coalesce((SELECT jsonb_agg(c.dados ORDER BY c.nome,c.id) FROM clientes_json c),'[]'::jsonb)
) FROM vendas_resumo v CROSS JOIN orcamentos_resumo o;
$function$;

CREATE OR REPLACE FUNCTION public.cobertura_vendedor(_empresa_id uuid,_vendedor_id uuid,_hoje date) RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path=public AS $function$
WITH periodo AS (
 SELECT hoje,date_trunc('month',hoje)::date AS inicio FROM (SELECT coalesce(_hoje,(current_timestamp AT TIME ZONE 'America/Maceio')::date) AS hoje) d
), carteira AS (
 SELECT id FROM public.clientes WHERE empresa_id=_empresa_id AND vendedor_id=_vendedor_id
)
SELECT jsonb_build_object('total',count(*),'cobertos',count(*) FILTER(WHERE
 EXISTS(SELECT 1 FROM public.vendas v WHERE v.cliente_id=c.id AND v.empresa_id=_empresa_id AND v.shop9_tipo IS DISTINCT FROM 'devolucao' AND v.data_faturamento BETWEEN p.inicio AND p.hoje)
 OR EXISTS(SELECT 1 FROM public.interacoes i WHERE i.cliente_id=c.id AND i.empresa_id=_empresa_id AND (i.data AT TIME ZONE 'America/Maceio')::date BETWEEN p.inicio AND p.hoje AND (i.cliente_respondeu OR (i.tipo IN ('visita','ligacao') AND nullif(btrim(i.resultado),'') IS NOT NULL)))
)) FROM carteira c CROSS JOIN periodo p;
$function$;

CREATE OR REPLACE FUNCTION public.painel_gestao(_empresa_id uuid,_hoje date DEFAULT NULL) RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path=public AS $$
WITH p AS (SELECT h AS hoje,date_trunc('month',h)::date AS inicio FROM (SELECT coalesce(_hoje,(current_timestamp AT TIME ZONE 'America/Maceio')::date) h) d),
lim AS (SELECT coalesce((SELECT valor FROM public.configuracoes_regras WHERE empresa_id=_empresa_id AND chave='cliente_sem_compra_dias' LIMIT 1),90) sem_compra,
 coalesce((SELECT valor FROM public.configuracoes_regras WHERE empresa_id=_empresa_id AND chave='cliente_esquecido_dias' LIMIT 1),30) esquecido),
vend AS (SELECT u.id,u.nome,e.nome equipe FROM public.usuarios u LEFT JOIN public.equipes e ON e.id=u.equipe_id
 WHERE public.pode_ver_vendedor(u.id) AND (EXISTS(SELECT 1 FROM public.clientes c WHERE c.empresa_id=_empresa_id AND c.vendedor_id=u.id)
  OR (u.auth_user_id IS NOT NULL AND public.has_role(u.auth_user_id,'vendedor',_empresa_id)))),
cli AS (SELECT c.id,c.vendedor_id,c.data_ultima_compra,
 (SELECT max((i.data AT TIME ZONE 'America/Maceio')::date) FROM public.interacoes i WHERE i.cliente_id=c.id AND i.empresa_id=_empresa_id AND (i.cliente_respondeu OR (i.tipo IN ('visita','ligacao') AND nullif(btrim(i.resultado),'') IS NOT NULL))) ult_q,
 (SELECT max(v.data_faturamento) FROM public.vendas v WHERE v.cliente_id=c.id AND v.empresa_id=_empresa_id AND v.shop9_tipo IS DISTINCT FROM 'devolucao') ult_v
 FROM public.clientes c JOIN vend ON vend.id=c.vendedor_id WHERE c.empresa_id=_empresa_id)
SELECT coalesce(jsonb_agg(jsonb_build_object(
 'vendedor_id',vd.id,'nome',vd.nome,'equipe',vd.equipe,
 'meta',(SELECT to_jsonb(m) FROM public.metas m WHERE m.empresa_id=_empresa_id AND m.vendedor_id=vd.id AND m.mes=p.inicio LIMIT 1),
 'faturado_mes',(SELECT coalesce(sum(valor),0) FROM public.vendas WHERE empresa_id=_empresa_id AND vendedor_id=vd.id AND data_faturamento BETWEEN p.inicio AND p.hoje),
 'faturado_hoje',(SELECT coalesce(sum(valor),0) FROM public.vendas WHERE empresa_id=_empresa_id AND vendedor_id=vd.id AND data_faturamento=p.hoje),
 'clientes_total',(SELECT count(*) FROM cli WHERE cli.vendedor_id=vd.id),
 'clientes_cobertos',(SELECT count(*) FROM cli WHERE cli.vendedor_id=vd.id AND (
   EXISTS(SELECT 1 FROM public.vendas v WHERE v.cliente_id=cli.id AND v.empresa_id=_empresa_id AND v.shop9_tipo IS DISTINCT FROM 'devolucao' AND v.data_faturamento BETWEEN p.inicio AND p.hoje)
   OR EXISTS(SELECT 1 FROM public.interacoes i WHERE i.cliente_id=cli.id AND i.empresa_id=_empresa_id AND (i.data AT TIME ZONE 'America/Maceio')::date BETWEEN p.inicio AND p.hoje AND (i.cliente_respondeu OR (i.tipo IN ('visita','ligacao') AND nullif(btrim(i.resultado),'') IS NOT NULL))))),
 'orcamentos_abertos',coalesce((SELECT jsonb_agg(jsonb_build_object('id',o.id,'cliente_id',o.cliente_id,'valor',o.valor,'data',o.data,'ultimo_followup',o.ultimo_followup,
   'ultima_interacao',(SELECT max((i.data AT TIME ZONE 'America/Maceio')::date) FROM public.interacoes i WHERE i.cliente_id=o.cliente_id AND i.empresa_id=_empresa_id)) ORDER BY o.data,o.id)
   FROM public.orcamentos o WHERE o.empresa_id=_empresa_id AND o.vendedor_id=vd.id AND o.status='aberto'),'[]'::jsonb),
 'clientes_sem_compra_90',(SELECT count(*) FROM cli WHERE cli.vendedor_id=vd.id AND (cli.data_ultima_compra IS NULL OR p.hoje-cli.data_ultima_compra>=l.sem_compra)),
 'esquecidos',(SELECT count(*) FROM cli WHERE cli.vendedor_id=vd.id AND coalesce(p.hoje-GREATEST(cli.ult_q,cli.ult_v,cli.data_ultima_compra),2147483647)>=l.esquecido)
) ORDER BY vd.nome,vd.id),'[]'::jsonb) FROM vend vd CROSS JOIN p CROSS JOIN lim l;
$$;

CREATE OR REPLACE FUNCTION public.gam_vendas_batida(_empresa uuid,_vendedor uuid,_dia date) RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE meta numeric; antes numeric; hoje_v numeric; rest int; ini date:=date_trunc('month',_dia)::date;
BEGIN
 IF NOT public.gam_dia_util(_empresa,_dia) THEN RETURN false; END IF;
 SELECT meta_vendas INTO meta FROM public.metas WHERE empresa_id=_empresa AND vendedor_id=_vendedor AND mes=ini LIMIT 1;
 IF coalesce(meta,0)<=0 THEN RETURN false; END IF;
 SELECT coalesce(sum(valor) FILTER(WHERE data_faturamento<_dia),0),coalesce(sum(valor) FILTER(WHERE data_faturamento=_dia),0) INTO antes,hoje_v
  FROM public.vendas WHERE empresa_id=_empresa AND vendedor_id=_vendedor AND data_faturamento BETWEEN ini AND _dia;
 rest:=public.gam_uteis_restantes(_empresa,_dia);
 IF rest<=0 THEN RETURN false; END IF;
 -- Meta do mês já batida: segue pontuando com a média diária do mês (decisão da diretoria, 17/11/2026).
 IF meta-antes<=0 THEN
  RETURN hoje_v>=meta/greatest(1,(SELECT count(*) FROM generate_series(ini,(ini+interval '1 month -1 day')::date,interval '1 day') g(d) WHERE public.gam_dia_util(_empresa,g.d::date)));
 END IF;
 RETURN hoje_v>=(meta-antes)/rest;
END $$;

CREATE OR REPLACE FUNCTION public.calcular_pontos_dia(_empresa_id uuid,_vendedor_id uuid,_dia date) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE util boolean; ini date:=date_trunc('month',_dia)::date; rest int; m public.metas; n_hoje numeric; n_antes numeric; carteira int; alvo numeric; limite numeric;
 p_v int:=0; p_o int:=0; p_c int:=0; p_r int:=0; p_i int:=0; res jsonb; eh_demo boolean;
BEGIN
 PERFORM public.gam_permitido(_empresa_id,_vendedor_id);
 IF auth.uid() IS NOT NULL AND NOT public.tem_setor('comercial') THEN RAISE EXCEPTION 'Sem acesso ao setor Comercial.' USING ERRCODE = '42501'; END IF;
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
    WHERE v.empresa_id=_empresa_id AND v.shop9_tipo IS DISTINCT FROM 'devolucao' AND v.data_faturamento BETWEEN ini AND _dia)
  SELECT count(DISTINCT cliente_id) FILTER(WHERE dia=_dia),count(DISTINCT cliente_id) FILTER(WHERE dia<_dia) INTO n_hoje,n_antes FROM q;
  alvo:=ceil((m.meta_cobertura/100.0*carteira-n_antes)/rest);
  IF alvo>0 AND n_hoje>=alvo THEN p_c:=public.gam_regra(_empresa_id,'peso_cobertura',20); END IF;
 END IF;
 limite:=public.gam_regra(_empresa_id,'cliente_sem_compra_dias',90);
 SELECT count(*) INTO n_hoje FROM (SELECT DISTINCT v.cliente_id FROM public.vendas v WHERE v.empresa_id=_empresa_id AND v.vendedor_id=_vendedor_id AND v.shop9_tipo IS DISTINCT FROM 'devolucao' AND v.data_faturamento=_dia
  AND _dia-(SELECT max(a.data_faturamento) FROM public.vendas a WHERE a.cliente_id=v.cliente_id AND a.empresa_id=_empresa_id AND a.shop9_tipo IS DISTINCT FROM 'devolucao' AND a.data_faturamento<_dia)>=limite) r;
 p_r:=n_hoje*public.gam_regra(_empresa_id,'peso_reativacao',20);
 SELECT count(*) INTO n_hoje FROM public.posts_instagram WHERE empresa_id=_empresa_id AND vendedor_id=_vendedor_id AND data_post=_dia AND status='aprovado';
 p_i:=n_hoje*public.gam_regra(_empresa_id,'peso_instagram',5);
 res:=jsonb_build_object('vendas',p_v,'orcamentos',p_o,'cobertura',p_c,'reativacao',p_r,'instagram',p_i);
 INSERT INTO public.pontos(empresa_id,vendedor_id,data,indicador,pontos,demo)
 SELECT _empresa_id,_vendedor_id,_dia,k,v::int,coalesce(eh_demo,false) FROM jsonb_each_text(res) x(k,v)
 ON CONFLICT(empresa_id,vendedor_id,data,indicador) DO UPDATE SET pontos=EXCLUDED.pontos;
 RETURN res;
END $$;

-- Ficha do cliente: devolução marcada; quantidade e ticket só de vendas, por nota.
CREATE OR REPLACE FUNCTION public.ficha_cliente(_cliente_id uuid, _hoje date DEFAULT NULL) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path=public AS $$
DECLARE h date:=coalesce(_hoje,(current_timestamp AT TIME ZONE 'America/Maceio')::date); c public.clientes; ini date;
BEGIN
 SELECT * INTO c FROM public.clientes WHERE id=_cliente_id;
 IF NOT FOUND THEN RETURN NULL; END IF;
 ini:=(h - interval '12 months')::date;
 RETURN jsonb_build_object(
  'cliente', jsonb_build_object('id',c.id,'empresa_id',c.empresa_id,'vendedor_id',c.vendedor_id,'nome',c.nome,'telefone',c.telefone,'email',c.email,'documento',c.documento,'segmento',c.segmento,'cidade',c.cidade,'codigo_shop9',c.codigo_shop9,'etiquetas',to_jsonb(c.etiquetas),'data_ultima_compra',c.data_ultima_compra),
  -- Uma linha por nota (as partes de uma venda compartilhada somadas); devolução marcada e negativa.
  'compras', coalesce((SELECT jsonb_agg(x ORDER BY x->>'data' DESC) FROM (
     SELECT jsonb_build_object('id',min(v.id::text),'data',max(v.data_faturamento),'valor',sum(v.valor),
       'tipo',CASE WHEN v.shop9_tipo='devolucao' THEN 'devolucao' ELSE 'venda' END,'codigo_shop9',min(v.codigo_shop9),
       'itens',coalesce((SELECT jsonb_agg(jsonb_build_object('produto',i.produto,'codigo_produto',i.codigo_produto,'quantidade',i.quantidade,'valor_total',i.valor_total) ORDER BY i.produto)
          FROM public.itens_venda i WHERE i.venda_id=ANY(array_agg(v.id))),'[]')) x
     FROM public.vendas v WHERE v.cliente_id=c.id AND v.data_faturamento<=h
     GROUP BY v.shop9_tipo, coalesce(v.shop9_ordem, v.id::text) ORDER BY max(v.data_faturamento) DESC, max(v.created_at) DESC LIMIT 24) s),'[]'),
  'total_12m', (SELECT coalesce(sum(valor),0) FROM public.vendas WHERE cliente_id=c.id AND data_faturamento>ini AND data_faturamento<=h),
  'qtd_12m', (SELECT count(DISTINCT coalesce(shop9_ordem, id::text)) FROM public.vendas WHERE cliente_id=c.id AND shop9_tipo IS DISTINCT FROM 'devolucao' AND data_faturamento>ini AND data_faturamento<=h),
  'ticket_medio_12m', (SELECT coalesce(round(sum(valor)/nullif(count(DISTINCT coalesce(shop9_ordem, id::text)),0),2),0) FROM public.vendas WHERE cliente_id=c.id AND shop9_tipo IS DISTINCT FROM 'devolucao' AND data_faturamento>ini AND data_faturamento<=h),
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

-- D4. Carrinho sempre com o preço de tabela do dia: o recálculo (a cada item e na conclusão) atualiza os preços.
CREATE OR REPLACE FUNCTION public.carrinho_recalcular(_carrinho_id uuid) RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
 UPDATE public.itens_carrinho i SET preco_unit=p.preco_tabela, total=round(p.preco_tabela*i.quantidade*(1-i.desconto_pct/100),2)
  FROM public.produtos p WHERE i.carrinho_id=_carrinho_id AND p.id=i.produto_id AND i.preco_unit IS DISTINCT FROM p.preco_tabela;
 UPDATE public.carrinhos SET total=coalesce((SELECT sum(total) FROM public.itens_carrinho WHERE carrinho_id=_carrinho_id),0), atualizado_em=now() WHERE id=_carrinho_id;
$$;

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
 IF EXISTS(SELECT 1 FROM public.itens_carrinho i JOIN public.produtos p ON p.id=i.produto_id WHERE i.carrinho_id=c.id AND NOT p.ativo) THEN
  RAISE EXCEPTION 'Há produto fora de linha no carrinho: remova antes de concluir.' USING ERRCODE='P0001'; END IF;
 PERFORM public.carrinho_recalcular(c.id);
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

-- D1. Lista do vendedor: notas com mais de um vendedor em que quem chama participa, com cliente, total, sua parte,
-- os outros vendedores e os itens. Papel 1 = a linha com os itens (ou sem o "/2" na planilha).
CREATE FUNCTION public.minhas_vendas_compartilhadas(_empresa_id uuid, _desde date DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE eu uuid := public.meu_usuario_id();
BEGIN
 IF eu IS NULL OR NOT public.tem_empresa(_empresa_id) THEN RAISE EXCEPTION 'Sem acesso a esta empresa.' USING ERRCODE = '42501'; END IF;
 IF NOT public.tem_setor('comercial') THEN RAISE EXCEPTION 'Sem acesso ao setor Comercial.' USING ERRCODE = '42501'; END IF;
 RETURN coalesce((SELECT jsonb_agg(x ORDER BY x->>'data' DESC, x->>'codigo_shop9') FROM (
  SELECT jsonb_build_object('id', m.id, 'codigo_shop9', regexp_replace(m.codigo_shop9, '/2$', ''), 'data', m.data_faturamento,
   'tipo', CASE WHEN m.shop9_tipo = 'devolucao' THEN 'devolucao' ELSE 'venda' END,
   'valor', (SELECT sum(w.valor) FROM public.vendas w WHERE w.empresa_id = m.empresa_id AND w.shop9_ordem = m.shop9_ordem AND w.shop9_tipo IS NOT DISTINCT FROM m.shop9_tipo),
   'minha_parte', m.valor,
   'papel', CASE WHEN EXISTS (SELECT 1 FROM public.itens_venda i WHERE i.venda_id = m.id) THEN 1
                 WHEN EXISTS (SELECT 1 FROM public.itens_venda i JOIN public.vendas w ON w.id = i.venda_id WHERE w.empresa_id = m.empresa_id AND w.shop9_ordem = m.shop9_ordem AND w.shop9_tipo IS NOT DISTINCT FROM m.shop9_tipo) THEN 2
                 WHEN m.codigo_shop9 LIKE '%/2' THEN 2 ELSE 1 END,
   'cliente', c.nome,
   'outro_vendedor', (SELECT string_agg(DISTINCT u.nome, ', ') FROM public.vendas w JOIN public.usuarios u ON u.id = w.vendedor_id
      WHERE w.empresa_id = m.empresa_id AND w.shop9_ordem = m.shop9_ordem AND w.shop9_tipo IS NOT DISTINCT FROM m.shop9_tipo AND w.vendedor_id <> eu),
   'itens', coalesce((SELECT jsonb_agg(jsonb_build_object('produto', i.produto, 'quantidade', i.quantidade, 'valor_total', i.valor_total) ORDER BY i.produto)
      FROM public.itens_venda i JOIN public.vendas w ON w.id = i.venda_id
      WHERE w.empresa_id = m.empresa_id AND w.shop9_ordem = m.shop9_ordem AND w.shop9_tipo IS NOT DISTINCT FROM m.shop9_tipo), '[]')) x
  FROM public.vendas m JOIN public.clientes c ON c.id = m.cliente_id
  WHERE m.empresa_id = _empresa_id AND m.vendedor_id = eu AND m.shop9_ordem IS NOT NULL
    AND m.data_faturamento >= coalesce(_desde, (now() AT TIME ZONE 'America/Maceio')::date - 365)
    AND EXISTS (SELECT 1 FROM public.vendas w WHERE w.empresa_id = m.empresa_id AND w.shop9_ordem = m.shop9_ordem
                AND w.shop9_tipo IS NOT DISTINCT FROM m.shop9_tipo AND w.vendedor_id IS DISTINCT FROM eu)
  ORDER BY m.data_faturamento DESC LIMIT 200) s), '[]'::jsonb);
END $$;
REVOKE ALL ON FUNCTION public.minhas_vendas_compartilhadas(uuid, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.minhas_vendas_compartilhadas(uuid, date) TO authenticated;
```

## Testes (SQL puro, nada fica gravado)

```sql
BEGIN;
DO $t$
DECLARE
  emp uuid; n int; ok boolean;
  x_id uuid := gen_random_uuid(); x_auth uuid := gen_random_uuid();  -- administrador sem acesso total
  d_id uuid := gen_random_uuid(); d_auth uuid := gen_random_uuid();  -- diretoria, começa sem setor
  v_id uuid := gen_random_uuid(); v_auth uuid := gen_random_uuid();  -- vendedor com setor Comercial
  v2_id uuid := gen_random_uuid();                                  -- outro vendedor (sem login)
  c1 uuid := gen_random_uuid(); c2 uuid := gen_random_uuid(); c3 uuid := gen_random_uuid();
  p1 uuid; p2 uuid; n2 uuid; car uuid; orc uuid; r jsonb; x numeric;
BEGIN
  SELECT id INTO emp FROM public.empresas WHERE nome = 'CENTERFRIOS';
  IF emp IS NULL THEN RAISE EXCEPTION 'FALHA 0: empresa não encontrada'; END IF;
  INSERT INTO public.usuarios(id, nome, email, empresa_id) VALUES
   (x_id, 'Admin teste 22', 'teste22.admin@centerfrios.com', emp),
   (d_id, 'Diretoria teste 22', 'teste22.diretoria@centerfrios.com', emp),
   (v_id, 'Vendedor teste 22', 'teste22.vendedor@centerfrios.com', emp),
   (v2_id, 'Vendedor 2 teste 22', 'teste22.vendedor2@centerfrios.com', emp);
  INSERT INTO public.usuario_empresas(usuario_id, empresa_id) VALUES (x_id, emp), (d_id, emp), (v_id, emp);
  INSERT INTO public.papeis_pre_cadastro(usuario_id, role, empresa_id) VALUES
   (x_id, 'administrador', NULL), (d_id, 'diretoria', NULL), (v_id, 'vendedor', emp);
  INSERT INTO public.usuario_setores(usuario_id, setor) VALUES (v_id, 'comercial');
  INSERT INTO auth.users(id, instance_id, aud, role, email, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at) VALUES
   (x_auth, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'teste22.admin@centerfrios.com', now(), '{}', '{}', now(), now()),
   (d_auth, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'teste22.diretoria@centerfrios.com', now(), '{}', '{}', now(), now()),
   (v_auth, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'teste22.vendedor@centerfrios.com', now(), '{}', '{}', now(), now());
  INSERT INTO public.clientes(id, empresa_id, vendedor_id, nome, codigo_shop9) VALUES
   (c1, emp, v_id, 'Cliente 1 teste 22', 'T22C1'), (c2, emp, v2_id, 'Cliente 2 teste 22', 'T22C2');
  INSERT INTO public.registro_auditoria(empresa_id, acao, tabela, registro_id) VALUES
   (emp, 'teste22', 'clientes', c1), (emp, 'teste22', 'usuarios', x_id);

  -- 1 (S1). Administrador sem acesso total não grava papel direto nem se dá diretoria; dá a outra pessoa.
  PERFORM set_config('request.jwt.claims', json_build_object('sub', x_auth, 'role', 'authenticated')::text, true);
  EXECUTE 'set local role authenticated';
  ok := false; BEGIN INSERT INTO public.user_roles(user_id, role) VALUES (x_auth, 'diretoria'); EXCEPTION WHEN insufficient_privilege THEN ok := true; END;
  IF NOT ok THEN RAISE EXCEPTION 'FALHA 1a: gravou papel direto em user_roles'; END IF;
  ok := false; BEGIN INSERT INTO public.usuario_empresas(usuario_id, empresa_id) VALUES (v2_id, emp); EXCEPTION WHEN insufficient_privilege THEN ok := true; END;
  IF NOT ok THEN RAISE EXCEPTION 'FALHA 1b: gravou vínculo direto'; END IF;
  ok := false; BEGIN PERFORM public.admin_salvar_acessos(x_id, ARRAY['administrador','diretoria']::public.app_role[], ARRAY[emp], ARRAY['comercial']); EXCEPTION WHEN insufficient_privilege THEN ok := true; END;
  IF NOT ok THEN RAISE EXCEPTION 'FALHA 1c: administrador se deu diretoria'; END IF;
  PERFORM public.admin_salvar_acessos(v_id, ARRAY['vendedor']::public.app_role[], ARRAY[emp], ARRAY['comercial']);
  EXECUTE 'reset role';

  -- 3 (S3). Sem o setor Comercial, a auditoria comercial some; a administrativa continua para o administrador.
  PERFORM set_config('request.jwt.claims', json_build_object('sub', d_auth, 'role', 'authenticated')::text, true);
  EXECUTE 'set local role authenticated';
  SELECT count(*) INTO n FROM public.registro_auditoria WHERE acao = 'teste22' AND tabela = 'clientes';
  IF n <> 0 THEN RAISE EXCEPTION 'FALHA 3a: diretoria sem setor leu auditoria comercial'; END IF;
  EXECUTE 'reset role';
  INSERT INTO public.usuario_setores(usuario_id, setor) VALUES (d_id, 'comercial');
  EXECUTE 'set local role authenticated';
  SELECT count(*) INTO n FROM public.registro_auditoria WHERE acao = 'teste22' AND tabela = 'clientes';
  IF n <> 1 THEN RAISE EXCEPTION 'FALHA 3b: diretoria com setor não leu auditoria comercial'; END IF;
  EXECUTE 'reset role';
  PERFORM set_config('request.jwt.claims', json_build_object('sub', x_auth, 'role', 'authenticated')::text, true);
  EXECUTE 'set local role authenticated';
  SELECT count(*) INTO n FROM public.registro_auditoria WHERE acao = 'teste22' AND tabela = 'usuarios';
  IF n <> 1 THEN RAISE EXCEPTION 'FALHA 3c: administrador perdeu a auditoria administrativa'; END IF;
  EXECUTE 'reset role';

  -- 2 (S2). Contato só de cliente da carteira, com data de agora e sem marca de demonstração.
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_auth, 'role', 'authenticated')::text, true);
  EXECUTE 'set local role authenticated';
  INSERT INTO public.interacoes(empresa_id, cliente_id, vendedor_id, tipo, cliente_respondeu) VALUES (emp, c1, v_id, 'whatsapp', true);
  ok := false; BEGIN INSERT INTO public.interacoes(empresa_id, cliente_id, vendedor_id, tipo) VALUES (emp, c2, v_id, 'whatsapp'); EXCEPTION WHEN insufficient_privilege THEN ok := true; END;
  IF NOT ok THEN RAISE EXCEPTION 'FALHA 2a: contato em cliente de outra carteira'; END IF;
  ok := false; BEGIN INSERT INTO public.interacoes(empresa_id, cliente_id, vendedor_id, tipo, data) VALUES (emp, c1, v_id, 'visita', now() - interval '10 days'); EXCEPTION WHEN insufficient_privilege THEN ok := true; END;
  IF NOT ok THEN RAISE EXCEPTION 'FALHA 2b: contato com data antiga'; END IF;
  ok := false; BEGIN INSERT INTO public.interacoes(empresa_id, cliente_id, vendedor_id, tipo, demo) VALUES (emp, c1, v_id, 'visita', true); EXCEPTION WHEN insufficient_privilege THEN ok := true; END;
  IF NOT ok THEN RAISE EXCEPTION 'FALHA 2c: contato marcado como demonstração'; END IF;

  -- 4 (S4). Post: só http(s), dos últimos 7 dias e sem repetir.
  INSERT INTO public.posts_instagram(empresa_id, vendedor_id, url, legenda, data_post)
   VALUES (emp, v_id, 'https://instagram.com/p/teste22', '@centerfriosoficial', (now() AT TIME ZONE 'America/Maceio')::date);
  ok := false; BEGIN INSERT INTO public.posts_instagram(empresa_id, vendedor_id, url, legenda, data_post)
   VALUES (emp, v_id, 'https://instagram.com/p/teste22', '@centerfriosoficial', (now() AT TIME ZONE 'America/Maceio')::date); EXCEPTION WHEN insufficient_privilege THEN ok := true; END;
  IF NOT ok THEN RAISE EXCEPTION 'FALHA 4a: post repetido'; END IF;
  ok := false; BEGIN INSERT INTO public.posts_instagram(empresa_id, vendedor_id, url, legenda, data_post)
   VALUES (emp, v_id, 'javascript:alert(1)', '@centerfriosoficial', (now() AT TIME ZONE 'America/Maceio')::date); EXCEPTION WHEN check_violation THEN ok := true; END;
  IF NOT ok THEN RAISE EXCEPTION 'FALHA 4b: endereço que não é http(s)'; END IF;
  ok := false; BEGIN INSERT INTO public.posts_instagram(empresa_id, vendedor_id, url, legenda, data_post)
   VALUES (emp, v_id, 'https://instagram.com/p/teste22b', '@centerfriosoficial', (now() AT TIME ZONE 'America/Maceio')::date - 30); EXCEPTION WHEN insufficient_privilege THEN ok := true; END;
  IF NOT ok THEN RAISE EXCEPTION 'FALHA 4c: post de 30 dias atrás'; END IF;
  EXECUTE 'reset role';

  -- 5 (S5). Carga de demonstração só pelo servidor.
  IF has_function_privilege('authenticated', 'public.carregar_dados_demo(uuid[])', 'EXECUTE') THEN
    RAISE EXCEPTION 'FALHA 5: authenticated ainda carrega demonstração'; END IF;

  -- 6 (R3). Reimportar a nota depois de trocar a carteira mantém o vendedor da venda.
  PERFORM set_config('request.jwt.claims', json_build_object('sub', d_auth, 'role', 'authenticated')::text, true);
  EXECUTE 'set local role authenticated';
  PERFORM public.importar_vendas(emp, 'teste23.csv', jsonb_build_array(jsonb_build_object('linha', 2, 'codigo_shop9', 'T22N1',
   'cliente_codigo', 'T22C1', 'data_faturamento', '2026-11-10', 'valor', 100, 'itens', jsonb_build_array(jsonb_build_object('produto', 'Item teste', 'quantidade', 1, 'valor_total', 100)))));
  EXECUTE 'reset role';
  PERFORM set_config('request.jwt.claims', json_build_object('role', 'service_role')::text, true);
  EXECUTE 'set local role service_role';
  UPDATE public.clientes SET vendedor_id = v2_id WHERE id = c1;
  EXECUTE 'reset role';
  PERFORM set_config('request.jwt.claims', json_build_object('sub', d_auth, 'role', 'authenticated')::text, true);
  EXECUTE 'set local role authenticated';
  PERFORM public.importar_vendas(emp, 'teste23.csv', jsonb_build_array(jsonb_build_object('linha', 2, 'codigo_shop9', 'T22N1',
   'cliente_codigo', 'T22C1', 'data_faturamento', '2026-11-10', 'valor', 120, 'itens', jsonb_build_array(jsonb_build_object('produto', 'Item teste', 'quantidade', 1, 'valor_total', 120)))));
  EXECUTE 'reset role';
  SELECT count(*) INTO n FROM public.vendas WHERE empresa_id = emp AND codigo_shop9 = 'T22N1' AND vendedor_id = v_id AND valor = 120;
  IF n <> 1 THEN RAISE EXCEPTION 'FALHA 6a: reimportação trocou o vendedor ou não atualizou o valor'; END IF;
  SELECT count(*) INTO n FROM public.itens_venda i JOIN public.vendas v ON v.id = i.venda_id WHERE v.codigo_shop9 = 'T22N1' AND v.empresa_id = emp AND i.vendedor_id = v_id;
  IF n <> 1 THEN RAISE EXCEPTION 'FALHA 6b: itens com outro vendedor'; END IF;

  -- 7 (D1, D2). Venda com vendedor 2 vira uma linha para cada (50%); devolução abate dos dois; não conta como compra.
  PERFORM set_config('request.jwt.claims', json_build_object('sub', d_auth, 'role', 'authenticated')::text, true);
  EXECUTE 'set local role authenticated';
  PERFORM public.importar_vendas(emp, 'teste23.csv', jsonb_build_array(
   jsonb_build_object('linha', 2, 'codigo_shop9', 'T22N2', 'cliente_codigo', 'T22C2', 'data_faturamento', '2026-11-12', 'valor', 1000,
    'vendedor_2_email', 'teste22.vendedor@centerfrios.com', 'tipo', 'venda',
    'itens', jsonb_build_array(jsonb_build_object('produto', 'Item compartilhado', 'quantidade', 1, 'valor_total', 1000))),
   jsonb_build_object('linha', 3, 'codigo_shop9', 'T22D1', 'cliente_codigo', 'T22C2', 'data_faturamento', '2026-11-13', 'valor', 200,
    'tipo', 'devolucao', 'nota_origem', 'T22N2')));
  r := public.painel_vendedor(emp, v_id, '2026-11-20');
  IF (r->>'faturado_mes')::numeric <> 520 THEN RAISE EXCEPTION 'FALHA 7a: vendedor 2 esperado 520 (120 + 500 - 100), veio %', r->>'faturado_mes'; END IF;
  r := public.painel_vendedor(emp, v2_id, '2026-11-20');
  IF (r->>'faturado_mes')::numeric <> 400 THEN RAISE EXCEPTION 'FALHA 7b: vendedor 1 esperado 400 (500 - 100), veio %', r->>'faturado_mes'; END IF;
  SELECT count(*) INTO n FROM jsonb_array_elements(r->'clientes') c WHERE c->>'id' = c2::text AND c->'compras' = '["2026-11-12"]'::jsonb;
  IF n <> 1 THEN RAISE EXCEPTION 'FALHA 7c: devolução apareceu como compra'; END IF;
  EXECUTE 'reset role';
  IF (SELECT data_ultima_compra FROM public.clientes WHERE id = c2) <> '2026-11-12' THEN RAISE EXCEPTION 'FALHA 7d: devolução mudou a última compra'; END IF;
  SELECT count(*) INTO n FROM public.vendas WHERE empresa_id = emp AND shop9_ordem = 'planilha:T22N2' AND shop9_tipo = 'saida';
  IF n <> 2 THEN RAISE EXCEPTION 'FALHA 7e: venda compartilhada não virou duas linhas (%)', n; END IF;
  SELECT id INTO n2 FROM public.vendas WHERE empresa_id = emp AND codigo_shop9 = 'T22N2';

  -- 8 (D3). Meta do mês já batida: segue pontuando no dia com venda; sem venda, não.
  INSERT INTO public.metas(empresa_id, vendedor_id, mes, meta_vendas, meta_orcamentos, meta_cobertura, meta_reativacao) VALUES (emp, v_id, '2026-11-01', 100, 0, 0, 0);
  IF NOT public.gam_vendas_batida(emp, v_id, '2026-11-12') THEN RAISE EXCEPTION 'FALHA 8a: parou de pontuar depois da meta'; END IF;
  IF public.gam_vendas_batida(emp, v_id, '2026-11-11') THEN RAISE EXCEPTION 'FALHA 8b: pontuou sem venda no dia'; END IF;

  -- 10 (D2). A ficha soma as partes por nota, marca a devolução e não a conta como compra.
  PERFORM set_config('request.jwt.claims', json_build_object('sub', d_auth, 'role', 'authenticated')::text, true);
  EXECUTE 'set local role authenticated';
  r := public.ficha_cliente(c2, '2026-11-20');
  IF NOT (r->'compras') @> '[{"tipo":"devolucao","valor":-200},{"tipo":"venda","valor":1000}]'::jsonb
     OR (r->>'qtd_12m')::int <> 1 OR (r->>'total_12m')::numeric <> 800 THEN
    RAISE EXCEPTION 'FALHA 10: ficha errada (%)', r->'compras'; END IF;

  -- 11 (D1). O vendedor 2 vê os itens da nota compartilhada (que ficam na linha do vendedor 1).
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_auth, 'role', 'authenticated')::text, true);
  SELECT count(*) INTO n FROM public.itens_venda WHERE venda_id = n2;
  IF n <> 1 THEN RAISE EXCEPTION 'FALHA 11: vendedor 2 não vê os itens da venda compartilhada (viu %)', n; END IF;

  -- 12 (D1). A lista do vendedor traz as notas compartilhadas dele, com total, parte e itens; sem o setor, recusa.
  r := public.minhas_vendas_compartilhadas(emp, '2026-01-01');
  IF NOT r @> '[{"codigo_shop9":"T22N2","valor":1000,"minha_parte":500,"papel":2,"cliente":"Cliente 2 teste 22"}]'::jsonb
     OR NOT r @> '[{"codigo_shop9":"DEV:T22D1","tipo":"devolucao","minha_parte":-100}]'::jsonb
     OR jsonb_array_length((SELECT e->'itens' FROM jsonb_array_elements(r) e WHERE e->>'codigo_shop9' = 'T22N2')) <> 1 THEN
    RAISE EXCEPTION 'FALHA 12a: lista do vendedor 2 incompleta (%)', r; END IF;
  EXECUTE 'reset role';
  PERFORM set_config('request.jwt.claims', json_build_object('sub', x_auth, 'role', 'authenticated')::text, true);
  EXECUTE 'set local role authenticated';
  ok := false; BEGIN PERFORM public.minhas_vendas_compartilhadas(emp, NULL); EXCEPTION WHEN insufficient_privilege THEN ok := true; END;
  IF NOT ok THEN RAISE EXCEPTION 'FALHA 12b: sem o setor Comercial leu a lista'; END IF;
  EXECUTE 'reset role';

  -- 13 (D2). Nota cancelada sai do resultado (as duas linhas).
  PERFORM set_config('request.jwt.claims', json_build_object('sub', d_auth, 'role', 'authenticated')::text, true);
  EXECUTE 'set local role authenticated';
  PERFORM public.importar_vendas(emp, 'teste23.csv', jsonb_build_array(jsonb_build_object('linha', 2, 'codigo_shop9', 'T22N2', 'cancelada', true)));
  EXECUTE 'reset role';
  IF EXISTS (SELECT 1 FROM public.vendas WHERE empresa_id = emp AND codigo_shop9 IN ('T22N2', 'T22N2/2')) THEN RAISE EXCEPTION 'FALHA 13: nota cancelada continuou'; END IF;

  -- 9 (D4). Carrinho conclui com o preço de tabela do dia e recusa produto fora de linha.
  INSERT INTO public.clientes(id, empresa_id, vendedor_id, nome, codigo_shop9) VALUES (c3, emp, v_id, 'Cliente 3 teste 22', 'T22C3');
  INSERT INTO public.produtos(empresa_id, codigo_shop9, descricao, preco_tabela) VALUES (emp, 'T22P1', 'Produto 1 teste 22', 10) RETURNING id INTO p1;
  INSERT INTO public.produtos(empresa_id, codigo_shop9, descricao, preco_tabela) VALUES (emp, 'T22P2', 'Produto 2 teste 22', 10) RETURNING id INTO p2;
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_auth, 'role', 'authenticated')::text, true);
  EXECUTE 'set local role authenticated';
  car := public.abrir_carrinho(c3);
  PERFORM public.adicionar_item_carrinho(car, p1, 2, 0);
  EXECUTE 'reset role';
  UPDATE public.produtos SET preco_tabela = 12 WHERE id = p1;
  EXECUTE 'set local role authenticated';
  orc := public.concluir_carrinho(car);
  EXECUTE 'reset role';
  SELECT valor INTO x FROM public.orcamentos WHERE id = orc;
  IF x <> 24 THEN RAISE EXCEPTION 'FALHA 9a: orçamento com preço antigo (esperado 24, veio %)', x; END IF;
  EXECUTE 'set local role authenticated';
  car := public.abrir_carrinho(c3);
  PERFORM public.adicionar_item_carrinho(car, p2, 1, 0);
  EXECUTE 'reset role';
  UPDATE public.produtos SET ativo = false WHERE id = p2;
  EXECUTE 'set local role authenticated';
  ok := false; BEGIN PERFORM public.concluir_carrinho(car); EXCEPTION WHEN raise_exception THEN ok := true; END;
  IF NOT ok THEN RAISE EXCEPTION 'FALHA 9b: concluiu com produto fora de linha'; END IF;
  EXECUTE 'reset role';

  RAISE NOTICE 'Texto 22: testes 1 a 13 passaram.';
END $t$;
ROLLBACK;
```

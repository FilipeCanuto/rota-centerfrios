CREATE FUNCTION public.painel_vendedor(_empresa_id uuid,_vendedor_id uuid,_hoje date) RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path=public AS $function$
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
 'compras',coalesce((SELECT jsonb_agg(d.data_faturamento ORDER BY d.data_faturamento DESC) FROM (SELECT DISTINCT v.data_faturamento FROM public.vendas v WHERE v.cliente_id=c.id AND v.empresa_id=_empresa_id ORDER BY v.data_faturamento DESC LIMIT 12) d),'[]'::jsonb),
 'comprou_no_mes',EXISTS(SELECT 1 FROM public.vendas v CROSS JOIN periodo p WHERE v.cliente_id=c.id AND v.empresa_id=_empresa_id AND v.data_faturamento BETWEEN p.inicio AND p.hoje),
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
REVOKE ALL ON FUNCTION public.painel_vendedor(uuid,uuid,date) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.painel_vendedor(uuid,uuid,date) TO authenticated,service_role;
CREATE FUNCTION public.cobertura_vendedor(_empresa_id uuid,_vendedor_id uuid,_hoje date) RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path=public AS $function$
WITH periodo AS (
 SELECT hoje,date_trunc('month',hoje)::date AS inicio FROM (SELECT coalesce(_hoje,(current_timestamp AT TIME ZONE 'America/Maceio')::date) AS hoje) d
), carteira AS (
 SELECT id FROM public.clientes WHERE empresa_id=_empresa_id AND vendedor_id=_vendedor_id
)
SELECT jsonb_build_object('total',count(*),'cobertos',count(*) FILTER(WHERE
 EXISTS(SELECT 1 FROM public.vendas v WHERE v.cliente_id=c.id AND v.empresa_id=_empresa_id AND v.data_faturamento BETWEEN p.inicio AND p.hoje)
 OR EXISTS(SELECT 1 FROM public.interacoes i WHERE i.cliente_id=c.id AND i.empresa_id=_empresa_id AND (i.data AT TIME ZONE 'America/Maceio')::date BETWEEN p.inicio AND p.hoje AND (i.cliente_respondeu OR (i.tipo IN ('visita','ligacao') AND nullif(btrim(i.resultado),'') IS NOT NULL)))
)) FROM carteira c CROSS JOIN periodo p;
$function$;
REVOKE ALL ON FUNCTION public.cobertura_vendedor(uuid,uuid,date) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.cobertura_vendedor(uuid,uuid,date) TO authenticated,service_role;
COMMENT ON FUNCTION public.painel_vendedor(uuid,uuid,date) IS 'Agregados sob RLS do chamador; eventos em America/Maceio; sem regras de negócio ou cálculo de dias úteis. Histórico: últimas 12 datas distintas de compra.';
COMMENT ON FUNCTION public.cobertura_vendedor(uuid,uuid,date) IS 'Contagem leve da carteira com venda ou interação qualificada no mês até a data local indicada, sob RLS.';
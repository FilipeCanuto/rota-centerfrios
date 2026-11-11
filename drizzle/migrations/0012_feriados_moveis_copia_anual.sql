ALTER TABLE public.feriados DROP CONSTRAINT feriados_abrangencia_valida;
ALTER TABLE public.feriados ADD CONSTRAINT feriados_abrangencia_valida CHECK (abrangencia IN ('nacional','estadual','municipal','empresa'));
ALTER TABLE public.feriados ADD COLUMN data_movel boolean NOT NULL DEFAULT false;
COMMENT ON COLUMN public.feriados.data_movel IS 'Datas que mudam a cada ano não são copiadas pela função copiar_feriados_para_ano.';
CREATE OR REPLACE FUNCTION public.carregar_feriados_nacionais()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE n integer;
BEGIN
 IF auth.uid() IS NULL OR NOT (public.eh_admin() OR public.ve_tudo()) THEN RAISE EXCEPTION 'Apenas administradores ou diretoria podem carregar feriados nacionais.' USING ERRCODE='42501'; END IF;
 INSERT INTO public.feriados(empresa_id,data,nome,abrangencia,localidade,origem,data_movel)
 SELECT NULL,d::date,nome,'nacional',NULL,'manual'::public.origem_dado,nome='Paixão de Cristo' FROM (VALUES
 ('2026-01-01','Confraternização Universal'),('2026-04-03','Paixão de Cristo'),('2026-04-21','Tiradentes'),('2026-05-01','Dia do Trabalho'),('2026-09-07','Independência do Brasil'),('2026-10-12','Nossa Senhora Aparecida'),('2026-11-02','Finados'),('2026-11-15','Proclamação da República'),('2026-11-20','Dia Nacional de Zumbi e da Consciência Negra'),('2026-12-25','Natal'),
 ('2027-01-01','Confraternização Universal'),('2027-03-26','Paixão de Cristo'),('2027-04-21','Tiradentes'),('2027-05-01','Dia do Trabalho'),('2027-09-07','Independência do Brasil'),('2027-10-12','Nossa Senhora Aparecida'),('2027-11-02','Finados'),('2027-11-15','Proclamação da República'),('2027-11-20','Dia Nacional de Zumbi e da Consciência Negra'),('2027-12-25','Natal')) f(d,nome)
 ON CONFLICT(empresa_id,data) DO NOTHING;
 GET DIAGNOSTICS n=ROW_COUNT; RETURN n;
END $function$;
CREATE FUNCTION public.copiar_feriados_para_ano(_ano_origem integer, _ano_destino integer)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path TO 'public' AS $function$
DECLARE inicio date; fim date; moveis bigint; elegiveis bigint; copiados bigint;
BEGIN
 IF _ano_origem IS NULL OR _ano_destino IS NULL OR _ano_origem NOT BETWEEN 1 AND 9999 OR _ano_destino NOT BETWEEN 1 AND 9999 THEN
  RAISE EXCEPTION 'Informe anos válidos entre 1 e 9999.' USING ERRCODE='22023';
 END IF;
 inicio:=make_date(_ano_origem,1,1); fim:=make_date(_ano_origem,12,31);
 -- Materializar a origem evita que a própria inserção mude a contagem; a RLS vale para leitura e escrita.
 WITH origem AS MATERIALIZED (
  SELECT f.*, extract(month FROM f.data)::integer AS mes, extract(day FROM f.data)::integer AS dia
  FROM public.feriados f WHERE f.data BETWEEN inicio AND fim
 ), fixos AS MATERIALIZED (
  SELECT * FROM origem WHERE NOT data_movel
   AND NOT (mes=2 AND dia=29 AND NOT (_ano_destino%400=0 OR (_ano_destino%4=0 AND _ano_destino%100<>0)))
 ), inseridos AS (
  INSERT INTO public.feriados(empresa_id,data,nome,abrangencia,localidade,origem,data_movel)
  SELECT empresa_id,make_date(_ano_destino,mes,dia),nome,abrangencia,localidade,origem,false FROM fixos
  ON CONFLICT(empresa_id,data) DO NOTHING RETURNING id
 )
 SELECT (SELECT count(*) FROM origem WHERE data_movel),(SELECT count(*) FROM fixos),(SELECT count(*) FROM inseridos)
 INTO moveis,elegiveis,copiados;
 RETURN jsonb_build_object('copiados',copiados,'ja_existiam',elegiveis-copiados,'ignorados_moveis',moveis);
END $function$;
REVOKE ALL ON FUNCTION public.copiar_feriados_para_ano(integer,integer) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.copiar_feriados_para_ano(integer,integer) TO authenticated,service_role;
COMMENT ON FUNCTION public.copiar_feriados_para_ano(integer,integer) IS 'Copia datas fixas com RLS do chamador; 29/02 inválido é ignorado e não é contado como duplicado. Auditoria usa o gatilho existente.';
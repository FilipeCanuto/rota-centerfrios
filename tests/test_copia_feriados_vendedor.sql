-- Transactional RLS regression: temporarily reduce the existing test context
-- to seller only; ROLLBACK preserves every persisted identity and role.
BEGIN;
DELETE FROM public.user_roles WHERE user_id='900e686d-4ba6-4640-9b84-e457c45e2e4d';
INSERT INTO public.user_roles(user_id,role,empresa_id) VALUES ('900e686d-4ba6-4640-9b84-e457c45e2e4d','vendedor',NULL);
SELECT set_config('request.jwt.claims','{"sub":"900e686d-4ba6-4640-9b84-e457c45e2e4d","role":"authenticated"}',true);
SET LOCAL ROLE authenticated;
DO $$
BEGIN
 BEGIN
  INSERT INTO public.feriados(data,nome,abrangencia,data_movel) VALUES ('2027-02-09','Carnaval recusado','empresa',true);
  RAISE EXCEPTION 'Teste falhou: vendedor inseriu feriado';
 EXCEPTION WHEN insufficient_privilege THEN NULL;
 END;
 BEGIN
  PERFORM public.copiar_feriados_para_ano(2027,2028);
  RAISE EXCEPTION 'Teste falhou: vendedor copiou feriados';
 EXCEPTION WHEN insufficient_privilege THEN NULL;
 END;
END $$;
ROLLBACK;
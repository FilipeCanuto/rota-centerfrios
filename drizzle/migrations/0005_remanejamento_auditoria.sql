CREATE OR REPLACE FUNCTION public.pode_ver_vendedor(_vendedor_id uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
SELECT public.ve_tudo() OR _vendedor_id=public.meu_usuario_id() OR (EXISTS(SELECT 1 FROM public.user_roles WHERE user_id=auth.uid() AND role='supervisor') AND EXISTS(SELECT 1 FROM public.usuarios v JOIN public.equipes e ON e.id=v.equipe_id WHERE v.id=_vendedor_id AND e.supervisor_id=public.meu_usuario_id()));
$$;
ALTER TABLE public.registro_auditoria ADD COLUMN vendedor_id uuid REFERENCES public.usuarios(id);
DO $$ DECLARE p record; BEGIN FOR p IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='registro_auditoria' LOOP EXECUTE format('DROP POLICY %I ON public.registro_auditoria',p.policyname); END LOOP; END $$;
REVOKE ALL ON public.registro_auditoria FROM anon,authenticated;
GRANT SELECT ON public.registro_auditoria TO authenticated;
GRANT ALL ON public.registro_auditoria TO service_role;
ALTER TABLE public.registro_auditoria ENABLE ROW LEVEL SECURITY;
CREATE POLICY leitura_auditoria ON public.registro_auditoria FOR SELECT TO authenticated USING (
 public.ve_tudo()
 OR (EXISTS(SELECT 1 FROM public.user_roles WHERE user_id=auth.uid() AND role='supervisor') AND (public.pode_ver_vendedor(vendedor_id) OR usuario_id=public.meu_usuario_id()))
 OR (public.eh_admin() AND tabela IN ('usuarios','usuario_empresas','user_roles','papeis_pre_cadastro','links','equipes'))
);
CREATE FUNCTION public.auditar(_acao text,_tabela text,_registro uuid,_empresa uuid,_vendedor uuid,_detalhes jsonb) RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path=public AS $$
INSERT INTO public.registro_auditoria(acao,tabela,registro_id,empresa_id,vendedor_id,usuario_id,detalhes) VALUES (_acao,_tabela,_registro,_empresa,_vendedor,public.meu_usuario_id(),_detalhes);
$$;
REVOKE ALL ON FUNCTION public.auditar(text,text,uuid,uuid,uuid,jsonb) FROM PUBLIC,anon,authenticated;
CREATE FUNCTION public.auditoria_alteracao() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE antigo jsonb; novo jsonb; linha jsonb; vendedor uuid; registro uuid;
BEGIN
 IF TG_OP<>'INSERT' THEN antigo:=to_jsonb(OLD); END IF;
 IF TG_OP<>'DELETE' THEN novo:=to_jsonb(NEW); END IF;
 linha:=coalesce(novo,antigo);
 vendedor:=(linha->>'vendedor_id')::uuid;
 IF TG_TABLE_NAME='usuario_empresas' THEN vendedor:=(linha->>'usuario_id')::uuid; END IF;
 IF TG_TABLE_NAME='user_roles' THEN SELECT id INTO vendedor FROM public.usuarios WHERE auth_user_id=(linha->>'user_id')::uuid LIMIT 1; END IF;
 registro:=coalesce((linha->>'id')::uuid,(linha->>'usuario_id')::uuid);
 PERFORM public.auditar(TG_ARGV[0],TG_TABLE_NAME,registro,(linha->>'empresa_id')::uuid,vendedor,jsonb_build_object('operacao',TG_OP,'antigo',antigo,'novo',novo));
 RETURN NULL;
END;
$$;
REVOKE ALL ON FUNCTION public.auditoria_alteracao() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER auditar_metas AFTER INSERT OR UPDATE OR DELETE ON public.metas FOR EACH ROW EXECUTE FUNCTION public.auditoria_alteracao('alteracao_meta');
CREATE TRIGGER auditar_regras AFTER INSERT OR UPDATE OR DELETE ON public.configuracoes_regras FOR EACH ROW EXECUTE FUNCTION public.auditoria_alteracao('alteracao_regra');
CREATE TRIGGER auditar_papeis AFTER INSERT OR DELETE ON public.user_roles FOR EACH ROW EXECUTE FUNCTION public.auditoria_alteracao('alteracao_permissao');
CREATE TRIGGER auditar_vinculos AFTER INSERT OR DELETE ON public.usuario_empresas FOR EACH ROW EXECUTE FUNCTION public.auditoria_alteracao('alteracao_vinculo_empresa');
CREATE FUNCTION public.remanejar_cliente(_cliente_id uuid,_novo_vendedor_id uuid,_motivo text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE cliente public.clientes; limite numeric; dias integer; hoje date:=(current_timestamp AT TIME ZONE 'America/Maceio')::date; marca_anterior text; antigo jsonb; novo jsonb;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'É necessário entrar na plataforma.' USING ERRCODE='42501'; END IF;
 IF _motivo IS NULL OR length(btrim(_motivo))<5 THEN RAISE EXCEPTION 'Informe um motivo com pelo menos 5 caracteres.' USING ERRCODE='22023'; END IF;
 SELECT * INTO cliente FROM public.clientes WHERE id=_cliente_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Cliente não encontrado.' USING ERRCODE='22023'; END IF;
 IF NOT public.ve_tudo() AND NOT public.has_role(auth.uid(),'supervisor',cliente.empresa_id) THEN RAISE EXCEPTION 'Somente a diretoria ou o supervisor da empresa pode remanejar clientes.' USING ERRCODE='42501'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.usuarios WHERE id=_novo_vendedor_id) THEN RAISE EXCEPTION 'Novo vendedor não encontrado.' USING ERRCODE='22023'; END IF;
 IF NOT public.ve_tudo() THEN
  IF NOT EXISTS(SELECT 1 FROM public.usuarios v JOIN public.equipes e ON e.id=v.equipe_id WHERE v.id=cliente.vendedor_id AND e.supervisor_id=public.meu_usuario_id())
   OR NOT EXISTS(SELECT 1 FROM public.usuarios v JOIN public.equipes e ON e.id=v.equipe_id WHERE v.id=_novo_vendedor_id AND e.supervisor_id=public.meu_usuario_id())
   OR NOT EXISTS(SELECT 1 FROM public.usuario_empresas WHERE usuario_id=_novo_vendedor_id AND empresa_id=cliente.empresa_id)
  THEN RAISE EXCEPTION 'Os vendedores devem pertencer à sua equipe e o novo vendedor deve ter vínculo com a empresa do cliente.' USING ERRCODE='42501'; END IF;
 END IF;
 SELECT valor INTO limite FROM public.configuracoes_regras WHERE empresa_id=cliente.empresa_id AND chave='cliente_sem_compra_dias' LIMIT 1;
 limite:=coalesce(limite,90);
 dias:=hoje-cliente.data_ultima_compra;
 IF dias IS NOT NULL AND dias<limite THEN RAISE EXCEPTION 'Este cliente comprou há menos de % dias e ainda não pode mudar de carteira.',limite USING ERRCODE='22023'; END IF;
 IF cliente.vendedor_id IS NOT DISTINCT FROM _novo_vendedor_id THEN RETURN; END IF;
 antigo:=to_jsonb(cliente);
 marca_anterior:=current_setting('rota.remanejamento',true);
 PERFORM set_config('rota.remanejamento','on',true);
 UPDATE public.clientes SET vendedor_id=_novo_vendedor_id WHERE id=_cliente_id RETURNING to_jsonb(clientes.*) INTO novo;
 PERFORM set_config('rota.remanejamento',coalesce(marca_anterior,''),true);
 PERFORM public.auditar('remanejamento','clientes',cliente.id,cliente.empresa_id,cliente.vendedor_id,jsonb_build_object('de',cliente.vendedor_id,'para',_novo_vendedor_id,'motivo',btrim(_motivo),'dias_sem_compra',dias,'antigo',antigo,'novo',novo));
END;
$$;
REVOKE ALL ON FUNCTION public.remanejar_cliente(uuid,uuid,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.remanejar_cliente(uuid,uuid,text) TO authenticated;
-- Invoker: a marca sozinha nunca autoriza um usuário authenticated.
CREATE FUNCTION public.proteger_remanejamento() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
DECLARE dono name;
BEGIN
 IF OLD.vendedor_id IS NOT DISTINCT FROM NEW.vendedor_id THEN RETURN NEW; END IF;
 SELECT pg_get_userbyid(proowner) INTO dono FROM pg_proc WHERE oid='public.remanejar_cliente(uuid,uuid,text)'::regprocedure;
 IF current_user='service_role' OR (current_user=dono AND current_setting('rota.remanejamento',true)='on') THEN RETURN NEW; END IF;
 RAISE EXCEPTION 'Troca de carteira permitida somente pela função remanejar_cliente ou pela integração.' USING ERRCODE='42501';
END;
$$;
REVOKE ALL ON FUNCTION public.proteger_remanejamento() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER proteger_troca_carteira BEFORE UPDATE OF vendedor_id ON public.clientes FOR EACH ROW EXECUTE FUNCTION public.proteger_remanejamento();
CREATE FUNCTION public.auditar_remanejamento_integracao() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF OLD.vendedor_id IS DISTINCT FROM NEW.vendedor_id AND current_setting('rota.remanejamento',true) IS DISTINCT FROM 'on' THEN
  PERFORM public.auditar('remanejamento','clientes',OLD.id,OLD.empresa_id,OLD.vendedor_id,jsonb_build_object('de',OLD.vendedor_id,'para',NEW.vendedor_id,'motivo','Integração','dias_sem_compra',(current_timestamp AT TIME ZONE 'America/Maceio')::date-OLD.data_ultima_compra,'antigo',to_jsonb(OLD),'novo',to_jsonb(NEW)));
 END IF;
 RETURN NULL;
END;
$$;
REVOKE ALL ON FUNCTION public.auditar_remanejamento_integracao() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER auditar_troca_carteira AFTER UPDATE OF vendedor_id ON public.clientes FOR EACH ROW EXECUTE FUNCTION public.auditar_remanejamento_integracao();
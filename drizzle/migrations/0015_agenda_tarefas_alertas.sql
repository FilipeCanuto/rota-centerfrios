ALTER TABLE public.tarefas_agenda
 ADD COLUMN tipo text NOT NULL DEFAULT 'tarefa' CHECK (tipo IN ('retorno','visita','ligacao','tarefa')),
 ADD COLUMN hora time,
 ADD COLUMN observacao text,
 ADD COLUMN motivo_alerta text CHECK (motivo_alerta IN ('recompra_urgente','recompra_atencao','orcamento_parado','esquecido','sem_compra')),
 ADD COLUMN concluida_em timestamptz;
CREATE UNIQUE INDEX tarefas_agenda_alerta_unico ON public.tarefas_agenda(vendedor_id,cliente_id,data,motivo_alerta) WHERE motivo_alerta IS NOT NULL;

-- Permissões por coluna: vendedor cria e edita apenas os campos da tarefa.
REVOKE INSERT, UPDATE ON public.tarefas_agenda FROM authenticated;
GRANT INSERT (empresa_id,vendedor_id,cliente_id,titulo,data,hora,tipo,observacao,concluida,concluida_em,motivo_alerta) ON public.tarefas_agenda TO authenticated;
GRANT UPDATE (concluida,concluida_em,data,hora,titulo,tipo,observacao) ON public.tarefas_agenda TO authenticated;

-- Cliente da tarefa (opcional) precisa ser da mesma empresa e de carteira visível.
DROP POLICY inserir ON public.tarefas_agenda;
CREATE POLICY inserir ON public.tarefas_agenda FOR INSERT TO authenticated WITH CHECK (
 public.tem_empresa(empresa_id) AND public.pode_ver_vendedor(vendedor_id)
 AND (cliente_id IS NULL OR EXISTS(SELECT 1 FROM public.clientes c WHERE c.id=cliente_id AND c.empresa_id=tarefas_agenda.empresa_id AND c.vendedor_id IS NOT DISTINCT FROM tarefas_agenda.vendedor_id)));

CREATE FUNCTION public.gerar_tarefas_dos_alertas(_itens jsonb) RETURNS integer LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
DECLARE eu uuid:=public.meu_usuario_id(); hoje date:=(current_timestamp AT TIME ZONE 'America/Maceio')::date; i jsonb; n int:=0; k int;
BEGIN
 IF eu IS NULL THEN RAISE EXCEPTION 'É necessário entrar na plataforma.' USING ERRCODE='42501'; END IF;
 IF jsonb_typeof(_itens) IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'Os itens devem ser uma lista.' USING ERRCODE='22023'; END IF;
 FOR i IN SELECT * FROM jsonb_array_elements(_itens) LOOP
  -- Cliente fora da carteira é ignorado (sem erro), para não interromper o lote.
  CONTINUE WHEN NOT EXISTS(SELECT 1 FROM public.clientes c WHERE c.id=(i->>'cliente_id')::uuid AND c.empresa_id=(i->>'empresa_id')::uuid AND c.vendedor_id=eu);
  INSERT INTO public.tarefas_agenda(empresa_id,vendedor_id,cliente_id,titulo,data,tipo,motivo_alerta)
  VALUES((i->>'empresa_id')::uuid,eu,(i->>'cliente_id')::uuid,coalesce(nullif(btrim(i->>'titulo'),''),'Retorno ao cliente'),hoje,'retorno',i->>'motivo_alerta')
  ON CONFLICT (vendedor_id,cliente_id,data,motivo_alerta) WHERE motivo_alerta IS NOT NULL DO NOTHING;
  GET DIAGNOSTICS k=ROW_COUNT; n:=n+k;
 END LOOP;
 RETURN n;
END $$;
REVOKE ALL ON FUNCTION public.gerar_tarefas_dos_alertas(jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.gerar_tarefas_dos_alertas(jsonb) TO authenticated;
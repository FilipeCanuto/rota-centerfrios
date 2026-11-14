CREATE TABLE public.setores (
  chave text PRIMARY KEY CHECK (chave ~ '^[a-z][a-z_]{1,30}$'),
  nome text NOT NULL CHECK (char_length(btrim(nome)) BETWEEN 2 AND 60),
  icone text NOT NULL DEFAULT 'building' CHECK (icone IN ('briefcase','users','wallet','receipt','truck','clipboard-check','landmark','shopping-cart','file-text','calculator','building')),
  ativo boolean NOT NULL DEFAULT true,
  disponivel boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX setores_nome_unico ON public.setores (lower(btrim(nome)));
REVOKE ALL ON public.setores FROM anon, authenticated;
GRANT SELECT ON public.setores TO authenticated;
GRANT ALL ON public.setores TO service_role;
ALTER TABLE public.setores ENABLE ROW LEVEL SECURITY;
CREATE POLICY setores_ler ON public.setores FOR SELECT TO authenticated USING (true);

CREATE FUNCTION public.setores_tocar_updated_at() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
BEGIN NEW.updated_at := now(); RETURN NEW; END $$;
CREATE TRIGGER setores_updated_at BEFORE UPDATE ON public.setores FOR EACH ROW EXECUTE FUNCTION public.setores_tocar_updated_at();

INSERT INTO public.setores (chave,nome,icone,ativo,disponivel) VALUES
 ('comercial','Comercial','briefcase',true,true),
 ('rh','RH','users',true,false),
 ('financeiro','Financeiro','wallet',true,false),
 ('faturamento','Faturamento','receipt',true,false),
 ('logistica','Logística','truck',true,false),
 ('supervisao','Supervisão','clipboard-check',true,false),
 ('diretoria','Diretoria','landmark',true,false),
 ('compras','Compras','shopping-cart',true,false),
 ('fiscal','Fiscal','file-text',true,false),
 ('contabilidade','Contabilidade','calculator',true,false)
ON CONFLICT (chave) DO NOTHING;

CREATE FUNCTION public.admin_criar_setor(_chave text, _nome text, _icone text DEFAULT 'building') RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF NOT public.eh_admin() THEN RAISE EXCEPTION 'Apenas administradores.' USING ERRCODE = '42501'; END IF;
 IF _chave IS NULL OR _chave !~ '^[a-z][a-z_]{1,30}$' THEN RAISE EXCEPTION 'Chave inválida.' USING ERRCODE='22023'; END IF;
 IF _nome IS NULL OR char_length(btrim(_nome)) NOT BETWEEN 2 AND 60 THEN RAISE EXCEPTION 'Nome inválido.' USING ERRCODE='22023'; END IF;
 IF _icone IS NULL OR _icone NOT IN ('briefcase','users','wallet','receipt','truck','clipboard-check','landmark','shopping-cart','file-text','calculator','building') THEN RAISE EXCEPTION 'Ícone inválido.' USING ERRCODE='22023'; END IF;
 IF EXISTS (SELECT 1 FROM public.setores WHERE chave=_chave) THEN RAISE EXCEPTION 'Chave já existe.' USING ERRCODE='23505'; END IF;
 IF EXISTS (SELECT 1 FROM public.setores WHERE lower(btrim(nome))=lower(btrim(_nome))) THEN RAISE EXCEPTION 'Nome já existe.' USING ERRCODE='23505'; END IF;
 INSERT INTO public.setores (chave,nome,icone,ativo,disponivel) VALUES (_chave,btrim(_nome),_icone,true,false);
 PERFORM public.auditar('setor_criado','setores',NULL,NULL,NULL,jsonb_build_object('chave',_chave,'nome',btrim(_nome),'icone',_icone));
END $$;

CREATE FUNCTION public.admin_atualizar_setor(_chave text, _dados jsonb) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE antes public.setores; depois public.setores; k text; v_nome text; v_icone text; v_ativo boolean;
BEGIN
 IF NOT public.eh_admin() THEN RAISE EXCEPTION 'Apenas administradores.' USING ERRCODE = '42501'; END IF;
 IF _dados IS NULL OR jsonb_typeof(_dados)<>'object' OR _dados='{}'::jsonb THEN RAISE EXCEPTION 'Dados inválidos.' USING ERRCODE='22023'; END IF;
 FOR k IN SELECT jsonb_object_keys(_dados) LOOP
  IF k NOT IN ('nome','icone','ativo') THEN RAISE EXCEPTION 'Campo não permitido.' USING ERRCODE='22023'; END IF;
 END LOOP;
 SELECT * INTO antes FROM public.setores WHERE chave=_chave FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Setor inexistente.' USING ERRCODE='P0002'; END IF;
 v_nome:=antes.nome; v_icone:=antes.icone; v_ativo:=antes.ativo;
 IF _dados ? 'nome' THEN
  IF jsonb_typeof(_dados->'nome')<>'string' OR char_length(btrim(_dados->>'nome')) NOT BETWEEN 2 AND 60 THEN RAISE EXCEPTION 'Nome inválido.' USING ERRCODE='22023'; END IF;
  v_nome:=btrim(_dados->>'nome');
  IF EXISTS (SELECT 1 FROM public.setores WHERE chave<>_chave AND lower(btrim(nome))=lower(v_nome)) THEN RAISE EXCEPTION 'Nome já existe.' USING ERRCODE='23505'; END IF;
 END IF;
 IF _dados ? 'icone' THEN
  IF jsonb_typeof(_dados->'icone')<>'string' OR (_dados->>'icone') NOT IN ('briefcase','users','wallet','receipt','truck','clipboard-check','landmark','shopping-cart','file-text','calculator','building') THEN RAISE EXCEPTION 'Ícone inválido.' USING ERRCODE='22023'; END IF;
  v_icone:=_dados->>'icone';
 END IF;
 IF _dados ? 'ativo' THEN
  IF jsonb_typeof(_dados->'ativo')<>'boolean' THEN RAISE EXCEPTION 'Valor inválido para ativo.' USING ERRCODE='22023'; END IF;
  v_ativo:=(_dados->>'ativo')::boolean;
 END IF;
 UPDATE public.setores SET nome=v_nome, icone=v_icone, ativo=v_ativo, updated_at=now() WHERE chave=_chave RETURNING * INTO depois;
 PERFORM public.auditar(
  CASE WHEN antes.nome=depois.nome AND antes.icone=depois.icone AND antes.ativo<>depois.ativo THEN 'setor_ativacao' ELSE 'setor_alterado' END,
  'setores',NULL,NULL,NULL,jsonb_build_object('chave',_chave,'antigo',to_jsonb(antes),'novo',to_jsonb(depois)));
END $$;

REVOKE ALL ON FUNCTION public.admin_criar_setor(text,text,text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_atualizar_setor(text,jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_criar_setor(text,text,text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_atualizar_setor(text,jsonb) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.setores_tocar_updated_at() FROM PUBLIC, anon, authenticated;

ALTER TABLE public.midia_login
  ADD COLUMN enquadramento text NOT NULL DEFAULT 'preencher' CHECK (enquadramento IN ('preencher','ajustar')),
  ADD COLUMN foco_x smallint NOT NULL DEFAULT 50 CHECK (foco_x BETWEEN 0 AND 100),
  ADD COLUMN foco_y smallint NOT NULL DEFAULT 50 CHECK (foco_y BETWEEN 0 AND 100);
Aplique exatamente o SQL abaixo como UMA migração nova. Não investigue o projeto, não reescreva nem otimize o SQL, não crie testes em Python. Depois rode o bloco de testes em SQL. Se algo falhar, PARE e copie o erro na resposta, sem tentar corrigir. Regenere os tipos.

Pré-requisito: mensagem 21 já aplicada (migração 0030).

## SQL

```sql
-- 22: correções da auditoria (docs/auditoria-fable.md: S1, S2, S3, S4, S5, R3).

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

-- R3. Reimportar uma venda não troca o vendedor dela (o faturamento fica com quem vendeu).
CREATE OR REPLACE FUNCTION public.importar_vendas(_empresa_id uuid, _arquivo text, _linhas jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE l jsonb; n int; cod text; cli public.clientes; vid uuid; vend uuid; ins int:=0; upd int:=0; erros jsonb:='[]'; dt date;
BEGIN
 PERFORM public.importacao_validar(_empresa_id,_linhas);
 IF auth.uid() IS NOT NULL AND NOT public.tem_setor('comercial') THEN RAISE EXCEPTION 'Sem acesso ao setor Comercial.' USING ERRCODE = '42501'; END IF;
 FOR l IN SELECT * FROM jsonb_array_elements(_linhas) LOOP
  n:=(l->>'linha')::int; cod:=nullif(btrim(l->>'codigo_shop9'),''); dt:=(l->>'data_faturamento')::date;
  IF cod IS NULL THEN erros:=erros||jsonb_build_object('linha',n,'campo','codigo_shop9','mensagem','Número da nota vazio.'); CONTINUE; END IF;
  SELECT * INTO cli FROM public.clientes WHERE empresa_id=_empresa_id AND codigo_shop9=btrim(l->>'cliente_codigo');
  IF NOT FOUND THEN erros:=erros||jsonb_build_object('linha',n,'campo','cliente_codigo','mensagem','Cliente não encontrado.'); CONTINUE; END IF;
  vid:=NULL; vend:=NULL;
  SELECT id, vendedor_id INTO vid, vend FROM public.vendas WHERE empresa_id=_empresa_id AND codigo_shop9=cod;
  IF vid IS NULL THEN
   vend:=cli.vendedor_id;
   INSERT INTO public.vendas(empresa_id,cliente_id,vendedor_id,codigo_shop9,data_faturamento,valor,origem,demo)
   VALUES(_empresa_id,cli.id,vend,cod,dt,(l->>'valor')::numeric,'importacao',false) RETURNING id INTO vid; ins:=ins+1;
  ELSE
   UPDATE public.vendas SET cliente_id=cli.id,data_faturamento=dt,valor=(l->>'valor')::numeric,origem='importacao' WHERE id=vid;
   DELETE FROM public.itens_venda WHERE venda_id=vid; upd:=upd+1;
  END IF;
  INSERT INTO public.itens_venda(empresa_id,venda_id,cliente_id,vendedor_id,produto,codigo_produto,quantidade,valor_total,origem,demo)
  SELECT _empresa_id,vid,cli.id,vend,i->>'produto',nullif(i->>'codigo_produto',''),coalesce((i->>'quantidade')::numeric,1),coalesce((i->>'valor_total')::numeric,0),'importacao',false
  FROM jsonb_array_elements(coalesce(l->'itens','[]')) i WHERE nullif(btrim(i->>'produto'),'') IS NOT NULL;
  UPDATE public.clientes SET data_ultima_compra=dt WHERE id=cli.id AND (data_ultima_compra IS NULL OR data_ultima_compra<dt);
 END LOOP;
 RETURN public.importacao_registrar(_empresa_id,'vendas',_arquivo,jsonb_array_length(_linhas),ins,upd,erros);
END $$;
```

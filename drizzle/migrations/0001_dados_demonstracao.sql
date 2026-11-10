
do $$
declare
  e_cf uuid; e_381 uuid; eq uuid; sup uuid; v_h uuid; v_c uuid;
  nomes text[] := array['Padaria Pão Dourado','Açougue Boi Nobre','Supermercado Bom Preço','Pizzaria Forno de Pedra','Lanchonete Ponto Certo','Padaria Santa Clara','Açougue do Zé','Mercadinho Família','Pizzaria Bella Napoli','Lanchonete Sabor da Esquina','Padaria Trigo Fino','Casa de Carnes Gaúcha','Supermercado Vila Nova','Pizzaria Massa Nobre','Lanchonete Express','Confeitaria Doce Mel','Açougue Corte Fino','Atacarejo Central','Pizzaria Dom Vito','Hamburgueria Brasa','Padaria Nossa Senhora','Frigorífico Bom Corte','Supermercado Avenida','Pizzaria Sabor Italiano','Lanchonete do Porto','Padaria Pão Quente','Açougue Primavera','Mercado São Jorge','Pizzaria Napolitana','Lanchonete Bom Lanche','Panificadora Real','Boutique de Carnes Prime','Supermercado Econômico','Pizzaria Forno a Lenha','Pastelaria Dourada','Padaria Ki-Pão','Açougue Estrela','Hipermercado Norte','Pizzaria Calabresa','Lanchonete Trevo','Padaria Bom Dia','Açougue Bandeirante','Supermercado Pague Menos','Pizzaria Vulcano','Lanchonete Mineira','Padaria Flor de Trigo','Casa de Carnes Real','Mercado Popular','Pizzaria La Mamma','Sorveteria Polar','Padaria Monte Carlo','Açougue Nova Era','Supermercado Comercial','Pizzaria Toscana','Lanchonete Central','Padaria Doce Lar','Açougue Picanha Nobre','Mercado Bairro Alto','Pizzaria Margherita','Restaurante Sabor Caseiro'];
  cidades text[] := array['Recife','Olinda','Jaboatão','Caruaru','Paulista','Camaragibe'];
  i int; cid uuid; vend uuid; emp uuid; seg text; cad int; cat int; ult date; d date; k int; hoje date := current_date;
begin
  perform setseed(0.42);
  insert into public.empresas (nome, slug, demo) values ('CENTERFRIOS','centerfrios', true) returning id into e_cf;
  insert into public.empresas (nome, slug, demo) values ('381 Distribuidora','381', true) returning id into e_381;
  update public.empresas set empresa_id = id;

  insert into public.usuarios (nome, email, empresa_id, perfil, apelido_copiloto, demo)
    values ('Marcos','marcos.supervisor@demo.local', e_cf, 'supervisor', 'Polar', true) returning id into sup;
  insert into public.equipes (empresa_id, nome, supervisor_id, demo) values (e_cf, 'Equipe Recife', sup, true) returning id into eq;
  update public.usuarios set equipe_id = eq where id = sup;
  insert into public.usuarios (nome, empresa_id, perfil, equipe_id, apelido_copiloto, demo)
    values ('Humberto', e_cf, 'vendedor', eq, 'Beto', true) returning id into v_h;
  insert into public.usuarios (nome, empresa_id, perfil, equipe_id, apelido_copiloto, demo)
    values ('Clara', e_cf, 'vendedor', eq, 'Clarinha', true) returning id into v_c;
  insert into public.usuario_empresas (usuario_id, empresa_id)
    select u, e from unnest(array[sup, v_h, v_c]) u cross join unnest(array[e_cf, e_381]) e;

  for i in 1..60 loop
    vend := case when i % 2 = 0 then v_h else v_c end;
    emp := case when i % 3 = 0 then e_381 else e_cf end;
    seg := case when nomes[i] ilike 'padaria%' or nomes[i] ilike 'panif%' or nomes[i] ilike 'confeit%' then 'Padaria'
                when nomes[i] ilike '%carne%' or nomes[i] ilike 'açougue%' or nomes[i] ilike 'frigor%' then 'Açougue'
                when nomes[i] ilike '%mercad%' or nomes[i] ilike 'atacarejo%' or nomes[i] ilike 'hiper%' then 'Supermercado'
                when nomes[i] ilike 'pizzaria%' then 'Pizzaria'
                else 'Lanchonete' end;
    cad := 12 + floor(random()*28)::int;
    cat := i % 10; -- 0-5 regular, 6 atenção, 7 urgente, 8 sem compra 90+, 9 regular/esquecido
    ult := case
      when cat = 6 then hoje - (cad * 1.7)::int
      when cat = 7 then hoje - (cad * 2.4)::int
      when cat = 8 then hoje - (95 + floor(random()*90)::int)
      else hoje - floor(random()*least(cad, 20))::int end;
    insert into public.clientes (empresa_id, vendedor_id, nome, telefone, segmento, cidade, data_ultima_compra, demo)
      values (emp, vend, nomes[i], '5581' || (980000000 + floor(random()*19999999))::bigint::text, seg, cidades[1 + (i % 6)], ult, true)
      returning id into cid;

    d := ult;
    while d > hoje - 365 loop
      insert into public.vendas (empresa_id, cliente_id, vendedor_id, data_faturamento, valor, demo)
        values (emp, cid, vend, d, round((900 + random()*7000)::numeric, 2), true);
      d := d - (cad + floor(random()*7)::int - 3);
    end loop;

    -- interações
    if cat in (0,1,2,3) then
      insert into public.interacoes (empresa_id, cliente_id, vendedor_id, tipo, cliente_respondeu, resultado, data, demo)
        values (emp, cid, vend, (array['whatsapp','ligacao','visita'])[1 + (i % 3)], true, 'Cliente atendido, pedido em andamento', now() - ((1 + floor(random()*9))::int || ' days')::interval, true);
    elsif cat in (4,5) then
      insert into public.interacoes (empresa_id, cliente_id, vendedor_id, tipo, cliente_respondeu, resultado, data, demo)
        values (emp, cid, vend, 'whatsapp', false, 'Mensagem enviada, sem resposta', now() - '3 days'::interval, true);
    elsif cat = 9 then
      insert into public.interacoes (empresa_id, cliente_id, vendedor_id, tipo, cliente_respondeu, resultado, data, demo)
        values (emp, cid, vend, 'visita', true, 'Visita de rotina', now() - ((35 + floor(random()*20))::int || ' days')::interval, true);
    end if;
    -- interações históricas
    for k in 1..4 loop
      insert into public.interacoes (empresa_id, cliente_id, vendedor_id, tipo, cliente_respondeu, resultado, data, demo)
        values (emp, cid, vend, (array['whatsapp','ligacao','visita','outro'])[1 + floor(random()*4)::int], random() > 0.3, 'Contato de acompanhamento', now() - ((40 + floor(random()*320))::int || ' days')::interval, true);
    end loop;

    -- orçamentos
    if i % 4 = 0 then
      insert into public.orcamentos (empresa_id, cliente_id, vendedor_id, status, data, valor, ultimo_followup, demo)
        values (emp, cid, vend, 'aberto', hoje - (3 + floor(random()*10))::int, round((3000 + random()*25000)::numeric,2), hoje - (2 + floor(random()*6))::int, true);
    elsif i % 4 = 1 then
      insert into public.orcamentos (empresa_id, cliente_id, vendedor_id, status, data, valor, ultimo_followup, demo)
        values (emp, cid, vend, 'aberto', hoje - 2, round((2000 + random()*15000)::numeric,2), hoje, true);
    end if;
    insert into public.orcamentos (empresa_id, cliente_id, vendedor_id, status, data, valor, ultimo_followup, demo)
      values (emp, cid, vend, (array['ganho','perdido'])[1 + floor(random()*2)::int], hoje - (20 + floor(random()*300))::int, round((2000 + random()*20000)::numeric,2), null, true);
  end loop;

  -- metas do mês (e dos meses anteriores)
  for k in 0..11 loop
    insert into public.metas (empresa_id, vendedor_id, mes, meta_vendas, meta_orcamentos, meta_cobertura, meta_reativacao, demo) values
      (e_cf, v_h, date_trunc('month', hoje)::date - (k || ' months')::interval, 120000, 20, 70, 3, true),
      (e_cf, v_c, date_trunc('month', hoje)::date - (k || ' months')::interval, 110000, 18, 70, 3, true),
      (e_381, v_h, date_trunc('month', hoje)::date - (k || ' months')::interval, 55000, 8, 70, 1, true),
      (e_381, v_c, date_trunc('month', hoje)::date - (k || ' months')::interval, 50000, 8, 70, 1, true);
  end loop;

  insert into public.pontos (empresa_id, vendedor_id, data, indicador, pontos, demo) values
    (e_cf, v_h, hoje, 'cobertura', 15, true), (e_cf, v_h, hoje, 'orcamentos', 10, true),
    (e_cf, v_c, hoje, 'vendas', 20, true), (e_cf, v_c, hoje, 'cobertura', 10, true);
  insert into public.selos (empresa_id, vendedor_id, nome, descricao, conquistado_em, demo) values
    (e_cf, v_h, 'Carteira em dia', 'Cobertura acima de 70% no mês', hoje - 20, true),
    (e_cf, v_c, 'Reativadora', 'Reativou 3 clientes em um mês', hoje - 35, true);
  insert into public.tarefas_agenda (empresa_id, vendedor_id, titulo, data, demo) values
    (e_cf, v_h, 'Ligar para confirmar entrega de câmara fria', hoje, true),
    (e_cf, v_c, 'Visita técnica com cliente novo', hoje + 1, true);

  insert into public.links (empresa_id, titulo, descricao, url, icone, publico, demo) values
    (e_cf, 'Catálogo CENTERFRIOS', 'Catálogo completo de refrigeração comercial', 'https://example.com/catalogo', 'book-open', 'cliente', true),
    (e_cf, 'Tabela de preços', 'Tabela vigente para vendedores', 'https://example.com/tabela', 'table', 'interno', true),
    (e_381, 'Catálogo 381', 'Linha de gastronomia e armazenagem', 'https://example.com/381', 'book-open', 'cliente', true);

  insert into public.configuracoes_regras (empresa_id, chave, valor, descricao)
    select e, c.chave, c.valor, c.descricao from unnest(array[e_cf, e_381]) e cross join (values
      ('recompra_minimo_compras', 3, 'Mínimo de compras para calcular o intervalo médio'),
      ('recompra_fator_atencao', 1.5, 'Múltiplo do intervalo médio para "Atenção"'),
      ('recompra_fator_urgente', 2, 'Múltiplo do intervalo médio para "Urgente"'),
      ('cliente_esquecido_dias', 30, 'Dias sem interação qualificada para cliente esquecido'),
      ('cliente_sem_compra_dias', 90, 'Dias sem compra para permitir remanejamento'),
      ('orcamento_parado_dias_uteis', 2, 'Dias úteis sem interação para orçamento parado'),
      ('plano_do_dia_max', 10, 'Máximo de clientes no plano do dia')
    ) as c(chave, valor, descricao);
end $$;


do $$
declare h uuid; c uuid;
  para_h text[] := array['Açougue do Zé','Açougue Corte Fino','Pizzaria Bella Napoli','Pizzaria Dom Vito'];
  para_c text[] := array['Padaria Santa Clara','Confeitaria Doce Mel','Supermercado Bom Preço','Lanchonete Express'];
begin
  select id into h from public.usuarios where nome='Humberto' and demo;
  select id into c from public.usuarios where nome='Clara' and demo;
  if h is null or c is null then return; end if;
  update public.clientes set vendedor_id = h where demo and nome = any(para_h);
  update public.clientes set vendedor_id = c where demo and nome = any(para_c);
  update public.vendas v set vendedor_id = cl.vendedor_id from public.clientes cl where v.cliente_id = cl.id and v.demo;
  update public.interacoes v set vendedor_id = cl.vendedor_id from public.clientes cl where v.cliente_id = cl.id and v.demo;
  update public.orcamentos v set vendedor_id = cl.vendedor_id from public.clientes cl where v.cliente_id = cl.id and v.demo;
end $$;


create type public.app_role as enum ('vendedor','supervisor','diretoria','administrador');
create type public.origem_dado as enum ('manual','importacao','integracao');

create table public.empresas (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid,
  nome text not null,
  slug text not null unique,
  origem public.origem_dado not null default 'manual',
  demo boolean not null default false,
  created_at timestamptz not null default now()
);
update public.empresas set empresa_id = id;

create table public.equipes (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  nome text not null,
  supervisor_id uuid,
  origem public.origem_dado not null default 'manual',
  demo boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.usuarios (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid unique,
  empresa_id uuid references public.empresas(id) on delete set null,
  nome text not null,
  email text,
  perfil public.app_role not null default 'vendedor',
  equipe_id uuid references public.equipes(id) on delete set null,
  apelido_copiloto text not null default 'Polar',
  tema text not null default 'auto' check (tema in ('claro','escuro','auto')),
  origem public.origem_dado not null default 'manual',
  demo boolean not null default false,
  created_at timestamptz not null default now()
);
alter table public.equipes add constraint equipes_supervisor_fk foreign key (supervisor_id) references public.usuarios(id) on delete set null;

create table public.usuario_empresas (
  usuario_id uuid not null references public.usuarios(id) on delete cascade,
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  origem public.origem_dado not null default 'manual',
  created_at timestamptz not null default now(),
  primary key (usuario_id, empresa_id)
);

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.app_role not null,
  unique (user_id, role)
);

create table public.clientes (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  vendedor_id uuid references public.usuarios(id) on delete set null,
  nome text not null,
  telefone text,
  segmento text,
  cidade text,
  data_ultima_compra date,
  origem public.origem_dado not null default 'manual',
  demo boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.vendas (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  cliente_id uuid not null references public.clientes(id) on delete cascade,
  vendedor_id uuid references public.usuarios(id) on delete set null,
  data_faturamento date not null,
  valor numeric(14,2) not null,
  origem public.origem_dado not null default 'manual',
  demo boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.orcamentos (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  cliente_id uuid not null references public.clientes(id) on delete cascade,
  vendedor_id uuid references public.usuarios(id) on delete set null,
  status text not null default 'aberto' check (status in ('aberto','ganho','perdido')),
  data date not null default current_date,
  valor numeric(14,2) not null default 0,
  ultimo_followup date,
  origem public.origem_dado not null default 'manual',
  demo boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.interacoes (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  cliente_id uuid not null references public.clientes(id) on delete cascade,
  vendedor_id uuid references public.usuarios(id) on delete set null,
  tipo text not null check (tipo in ('whatsapp','ligacao','visita','outro')),
  cliente_respondeu boolean not null default false,
  resultado text,
  data timestamptz not null default now(),
  origem public.origem_dado not null default 'manual',
  demo boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.tarefas_agenda (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  vendedor_id uuid references public.usuarios(id) on delete cascade,
  cliente_id uuid references public.clientes(id) on delete cascade,
  titulo text not null,
  data date not null,
  concluida boolean not null default false,
  origem public.origem_dado not null default 'manual',
  demo boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.alertas (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  vendedor_id uuid references public.usuarios(id) on delete cascade,
  cliente_id uuid references public.clientes(id) on delete cascade,
  tipo text not null,
  mensagem text not null,
  data date not null default current_date,
  lido boolean not null default false,
  origem public.origem_dado not null default 'manual',
  demo boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.links (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  titulo text not null,
  descricao text,
  url text not null,
  icone text,
  publico text not null default 'interno' check (publico in ('interno','cliente')),
  origem public.origem_dado not null default 'manual',
  demo boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.metas (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  vendedor_id uuid not null references public.usuarios(id) on delete cascade,
  mes date not null,
  meta_vendas numeric(14,2) not null default 0,
  meta_orcamentos integer not null default 0,
  meta_cobertura numeric(5,2) not null default 0,
  meta_reativacao integer not null default 0,
  origem public.origem_dado not null default 'manual',
  demo boolean not null default false,
  created_at timestamptz not null default now(),
  unique (empresa_id, vendedor_id, mes)
);

create table public.pontos (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  vendedor_id uuid not null references public.usuarios(id) on delete cascade,
  data date not null default current_date,
  indicador text not null,
  pontos integer not null,
  origem public.origem_dado not null default 'manual',
  demo boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.selos (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  vendedor_id uuid not null references public.usuarios(id) on delete cascade,
  nome text not null,
  descricao text,
  conquistado_em date not null default current_date,
  origem public.origem_dado not null default 'manual',
  demo boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.configuracoes_regras (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  chave text not null,
  valor numeric not null,
  descricao text,
  origem public.origem_dado not null default 'manual',
  created_at timestamptz not null default now(),
  unique (empresa_id, chave)
);

create table public.registro_auditoria (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid references public.empresas(id) on delete cascade,
  usuario_id uuid references public.usuarios(id) on delete set null,
  acao text not null,
  tabela text,
  registro_id uuid,
  detalhes jsonb,
  origem public.origem_dado not null default 'manual',
  created_at timestamptz not null default now()
);

create index on public.clientes (vendedor_id);
create index on public.vendas (vendedor_id, data_faturamento);
create index on public.vendas (cliente_id);
create index on public.interacoes (cliente_id, data);
create index on public.orcamentos (vendedor_id, status);

-- helper functions
create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role)
$$;

create or replace function public.meu_usuario_id()
returns uuid language sql stable security definer set search_path = public as $$
  select id from public.usuarios where auth_user_id = auth.uid() limit 1
$$;

create or replace function public.ve_tudo()
returns boolean language sql stable security definer set search_path = public as $$
  select public.has_role(auth.uid(),'diretoria') or public.has_role(auth.uid(),'administrador')
$$;

create or replace function public.tem_empresa(_empresa_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.ve_tudo() or exists (
    select 1 from public.usuario_empresas ue
    join public.usuarios u on u.id = ue.usuario_id
    where u.auth_user_id = auth.uid() and ue.empresa_id = _empresa_id)
$$;

create or replace function public.pode_ver_vendedor(_vendedor_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.ve_tudo()
    or _vendedor_id = public.meu_usuario_id()
    or (public.has_role(auth.uid(),'supervisor') and exists (
      select 1 from public.usuarios v
      join public.equipes e on e.id = v.equipe_id
      where v.id = _vendedor_id and e.supervisor_id = public.meu_usuario_id()))
$$;

-- grants + RLS
do $$
declare t text;
begin
  foreach t in array array['empresas','equipes','usuarios','usuario_empresas','clientes','vendas','orcamentos','interacoes','tarefas_agenda','alertas','links','metas','pontos','selos','configuracoes_regras','registro_auditoria'] loop
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
    execute format('grant all on public.%I to service_role', t);
    execute format('alter table public.%I enable row level security', t);
  end loop;
end $$;
grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;

create policy "ver próprios papéis" on public.user_roles for select to authenticated
  using (user_id = auth.uid() or public.ve_tudo());

create policy "ver empresas" on public.empresas for select to authenticated using (public.tem_empresa(id));
create policy "admin gerencia empresas" on public.empresas for all to authenticated
  using (public.has_role(auth.uid(),'administrador')) with check (public.has_role(auth.uid(),'administrador'));

create policy "ver equipes" on public.equipes for select to authenticated using (public.tem_empresa(empresa_id));
create policy "admin gerencia equipes" on public.equipes for all to authenticated
  using (public.has_role(auth.uid(),'administrador')) with check (public.has_role(auth.uid(),'administrador'));

create policy "ver usuários" on public.usuarios for select to authenticated
  using (auth_user_id = auth.uid() or public.pode_ver_vendedor(id));
create policy "atualizar próprio usuário" on public.usuarios for update to authenticated
  using (auth_user_id = auth.uid()) with check (auth_user_id = auth.uid());
create policy "admin gerencia usuários" on public.usuarios for all to authenticated
  using (public.has_role(auth.uid(),'administrador')) with check (public.has_role(auth.uid(),'administrador'));

create policy "ver vínculos" on public.usuario_empresas for select to authenticated
  using (usuario_id = public.meu_usuario_id() or public.ve_tudo());
create policy "admin gerencia vínculos" on public.usuario_empresas for all to authenticated
  using (public.has_role(auth.uid(),'administrador')) with check (public.has_role(auth.uid(),'administrador'));

-- carteira tables
do $$
declare t text;
begin
  foreach t in array array['clientes','vendas','orcamentos','interacoes','tarefas_agenda','alertas','metas','pontos','selos'] loop
    execute format('create policy "ver carteira" on public.%I for select to authenticated using (public.tem_empresa(empresa_id) and public.pode_ver_vendedor(vendedor_id))', t);
    execute format('create policy "inserir carteira" on public.%I for insert to authenticated with check (public.tem_empresa(empresa_id) and public.pode_ver_vendedor(vendedor_id))', t);
    execute format('create policy "atualizar carteira" on public.%I for update to authenticated using (public.tem_empresa(empresa_id) and public.pode_ver_vendedor(vendedor_id)) with check (public.tem_empresa(empresa_id) and public.pode_ver_vendedor(vendedor_id))', t);
    execute format('create policy "admin apaga" on public.%I for delete to authenticated using (public.has_role(auth.uid(),''administrador''))', t);
  end loop;
end $$;

create policy "ver links" on public.links for select to authenticated using (public.tem_empresa(empresa_id));
create policy "diretoria gerencia links" on public.links for all to authenticated using (public.ve_tudo()) with check (public.ve_tudo());

create policy "ver regras" on public.configuracoes_regras for select to authenticated using (public.tem_empresa(empresa_id));
create policy "diretoria edita regras" on public.configuracoes_regras for all to authenticated using (public.ve_tudo()) with check (public.ve_tudo());

create policy "inserir auditoria" on public.registro_auditoria for insert to authenticated
  with check (usuario_id = public.meu_usuario_id());
create policy "diretoria lê auditoria" on public.registro_auditoria for select to authenticated using (public.ve_tudo());

-- signup: claim a demo vendor (Humberto, then Clara) or create a new one
create or replace function public.ao_criar_usuario()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_primeiro boolean; v_nome text;
begin
  select not exists (select 1 from public.usuarios where auth_user_id is not null) into v_primeiro;
  v_nome := coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', split_part(new.email,'@',1));
  select id into v_id from public.usuarios
    where demo and auth_user_id is null and perfil = 'vendedor'
    order by case nome when 'Humberto' then 0 when 'Clara' then 1 else 2 end limit 1;
  if v_id is not null then
    update public.usuarios set auth_user_id = new.id, email = new.email where id = v_id;
  else
    insert into public.usuarios (auth_user_id, nome, email, empresa_id, perfil)
      values (new.id, v_nome, new.email, (select id from public.empresas order by created_at limit 1), 'vendedor')
      returning id into v_id;
    insert into public.usuario_empresas (usuario_id, empresa_id) select v_id, id from public.empresas;
  end if;
  insert into public.user_roles (user_id, role) values (new.id, 'vendedor') on conflict do nothing;
  if v_primeiro then
    insert into public.user_roles (user_id, role) values (new.id, 'administrador') on conflict do nothing;
  end if;
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.ao_criar_usuario();

-- delete demo data (admin only)
create or replace function public.apagar_dados_demo()
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.has_role(auth.uid(),'administrador') then
    raise exception 'Apenas administradores podem apagar os dados de demonstração';
  end if;
  delete from public.interacoes where demo;
  delete from public.vendas where demo;
  delete from public.orcamentos where demo;
  delete from public.tarefas_agenda where demo;
  delete from public.alertas where demo;
  delete from public.pontos where demo;
  delete from public.selos where demo;
  delete from public.metas where demo;
  delete from public.links where demo;
  delete from public.clientes where demo;
  update public.usuarios set demo = false where auth_user_id is not null;
  delete from public.usuarios where demo and auth_user_id is null;
  insert into public.registro_auditoria (usuario_id, acao, detalhes)
    values (public.meu_usuario_id(), 'apagar_dados_demo', '{}'::jsonb);
end $$;
revoke execute on function public.apagar_dados_demo() from public, anon;
grant execute on function public.apagar_dados_demo() to authenticated;

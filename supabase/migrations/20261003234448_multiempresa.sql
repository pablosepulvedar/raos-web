-- Multiempresa: cada fila pertenece a una empresa y RLS solo deja ver la empresa del usuario.
-- Los datos existentes pasan a RAOS. Se crea DEMO con catálogos copiados de RAOS.

create table public.empresas (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9-]+$'),
  nombre text not null,
  logo_url text,
  color text,
  activa boolean not null default true,
  created_at timestamptz not null default now()
);
alter table public.empresas enable row level security;
grant select on public.empresas to authenticated;

insert into public.empresas (slug, nombre, logo_url, color) values
  ('raos', 'Parapente RAOS', '/logo.jpg', '#2e6db4'),
  ('demo', 'Empresa Demo', null, '#2e6db4');

-- Perfiles: empresa del usuario + flag de superadmin (soporte)
alter table public.perfiles
  add column empresa_id uuid references public.empresas(id),
  add column es_superadmin boolean not null default false;
update public.perfiles set empresa_id = (select id from public.empresas where slug = 'raos');
alter table public.perfiles alter column empresa_id set not null;
create index on public.perfiles (empresa_id);

update public.perfiles set es_superadmin = true
where id = (select id from auth.users where email = 'pablo.sepulveda.retamal@gmail.com');

-- security definer: lee perfiles sin pasar por su propio RLS
create function public.mi_empresa_id() returns uuid
  language sql stable security definer set search_path = ''
  as $$ select empresa_id from public.perfiles where id = auth.uid() $$;

alter table public.perfiles alter column empresa_id set default public.mi_empresa_id();

-- Superadmin cambia la empresa que está viendo
create function public.cambiar_empresa(p_slug text) returns void
  language plpgsql security definer set search_path = ''
  as $$
begin
  if not exists (select 1 from public.perfiles where id = auth.uid() and es_superadmin) then
    raise exception 'solo superadmin';
  end if;
  update public.perfiles
    set empresa_id = (select id from public.empresas where slug = p_slug)
    where id = auth.uid();
end $$;
revoke execute on function public.cambiar_empresa(text) from public, anon;

-- Desde la app nadie puede darse superadmin (solo SQL directo / service_role)
create function public.proteger_superadmin() returns trigger
  language plpgsql set search_path = ''
  as $$
begin
  if current_user in ('authenticated', 'anon')
     and new.es_superadmin is distinct from (case when tg_op = 'UPDATE' then old.es_superadmin else false end) then
    raise exception 'es_superadmin no se puede modificar';
  end if;
  return new;
end $$;
create trigger proteger_superadmin before insert or update on public.perfiles
  for each row execute function public.proteger_superadmin();

-- empresa_id en todas las tablas de negocio + reemplazo de policies
do $$
declare
  t text;
  p record;
  raos uuid := (select id from public.empresas where slug = 'raos');
begin
  foreach t in array array[
    'deuda', 'deuda_detalles', 'gastos_diarios', 'horarios', 'metodos_pago', 'pagos',
    'perfil_roles', 'perfil_valores', 'piloto_pagos', 'pilotos', 'reserva_pagos',
    'reserva_servicios', 'reservas', 'reservas_personas', 'roles', 'valores'
  ] loop
    execute format('alter table public.%I add column empresa_id uuid references public.empresas(id) on delete cascade', t);
    execute format('update public.%I set empresa_id = %L', t, raos);
    execute format('alter table public.%I alter column empresa_id set not null', t);
    execute format('alter table public.%I alter column empresa_id set default public.mi_empresa_id()', t);
    execute format('create index on public.%I (empresa_id)', t);
  end loop;

  -- borra todas las policies viejas (varias eran "using (true)", incluso para anon)
  for p in
    select policyname, tablename from pg_policies
    where schemaname = 'public' and tablename in (
      'deuda', 'deuda_detalles', 'gastos_diarios', 'horarios', 'metodos_pago', 'pagos',
      'perfil_roles', 'perfil_valores', 'piloto_pagos', 'pilotos', 'reserva_pagos',
      'reserva_servicios', 'reservas', 'reservas_personas', 'roles', 'valores', 'perfiles')
  loop
    execute format('drop policy %I on public.%I', p.policyname, p.tablename);
  end loop;

  foreach t in array array[
    'deuda', 'deuda_detalles', 'gastos_diarios', 'horarios', 'metodos_pago', 'pagos',
    'perfil_roles', 'perfil_valores', 'piloto_pagos', 'pilotos', 'reserva_pagos',
    'reserva_servicios', 'reservas', 'reservas_personas', 'roles', 'valores', 'perfiles'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format(
      'create policy empresa on public.%I for all to authenticated
         using (empresa_id = (select public.mi_empresa_id()))
         with check (empresa_id = (select public.mi_empresa_id()))', t);
  end loop;
end $$;

-- Cada usuario ve su propia empresa (nombre, logo, color)
create policy empresa_propia on public.empresas for select to authenticated
  using (id = (select public.mi_empresa_id()));

-- DEMO: catálogos copiados de RAOS
insert into public.roles (nombre, empresa_id)
  select nombre, (select id from public.empresas where slug = 'demo') from public.roles
  where empresa_id = (select id from public.empresas where slug = 'raos');
insert into public.horarios (horario, empresa_id)
  select horario, (select id from public.empresas where slug = 'demo') from public.horarios
  where empresa_id = (select id from public.empresas where slug = 'raos');
insert into public.metodos_pago (nombre, activo, empresa_id)
  select nombre, activo, (select id from public.empresas where slug = 'demo') from public.metodos_pago
  where empresa_id = (select id from public.empresas where slug = 'raos');
insert into public.valores (servicio, monto, piloto, pasajero, descuento, empresa_id)
  select servicio, monto, piloto, pasajero, descuento, (select id from public.empresas where slug = 'demo') from public.valores
  where empresa_id = (select id from public.empresas where slug = 'raos');

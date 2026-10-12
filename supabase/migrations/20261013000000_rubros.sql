-- El rubro de cada empresa y la jerga que le corresponde. En vez de hablar de
-- "pilotos" y "vuelos" en toda la app, cada pantalla usa la palabra del rubro:
-- el piloto de parapente es el guía del rafting y el instructor del buceo.
-- Es tabla y no enum para poder agregar rubros sin desplegar.
create table public.rubros (
  codigo text primary key,
  nombre text not null,
  actividad text not null,
  actividad_plural text not null,
  operador text not null,
  operador_plural text not null,
  cliente text not null,
  cliente_plural text not null,
  realizado text not null,
  orden integer not null default 100
);

insert into public.rubros (codigo, nombre, actividad, actividad_plural, operador, operador_plural, cliente, cliente_plural, realizado, orden) values
  ('parapente',  'Parapente',            'vuelo',     'vuelos',     'piloto',     'pilotos',     'pasajero',    'pasajeros',    'voló',   10),
  ('rafting',    'Rafting',              'bajada',    'bajadas',    'guía',       'guías',       'tripulante',  'tripulantes',  'bajó',   20),
  ('cabalgatas', 'Cabalgatas',           'cabalgata', 'cabalgatas', 'arriero',    'arrieros',    'jinete',      'jinetes',      'salió',  30),
  ('trekking',   'Trekking y montaña',   'salida',    'salidas',    'guía',       'guías',       'caminante',   'caminantes',   'salió',  40),
  ('buceo',      'Buceo',                'inmersión', 'inmersiones','instructor', 'instructores','buzo',        'buzos',        'buceó',  50),
  ('navegacion', 'Navegación',           'zarpe',     'zarpes',     'patrón',     'patrones',    'tripulante',  'tripulantes',  'zarpó',  60),
  ('tours',      'Tours y excursiones',  'tour',      'tours',      'guía',       'guías',       'pasajero',    'pasajeros',    'salió',  70),
  ('generico',   'Otra actividad',       'salida',    'salidas',    'guía',       'guías',       'participante','participantes','salió', 100);

-- Catálogo compartido: lo lee cualquier usuario con sesión, no lo edita nadie desde la app
alter table public.rubros enable row level security;
create policy rubros_lectura on public.rubros for select to authenticated using (true);
grant select on public.rubros to authenticated;

alter table public.empresas add column rubro text not null default 'generico' references public.rubros(codigo);
update public.empresas set rubro = 'parapente' where slug in ('raos', 'demo');

-- La jerga de la empresa del usuario, para las pantallas
create or replace function public.mi_jerga()
  returns public.rubros
  language sql stable security definer set search_path = ''
  as $$
  select r.* from public.rubros r
    join public.empresas e on e.rubro = r.codigo
    where e.id = public.mi_empresa_id()
  $$;
revoke execute on function public.mi_jerga() from public, anon;
grant execute on function public.mi_jerga() to authenticated;

-- El panel del superadmin muestra y edita el rubro
drop function if exists public.sa_empresas();
create function public.sa_empresas()
  returns table (id uuid, slug text, nombre text, logo_url text, color text, activa boolean,
                 created_at timestamptz, usuarios bigint, reservas bigint, reservas_30d bigint,
                 ultimo_login timestamptz, vuelos_30d bigint, pasajeros_30d bigint,
                 ingresos_30d bigint, fichas_firmadas bigint, fichas_pendientes bigint,
                 rubro text, rubro_nombre text)
  language plpgsql stable security definer set search_path = ''
  as $$
begin
  if not public.es_superadmin() then raise exception 'solo superadmin'; end if;
  return query
    select e.id, e.slug, e.nombre, e.logo_url, e.color, e.activa, e.created_at,
      (select count(*) from public.perfiles p where p.empresa_id = e.id),
      (select count(*) from public.reservas r where r.empresa_id = e.id),
      (select count(*) from public.reservas r
         where r.empresa_id = e.id and r.created_at > now() - interval '30 days'),
      (select max(u.last_sign_in_at) from public.perfiles p
         join auth.users u on u.id = p.id where p.empresa_id = e.id),
      (select count(*) from public.reservas r
         where r.empresa_id = e.id and r.volo and r.fecha > current_date - 30),
      (select coalesce(sum(r.cantidad), 0) from public.reservas r
         where r.empresa_id = e.id and r.volo and r.fecha > current_date - 30),
      (select coalesce(sum(rp.monto), 0) from public.reserva_pagos rp
         where rp.empresa_id = e.id and rp.created_at > now() - interval '30 days'),
      (select count(*) from public.fichas_riesgo f
         where f.empresa_id = e.id and f.aceptada_at is not null),
      (select count(*) from public.fichas_riesgo f
         where f.empresa_id = e.id and f.aceptada_at is null),
      e.rubro, r.nombre
    from public.empresas e join public.rubros r on r.codigo = e.rubro
    order by e.created_at;
end $$;
revoke execute on function public.sa_empresas() from public, anon;
grant execute on function public.sa_empresas() to authenticated;

-- Al crear la empresa, el rol del operador también sale del rubro
drop function if exists public.sa_guardar_empresa(uuid, text, text, text, text, boolean);
create function public.sa_guardar_empresa(p_id uuid, p_slug text, p_nombre text, p_logo_url text,
                                          p_color text, p_activa boolean, p_rubro text default 'generico')
  returns uuid
  language plpgsql security definer set search_path = ''
  as $$
declare
  v_id uuid;
  v_operador text;
begin
  if not public.es_superadmin() then raise exception 'solo superadmin'; end if;
  if not exists (select 1 from public.rubros where codigo = p_rubro) then
    raise exception 'rubro "%" no existe', p_rubro;
  end if;
  if p_id is null then
    insert into public.empresas (slug, nombre, logo_url, color, activa, rubro)
      values (lower(trim(p_slug)), trim(p_nombre), nullif(trim(p_logo_url), ''),
              coalesce(nullif(p_color, ''), '#2e6db4'), coalesce(p_activa, true), p_rubro)
      returning id into v_id;
    select initcap(operador) into v_operador from public.rubros where codigo = p_rubro;
    insert into public.roles (nombre, empresa_id)
      select r, v_id from unnest(array['Admin', v_operador, 'Coordinador']) r;
  else
    update public.empresas set
      nombre = trim(p_nombre), logo_url = nullif(trim(p_logo_url), ''),
      color = coalesce(nullif(p_color, ''), color), activa = p_activa, rubro = p_rubro
      where id = p_id
      returning id into v_id;
  end if;
  return v_id;
end $$;
revoke execute on function public.sa_guardar_empresa(uuid, text, text, text, text, boolean, text) from public, anon;
grant execute on function public.sa_guardar_empresa(uuid, text, text, text, text, boolean, text) to authenticated;

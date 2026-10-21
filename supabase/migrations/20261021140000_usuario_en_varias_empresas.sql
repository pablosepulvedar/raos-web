-- Un usuario puede trabajar en varias empresas.
--
-- Hasta ahora `perfiles.empresa_id` hacía dos trabajos a la vez: a qué empresa
-- perteneces y en cuál estás trabajando. Por eso `cambiar_empresa` era una mudanza:
-- el piloto desaparecía de la empresa anterior y sus vuelos quedaban "Sin nombre".
-- Y un guía que vuela para dos empresas no tenía cómo existir.
--
-- Se separan los dos conceptos:
--   pertenencia      -> public.perfil_roles (ya existía, tiene empresa_id)
--   empresa de turno -> public.perfil_sesion (esta tabla)
--
-- mi_empresa_id() sigue siendo el único punto del que cuelga todo el RLS: las 20
-- políticas no se tocan.

-- ── La empresa en la que estoy trabajando ────────────────────────────────────
create table public.perfil_sesion (
  perfil_id uuid primary key references public.perfiles(id) on delete cascade,
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  actualizado_at timestamptz not null default now()
);

-- Cada uno ve su propia fila y nada más: así una empresa no puede averiguar en
-- qué otras trabaja su piloto. Escribir es cosa de cambiar_empresa().
create policy "propia" on public.perfil_sesion for select using (perfil_id = auth.uid());
grant select on public.perfil_sesion to authenticated;

insert into public.perfil_sesion (perfil_id, empresa_id)
  select id, empresa_id from public.perfiles where empresa_id is not null;

-- ── El ancla del RLS ─────────────────────────────────────────────────────────
-- La empresa de turno, pero solo si sigo perteneciendo a ella. Sin fila de sesión
-- (usuario recién creado) cae en la única empresa donde tiene roles.
create or replace function public.mi_empresa_id() returns uuid
  language sql stable security definer set search_path = ''
  as $$
    select coalesce(
      (select s.empresa_id
         from public.perfil_sesion s
         join public.empresas e on e.id = s.empresa_id and e.activa
        where s.perfil_id = auth.uid()
          and (public.es_superadmin()
               or exists (select 1 from public.perfil_roles pr
                           where pr.perfil_id = auth.uid() and pr.empresa_id = s.empresa_id))),
      (select pr.empresa_id
         from public.perfil_roles pr
         join public.empresas e on e.id = pr.empresa_id and e.activa
        where pr.perfil_id = auth.uid()
        limit 1)
    )
  $$;

-- ── Quién se ve con quién ────────────────────────────────────────────────────
-- Antes: "este perfil es de mi empresa". Ahora: "compartimos empresa". Si no, el
-- guía que trabaja en dos sale sin nombre en una de ellas.
drop policy if exists "empresa" on public.perfiles;
create policy "comparte empresa" on public.perfiles for select
  using (
    id = auth.uid()
    or exists (select 1 from public.perfil_roles pr
                where pr.perfil_id = perfiles.id and pr.empresa_id = public.mi_empresa_id())
  );
create policy "escribir en mi empresa" on public.perfiles for update
  using (exists (select 1 from public.perfil_roles pr
                  where pr.perfil_id = perfiles.id and pr.empresa_id = public.mi_empresa_id()));
create policy "borrar de mi empresa" on public.perfiles for delete
  using (exists (select 1 from public.perfil_roles pr
                  where pr.perfil_id = perfiles.id and pr.empresa_id = public.mi_empresa_id()));

-- ── Mis empresas, para el selector ───────────────────────────────────────────
-- Solo responde por uno mismo: nadie puede preguntar por las empresas de otro.
-- Primero la que me asignó un vuelo más recientemente.
create function public.mis_empresas()
  returns table (id uuid, slug text, nombre text, logo_url text, color text,
                 actual boolean, ultimo_vuelo date)
  language sql stable security definer set search_path = ''
  as $$
    with mias as (
      select e.id, e.slug, e.nombre, e.logo_url, e.color
        from public.empresas e
       where e.activa
         and (public.es_superadmin()
              or exists (select 1 from public.perfil_roles pr
                          where pr.perfil_id = auth.uid() and pr.empresa_id = e.id))
    )
    select m.id, m.slug, m.nombre, m.logo_url, m.color,
           m.id = public.mi_empresa_id(),
           (select max(r.fecha) from public.reservas_personas rp
              join public.reservas r on r.id = rp.reserva_id
             where rp.perfil_id = auth.uid() and r.empresa_id = m.id)
      from mias m
     order by 7 desc nulls last, m.nombre
  $$;
revoke execute on function public.mis_empresas() from public, anon;
grant execute on function public.mis_empresas() to authenticated;

-- ── Cambiar de empresa ya no es mudarse ──────────────────────────────────────
create or replace function public.cambiar_empresa(p_slug text) returns void
  language plpgsql security definer set search_path = ''
  as $$
declare v_empresa uuid;
begin
  select id into v_empresa from public.empresas where slug = p_slug and activa;
  if v_empresa is null then raise exception 'empresa desconocida'; end if;

  -- El superadmin entra a cualquiera; el resto, solo donde tiene roles
  if not public.es_superadmin()
     and not exists (select 1 from public.perfil_roles pr
                      where pr.perfil_id = auth.uid() and pr.empresa_id = v_empresa) then
    raise exception 'no perteneces a esa empresa';
  end if;

  insert into public.perfil_sesion (perfil_id, empresa_id, actualizado_at)
       values (auth.uid(), v_empresa, now())
  on conflict (perfil_id) do update set empresa_id = excluded.empresa_id,
                                        actualizado_at = now();
end $$;
revoke execute on function public.cambiar_empresa(text) from public, anon;
grant execute on function public.cambiar_empresa(text) to authenticated;

-- ── Crear o vincular ─────────────────────────────────────────────────────────
-- Si el correo ya existe en otra empresa, no se crea un perfil nuevo: se le dan
-- roles en esta. El nombre no se pisa, es el que la persona ya tenía.
create or replace function public.sa_crear_perfil(p_user uuid, p_empresa uuid,
                                                  p_nombre text, p_roles text[])
  returns void language plpgsql security definer set search_path = ''
  as $$
begin
  if not public.es_superadmin() then raise exception 'solo superadmin'; end if;

  insert into public.perfiles (id, nombre, activo) values (p_user, trim(p_nombre), true)
  on conflict (id) do nothing;

  insert into public.perfil_roles (perfil_id, rol_id, empresa_id)
    select p_user, r.id, p_empresa from public.roles r
     where r.empresa_id = p_empresa and r.nombre = any(p_roles)
  on conflict do nothing;

  -- Si es su primera empresa, queda trabajando ahí
  insert into public.perfil_sesion (perfil_id, empresa_id) values (p_user, p_empresa)
  on conflict (perfil_id) do nothing;
end $$;

-- ── Usuarios de una empresa (panel del superadmin) ───────────────────────────
-- Los roles se acotan a la empresa consultada: sin eso, el panel mostraría los
-- roles que la persona tiene en otras empresas.
create or replace function public.sa_usuarios(p_empresa uuid)
  returns table (id uuid, email text, nombre text, roles text,
                 ultimo_login timestamptz, bloqueado boolean)
  language plpgsql stable security definer set search_path = ''
  as $$
begin
  if not public.es_superadmin() then raise exception 'solo superadmin'; end if;
  return query
    select p.id, u.email::text, p.nombre,
      (select string_agg(r.nombre, ', ' order by r.nombre)
         from public.perfil_roles pr
         join public.roles r on r.id = pr.rol_id
        where pr.perfil_id = p.id and pr.empresa_id = p_empresa)::text,
      u.last_sign_in_at, coalesce(u.banned_until > now(), false)
    from public.perfiles p
    join auth.users u on u.id = p.id
   where exists (select 1 from public.perfil_roles pr
                  where pr.perfil_id = p.id and pr.empresa_id = p_empresa)
   order by p.nombre;
end $$;

-- ── El contador de usuarios del panel ────────────────────────────────────────
-- Los usuarios de una empresa ya no son "los perfiles con ese empresa_id", sino
-- los que tienen roles ahí. El resto de la función queda igual.
create or replace function public.sa_empresas()
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
      (select count(distinct pr.perfil_id) from public.perfil_roles pr where pr.empresa_id = e.id),
      (select count(*) from public.reservas r where r.empresa_id = e.id),
      (select count(*) from public.reservas r
         where r.empresa_id = e.id and r.created_at > now() - interval '30 days'),
      (select max(u.last_sign_in_at) from public.perfil_roles pr
         join auth.users u on u.id = pr.perfil_id where pr.empresa_id = e.id),
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
      e.rubro, ru.nombre
    from public.empresas e join public.rubros ru on ru.codigo = e.rubro
    order by e.created_at;
end $$;

-- ── Y se va la columna que hacía los dos trabajos ────────────────────────────
-- Mientras existiera, una empresa podía leer en el perfil de su guía a qué otra
-- empresa pertenece.
alter table public.perfiles drop column empresa_id;

-- Panel superadmin: funciones security definer que validan es_superadmin.
-- service_role en prod no tiene DML sobre public, así que el panel pasa por aquí.

-- Empresa desactivada: sus usuarios dejan de ver datos
create or replace function public.mi_empresa_id() returns uuid
  language sql stable security definer set search_path = ''
  as $$
    select p.empresa_id from public.perfiles p
    join public.empresas e on e.id = p.empresa_id and e.activa
    where p.id = auth.uid()
  $$;

create function public.es_superadmin() returns boolean
  language sql stable security definer set search_path = ''
  as $$ select coalesce((select es_superadmin from public.perfiles where id = auth.uid()), false) $$;

create function public.sa_empresas()
  returns table (id uuid, slug text, nombre text, logo_url text, color text, activa boolean,
                 created_at timestamptz, usuarios bigint, reservas bigint, reservas_30d bigint,
                 ultimo_login timestamptz)
  language plpgsql stable security definer set search_path = ''
  as $$
begin
  if not public.es_superadmin() then raise exception 'solo superadmin'; end if;
  return query
    select e.id, e.slug, e.nombre, e.logo_url, e.color, e.activa, e.created_at,
      (select count(*) from public.perfiles p where p.empresa_id = e.id),
      (select count(*) from public.reservas r where r.empresa_id = e.id),
      (select count(*) from public.reservas r where r.empresa_id = e.id and r.created_at > now() - interval '30 days'),
      (select max(u.last_sign_in_at) from public.perfiles p join auth.users u on u.id = p.id where p.empresa_id = e.id)
    from public.empresas e
    order by e.created_at;
end $$;

-- Crea (p_id null) o actualiza una empresa. Al crear, agrega los roles base.
create function public.sa_guardar_empresa(p_id uuid, p_slug text, p_nombre text, p_logo_url text,
                                          p_color text, p_activa boolean)
  returns uuid
  language plpgsql security definer set search_path = ''
  as $$
declare v_id uuid;
begin
  if not public.es_superadmin() then raise exception 'solo superadmin'; end if;
  if p_id is null then
    insert into public.empresas (slug, nombre, logo_url, color, activa)
      values (lower(trim(p_slug)), trim(p_nombre), nullif(trim(p_logo_url), ''), coalesce(nullif(p_color, ''), '#2e6db4'), coalesce(p_activa, true))
      returning id into v_id;
    insert into public.roles (nombre, empresa_id)
      select r, v_id from unnest(array['Admin', 'Piloto', 'Coordinador']) r;
  else
    update public.empresas set
      nombre = trim(p_nombre), logo_url = nullif(trim(p_logo_url), ''),
      color = coalesce(nullif(p_color, ''), color), activa = p_activa
      where id = p_id
      returning id into v_id;
  end if;
  return v_id;
end $$;

create function public.sa_usuarios(p_empresa uuid)
  returns table (id uuid, email text, nombre text, roles text, ultimo_login timestamptz, bloqueado boolean)
  language plpgsql stable security definer set search_path = ''
  as $$
begin
  if not public.es_superadmin() then raise exception 'solo superadmin'; end if;
  return query
    select p.id, u.email::text, p.nombre,
      (select string_agg(r.nombre, ', ' order by r.nombre) from public.perfil_roles pr
         join public.roles r on r.id = pr.rol_id where pr.perfil_id = p.id)::text,
      u.last_sign_in_at, coalesce(u.banned_until > now(), false)
    from public.perfiles p join auth.users u on u.id = p.id
    where p.empresa_id = p_empresa
    order by p.nombre;
end $$;

-- Perfil + roles (por nombre) para un usuario de auth recién creado
create function public.sa_crear_perfil(p_user uuid, p_empresa uuid, p_nombre text, p_roles text[])
  returns void
  language plpgsql security definer set search_path = ''
  as $$
begin
  if not public.es_superadmin() then raise exception 'solo superadmin'; end if;
  insert into public.perfiles (id, nombre, activo, empresa_id) values (p_user, trim(p_nombre), true, p_empresa);
  insert into public.perfil_roles (perfil_id, rol_id, empresa_id)
    select p_user, r.id, p_empresa from public.roles r
    where r.empresa_id = p_empresa and r.nombre = any(p_roles);
end $$;

do $$
declare f text;
begin
  foreach f in array array[
    'es_superadmin()', 'sa_empresas()',
    'sa_guardar_empresa(uuid, text, text, text, text, boolean)',
    'sa_usuarios(uuid)', 'sa_crear_perfil(uuid, uuid, text, text[])'
  ] loop
    execute format('revoke execute on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;

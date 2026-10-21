-- Banco de guías: una empresa puede encontrar guías que ya usan el sistema y
-- ofrecerles trabajo, sin que eso abra la lista de pilotos de nadie.
--
-- Dos reglas que lo mantienen honesto:
--   1. Aparecer lo decide el guía (`perfiles.disponible`), nunca el sistema.
--      El que vuela solo para su empresa sigue siendo invisible.
--   2. La búsqueda devuelve nombre y rubro, nunca el correo ni el teléfono. Así
--      el banco no se puede copiar como lista de contactos.
--
-- Agregar a alguien no es un clic de la empresa: es una invitación que el guía
-- acepta. Nadie entra a trabajar a una empresa sin enterarse.

alter table public.perfiles
  add column disponible boolean not null default false;

comment on column public.perfiles.disponible is
  'El guía eligió aparecer en el banco para que otras empresas lo encuentren';

-- ── Invitaciones ─────────────────────────────────────────────────────────────
create table public.invitaciones (
  id bigint generated always as identity primary key,
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  perfil_id uuid not null references public.perfiles(id) on delete cascade,
  roles text[] not null,
  estado text not null default 'pendiente'
    check (estado in ('pendiente', 'aceptada', 'rechazada')),
  creada_at timestamptz not null default now(),
  respondida_at timestamptz
);
create unique index invitaciones_pendiente
  on public.invitaciones (empresa_id, perfil_id) where estado = 'pendiente';

-- La ve la empresa que invita y el guía invitado, nadie más. Se escribe por función.
create policy "parte interesada" on public.invitaciones for select
  using (empresa_id = public.mi_empresa_id() or perfil_id = auth.uid());
grant select on public.invitaciones to authenticated;

-- ── Buscar en el banco ───────────────────────────────────────────────────────
-- Pide al menos 3 letras: sin eso sería un volcado de toda la tabla.
create function public.buscar_guias(p_texto text)
  returns table (id uuid, nombre text, rubros text, ya_esta boolean, invitado boolean)
  language sql stable security definer set search_path = ''
  as $$
    select p.id, p.nombre,
      (select string_agg(distinct ru.nombre, ', ')
         from public.perfil_roles pr
         join public.empresas e on e.id = pr.empresa_id
         join public.rubros ru on ru.codigo = e.rubro
        where pr.perfil_id = p.id),
      exists (select 1 from public.perfil_roles pr
               where pr.perfil_id = p.id and pr.empresa_id = public.mi_empresa_id()),
      exists (select 1 from public.invitaciones i
               where i.perfil_id = p.id and i.empresa_id = public.mi_empresa_id()
                 and i.estado = 'pendiente')
      from public.perfiles p
     where public.puedo_administrar()
       and length(trim(p_texto)) >= 3
       and p.disponible
       and p.activo
       and not p.es_superadmin
       and p.nombre ilike '%' || trim(p_texto) || '%'
     order by p.nombre
     limit 20
  $$;
revoke execute on function public.buscar_guias(text) from public, anon;
grant execute on function public.buscar_guias(text) to authenticated;

create function public.invitar_guia(p_perfil uuid, p_roles text[]) returns void
  language plpgsql security definer set search_path = ''
  as $$
declare v_empresa uuid;
begin
  if not public.puedo_administrar() then raise exception 'no autorizado'; end if;
  v_empresa := public.mi_empresa_id();

  if not exists (select 1 from public.perfiles where id = p_perfil and disponible and activo) then
    raise exception 'ese guía no está disponible';
  end if;
  if exists (select 1 from public.perfil_roles pr
              where pr.perfil_id = p_perfil and pr.empresa_id = v_empresa) then
    raise exception 'ya trabaja en esta empresa';
  end if;
  if array_length(p_roles, 1) is null then raise exception 'elige al menos un rol'; end if;

  insert into public.invitaciones (empresa_id, perfil_id, roles)
       values (v_empresa, p_perfil, p_roles)
  on conflict do nothing;
end $$;
revoke execute on function public.invitar_guia(uuid, text[]) from public, anon;
grant execute on function public.invitar_guia(uuid, text[]) to authenticated;

-- ── Lo que ve el guía ────────────────────────────────────────────────────────
create function public.mis_invitaciones()
  returns table (id bigint, empresa text, logo_url text, color text, roles text, creada_at timestamptz)
  language sql stable security definer set search_path = ''
  as $$
    select i.id, e.nombre, e.logo_url, e.color,
           array_to_string(i.roles, ', '), i.creada_at
      from public.invitaciones i
      join public.empresas e on e.id = i.empresa_id and e.activa
     where i.perfil_id = auth.uid() and i.estado = 'pendiente'
     order by i.creada_at
  $$;
revoke execute on function public.mis_invitaciones() from public, anon;
grant execute on function public.mis_invitaciones() to authenticated;

-- Aceptar es lo único que crea los roles: la empresa por sí sola no puede meter
-- a nadie en su equipo.
create function public.responder_invitacion(p_id bigint, p_acepta boolean) returns void
  language plpgsql security definer set search_path = ''
  as $$
declare v_inv public.invitaciones;
begin
  select * into v_inv from public.invitaciones
   where id = p_id and perfil_id = auth.uid() and estado = 'pendiente';
  if not found then raise exception 'invitación no encontrada'; end if;

  update public.invitaciones
     set estado = case when p_acepta then 'aceptada' else 'rechazada' end,
         respondida_at = now()
   where id = p_id;

  if p_acepta then
    insert into public.perfil_roles (perfil_id, rol_id, empresa_id)
      select auth.uid(), r.id, v_inv.empresa_id
        from public.roles r
       where r.empresa_id = v_inv.empresa_id and r.nombre = any(v_inv.roles)
    on conflict do nothing;
  end if;
end $$;
revoke execute on function public.responder_invitacion(bigint, boolean) from public, anon;
grant execute on function public.responder_invitacion(bigint, boolean) to authenticated;

-- ── Publicarse o esconderse ──────────────────────────────────────────────────
-- Solo sobre uno mismo. La empresa no puede publicar a su guía.
create function public.publicarme(p_disponible boolean) returns void
  language sql security definer set search_path = ''
  as $$
    update public.perfiles set disponible = p_disponible where id = auth.uid()
  $$;
revoke execute on function public.publicarme(boolean) from public, anon;
grant execute on function public.publicarme(boolean) to authenticated;

create function public.estoy_publicado() returns boolean
  language sql stable security definer set search_path = ''
  as $$ select coalesce((select disponible from public.perfiles where id = auth.uid()), false) $$;
revoke execute on function public.estoy_publicado() from public, anon;
grant execute on function public.estoy_publicado() to authenticated;

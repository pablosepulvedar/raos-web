-- Mas indicadores por empresa en el panel: cuanto se vuela, cuanto se cobra y
-- cuantas fichas se firman. Con reservas y usuarios solos no se ve si la
-- empresa esta operando de verdad.
drop function if exists public.sa_empresas();

create function public.sa_empresas()
  returns table (id uuid, slug text, nombre text, logo_url text, color text, activa boolean,
                 created_at timestamptz, usuarios bigint, reservas bigint, reservas_30d bigint,
                 ultimo_login timestamptz, vuelos_30d bigint, pasajeros_30d bigint,
                 ingresos_30d bigint, fichas_firmadas bigint, fichas_pendientes bigint)
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
      -- vuelos realmente realizados, no solo agendados
      (select count(*) from public.reservas r
         where r.empresa_id = e.id and r.volo and r.fecha > current_date - 30),
      (select coalesce(sum(r.cantidad), 0) from public.reservas r
         where r.empresa_id = e.id and r.volo and r.fecha > current_date - 30),
      (select coalesce(sum(rp.monto), 0) from public.reserva_pagos rp
         where rp.empresa_id = e.id and rp.created_at > now() - interval '30 days'),
      (select count(*) from public.fichas_riesgo f
         where f.empresa_id = e.id and f.aceptada_at is not null),
      (select count(*) from public.fichas_riesgo f
         where f.empresa_id = e.id and f.aceptada_at is null)
    from public.empresas e
    order by e.created_at;
end $$;
revoke execute on function public.sa_empresas() from public, anon;
grant execute on function public.sa_empresas() to authenticated;

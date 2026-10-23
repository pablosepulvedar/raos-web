-- Interruptor por empresa: ¿los pilotos (roles restringidos) ven las reservas?
-- Encendido es lo de siempre. Apagado, el piloto ve solo sus vuelos y recién
-- desde el día del vuelo: nada del calendario a futuro, nada de los otros.
-- Va en el RLS y no solo en el menú, porque esconder el botón no esconde el dato.

alter table public.empresas
  add column pilotos_ven_reservas boolean not null default true;

-- Quien administra ve todo siempre; el resto, según lo que diga la empresa
create function public.veo_todas_las_reservas() returns boolean
  language sql stable security definer set search_path = ''
  as $$
    select public.puedo_administrar() or coalesce(
      (select e.pilotos_ven_reservas from public.empresas e where e.id = public.mi_empresa_id()),
      true)
  $$;
revoke execute on function public.veo_todas_las_reservas() from public, anon;
grant execute on function public.veo_todas_las_reservas() to authenticated;

create function public.fijar_pilotos_ven_reservas(p_valor boolean) returns void
  language plpgsql security definer set search_path = ''
  as $$
  begin
    if not public.puedo_administrar() then raise exception 'no autorizado'; end if;
    update public.empresas set pilotos_ven_reservas = p_valor where id = public.mi_empresa_id();
  end
  $$;
revoke execute on function public.fijar_pilotos_ven_reservas(boolean) from public, anon;
grant execute on function public.fijar_pilotos_ven_reservas(boolean) to authenticated;

-- Restrictivas: se suman (AND) a la política "empresa" de cada tabla.
-- Ojo con la recursión: reservas mira reservas_personas, así que
-- reservas_personas no puede mirar reservas.
create policy sus_vuelos on public.reservas as restrictive for select to authenticated
  using ((select public.veo_todas_las_reservas()) or (
    fecha <= (now() at time zone 'America/Santiago')::date
    and exists (select 1 from public.reservas_personas rp
                 where rp.reserva_id = reservas.id and rp.perfil_id = auth.uid())));

create policy sus_vuelos on public.reservas_personas as restrictive for select to authenticated
  using ((select public.veo_todas_las_reservas()) or perfil_id = auth.uid());

create policy lo_suyo on public.perfil_valores as restrictive for select to authenticated
  using ((select public.veo_todas_las_reservas()) or perfil_id = auth.uid());

create policy lo_suyo on public.piloto_pagos as restrictive for select to authenticated
  using ((select public.veo_todas_las_reservas()) or perfil_id = auth.uid());

-- Datos del cliente (pagos, servicios, fichas): con el interruptor apagado no son del piloto
create policy solo_si_ve_reservas on public.reserva_pagos as restrictive for select to authenticated
  using ((select public.veo_todas_las_reservas()));
create policy solo_si_ve_reservas on public.reserva_servicios as restrictive for select to authenticated
  using ((select public.veo_todas_las_reservas()));
create policy solo_si_ve_reservas on public.fichas_riesgo as restrictive for select to authenticated
  using ((select public.veo_todas_las_reservas()));
create policy solo_si_ve_reservas on public.fichas_log as restrictive for select to authenticated
  using ((select public.veo_todas_las_reservas()));

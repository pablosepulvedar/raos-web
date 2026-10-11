-- El sitio demo es de prueba: lo que se carga ahí se borra a los 5 días.
-- Solo datos de operación. Los catálogos (roles, horarios, valores, métodos de
-- pago) y los usuarios demo se quedan, si no la demo queda inservible.
create function public.limpiar_demo() returns void
  language plpgsql security definer set search_path = ''
  as $$
declare
  demo uuid := (select id from public.empresas where slug = 'demo');
  corte timestamptz := now() - interval '5 days';
begin
  if demo is null then return; end if;

  -- pagos y perfil_valores apuntan a reservas sin cascade: van primero
  delete from public.pagos
    where reserva_id in (select id from public.reservas where empresa_id = demo and created_at < corte);
  delete from public.perfil_valores
    where reserva_id in (select id from public.reservas where empresa_id = demo and created_at < corte);

  -- arrastra personas, servicios, pagos de reserva, deuda y fichas por cascade
  delete from public.reservas where empresa_id = demo and created_at < corte;

  delete from public.gastos_diarios where empresa_id = demo and created_at < corte;
  delete from public.deuda where empresa_id = demo and created_at < corte;
  delete from public.piloto_pagos where empresa_id = demo and created_at < corte;
  delete from public.pilotos where empresa_id = demo and created_at < corte;
end $$;
revoke execute on function public.limpiar_demo() from public, anon, authenticated;

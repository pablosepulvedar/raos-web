-- "En espera / por reagendar": la salida no se hizo y hay que moverla de día.
-- Mientras está en espera no cuenta como vuelo en ningún lado, no se le paga al guía
-- y tampoco entran sus pagos: un abono cuenta el día que se vuela, no el día que se cobró.
--
-- A diferencia de `borrada_at`, esto NO se esconde con una política restrictiva de RLS:
-- la pestaña Espera tiene que poder verlas. El filtro va en cada consulta.
-- Los roles se respetan solos, porque es la misma tabla y sigue mandando
-- veo_todas_las_reservas().

alter table public.reservas add column espera_at timestamptz;
create index on public.reservas (espera_at) where espera_at is not null;

-- Las dos acciones van en funciones para que pasen completas o no pasen:
-- sin security definer, así el RLS sigue decidiendo qué reserva puede tocar cada quien.
create function public.reserva_a_espera(p_id bigint) returns void
  language plpgsql set search_path = ''
  as $$
begin
  update public.reservas set espera_at = now(), volo = false where id = p_id;
  if not found then raise exception 'reserva no encontrada'; end if;
  -- El guía se suelta: ese día no voló, así que no se le debe pagar.
  -- Al reagendar se asigna de nuevo, que puede ser otro.
  update public.reservas_personas set perfil_id = null where reserva_id = p_id;
end $$;
grant execute on function public.reserva_a_espera(bigint) to authenticated;

create function public.reserva_reagendar(p_id bigint, p_fecha date, p_horario_id bigint)
  returns void
  language plpgsql set search_path = ''
  as $$
begin
  if p_fecha is null then raise exception 'falta la fecha nueva'; end if;
  update public.reservas
     set fecha = p_fecha, horario_id = p_horario_id, espera_at = null
   where id = p_id and espera_at is not null;
  if not found then raise exception 'esa reserva no está en espera'; end if;
end $$;
grant execute on function public.reserva_reagendar(bigint, date, bigint) to authenticated;

-- Al borrar un pasajero, su ficha sin firmar se va con él. Antes quedaba suelta
-- (persona_id se pone en null): Hoy la seguía listando y generar_fichas le
-- habría vuelto a crear un pasajero. La firmada se conserva siempre: es la
-- evidencia y se guarda 2 años (D.S. 19).
create function public.borrar_ficha_del_pasajero() returns trigger
  language plpgsql set search_path = ''
  as $$
  begin
    delete from public.fichas_riesgo where persona_id = old.id and aceptada_at is null;
    return old;
  end
  $$;

create trigger borrar_ficha_del_pasajero before delete on public.reservas_personas
  for each row execute function public.borrar_ficha_del_pasajero();

-- Las que ya quedaron sueltas así (sin pasajero y sin firmar)
delete from public.fichas_riesgo where persona_id is null and aceptada_at is null;

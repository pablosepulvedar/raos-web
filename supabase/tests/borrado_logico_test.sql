-- Prueba: borrar una reserva desde la app la oculta pero conserva sus fichas
-- firmadas; la cámara del cumpleañero (360) y la de promo no se cobran.
-- Uso: docker exec -i supabase_db_raos-web psql -U postgres -t -A < supabase/tests/borrado_logico_test.sql
begin;
create temp table res (n int, prueba text, esperado text, obtenido text);
grant all on res to authenticated;
do $p$
declare e uuid; admin uuid; r bigint; p1 bigint; p2 bigint; f1 bigint; v text;
begin
  select id into e from public.empresas where slug = 'demo';
  select id into admin from auth.users where email = 'demo1@demo.cl';
  insert into public.reservas (nombre, cantidad, fecha, empresa_id) values ('Prueba borrado', 2, current_date, e) returning id into r;
  insert into public.reservas_personas (reserva_id, nombre, empresa_id) values (r, 'Ana', e) returning id into p1;
  insert into public.reservas_personas (reserva_id, nombre, empresa_id) values (r, 'Beto', e) returning id into p2;
  insert into public.fichas_riesgo (reserva_id, persona_id, empresa_id, aceptada_at) values (r, p1, e, now()) returning id into f1;
  insert into public.fichas_riesgo (reserva_id, persona_id, empresa_id) values (r, p2, e);

  perform set_config('role', 'authenticated', true);
  perform set_config('request.headers', '{"x-empresa":"demo"}', true);
  perform set_config('request.jwt.claims', json_build_object('sub', admin)::text, true);

  -- Cumpleañero con 360: no se cobra
  update public.reservas_personas set cumpleanero = true, camara_360 = true where id = p1;
  select count(*)::text into v from public.reserva_servicios where reserva_id = r;
  insert into res values (1, 'Cumpleañero con 360: sin cobro', '0', v);

  -- Deja de ser cumpleañero: ahora sí
  update public.reservas_personas set cumpleanero = false where id = p1;
  select count(*)::text into v from public.reserva_servicios where reserva_id = r;
  insert into res values (2, 'Deja de ser cumpleañero: se cobra', '1', v);

  -- Beto con Normal en promo: no se cobra
  update public.reservas_personas set camara_normal = true, camara_promo = true where id = p2;
  select count(*)::text into v from public.reserva_servicios where reserva_id = r;
  insert into res values (3, 'Normal en promo: sin cobro', '1', v);

  -- Ana pasa a promo: se quita su cobro
  update public.reservas_personas set camara_promo = true where id = p1;
  select count(*)::text into v from public.reserva_servicios where reserva_id = r;
  insert into res values (4, 'Pasa a promo: se quita el cobro', '0', v);

  -- Borrar la reserva
  delete from public.reservas where id = r;
  select count(*)::text into v from public.reservas where id = r;
  insert into res values (5, 'Reserva borrada no se ve', '0', v);
  select string_agg(fecha::text, '') into v from public.reserva_de_fichas(array[f1]);
  insert into res values (6, 'La ficha firmada conserva su reserva', current_date::text, v);
  select count(*)::text into v from public.fichas_riesgo where reserva_id = r;
  insert into res values (7, 'Queda solo la ficha firmada', '1', v);

  perform set_config('role', 'postgres', true);
  select (borrada_at is not null)::text into v from public.reservas where id = r;
  insert into res values (8, 'La fila sigue, marcada', 'true', v);
  delete from public.reservas where id = r;
  select count(*)::text into v from public.reservas where id = r;
  insert into res values (9, 'postgres borra de verdad', '0', v);
end $p$;
reset role;
select case when esperado = obtenido then 'OK   ' else 'FALLA' end || '  ' || n || '. ' || prueba
       || ': esperaba ' || esperado || ', obtuvo ' || coalesce(obtenido,'(nulo)') as r
  from res order by n;
rollback;

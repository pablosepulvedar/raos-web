-- Prueba: la cámara del pasajero y el servicio cobrado se arrastran uno al otro.
-- Uso: docker exec -i supabase_db_raos-web psql -U postgres -t -A < supabase/tests/camara_sincronizada_test.sql
begin;
create temp table res (n int, prueba text, esperado text, obtenido text);
grant all on res to authenticated;
do $p$
declare e uuid; admin uuid; r bigint; p1 bigint; p2 bigint; c360 bigint; v text;
  estado text;
begin
  select id into e from public.empresas where slug = 'demo';
  select id into admin from auth.users where email = 'demo1@demo.cl';
  select id into c360 from public.valores where empresa_id = e and servicio = 'Cámara 360';
  insert into public.reservas (nombre, cantidad, fecha, empresa_id) values ('Prueba camara', 2, current_date, e) returning id into r;
  insert into public.reservas_personas (reserva_id, nombre, empresa_id) values (r, 'Ana', e) returning id into p1;
  insert into public.reservas_personas (reserva_id, nombre, empresa_id) values (r, 'Beto', e) returning id into p2;

  perform set_config('role', 'authenticated', true);
  perform set_config('request.headers', '{"x-empresa":"demo"}', true);
  perform set_config('request.jwt.claims', json_build_object('sub', admin)::text, true);

  -- Hoy: Ana elige 360 -> aparece el servicio
  update public.reservas_personas set camara_360 = true, camara_normal = false, sin_camara = false where id = p1;
  select string_agg(v.servicio, ',' order by v.servicio) into v from public.reserva_servicios rs join public.valores v on v.id = rs.valor_id where rs.reserva_id = r;
  insert into res values (1, 'Pasajero elige 360: se cobra', 'Cámara 360', v);

  -- Ana pasa a Normal -> cambia el servicio
  update public.reservas_personas set camara_360 = false, camara_normal = true where id = p1;
  select string_agg(v.servicio, ',' order by v.servicio) into v from public.reserva_servicios rs join public.valores v on v.id = rs.valor_id where rs.reserva_id = r;
  insert into res values (2, 'Cambia a Normal: cambia el cobro', 'Cámara Normal', v);

  -- Agenda: se agrega Cámara 360 -> se la asigna a Beto, que no tenía
  insert into public.reserva_servicios (reserva_id, valor_id, empresa_id) values (r, c360, e);
  select string_agg(nombre || ':' || coalesce(public.camara_de(p), '-'), ',' order by nombre) into v from public.reservas_personas p where reserva_id = r;
  insert into res values (3, 'Servicio 360 agregado: lo toma Beto', 'Ana:camara_normal,Beto:camara_360', v);

  -- Agenda: se quita el servicio Normal -> Ana queda sin elegir
  delete from public.reserva_servicios where reserva_id = r and public.camara_del_valor(valor_id) = 'camara_normal';
  select string_agg(nombre || ':' || coalesce(public.camara_de(p), '-'), ',' order by nombre) into v from public.reservas_personas p where reserva_id = r;
  insert into res values (4, 'Servicio Normal quitado: Ana sin cámara', 'Ana:-,Beto:camara_360', v);

  -- Borrar a Beto se lleva su cámara
  delete from public.reservas_personas where id = p2;
  select count(*)::text into v from public.reserva_servicios where reserva_id = r;
  insert into res values (5, 'Borrar pasajero quita su servicio', '0', v);

  -- Servicio cobrado sin pasajeros todavía: queda, y el primero que elige esa cámara lo toma
  insert into public.reserva_servicios (reserva_id, valor_id, empresa_id) values (r, c360, e);
  update public.reservas_personas set sin_camara = true where id = p1;
  select count(*)::text into v from public.reserva_servicios where reserva_id = r;
  insert into res values (6, 'Sin cámara no toca el servicio pendiente', '1', v);
end $p$;
reset role;
select case when esperado = obtenido then 'OK   ' else 'FALLA' end || '  ' || n || '. ' || prueba
       || ': esperaba ' || esperado || ', obtuvo ' || coalesce(obtenido,'(nulo)') as r
  from res order by n;
rollback;

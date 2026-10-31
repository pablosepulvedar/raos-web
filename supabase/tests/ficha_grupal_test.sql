-- Prueba: link de la reserva, nombre fijo y pasajeros repetidos al firmar fichas.
-- Uso: docker exec -i supabase_db_raos-web psql -U postgres -t -A < supabase/tests/ficha_grupal_test.sql
begin;
create temp table res (n int, prueba text, esperado text, obtenido text);
do $p$
declare e uuid; r bigint; rt text; t_ana text; t_gen text; t_beto text; v text;
begin
  select id into e from public.empresas where slug = 'demo';
  insert into public.reservas (nombre, cantidad, fecha, empresa_id) values ('Prueba grupal', 3, current_date, e)
    returning id, ficha_token into r, rt;
  insert into public.reservas_personas (reserva_id, nombre, empresa_id) values (r, 'Ana Pérez', e);
  insert into public.reservas_personas (reserva_id, nombre, empresa_id) values (r, 'Beto Soto', e);
  perform public.generar_fichas(r);  -- crea las fichas de Ana, Beto y un "Pasajero 3"
  select f.token into t_ana from public.fichas_riesgo f join public.reservas_personas p on p.id = f.persona_id where f.reserva_id = r and p.nombre = 'Ana Pérez';
  select f.token into t_beto from public.fichas_riesgo f join public.reservas_personas p on p.id = f.persona_id where f.reserva_id = r and p.nombre = 'Beto Soto';
  select f.token into t_gen from public.fichas_riesgo f join public.reservas_personas p on p.id = f.persona_id where f.reserva_id = r and p.nombre ~ '^Pasajero';

  select string_agg(nombre || ':' || generico, ',' order by nombre) into v from public.fichas_de_reserva(rt);
  insert into res values (1, 'El link de la reserva lista a todos', 'Ana Pérez:false,Beto Soto:false,Pasajero 3:true', v);

  -- Link personal de Ana: aunque escriba otro nombre, queda el suyo
  perform public.firmar_ficha(t_ana, 'Otra Persona', '11.111.111-1', 30, 'Chilena', 'X', '912345678', 'Hermano',
    false, null, '{}', false, null, null, null, null, null, 'v', 'h', 'es', '1.1.1.1', 'ua', 70);
  select nombre into v from public.fichas_riesgo where token = t_ana;
  insert into res values (2, 'Link personal: el nombre no cambia', 'Ana Pérez', v);

  -- La misma ficha otra vez
  begin
    perform public.firmar_ficha(t_ana, 'Ana Pérez', '22.222.222-2', 30, 'Chilena', 'X', '912345678', 'Hermano',
      false, null, '{}', false, null, null, null, null, null, 'v', 'h', 'es', '1.1.1.1', 'ua', 70);
    v := 'firmó';
  exception when others then v := sqlerrm; end;
  insert into res values (3, 'Ficha ya firmada', 'ficha ya aceptada', v);

  -- El genérico escribe el nombre de Ana (ya firmado)
  begin
    perform public.firmar_ficha(t_gen, ' ana  perez ', '33.333.333-3', 30, 'Chilena', 'X', '912345678', 'Hermano',
      false, null, '{}', false, null, null, null, null, null, 'v', 'h', 'es', '1.1.1.1', 'ua', 70);
    v := 'firmó';
  exception when others then v := sqlerrm; end;
  insert into res values (4, 'Mismo nombre ya firmado', 'pasajero ya ingresado', v);

  -- Beto con el RUT de Ana escrito distinto
  begin
    perform public.firmar_ficha(t_beto, 'Beto Soto', '111111111', 30, 'Chilena', 'X', '912345678', 'Hermano',
      false, null, '{}', false, null, null, null, null, null, 'v', 'h', 'es', '1.1.1.1', 'ua', 70);
    v := 'firmó';
  exception when others then v := sqlerrm; end;
  insert into res values (5, 'Mismo RUT ya firmado', 'pasajero ya ingresado', v);

  -- El genérico escribe el nombre de Beto, que está en la lista sin firmar
  begin
    perform public.firmar_ficha(t_gen, 'Beto Soto', '44.444.444-4', 30, 'Chilena', 'X', '912345678', 'Hermano',
      false, null, '{}', false, null, null, null, null, null, 'v', 'h', 'es', '1.1.1.1', 'ua', 70);
    v := 'firmó';
  exception when others then v := sqlerrm; end;
  insert into res values (6, 'Nombre que ya está en la lista', 'nombre en la lista', v);

  -- El genérico con un nombre nuevo
  perform public.firmar_ficha(t_gen, 'Carla Ruiz', '55.555.555-5', 30, 'Chilena', 'X', '912345678', 'Hermano',
    false, null, '{}', false, null, null, null, null, null, 'v', 'h', 'es', '1.1.1.1', 'ua', 70);
  select p.nombre into v from public.fichas_riesgo f join public.reservas_personas p on p.id = f.persona_id where f.token = t_gen;
  insert into res values (7, 'Pasajero 3 pasa a tener nombre', 'Carla Ruiz', v);

  -- "No estoy en la lista"
  perform public.firmar_ficha_nueva(rt, 'Diego Lara', '66.666.666-6', 30, 'Chilena', 'X', '912345678', 'Hermano',
    false, null, '{}', false, null, null, null, null, null, 'v', 'h', 'es', '1.1.1.1', 'ua', 70);
  select cantidad || '/' || (select count(*) from public.reservas_personas where reserva_id = r) into v from public.reservas where id = r;
  insert into res values (8, 'Agregarse suma a la reserva', '4/4', v);

  -- "No estoy en la lista" repetido: error y no queda nada agregado
  begin
    perform public.firmar_ficha_nueva(rt, 'DIEGO LARA', '77.777.777-7', 30, 'Chilena', 'X', '912345678', 'Hermano',
      false, null, '{}', false, null, null, null, null, null, 'v', 'h', 'es', '1.1.1.1', 'ua', 70);
    v := 'firmó';
  exception when others then v := sqlerrm; end;
  v := v || ' ' || (select count(*) from public.reservas_personas where reserva_id = r);
  insert into res values (9, 'Agregarse repetido no deja nada', 'pasajero ya ingresado 4', v);

  -- Reserva borrada: el link muere
  update public.reservas set borrada_at = now() where id = r;
  select count(*)::text into v from public.fichas_de_reserva(rt);
  insert into res values (10, 'Link de reserva borrada', '0', v);
end $p$;
select case when esperado = obtenido then 'OK   ' else 'FALLA' end || '  ' || n || '. ' || prueba
       || ': esperaba ' || esperado || ', obtuvo ' || coalesce(obtenido,'(nulo)') as r
  from res order by n;
rollback;

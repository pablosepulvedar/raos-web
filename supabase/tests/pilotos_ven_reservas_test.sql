-- Prueba: el interruptor "los pilotos ven las reservas" de cada empresa.
-- Uso: docker exec -i supabase_db_raos-web psql -U postgres -t -A < supabase/tests/pilotos_ven_reservas_test.sql
begin;
create temp table res (n int, prueba text, esperado text, obtenido text);
grant all on res to authenticated;
do $p$
declare demo uuid; piloto uuid; admin uuid; ayer bigint; manana bigint; ajena bigint; v text;
  hoy date := (now() at time zone 'America/Santiago')::date;
begin
  select id into demo   from public.empresas where slug = 'demo';
  select id into piloto from auth.users where email = 'demo3@demo.cl';
  select id into admin  from auth.users where email = 'demo1@demo.cl';

  -- Un vuelo suyo de ayer, uno suyo de mañana y uno de otro piloto
  insert into public.reservas (nombre, cantidad, fecha, empresa_id) values ('Ayer', 1, hoy - 1, demo) returning id into ayer;
  insert into public.reservas (nombre, cantidad, fecha, empresa_id) values ('Manana', 1, hoy + 1, demo) returning id into manana;
  insert into public.reservas (nombre, cantidad, fecha, empresa_id) values ('Ajena', 1, hoy - 1, demo) returning id into ajena;
  insert into public.reservas_personas (reserva_id, nombre, perfil_id, empresa_id) values
    (ayer, 'P1', piloto, demo), (manana, 'P2', piloto, demo), (ajena, 'P3', admin, demo);
  insert into public.reserva_pagos (reserva_id, metodo_pago_id, monto, empresa_id)
    select ayer, id, 1000, demo from public.metodos_pago where empresa_id = demo limit 1;

  perform set_config('role', 'authenticated', true);
  perform set_config('request.headers', '{"x-empresa":"demo"}', true);

  -- Encendido (lo de siempre): el piloto ve las tres
  perform set_config('request.jwt.claims', json_build_object('sub', piloto)::text, true);
  select string_agg(nombre, ',' order by nombre) into v from public.reservas where id in (ayer, manana, ajena);
  insert into res values (1, 'Encendido: piloto ve todas', 'Ajena,Ayer,Manana', v);

  -- El piloto no puede apagarlo
  begin
    perform public.fijar_pilotos_ven_reservas(false);
    insert into res values (2, 'Piloto no puede cambiarlo', 'no autorizado', 'lo cambio');
  exception when others then
    insert into res values (2, 'Piloto no puede cambiarlo', 'no autorizado', sqlerrm);
  end;

  -- El admin lo apaga
  perform set_config('request.jwt.claims', json_build_object('sub', admin)::text, true);
  perform public.fijar_pilotos_ven_reservas(false);
  select string_agg(nombre, ',' order by nombre) into v from public.reservas where id in (ayer, manana, ajena);
  insert into res values (3, 'Apagado: admin sigue viendo todas', 'Ajena,Ayer,Manana', v);

  perform set_config('request.jwt.claims', json_build_object('sub', piloto)::text, true);
  select string_agg(nombre, ',' order by nombre) into v from public.reservas where id in (ayer, manana, ajena);
  insert into res values (4, 'Apagado: piloto ve solo su vuelo ya hecho', 'Ayer', v);
  select string_agg(nombre, ',' order by nombre) into v from public.reservas_personas where reserva_id in (ayer, manana, ajena);
  insert into res values (5, 'Apagado: pasajeros, solo los suyos', 'P1,P2', v);
  select count(*)::text into v from public.reserva_pagos where reserva_id = ayer;
  insert into res values (6, 'Apagado: no ve pagos del cliente', '0', v);
end $p$;
reset role;
select case when esperado = obtenido then 'OK   ' else 'FALLA' end || '  ' || n || '. ' || prueba
       || ': esperaba ' || esperado || ', obtuvo ' || coalesce(obtenido,'(nulo)') as r
  from res order by n;
rollback;

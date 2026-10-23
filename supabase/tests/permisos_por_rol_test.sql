-- Prueba: permisos por rol (Varios > Roles) y que solo quien administra toca roles.
-- Uso: docker exec -i supabase_db_raos-web psql -U postgres -t -A < supabase/tests/permisos_por_rol_test.sql
begin;
create temp table res (n int, prueba text, esperado text, obtenido text);
grant all on res to authenticated;
do $p$
declare demo uuid; piloto uuid; admin uuid; rol_piloto bigint; rol_admin bigint;
  ayer bigint; manana bigint; ajena bigint; v text;
  hoy date := (now() at time zone 'America/Santiago')::date;
begin
  select id into demo   from public.empresas where slug = 'demo';
  select id into piloto from auth.users where email = 'demo3@demo.cl';
  select id into admin  from auth.users where email = 'demo1@demo.cl';
  select id into rol_piloto from public.roles where empresa_id = demo and nombre = 'Piloto';
  select id into rol_admin  from public.roles where empresa_id = demo and nombre = 'Admin';

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

  -- Por defecto el piloto tiene "reservas": ve las tres
  perform set_config('request.jwt.claims', json_build_object('sub', piloto)::text, true);
  select string_agg(nombre, ',' order by nombre) into v from public.reservas where id in (ayer, manana, ajena);
  insert into res values (1, 'Con permiso: piloto ve todas', 'Ajena,Ayer,Manana', v);

  -- El piloto no puede tocar permisos ni darse Admin
  begin
    update public.roles set permisos = '{}' where id = rol_piloto;
    insert into res values (2, 'Piloto no cambia permisos', 'no autorizado', 'los cambio');
  exception when others then insert into res values (2, 'Piloto no cambia permisos', 'no autorizado', sqlerrm); end;
  begin
    insert into public.perfil_roles (perfil_id, rol_id, empresa_id) values (piloto, rol_admin, demo);
    insert into res values (3, 'Piloto no se da Admin', 'no autorizado', 'se lo dio');
  exception when others then insert into res values (3, 'Piloto no se da Admin', 'no autorizado', sqlerrm); end;

  -- El admin le saca "reservas" al rol Piloto
  perform set_config('request.jwt.claims', json_build_object('sub', admin)::text, true);
  update public.roles set permisos = '{pilotos}' where id = rol_piloto;
  select string_agg(nombre, ',' order by nombre) into v from public.reservas where id in (ayer, manana, ajena);
  insert into res values (4, 'Sin permiso: admin sigue viendo todas', 'Ajena,Ayer,Manana', v);
  begin
    update public.roles set restringido = true where id = rol_admin;
    insert into res values (5, 'Admin de base no se restringe', 'el tipo de rol no se cambia', 'se restringio');
  exception when others then insert into res values (5, 'Admin de base no se restringe', 'el tipo de rol no se cambia', sqlerrm); end;

  perform set_config('request.jwt.claims', json_build_object('sub', piloto)::text, true);
  select string_agg(nombre, ',' order by nombre) into v from public.reservas where id in (ayer, manana, ajena);
  insert into res values (6, 'Sin permiso: piloto ve solo su vuelo ya hecho', 'Ayer', v);
  select string_agg(nombre, ',' order by nombre) into v from public.reservas_personas where reserva_id in (ayer, manana, ajena);
  insert into res values (7, 'Sin permiso: pasajeros, solo los suyos', 'P1,P2', v);
  select count(*)::text into v from public.reserva_pagos where reserva_id = ayer;
  insert into res values (8, 'Sin permiso: no ve pagos del cliente', '0', v);
end $p$;
reset role;
select case when esperado = obtenido then 'OK   ' else 'FALLA' end || '  ' || n || '. ' || prueba
       || ': esperaba ' || esperado || ', obtuvo ' || coalesce(obtenido,'(nulo)') as r
  from res order by n;
rollback;

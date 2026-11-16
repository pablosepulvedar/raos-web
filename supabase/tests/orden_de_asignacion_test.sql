-- "Con quién voló" en el orden en que el guía los fue tomando.
-- Correr: docker exec -i supabase_db_raos-web psql -U postgres -t -A < supabase/tests/orden_de_asignacion_test.sql
begin;
do $$
declare
  emp uuid; hor bigint; res bigint; guia uuid; otro uuid;
  a bigint; b bigint; c bigint; nombres text; n int;
begin
  select e.id into emp from public.empresas e
   where e.activa and exists (select 1 from public.horarios h where h.empresa_id = e.id) limit 1;
  select id into hor from public.horarios where empresa_id = emp limit 1;
  select id into guia from public.perfiles limit 1;
  select id into otro from public.perfiles where id <> guia limit 1;

  insert into public.reservas (nombre, cantidad, fecha, horario_id, empresa_id)
    values ('ORDEN', 3, (now() at time zone 'America/Santiago')::date, hor, emp) returning id into res;
  -- Se crean en un orden (como se tomó la reserva)...
  insert into public.reservas_personas (reserva_id, nombre, empresa_id) values (res, 'Primero en la lista', emp) returning id into a;
  insert into public.reservas_personas (reserva_id, nombre, empresa_id) values (res, 'Segundo en la lista', emp) returning id into b;
  insert into public.reservas_personas (reserva_id, nombre, empresa_id) values (res, 'Tercero en la lista', emp) returning id into c;

  -- ...y se vuelan en otro
  update public.reservas_personas set perfil_id = guia where id = b;
  perform pg_sleep(0.01);
  update public.reservas_personas set perfil_id = guia where id = c;
  perform pg_sleep(0.01);
  update public.reservas_personas set perfil_id = guia where id = a;

  select string_agg(nombre, ' > ' order by asignado_at) into nombres
    from public.reservas_personas where reserva_id = res;
  assert nombres = 'Segundo en la lista > Tercero en la lista > Primero en la lista',
    'deberia quedar en el orden en que se asignaron, dio: ' || coalesce(nombres, '(nada)');

  -- Soltar al guía borra la marca; volver a asignarlo lo manda al final
  update public.reservas_personas set perfil_id = null where id = b;
  select count(*) into n from public.reservas_personas where id = b and asignado_at is null;
  assert n = 1, 'al soltar al guia la marca deberia quedar vacia';
  perform pg_sleep(0.01);
  update public.reservas_personas set perfil_id = guia where id = b;
  select string_agg(nombre, ' > ' order by asignado_at) into nombres
    from public.reservas_personas where reserva_id = res and asignado_at is not null;
  assert nombres = 'Tercero en la lista > Primero en la lista > Segundo en la lista',
    'al reasignarlo deberia ir al final, dio: ' || coalesce(nombres, '(nada)');

  -- Cambiar otra cosa no mueve el orden
  select asignado_at into nombres from public.reservas_personas where id = c;
  update public.reservas_personas set camara_360 = true where id = c;
  select count(*) into n from public.reservas_personas where id = c and asignado_at::text = nombres;
  assert n = 1, 'tocar la camara no deberia mover la marca de asignacion';

  -- Y la marca no ensucia "Quién hizo qué"
  select count(*) into n from public.bitacora
   where tabla = 'reservas_personas' and fila_id = c::text and cambios ? 'asignado_at';
  assert n = 0, 'asignado_at no deberia salir en la bitacora de la empresa';

  raise notice 'orden de asignacion ok';
end $$;
rollback;

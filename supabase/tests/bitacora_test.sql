-- Prueba de la bitacora. Corre en una transaccion y hace rollback.
-- Uso: docker exec -i supabase_db_raos-web psql -U postgres -t -A < supabase/tests/bitacora_test.sql
begin;
create temp table res (n int, prueba text, esperado text, obtenido text);

do $p$
declare v text; v4 text; v5 text; v6 text; v1 text; v2 text; v3 text;
        marilu uuid; joel uuid; raos uuid; rol_coord bigint; r_id bigint; pr_id bigint;
begin
  select id into marilu from auth.users where email = 'admin@raos.com';
  select id into joel   from auth.users where email = 'joel@raos.cl';
  select id into raos   from public.empresas where slug = 'raos';
  select id into rol_coord from public.roles where empresa_id = raos and nombre = 'Coordinador';

  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', marilu)::text, true);

  insert into public.reservas (nombre, cantidad, fecha, horario_id)
    values ('Prueba Bitacora', 2, current_date,
            (select id from public.horarios where empresa_id = raos limit 1))
    returning id into r_id;
  update public.reservas set cantidad = 3 where id = r_id;
  insert into public.perfil_roles (perfil_id, rol_id) values (joel, rol_coord)
    returning id into pr_id;
  delete from public.perfil_roles where id = pr_id;

  select count(*)::text into v1 from public.bitacora where tabla='reservas' and fila_id = r_id::text;
  select (perfil_id = marilu)::text into v2 from public.bitacora
   where tabla='reservas' and fila_id = r_id::text and accion='alta';
  select (cambios->'cantidad'->>'antes') || ' -> ' || (cambios->'cantidad'->>'ahora') into v3
    from public.bitacora where tabla='reservas' and fila_id = r_id::text and accion='cambio';
  select count(*)::text into v4 from public.historial_roles(joel) where rol = 'Coordinador';
  select (hasta is not null)::text into v5 from public.historial_roles(joel) where rol = 'Coordinador';
  select count(*)::text into v6 from public.perfil_roles where perfil_id = joel and rol_id = rol_coord;

  perform set_config('request.jwt.claims', json_build_object('sub', joel)::text, true);
  select count(*)::text into v from public.bitacora;

  perform set_config('role', 'postgres', true);
  insert into res values (1, 'Lineas de esa reserva (alta + cambio)', '2', v1);
  insert into res values (2, 'El autor es quien la creo', 'true', v2);
  insert into res values (3, 'Que cambio', '2 -> 3', v3);
  insert into res values (4, 'Periodos como Coordinador', '1', v4);
  insert into res values (5, 'El periodo quedo cerrado', 'true', v5);
  insert into res values (6, 'Roles vigentes de Coordinador', '0', v6);
  insert into res values (7, 'Lineas que ve un guia restringido', '0', v);
end $p$;

select case when esperado = obtenido then 'OK   ' else 'FALLA' end || '  ' || n || '. ' || prueba
       || ': esperaba ' || esperado || ', obtuvo ' || coalesce(obtenido, '(nulo)') as resultado
  from res order by n;
rollback;

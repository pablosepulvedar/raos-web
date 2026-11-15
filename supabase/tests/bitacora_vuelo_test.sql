-- La bitácora del guía: sus vuelos del sistema + los de fuera, con sus minutos.
-- Correr: docker exec -i supabase_db_raos-web psql -U postgres -t -A < supabase/tests/bitacora_vuelo_test.sql
begin;

do $$
declare
  v_empresa uuid; v_slug text; v_horario bigint; v_res bigint; v_persona bigint;
  v_yo uuid; v_otro uuid; v_externo bigint; n int; m int;
begin
  select e.id, e.slug into v_empresa, v_slug from public.empresas e
   where e.activa and exists (select 1 from public.horarios h where h.empresa_id = e.id) limit 1;
  assert v_empresa is not null, 'no hay ninguna empresa activa con horarios';
  select id into v_horario from public.horarios where empresa_id = v_empresa limit 1;
  select id into v_yo from public.perfiles where es_superadmin limit 1;
  select id into v_otro from public.perfiles where id <> v_yo limit 1;
  assert v_yo is not null and v_otro is not null, 'hacen falta dos perfiles en esta base';

  -- Un vuelo de ayer, mío: la bitácora cuenta lo volado, no lo agendado
  insert into public.reservas (nombre, cantidad, fecha, horario_id, empresa_id)
    values ('PRUEBA BITACORA', 1, (now() at time zone 'America/Santiago')::date - 1, v_horario, v_empresa)
    returning id into v_res;
  insert into public.reservas_personas (reserva_id, nombre, perfil_id, camara_360, empresa_id)
    values (v_res, 'Pasajero de prueba', v_yo, true, v_empresa)
    returning id into v_persona;

  perform set_config('request.jwt.claims', json_build_object('sub', v_yo)::text, true);
  perform set_config('request.headers', json_build_object('x-empresa', v_slug)::text, true);
  execute 'set local role authenticated';

  -- Sin minutos propios, el vuelo vale 10
  select minutos into m from public.mi_bitacora() where origen = 'interno' and id = v_persona;
  assert m = 10, 'un vuelo sin minutos deberia valer 10, dio: ' || coalesce(m::text, '(nulo)');

  perform public.fijar_minutos(v_persona, 25);
  select minutos into m from public.mi_bitacora() where origen = 'interno' and id = v_persona;
  assert m = 25, 'deberia tomar los minutos escritos, dio: ' || coalesce(m::text, '(nulo)');

  -- Un vuelo de fuera: entra en la misma lista
  insert into public.vuelos_externos (fecha, empresa, pasajero, camara, valor)
    values ((now() at time zone 'America/Santiago')::date - 1, 'Otra Empresa', 'Juan Externo', 'normal', 30000)
    returning id into v_externo;
  select count(*) into n from public.mi_bitacora();
  assert n >= 2, 'deberia ver sus dos vuelos, vio: ' || n;
  select minutos into m from public.mi_bitacora() where origen = 'externo' and id = v_externo;
  assert m = 10, 'el vuelo externo sin minutos tambien vale 10, dio: ' || coalesce(m::text, '(nulo)');

  -- El rango filtra por fecha
  select count(*) into n from public.mi_bitacora(
    (now() at time zone 'America/Santiago')::date, null);
  assert n = 0, 'con el rango desde hoy no deberia salir lo de ayer, salieron: ' || n;

  -- Lo cancelado no se voló
  execute 'reset role';
  update public.reservas set borrada_at = now() where id = v_res;
  execute 'set local role authenticated';
  select count(*) into n from public.mi_bitacora() where origen = 'interno' and id = v_persona;
  assert n = 0, 'una reserva cancelada no deberia contar como vuelo';
  execute 'reset role';
  update public.reservas set borrada_at = null where id = v_res;

  -- La bitácora es de cada uno: el de al lado no ve nada de esto
  perform set_config('request.jwt.claims', json_build_object('sub', v_otro)::text, true);
  execute 'set local role authenticated';
  select count(*) into n from public.vuelos_externos where id = v_externo;
  assert n = 0, 'otro perfil no deberia ver mis vuelos externos';
  select count(*) into n from public.mi_bitacora() where id in (v_persona, v_externo);
  assert n = 0, 'mi_bitacora deberia responder solo por quien pregunta';

  -- Y no se le pueden cambiar los minutos a un vuelo ajeno
  begin
    perform public.fijar_minutos(v_persona, 99);
    assert false, 'no deberia dejar tocar el vuelo de otro';
  exception when others then
    assert sqlerrm like '%no es tuyo%', 'esperaba el aviso de vuelo ajeno, obtuvo: ' || sqlerrm;
  end;

  execute 'reset role';
  raise notice 'bitacora de vuelo ok';
end $$;

rollback;

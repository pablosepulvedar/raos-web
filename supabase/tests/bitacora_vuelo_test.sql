-- La bitácora del guía: sus vuelos del sistema + los de fuera, con sus minutos.
-- Correr: docker exec -i supabase_db_raos-web psql -U postgres -t -A < supabase/tests/bitacora_vuelo_test.sql
begin;

do $$
declare
  v_empresa uuid; v_slug text; v_horario bigint; v_res bigint; v_persona bigint;
  v_yo uuid; v_otro uuid; v_externo bigint; n int; m int; s text;
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

  -- Sin anotación, el vuelo del sistema ya está en la bitácora y vale 10 minutos
  select minutos into m from public.mi_bitacora() where origen = 'interno' and ref = v_persona;
  assert m = 10, 'un vuelo sin minutos deberia valer 10, dio: ' || coalesce(m::text, '(nulo)');

  -- Anotarlo: minutos, sitio, vela y tipo
  insert into public.mis_vuelos (persona_id, minutos, sitio, vela, tipo, nota)
    values (v_persona, 25, 'Las Vizcachas', 'Gin Fuse', 'biplaza', 'termica suave');
  select minutos, sitio into m, s from public.mi_bitacora() where origen = 'interno' and ref = v_persona;
  assert m = 25, 'deberia tomar los minutos escritos, dio: ' || coalesce(m::text, '(nulo)');
  assert s = 'Las Vizcachas', 'deberia guardar el sitio, dio: ' || coalesce(s, '(nulo)');

  -- Un vuelo de fuera: entra en la misma lista
  insert into public.mis_vuelos (fecha, empresa, pasajero, camara, valor, tipo)
    values ((now() at time zone 'America/Santiago')::date - 1, 'Otra Empresa', 'Juan Externo',
            'normal', 30000, 'solo')
    returning id into v_externo;
  select count(*) into n from public.mi_bitacora();
  assert n >= 2, 'deberia ver sus dos vuelos, vio: ' || n;
  select minutos into m from public.mi_bitacora() where origen = 'externo' and ref = v_externo;
  assert m = 10, 'el vuelo externo sin minutos tambien vale 10, dio: ' || coalesce(m::text, '(nulo)');

  -- Un vuelo de fuera sin fecha ni empresa no es un vuelo
  begin
    insert into public.mis_vuelos (pasajero) values ('Sin nada');
    assert false, 'no deberia aceptar un vuelo de fuera sin fecha ni empresa';
  exception when others then
    assert sqlerrm like '%vuelo_de_fuera_con_fecha_y_empresa%', 'esperaba el check, obtuvo: ' || sqlerrm;
  end;

  -- El rango filtra por fecha
  select count(*) into n from public.mi_bitacora(
    (now() at time zone 'America/Santiago')::date, null);
  assert n = 0, 'con el rango desde hoy no deberia salir lo de ayer, salieron: ' || n;

  -- Lo cancelado no se voló
  execute 'reset role';
  update public.reservas set borrada_at = now() where id = v_res;
  execute 'set local role authenticated';
  select count(*) into n from public.mi_bitacora() where origen = 'interno' and ref = v_persona;
  assert n = 0, 'una reserva cancelada no deberia contar como vuelo';
  execute 'reset role';
  update public.reservas set borrada_at = null where id = v_res;

  -- Todas las empresas inscritas se ofrecen para el vuelo de fuera
  execute 'set local role authenticated';
  select count(*) into n from public.nombres_de_empresas();
  assert n >= 1, 'deberia listar las empresas activas';

  -- La bitácora es de cada uno: el de al lado no ve nada de esto
  perform set_config('request.jwt.claims', json_build_object('sub', v_otro)::text, true);
  select count(*) into n from public.mis_vuelos where id = v_externo;
  assert n = 0, 'otro perfil no deberia ver mis vuelos';
  select count(*) into n from public.mi_bitacora() where ref in (v_persona, v_externo);
  assert n = 0, 'mi_bitacora deberia responder solo por quien pregunta';

  -- Y no se puede anotar el vuelo de otro
  begin
    insert into public.mis_vuelos (persona_id, minutos) values (v_persona, 99);
    assert false, 'no deberia dejar anotar el vuelo de otro';
  exception when others then
    assert sqlerrm like '%row-level security%' or sqlerrm like '%seguridad%',
      'esperaba que lo frenara el RLS, obtuvo: ' || sqlerrm;
  end;

  execute 'reset role';
  raise notice 'bitacora de vuelo ok';
end $$;

rollback;

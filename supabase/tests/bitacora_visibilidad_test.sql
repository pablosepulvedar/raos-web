-- Quien ve que en la bitacora: el guia sus vuelos de TODAS sus empresas; la empresa los
-- vuelos de ELLA, sin los minutos ni los vuelos de fuera, que son del guia.
-- Correr: docker exec -i supabase_db_raos-web psql -U postgres -t -A < supabase/tests/bitacora_visibilidad_test.sql
begin;
do $$
declare
  a uuid; b uuid; slug_a text; slug_b text; ha bigint; hb bigint;
  piloto uuid; admin_a uuid; rol_b bigint;
  res_a bigint; res_b bigint; per_a bigint; per_b bigint; ext bigint;
  n int; emp int; ayer date;
begin
  ayer := (now() at time zone 'America/Santiago')::date - 1;
  select e.id, e.slug into a, slug_a from public.empresas e where e.slug = 'demo';
  select e.id, e.slug into b, slug_b from public.empresas e where e.slug = 'raos';
  select id into ha from public.horarios where empresa_id = a limit 1;
  select id into hb from public.horarios where empresa_id = b limit 1;
  assert ha is not null and hb is not null, 'faltan horarios en demo o parapenteandino';

  select pr.perfil_id into piloto from public.perfil_roles pr join public.roles r on r.id = pr.rol_id
   where pr.empresa_id = a and r.nombre = 'Piloto' limit 1;
  select pr.perfil_id into admin_a from public.perfil_roles pr join public.roles r on r.id = pr.rol_id
   where pr.empresa_id = a and r.nombre = 'Admin' limit 1;
  assert piloto is not null and admin_a is not null, 'faltan piloto o admin en demo';

  -- el mismo guia pasa a volar tambien para la otra empresa
  select id into rol_b from public.roles where empresa_id = b and nombre = 'Piloto';
  insert into public.perfil_roles (perfil_id, rol_id, empresa_id) values (piloto, rol_b, b);

  insert into public.reservas (nombre, cantidad, fecha, horario_id, empresa_id)
    values ('VIS A', 1, ayer, ha, a) returning id into res_a;
  insert into public.reservas_personas (reserva_id, nombre, perfil_id, camara_normal, empresa_id)
    values (res_a, 'Pasajero A', piloto, true, a) returning id into per_a;
  insert into public.reservas (nombre, cantidad, fecha, horario_id, empresa_id)
    values ('VIS B', 1, ayer, hb, b) returning id into res_b;
  insert into public.reservas_personas (reserva_id, nombre, perfil_id, camara_360, empresa_id)
    values (res_b, 'Pasajero B', piloto, true, b) returning id into per_b;

  -- 1. El guia, mirando el subdominio de A, ve sus vuelos de LAS DOS empresas
  perform set_config('request.jwt.claims', json_build_object('sub', piloto)::text, true);
  perform set_config('request.headers', json_build_object('x-empresa', slug_a)::text, true);
  execute 'set local role authenticated';
  select count(*), count(distinct empresa) into n, emp from public.mi_bitacora(ayer, ayer)
   where ref in (per_a, per_b);
  assert n = 2 and emp = 2, '1. deberia ver sus 2 vuelos de 2 empresas, vio: ' || n || ' / ' || emp;

  -- 2. En el subdominio de A solo lee las filas de A (esto no cambio)
  select count(*) into n from public.reservas_personas where id in (per_a, per_b);
  assert n = 1, '2. por RLS deberia leer solo la fila de su empresa de turno, leyo: ' || n;

  -- 3. Puede anotar minutos de los dos, y agregar uno de fuera
  insert into public.mis_vuelos (persona_id, minutos) values (per_a, 22);
  insert into public.mis_vuelos (persona_id, minutos) values (per_b, 33);
  insert into public.mis_vuelos (fecha, empresa, pasajero, camara)
    values (ayer, 'Escuela de Fuera', 'Juan Externo', '360') returning id into ext;
  select count(*) into n from public.mi_bitacora(ayer, ayer)
   where (ref = per_a and minutos = 22) or (ref = per_b and minutos = 33)
      or (origen = 'externo' and ref = ext and minutos = 10);
  assert n = 3, '3. deberia ver los 3 con sus minutos, vio: ' || n;

  -- 4. El admin de A ve a sus pilotos y los vuelos de SU empresa, no los de la otra
  execute 'reset role';
  perform set_config('request.jwt.claims', json_build_object('sub', admin_a)::text, true);
  perform set_config('request.headers', json_build_object('x-empresa', slug_a)::text, true);
  execute 'set local role authenticated';
  select count(*) into n from public.reservas_personas where id in (per_a, per_b);
  assert n = 1, '4. el admin de A no deberia ver el vuelo de la otra empresa, vio: ' || n;

  -- 5. Los minutos y los vuelos de fuera son del guia: el admin no los ve
  select count(*) into n from public.mis_vuelos;
  assert n = 0, '5. el admin no deberia ver ninguna fila de mis_vuelos, vio: ' || n;
  select count(*) into n from public.mi_bitacora(ayer, ayer);
  assert n = 0, '5b. la bitacora del admin es la suya, no la del guia, vio: ' || n;

  -- 6. Ni escribirlos
  begin
    insert into public.mis_vuelos (persona_id, minutos) values (per_a, 99);
    assert false, '6. no deberia dejar al admin anotar el vuelo de un guia';
  exception when others then
    assert sqlerrm like '%row-level security%' or sqlerrm like '%seguridad%',
      '6. esperaba RLS, obtuvo: ' || sqlerrm;
  end;

  -- 7. Otro guia no ve nada de esto
  execute 'reset role';
  perform set_config('request.jwt.claims',
    json_build_object('sub', (select id from public.perfiles where id <> piloto and id <> admin_a limit 1))::text, true);
  execute 'set local role authenticated';
  select count(*) into n from public.mi_bitacora(ayer, ayer) where ref in (per_a, per_b, ext);
  assert n = 0, '7. otro guia no deberia ver estos vuelos';

  execute 'reset role';
  raise notice 'visibilidad de la bitacora ok';
end $$;
rollback;

-- Los informes: la empresa ve lo volado con ella; el guia, solo lo suyo.
-- Correr: docker exec -i supabase_db_raos-web psql -U postgres -t -A < supabase/tests/reporte_por_empresa_test.sql
begin;
do $$
declare
  a uuid; b uuid; slug_a text; ha bigint; hb bigint;
  piloto uuid; admin_a uuid; rol_b bigint; rol_piloto_a bigint;
  res_a bigint; res_b bigint; per_a bigint; per_b bigint; n int; ayer date;
begin
  ayer := (now() at time zone 'America/Santiago')::date - 1;
  select e.id, e.slug into a, slug_a from public.empresas e where e.slug = 'demo';
  select e.id into b from public.empresas e where e.slug = 'raos';
  select id into ha from public.horarios where empresa_id = a limit 1;
  select id into hb from public.horarios where empresa_id = b limit 1;
  select pr.perfil_id, pr.rol_id into piloto, rol_piloto_a from public.perfil_roles pr
    join public.roles r on r.id = pr.rol_id where pr.empresa_id = a and r.nombre = 'Piloto' limit 1;
  select pr.perfil_id into admin_a from public.perfil_roles pr
    join public.roles r on r.id = pr.rol_id where pr.empresa_id = a and r.nombre = 'Admin' limit 1;

  -- El mismo guia vuela tambien para la otra empresa
  select id into rol_b from public.roles where empresa_id = b and nombre = 'Piloto';
  insert into public.perfil_roles (perfil_id, rol_id, empresa_id) values (piloto, rol_b, b);

  insert into public.reservas (nombre, cantidad, fecha, horario_id, empresa_id)
    values ('REP A', 1, ayer, ha, a) returning id into res_a;
  insert into public.reservas_personas (reserva_id, nombre, perfil_id, empresa_id)
    values (res_a, 'Pax A', piloto, a) returning id into per_a;
  insert into public.reservas (nombre, cantidad, fecha, horario_id, empresa_id)
    values ('REP B', 1, ayer, hb, b) returning id into res_b;
  insert into public.reservas_personas (reserva_id, nombre, perfil_id, empresa_id)
    values (res_b, 'Pax B', piloto, b) returning id into per_b;

  -- Como queda el rol Piloto de esta empresa: informes SI, ver las reservas de los demas NO
  update public.roles set permisos = array['pilotos','reporte_pilotos','reporte_periodo']
   where id = rol_piloto_a;

  -- 1. La empresa, en su informe, ve a ese guia SOLO con lo volado con ella
  perform set_config('request.jwt.claims', json_build_object('sub', admin_a)::text, true);
  perform set_config('request.headers', json_build_object('x-empresa', slug_a)::text, true);
  execute 'set local role authenticated';
  select count(*) into n from public.reservas_personas rp where rp.id in (per_a, per_b);
  assert n = 1, '1. la empresa deberia ver solo el vuelo hecho con ella, vio: ' || n;
  select count(*) into n from public.reservas r where r.id in (res_a, res_b);
  assert n = 1, '1b. tampoco deberia ver la reserva de la otra empresa, vio: ' || n;

  -- 2. El guia, con permiso de informes pero sin "reservas", ve lo suyo y nada mas
  execute 'reset role';
  perform set_config('request.jwt.claims', json_build_object('sub', piloto)::text, true);
  perform set_config('request.headers', json_build_object('x-empresa', slug_a)::text, true);
  execute 'set local role authenticated';
  assert not public.veo_todas_las_reservas(), '2. el guia no deberia ver todas las reservas';
  select count(*) into n from public.reservas_personas rp where rp.id = per_a;
  assert n = 1, '2b. el guia deberia ver su propio vuelo, vio: ' || n;
  select count(*) into n from public.reservas_personas rp
   where rp.empresa_id = a and rp.perfil_id is distinct from piloto;
  assert n = 0, '2c. el guia no deberia ver los vuelos de los demas, vio: ' || n;
  select count(*) into n from public.piloto_pagos pp where pp.perfil_id is distinct from piloto;
  assert n = 0, '2d. tampoco los pagos de los demas, vio: ' || n;

  execute 'reset role';
  raise notice 'reportes ok';
end $$;
rollback;

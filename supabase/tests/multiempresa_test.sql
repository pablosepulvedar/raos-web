-- Test de aislación multiempresa. Corre todo en una transacción y hace rollback.
-- Uso: docker exec -i supabase_db_raos-web psql -U postgres -v ON_ERROR_STOP=1 < supabase/tests/multiempresa_test.sql
begin;

-- usuario de prueba en DEMO
insert into auth.users (id, email) values ('00000000-0000-0000-0000-00000000d3e0', 'test-demo@local');
insert into public.perfiles (id, nombre, empresa_id)
  values ('00000000-0000-0000-0000-00000000d3e0', 'Test Demo', (select id from public.empresas where slug = 'demo'));

create function pg_temp.como(email text) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', (select id from auth.users u where u.email = como.email), 'role', 'authenticated')::text, true);
  set local role authenticated;
end $$;

do $$
declare n int; ok boolean;
begin
  -- RAOS ve sus datos, no los de DEMO
  perform pg_temp.como('joel@raos.cl');
  select count(*) into n from public.reservas;
  assert n > 0, 'RAOS deberia ver sus reservas';
  select count(*) into n from public.empresas;
  assert n = 1, 'RAOS deberia ver solo su empresa';
  select count(*) into n from public.perfiles where nombre = 'Test Demo';
  assert n = 0, 'RAOS no deberia ver perfiles de DEMO';

  -- insert sin empresa_id queda en la empresa del usuario
  insert into public.horarios (horario) values (2359);
  select count(*) into n from public.horarios h join public.empresas e on e.id = h.empresa_id
    where h.horario = 2359 and e.slug = 'raos';
  assert n = 1, 'insert deberia quedar en RAOS';

  -- no puede insertar en otra empresa
  ok := false;
  begin
    insert into public.horarios (horario, empresa_id) values (2358, (select id from public.empresas where slug = 'demo'));
  exception when others then ok := true;
  end;
  assert ok, 'RAOS no deberia poder insertar en DEMO';

  -- no puede darse superadmin
  ok := false;
  begin
    update public.perfiles set es_superadmin = true where id = auth.uid();
  exception when others then ok := true;
  end;
  assert ok, 'no deberia poder darse superadmin';

  -- no puede cambiarse de empresa
  ok := false;
  begin
    perform public.cambiar_empresa('demo');
  exception when others then ok := true;
  end;
  assert ok, 'cambiar_empresa deberia fallar sin superadmin';
  reset role;

  -- DEMO no ve nada de RAOS
  perform pg_temp.como('test-demo@local');
  select count(*) into n from public.reservas;
  assert n = 0, 'DEMO no deberia ver reservas de RAOS';
  select count(*) into n from public.valores;
  assert n > 0, 'DEMO deberia ver sus valores';
  reset role;

  -- anon no ve nada (antes reserva_pagos/gastos_diarios/piloto_pagos estaban abiertas)
  set local role anon;
  select count(*) into n from public.reserva_pagos;
  assert n = 0, 'anon no deberia ver reserva_pagos';
  reset role;

  -- superadmin cambia de empresa y vuelve
  perform pg_temp.como('pablo.sepulveda.retamal@gmail.com');
  perform public.cambiar_empresa('demo');
  select count(*) into n from public.reservas;
  assert n = 0, 'superadmin en DEMO no deberia ver reservas de RAOS';
  perform public.cambiar_empresa('raos');
  select count(*) into n from public.reservas;
  assert n > 0, 'superadmin de vuelta en RAOS';
  reset role;

  raise notice 'multiempresa: OK';
end $$;

rollback;

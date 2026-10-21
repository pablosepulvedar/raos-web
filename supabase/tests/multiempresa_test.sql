-- Test de aislación multiempresa. Corre todo en una transacción y hace rollback.
-- Uso: docker exec -i supabase_db_raos-web psql -U postgres -v ON_ERROR_STOP=1 < supabase/tests/multiempresa_test.sql
begin;

-- usuario de prueba en DEMO. Pertenecer a una empresa es tener roles en ella:
-- perfiles ya no guarda empresa_id.
insert into auth.users (id, email) values ('00000000-0000-0000-0000-00000000d3e0', 'test-demo@local');
insert into public.perfiles (id, nombre) values ('00000000-0000-0000-0000-00000000d3e0', 'Test Demo');
insert into public.perfil_roles (perfil_id, rol_id, empresa_id)
  select '00000000-0000-0000-0000-00000000d3e0', r.id, e.id
    from public.roles r join public.empresas e on e.id = r.empresa_id
   where e.slug = 'demo' and r.nombre = 'Admin';
insert into public.perfil_sesion (perfil_id, empresa_id)
  values ('00000000-0000-0000-0000-00000000d3e0', (select id from public.empresas where slug = 'demo'));

create function pg_temp.como(email text) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', (select id from auth.users u where u.email = como.email), 'role', 'authenticated')::text, true);
  set local role authenticated;
end $$;

do $$
declare n int; ok boolean; reserva_raos bigint; perfil_joel uuid;
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

  -- DEMO no ve nada de RAOS. Se compara contra una reserva concreta de RAOS y no
  -- contra "cero reservas": con datos reales, DEMO tiene las suyas.
  reset role;
  select r.id into reserva_raos from public.reservas r
    join public.empresas e on e.id = r.empresa_id where e.slug = 'raos' limit 1;
  perform pg_temp.como('test-demo@local');
  select count(*) into n from public.reservas where id = reserva_raos;
  assert n = 0, 'DEMO no deberia ver una reserva de RAOS';
  select count(*) into n from public.reservas;
  assert n > 0, 'DEMO deberia ver las suyas';
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
  select count(*) into n from public.reservas where id = reserva_raos;
  assert n = 0, 'superadmin en DEMO no deberia ver una reserva de RAOS';
  perform public.cambiar_empresa('raos');
  select count(*) into n from public.reservas where id = reserva_raos;
  assert n = 1, 'superadmin de vuelta en RAOS';
  reset role;

  -- panel: solo superadmin
  perform pg_temp.como('joel@raos.cl');
  ok := false;
  begin
    perform public.sa_empresas();
  exception when others then ok := true;
  end;
  assert ok, 'sa_empresas deberia fallar sin superadmin';
  reset role;

  perform pg_temp.como('pablo.sepulveda.retamal@gmail.com');
  select count(*) into n from public.sa_empresas();
  assert n >= 2, 'superadmin deberia ver todas las empresas';
  perform public.sa_guardar_empresa(null, 'test-emp', 'Test Emp', null, null, true);
  reset role;
  select count(*) into n from public.roles r join public.empresas e on e.id = r.empresa_id where e.slug = 'test-emp';
  assert n = 3, 'empresa nueva deberia tener 3 roles base';

  -- empresa desactivada: sus usuarios no ven datos
  update public.empresas set activa = false where slug = 'demo';
  perform pg_temp.como('test-demo@local');
  select count(*) into n from public.valores;
  assert n = 0, 'empresa inactiva no deberia ver datos';
  reset role;

  -- ── Un usuario en dos empresas ──────────────────────────────────────────
  update public.empresas set activa = true where slug = 'demo';
  -- Joel, piloto de RAOS, pasa a volar tambien para DEMO
  insert into public.perfil_roles (perfil_id, rol_id, empresa_id)
    select (select id from auth.users where email = 'joel@raos.cl'), r.id, e.id
      from public.roles r join public.empresas e on e.id = r.empresa_id
     where e.slug = 'demo' and r.nombre = 'Piloto';

  perform pg_temp.como('joel@raos.cl');
  select count(*) into n from public.mis_empresas();
  assert n = 2, 'Joel deberia ver sus dos empresas';

  -- Ahora si puede cambiarse, porque pertenece
  perform public.cambiar_empresa('demo');
  select count(*) into n from public.reservas where id = reserva_raos;
  assert n = 0, 'Joel en DEMO no deberia ver una reserva de RAOS';
  perform public.cambiar_empresa('raos');
  select count(*) into n from public.reservas where id = reserva_raos;
  assert n = 1, 'Joel de vuelta en RAOS';

  -- Pero no a una donde no tiene roles
  ok := false;
  begin
    perform public.cambiar_empresa('test-emp');
  exception when others then ok := true;
  end;
  assert ok, 'no deberia entrar donde no pertenece';
  reset role;

  -- Las dos empresas lo ven con nombre, ninguna ve la otra mitad
  -- auth.users no se puede leer como `authenticated`: el id se busca antes
  reset role;
  select u.id into perfil_joel from auth.users u where u.email = 'joel@raos.cl';
  perform pg_temp.como('test-demo@local');
  select count(*) into n from public.perfiles p where p.id = perfil_joel;
  assert n = 1, 'DEMO deberia ver a su piloto prestado';
  select count(*) into n from public.perfil_sesion where perfil_id = perfil_joel;
  assert n = 0, 'nadie deberia ver en que empresa anda otro';
  reset role;

  raise notice 'multiempresa: OK';
end $$;

rollback;

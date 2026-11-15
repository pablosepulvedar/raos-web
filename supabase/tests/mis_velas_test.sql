-- Las velas del guia: suyas, no de la empresa.
-- Correr: docker exec -i supabase_db_raos-web psql -U postgres -t -A < supabase/tests/mis_velas_test.sql
begin;
do $$
declare yo uuid; otro uuid; n int; v bigint;
begin
  select id into yo from public.perfiles where es_superadmin limit 1;
  select id into otro from public.perfiles where id <> yo limit 1;

  perform set_config('request.jwt.claims', json_build_object('sub', yo)::text, true);
  execute 'set local role authenticated';
  insert into public.mis_velas (nombre) values ('Gin Fuse 2') returning id into v;
  select count(*) into n from public.mis_velas;
  assert n = 1, 'deberia ver su vela, vio: ' || n;

  -- repetida no entra
  begin
    insert into public.mis_velas (nombre) values ('Gin Fuse 2');
    assert false, 'no deberia aceptar la misma vela dos veces';
  exception when unique_violation then null;
  end;

  -- vacia tampoco
  begin
    insert into public.mis_velas (nombre) values ('  ');
    assert false, 'no deberia aceptar una vela sin nombre';
  exception when check_violation then null;
  end;

  -- la vela es de cada uno
  perform set_config('request.jwt.claims', json_build_object('sub', otro)::text, true);
  select count(*) into n from public.mis_velas;
  assert n = 0, 'otro perfil no deberia ver mis velas, vio: ' || n;
  update public.mis_velas set nombre = 'Robada' where id = v;
  select count(*) into n from public.mis_velas where id = v;
  assert n = 0, 'tampoco deberia poder tocarla';

  execute 'reset role';
  raise notice 'mis_velas ok';
end $$;
rollback;

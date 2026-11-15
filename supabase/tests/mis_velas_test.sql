-- La ficha de la vela: marca, modelo, año, tipo, homologación.
-- Correr: docker exec -i supabase_db_raos-web psql -U postgres -t -A < supabase/tests/mis_velas_test.sql
begin;
do $$
declare yo uuid; otro uuid; n int; v bigint; nom text;
begin
  select id into yo from public.perfiles where es_superadmin limit 1;
  select id into otro from public.perfiles where id <> yo limit 1;
  perform set_config('request.jwt.claims', json_build_object('sub', yo)::text, true);
  execute 'set local role authenticated';

  insert into public.mis_velas (marca, modelo, anio, tipo, homologacion, talla, serie, revision)
    values ('Gin', 'Fuse 2', 2023, 'biplaza', 'EN B', '42', 'GF2-0099', date '2026-09-01')
    returning id into v;
  select nombre into nom from public.mis_velas where id = v;
  assert nom = 'Gin Fuse 2', 'el nombre deberia salir solo, dio: ' || coalesce(nom, '(nulo)');

  -- el mismo modelo de otro año si entra
  insert into public.mis_velas (marca, modelo, anio) values ('Gin', 'Fuse 2', 2019);
  select count(*) into n from public.mis_velas;
  assert n = 2, 'deberia aceptar el mismo modelo de otro año, vio: ' || n;

  -- repetida exacta no
  begin
    insert into public.mis_velas (marca, modelo, anio) values ('Gin', 'Fuse 2', 2019);
    assert false, 'no deberia aceptar la misma vela dos veces';
  exception when unique_violation then null;
  end;

  -- sin marca tampoco
  begin
    insert into public.mis_velas (marca, modelo) values ('  ', 'Fuse');
    assert false, 'no deberia aceptar una vela sin marca';
  exception when check_violation then null;
  end;

  -- homologacion inventada tampoco
  begin
    insert into public.mis_velas (marca, modelo, homologacion) values ('Ozone', 'Magnum', 'EN Z');
    assert false, 'no deberia aceptar una homologacion que no existe';
  exception when check_violation then null;
  end;

  -- la vela es de cada uno
  perform set_config('request.jwt.claims', json_build_object('sub', otro)::text, true);
  select count(*) into n from public.mis_velas;
  assert n = 0, 'otro perfil no deberia ver mis velas, vio: ' || n;
  update public.mis_velas set marca = 'Robada' where id = v;
  select count(*) into n from public.mis_velas where id = v;
  assert n = 0, 'tampoco deberia poder tocarla';

  execute 'reset role';
  raise notice 'mis_velas ok';
end $$;
rollback;

-- Los sitios de despegue: uno predeterminado por empresa, y el día que se voló en otro.
-- Correr: docker exec -i supabase_db_raos-web psql -U postgres -t -A < supabase/tests/sitios_test.sql
begin;
do $$
declare
  emp uuid; slug text; quien uuid; a bigint; b bigint; n int; nom text;
begin
  select e.id, e.slug into emp, slug from public.empresas e where e.slug = 'raos';
  select pr.perfil_id into quien from public.perfil_roles pr
    join public.roles r on r.id = pr.rol_id
   where pr.empresa_id = emp and not r.restringido limit 1;

  perform set_config('request.jwt.claims', json_build_object('sub', quien)::text, true);
  perform set_config('request.headers', json_build_object('x-empresa', slug)::text, true);
  execute 'set local role authenticated';

  insert into public.sitios (nombre, costo, cuando, predeterminado)
    values ('Sitio de prueba A', 12000, 'fin_de_mes', true) returning id into a;
  insert into public.sitios (nombre, costo, cuando)
    values ('Sitio de prueba B', 7000, 'al_momento') returning id into b;

  -- Uno solo manda
  select count(*) into n from public.sitios where predeterminado;
  assert n = 1, 'deberia haber un solo sitio de siempre, hay: ' || n;
  select nombre into nom from public.sitios where predeterminado;
  assert nom = 'Sitio de prueba A', 'el de siempre deberia ser el ultimo marcado, es: ' || nom;

  -- Marcar otro suelta al anterior
  update public.sitios set predeterminado = true where id = b;
  select nombre into nom from public.sitios where predeterminado;
  assert nom = 'Sitio de prueba B', 'deberia haber pasado al otro, es: ' || nom;
  select count(*) into n from public.sitios where predeterminado;
  assert n = 1, 'sigue teniendo que ser uno solo, hay: ' || n;

  -- Un precio negativo no es un precio
  begin
    insert into public.sitios (nombre, costo) values ('Sitio al reves', -1);
    assert false, 'no deberia aceptar un costo negativo';
  exception when check_violation then null;
  end;

  -- Un día, un sitio: volver a elegir lo cambia, no lo duplica
  insert into public.dias_de_vuelo (fecha, sitio_id) values (current_date, a);
  insert into public.dias_de_vuelo (fecha, sitio_id) values (current_date, b)
    on conflict (empresa_id, fecha) do update set sitio_id = excluded.sitio_id;
  select count(*) into n from public.dias_de_vuelo where fecha = current_date;
  assert n = 1, 'un dia deberia tener un solo sitio, tiene: ' || n;

  -- Lo de la empresa es de la empresa
  execute 'reset role';
  perform set_config('request.headers', json_build_object('x-empresa', 'demo')::text, true);
  execute 'set local role authenticated';
  select count(*) into n from public.sitios where id in (a, b);
  assert n = 0, 'otra empresa no deberia ver estos sitios, vio: ' || n;

  execute 'reset role';
  raise notice 'sitios ok';
end $$;
rollback;

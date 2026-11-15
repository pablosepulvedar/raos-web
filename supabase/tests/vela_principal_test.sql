-- La vela principal: una por tipo, y la bitacora la aplica sola.
-- Correr: docker exec -i supabase_db_raos-web psql -U postgres -t -A < supabase/tests/vela_principal_test.sql
begin;
do $$
declare
  yo uuid; emp uuid; slug text; hor bigint; res bigint; per bigint; v1 bigint; v2 bigint; n int; s text;
begin
  select id into yo from public.perfiles where es_superadmin limit 1;
  select e.id, e.slug into emp, slug from public.empresas e
   where e.activa and exists (select 1 from public.horarios h where h.empresa_id = e.id) limit 1;
  select id into hor from public.horarios where empresa_id = emp limit 1;

  insert into public.reservas (nombre, cantidad, fecha, horario_id, empresa_id)
    values ('PRUEBA VELA', 1, (now() at time zone 'America/Santiago')::date - 1, hor, emp)
    returning id into res;
  insert into public.reservas_personas (reserva_id, nombre, perfil_id, empresa_id)
    values (res, 'Pasajero', yo, emp) returning id into per;

  perform set_config('request.jwt.claims', json_build_object('sub', yo)::text, true);
  perform set_config('request.headers', json_build_object('x-empresa', slug)::text, true);
  execute 'set local role authenticated';

  -- Una principal sin tipo no es principal de nada
  begin
    insert into public.mis_velas (marca, modelo, principal) values ('Gin', 'Sin tipo', true);
    assert false, 'no deberia dejar una principal sin tipo';
  exception when check_violation then null;
  end;

  insert into public.mis_velas (marca, modelo, anio, tipo, principal)
    values ('Gin', 'Fuse 2', 2023, 'biplaza', true) returning id into v1;
  insert into public.mis_velas (marca, modelo, tipo, principal)
    values ('Ozone', 'Rush', 'monoplaza', true) returning id into v2;
  select count(*) into n from public.mis_velas where principal;
  assert n = 2, 'puede tener una principal por tipo, vio: ' || n;

  -- Sin vela anotada, la salida sale con la principal biplaza
  select vela into s from public.mi_bitacora() where origen = 'interno' and ref = per;
  assert s = 'Gin Fuse 2 2023', 'deberia tomar la principal, dio: ' || coalesce(s, '(nula)');

  -- Marcar otra biplaza como principal suelta la anterior
  insert into public.mis_velas (marca, modelo, tipo, principal)
    values ('Niviuk', 'Takoo 5', 'biplaza', true);
  select count(*) into n from public.mis_velas where principal and tipo = 'biplaza';
  assert n = 1, 'deberia quedar una sola principal biplaza, vio: ' || n;
  select vela into s from public.mi_bitacora() where origen = 'interno' and ref = per;
  assert s = 'Niviuk Takoo 5', 'deberia seguir a la nueva principal, dio: ' || coalesce(s, '(nula)');

  -- Lo que el guia escriba en la salida manda sobre la principal
  insert into public.mis_vuelos (persona_id, vela) values (per, 'Gin Fuse 2 2023');
  select vela into s from public.mi_bitacora() where origen = 'interno' and ref = per;
  assert s = 'Gin Fuse 2 2023', 'la vela escrita manda, dio: ' || coalesce(s, '(nula)');

  -- Un vuelo solo va con la monoplaza
  insert into public.mis_vuelos (fecha, empresa, tipo)
    values ((now() at time zone 'America/Santiago')::date - 1, 'Por mi cuenta', 'solo');
  select vela into s from public.mi_bitacora() where origen = 'externo' and empresa = 'Por mi cuenta';
  assert s = 'Ozone Rush', 'un vuelo solo deberia ir con la monoplaza, dio: ' || coalesce(s, '(nula)');

  execute 'reset role';
  raise notice 'vela principal ok';
end $$;
rollback;

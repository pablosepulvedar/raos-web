-- Prueba: estados del cobro de la plataforma, el pago que corre el vencimiento y
-- que una empresa no puede leer ni tocar lo que le cobran.
-- Uso: docker exec -i supabase_db_raos-web psql -U postgres -t -A < supabase/tests/cobros_test.sql
begin;
create temp table res (n int, prueba text, esperado text, obtenido text);
grant all on res to authenticated;
do $p$
declare e uuid; admin uuid; hoy date := (now() at time zone 'America/Santiago')::date; v text;
begin
  select id into e from public.empresas where slug = 'demo';
  select id into admin from auth.users where email = 'demo1@demo.cl';
  insert into res values (1, 'Vence hoy: al día', 'al_dia', public.estado_suscripcion('mensual', hoy));
  insert into res values (2, '7 días vencida: aviso', 'vencida', public.estado_suscripcion('mensual', hoy - 7));
  insert into res values (3, '8 días vencida: suspendida', 'suspendida', public.estado_suscripcion('mensual', hoy - 8));
  insert into res values (4, 'Cortesía no vence', 'cortesia', public.estado_suscripcion('cortesia', hoy - 400));

  delete from public.suscripciones where empresa_id = e;  -- la demo parte en cortesía
  insert into public.suscripciones (empresa_id, plan, precio, vence) values (e, 'mensual', 25000, hoy - 20);
  insert into public.pagos_plataforma (empresa_id, monto, hasta) values (e, 25000, hoy + 10);
  select vence::text into v from public.suscripciones where empresa_id = e;
  insert into res values (5, 'El pago corre el vencimiento', (hoy + 10)::text, v);

  perform set_config('role', 'authenticated', true);
  perform set_config('request.headers', '{"x-empresa":"demo"}', true);
  perform set_config('request.jwt.claims', json_build_object('sub', admin)::text, true);
  select count(*)::text into v from public.suscripciones;
  insert into res values (6, 'El admin de la empresa no ve la tabla', '0', v);
  select estado into v from public.mi_cuenta();
  insert into res values (7, 'Pero sí su estado', 'al_dia', v);
  begin
    update public.suscripciones set vence = hoy + 999 where empresa_id = e;
    get diagnostics v = row_count;
  exception when others then v := 'error';
  end;
  insert into res values (8, 'No puede correrse el vencimiento', '0', v);
end $p$;
reset role;
select case when esperado = obtenido then 'OK   ' else 'FALLA' end || '  ' || n || '. ' || prueba
       || ': esperaba ' || esperado || ', obtuvo ' || coalesce(obtenido,'(nulo)') as r
  from res order by n;
rollback;

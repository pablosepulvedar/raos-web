-- "En espera / por reagendar": la reserva sale de todo mientras espera y vuelve
-- entera al reagendarla, contando en la fecha NUEVA.
-- Correr: docker exec -i supabase_db_raos-web psql -U postgres -t -A < supabase/tests/espera_test.sql
begin;

do $$
declare
  v_empresa uuid;
  v_horario bigint;
  v_metodo bigint;
  v_res bigint;
  v_perfil uuid;
  n bigint;
begin
  -- Se parte de una empresa que tenga horarios Y metodos de pago, si no el insert falla
  select e.id into v_empresa from public.empresas e
   where exists (select 1 from public.horarios h where h.empresa_id = e.id)
     and exists (select 1 from public.metodos_pago m where m.empresa_id = e.id)
   limit 1;
  assert v_empresa is not null, 'no hay ninguna empresa con horarios y metodos de pago';
  select id into v_horario from public.horarios where empresa_id = v_empresa limit 1;
  select id into v_metodo  from public.metodos_pago where empresa_id = v_empresa limit 1;
  select id into v_perfil  from public.perfiles limit 1;

  insert into public.reservas (nombre, cantidad, fecha, horario_id, empresa_id)
    values ('PRUEBA ESPERA', 2, date '2026-11-06', v_horario, v_empresa)
    returning id into v_res;
  insert into public.reservas_personas (reserva_id, nombre, perfil_id, empresa_id)
    values (v_res, 'Pasajero 1', v_perfil, v_empresa);
  insert into public.reserva_pagos (reserva_id, metodo_pago_id, monto, empresa_id)
    values (v_res, v_metodo, 50000, v_empresa);

  -- ── Antes: cuenta como cualquier reserva ────────────────────────────────
  select count(*) into n from public.reservas
   where id = v_res and fecha = date '2026-11-06' and espera_at is null;
  assert n = 1, 'deberia estar normal en su fecha original';
  select count(*) into n from public.reservas_personas where reserva_id = v_res and perfil_id is not null;
  assert n = 1, 'deberia tener guia asignado';

  -- ── Se deja por reagendar ───────────────────────────────────────────────
  perform public.reserva_a_espera(v_res);

  select count(*) into n from public.reservas where id = v_res and espera_at is not null;
  assert n = 1, 'deberia quedar marcada en espera';

  -- Sale de los listados: ninguna consulta por fecha con espera_at is null la ve
  select count(*) into n from public.reservas
   where fecha = date '2026-11-06' and espera_at is null and id = v_res;
  assert n = 0, 'NO deberia aparecer en agenda/hoy/informes mientras espera';

  -- El guia se soltó: no se le paga por una salida que no se hizo
  select count(*) into n from public.reservas_personas where reserva_id = v_res and perfil_id is not null;
  assert n = 0, 'el guia deberia quedar sin asignar';

  -- El pago sigue guardado, pero no entra en el cuadre de esa fecha
  select count(*) into n from public.reserva_pagos where reserva_id = v_res;
  assert n = 1, 'el pago NO se borra, solo deja de contar';
  select count(*) into n
    from public.reserva_pagos p join public.reservas r on r.id = p.reserva_id
   where r.fecha = date '2026-11-06' and r.espera_at is null and p.reserva_id = v_res;
  assert n = 0, 'el pago NO deberia contar mientras la salida esta por reagendar';

  -- Y sigue existiendo: no es un borrado
  select count(*) into n from public.reservas where id = v_res and borrada_at is null;
  assert n = 1, 'la reserva sigue viva, no se borro';

  -- ── Se reagenda ─────────────────────────────────────────────────────────
  perform public.reserva_reagendar(v_res, date '2026-11-20', v_horario);

  select count(*) into n from public.reservas
   where id = v_res and fecha = date '2026-11-20' and espera_at is null;
  assert n = 1, 'reagendada deberia volver a la agenda en la fecha nueva';
  select count(*) into n from public.reservas where id = v_res and fecha = date '2026-11-06';
  assert n = 0, 'no deberia seguir en la fecha vieja';

  -- Y su pago cuenta en la fecha nueva, no en la original
  select count(*) into n
    from public.reserva_pagos p join public.reservas r on r.id = p.reserva_id
   where r.fecha = date '2026-11-20' and r.espera_at is null and p.reserva_id = v_res;
  assert n = 1, 'el pago deberia contar en la fecha nueva';

  -- No se puede reagendar algo que no esta esperando
  begin
    perform public.reserva_reagendar(v_res, date '2026-11-25', v_horario);
    assert false, 'no deberia reagendar una reserva que no esta en espera';
  exception when others then
    assert sqlerrm like '%no esta en espera%' or sqlerrm like '%no está en espera%',
      'esperaba el aviso de que no esta en espera, obtuvo: ' || sqlerrm;
  end;

  -- Ni dejar sin fecha
  perform public.reserva_a_espera(v_res);
  begin
    perform public.reserva_reagendar(v_res, null, v_horario);
    assert false, 'no deberia aceptar fecha vacia';
  exception when others then
    assert sqlerrm like '%falta la fecha%', 'esperaba falta la fecha, obtuvo: ' || sqlerrm;
  end;

  raise notice 'espera ok';
end $$;

rollback;

-- Cancelar con motivo: la reserva se esconde, el motivo queda escrito y la fila
-- sigue existiendo. Es el borrado lógico de siempre más el por qué.
-- Correr: docker exec -i supabase_db_raos-web psql -U postgres -t -A < supabase/tests/cancelar_test.sql
begin;

do $$
declare
  v_empresa uuid; v_slug text; v_horario bigint; v_res bigint; n bigint; v_motivo text;
  v_admin uuid;
begin
  select e.id, e.slug into v_empresa, v_slug from public.empresas e
   where e.activa and exists (select 1 from public.horarios h where h.empresa_id = e.id) limit 1;
  assert v_empresa is not null, 'no hay ninguna empresa activa con horarios';
  select id into v_horario from public.horarios where empresa_id = v_empresa limit 1;
  select id into v_admin from public.perfiles where es_superadmin limit 1;
  assert v_admin is not null, 'no hay superadmin en esta base';

  insert into public.reservas (nombre, cantidad, fecha, horario_id, empresa_id)
    values ('PRUEBA CANCELAR', 2, date '2026-11-20', v_horario, v_empresa)
    returning id into v_res;

  -- El borrado lógico solo corre para 'authenticated' (así es en la app): como
  -- postgres, el DELETE borra de verdad y no se estaría probando nada.
  perform set_config('request.jwt.claims', json_build_object('sub', v_admin)::text, true);
  perform set_config('request.headers', json_build_object('x-empresa', v_slug)::text, true);
  execute 'set local role authenticated';

  -- Sin motivo no se cancela: el dato es el punto de la pantalla
  begin
    perform public.reserva_cancelar(v_res, '   ');
    assert false, 'no deberia cancelar sin motivo';
  exception when others then
    assert sqlerrm like '%motivo%', 'esperaba aviso de motivo, obtuvo: ' || sqlerrm;
  end;

  -- Con motivo: queda guardado y la reserva marcada como borrada
  perform public.reserva_cancelar(v_res, '  el cliente no llegó  ');

  -- Ya no se ve desde la app: la política restrictiva la esconde
  select count(*) into n from public.reservas where id = v_res;
  assert n = 0, 'cancelada no deberia verse mas en la app';

  execute 'reset role';
  select motivo_cancelacion into v_motivo from public.reservas where id = v_res;
  assert v_motivo = 'el cliente no llegó',
    'el motivo deberia guardarse sin espacios de sobra, quedo: ' || coalesce(v_motivo, '(nulo)');
  select count(*) into n from public.reservas where id = v_res and borrada_at is not null;
  assert n = 1, 'deberia quedar marcada como borrada, no borrada de verdad';

  raise notice 'cancelar ok';
end $$;

rollback;

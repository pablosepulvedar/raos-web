-- El alta de empresas: quien tiene el link puede enviar sus datos una sola vez, y
-- nadie que no sea superadmin puede leer lo que mandaron los demás.
-- Correr: docker exec -i supabase_db_raos-web psql -U postgres -t -A < supabase/tests/onboarding_test.sql
begin;

-- Un link recién creado, insertado como dueño de la tabla (como lo haría el superadmin)
insert into public.onboarding (etiqueta, token) values ('Prueba SA', 'tok-de-prueba');

do $$
declare n bigint; t text; e text;
begin
  -- El anónimo ve que el link existe, pero nada más
  set local role anon;
  select count(*) into n from public.onboarding_abrir('tok-de-prueba');
  assert n = 1, 'el anonimo deberia poder abrir su link';
  select count(*) into n from public.onboarding_abrir('tok-que-no-existe');
  assert n = 0, 'un token inventado no deberia devolver nada';

  -- Pero NO puede leer la tabla
  begin
    select count(*) into n from public.onboarding;
    assert false, 'el anonimo NO deberia leer la tabla onboarding';
  exception when insufficient_privilege then
    null;  -- lo esperado
  end;

  -- Firma
  perform public.onboarding_firmar('tok-de-prueba',
    'Alma Outdoor', '76.123.456-7', 'Turismo aventura', 'Camino 123', 'Puente Alto', 'Santiago',
    'parapente', 'alma.cl', 'Pamela Rozas', 'Socia', 'PAMELA@ALMA.CL ', '+56912345678',
    'sin comentarios', 'Pamela Rozas', '12.345.678-9',
    '2026-11-v1', 'abc123', '1.2.3.4', 'navegador de prueba');
  reset role;

  select empresa_nombre into t from public.onboarding where token = 'tok-de-prueba';
  assert t = 'Alma Outdoor', 'deberia haber guardado el nombre';
  select contacto_email into t from public.onboarding where token = 'tok-de-prueba';
  assert t = 'pamela@alma.cl', 'el correo deberia quedar en minusculas y sin espacios, obtuvo: ' || t;
  select count(*) into n from public.onboarding where token = 'tok-de-prueba' and aceptado_at is not null;
  assert n = 1, 'deberia quedar aceptado';

  -- No se puede firmar dos veces
  set local role anon;
  begin
    perform public.onboarding_firmar('tok-de-prueba', 'Otra', '', '', '', '', '', 'generico', '',
      'X', '', 'x@x.cl', '', '', 'X', '', 'v', 'h', '1.1.1.1', 'ua');
    assert false, 'no deberia dejar firmar dos veces';
  exception when others then
    assert sqlerrm like '%ya fue enviado%', 'esperaba el aviso de ya enviado, obtuvo: ' || sqlerrm;
  end;

  -- Ni firmar un link inexistente
  begin
    perform public.onboarding_firmar('no-existe', 'X', '', '', '', '', '', 'generico', '',
      'X', '', 'x@x.cl', '', '', 'X', '', 'v', 'h', '1.1.1.1', 'ua');
    assert false, 'no deberia dejar firmar un link inexistente';
  exception when others then
    assert sqlerrm like '%no encontrado%', 'esperaba link no encontrado, obtuvo: ' || sqlerrm;
  end;

  -- Ni crear links: eso es solo del superadmin
  begin
    perform public.sa_nuevo_onboarding('intento');
    assert false, 'el anonimo no deberia poder crear links';
  exception when others then
    null;  -- da permiso denegado o 'solo superadmin': cualquiera de los dos sirve
  end;
  reset role;

  raise notice 'onboarding ok';
end $$;

rollback;

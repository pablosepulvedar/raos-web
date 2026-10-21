-- Prueba: la empresa viaja en la cabecera x-empresa, una por peticion.
-- Uso: docker exec -i supabase_db_raos-web psql -U postgres -t -A < supabase/tests/empresa_por_peticion_test.sql
begin;
create temp table res (n int, prueba text, esperado text, obtenido text);
do $p$
declare v1 text; v2 text; v3 text; v4 text; v5 text; pablo uuid; joel uuid;
begin
  select id into pablo from auth.users where email='pablo.sepulveda.retamal@gmail.com';
  select id into joel  from auth.users where email='joel@raos.cl';

  perform set_config('role','authenticated',true);
  perform set_config('request.jwt.claims', json_build_object('sub', pablo)::text, true);

  -- Pestana A: cabecera raos
  perform set_config('request.headers', '{"x-empresa":"raos"}', true);
  select slug into v1 from public.empresas;

  -- Pestana B: cabecera almaoutdoor, misma sesion, sin tocar perfil_sesion
  perform set_config('request.headers', '{"x-empresa":"almaoutdoor"}', true);
  select slug into v2 from public.empresas;

  -- Sin cabecera: manda perfil_sesion
  perform set_config('request.headers', '{}', true);
  select slug into v3 from public.empresas;

  -- Un guia pidiendo una empresa que no es suya: la cabecera se ignora
  perform set_config('request.jwt.claims', json_build_object('sub', joel)::text, true);
  perform set_config('request.headers', '{"x-empresa":"almaoutdoor"}', true);
  select slug into v4 from public.empresas;

  -- Y pidiendo la suya, funciona
  perform set_config('request.headers', '{"x-empresa":"raos"}', true);
  select slug into v5 from public.empresas;

  perform set_config('role','postgres',true);
  insert into res values (1, 'Pestana con cabecera raos', 'raos', v1);
  insert into res values (2, 'Otra pestana con cabecera almaoutdoor', 'almaoutdoor', v2);
  insert into res values (3, 'Sin cabecera manda la sesion', 'raos', v3);
  insert into res values (4, 'Guia pidiendo empresa ajena', 'raos', v4);
  insert into res values (5, 'Guia pidiendo la suya', 'raos', v5);
end $p$;
select case when esperado = obtenido then 'OK   ' else 'FALLA' end || '  ' || n || '. ' || prueba
       || ': esperaba ' || esperado || ', obtuvo ' || coalesce(obtenido,'(nulo)') as r
  from res order by n;
rollback;

-- La lista de subdominios validos, para que el middleware pueda rechazar los
-- inventados sin ejecutar la aplicacion entera.
--
-- Va como funcion y no como permiso de lectura sobre `empresas` porque solo la
-- necesita el servidor: la lista completa de clientes no tiene por que estar al
-- alcance de un visitante.
create function public.slugs_activos() returns text[]
  language sql stable security definer set search_path = ''
  as $$ select coalesce(array_agg(e.slug), '{}') from public.empresas e where e.activa $$;
revoke execute on function public.slugs_activos() from public, anon, authenticated;
grant execute on function public.slugs_activos() to service_role;

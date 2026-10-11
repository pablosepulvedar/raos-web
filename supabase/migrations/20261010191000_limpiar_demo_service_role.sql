-- service_role solo existe en el servidor: permite probar la limpieza y
-- dispararla a mano sin exponerla al navegador.
grant execute on function public.limpiar_demo() to service_role;

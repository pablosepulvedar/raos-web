-- En producción las tablas nuevas no reciben permisos por defecto (en local sí, por
-- eso las pruebas pasaban): sin GRANT, PostgREST responde "permission denied" antes
-- de mirar el RLS. Las políticas de cada tabla siguen decidiendo qué filas se ven.
grant select, insert, update, delete on public.tests_porosidad to authenticated;
grant select, insert, update, delete on public.suscripciones to authenticated;
grant select, insert, update, delete on public.pagos_plataforma to authenticated;

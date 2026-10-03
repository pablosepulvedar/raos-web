-- En prod el revoke de public dejó a authenticated sin permiso (la función valida superadmin adentro)
grant execute on function public.cambiar_empresa(text) to authenticated;

-- Cuanto pesa la base, para el panel de consumo del superadmin. El plan gratis de
-- Supabase da 500 MB: sin esto no hay forma de saber cuanto queda sin entrar al
-- dashboard de Supabase.
create function public.sa_uso_db()
  returns json
  language plpgsql stable security definer set search_path = ''
  as $$
declare resultado json;
begin
  if not public.es_superadmin() then raise exception 'solo superadmin'; end if;
  select json_build_object(
    'total', pg_database_size(current_database()),
    'tablas', coalesce((
      select json_agg(t) from (
        select c.relname::text as tabla,
               pg_total_relation_size(c.oid) as bytes,
               c.reltuples::bigint as filas
        from pg_class c
        join pg_namespace n on n.oid = c.relnamespace
        where n.nspname = 'public' and c.relkind = 'r'
        order by pg_total_relation_size(c.oid) desc
        limit 12
      ) t
    ), '[]'::json)
  ) into resultado;
  return resultado;
end $$;
revoke execute on function public.sa_uso_db() from public, anon;
grant execute on function public.sa_uso_db() to authenticated;

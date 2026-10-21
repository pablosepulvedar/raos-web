-- El seguro que enciende RLS en toda tabla nueva de `public`.
--
-- Existía en producción, pero no en las migraciones: se creó a mano una vez. Por
-- eso la base local no lo tenía, y ahí las tablas nuevas nacían con RLS apagado.
-- Una prueba local podía pasar mostrando datos que en producción están tapados,
-- que es la peor clase de prueba: la que tranquiliza sin motivo.
--
-- Esto lo deja en las migraciones, igual en los dos lados. En producción no cambia
-- nada: es el mismo cuerpo que ya estaba.
create or replace function public.rls_auto_enable() returns event_trigger
  language plpgsql security definer set search_path to 'pg_catalog'
  as $$
declare cmd record;
begin
  for cmd in
    select * from pg_event_trigger_ddl_commands()
     where command_tag in ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
       and object_type in ('table', 'partitioned table')
  loop
    if cmd.schema_name = 'public' then
      begin
        execute format('alter table if exists %s enable row level security', cmd.object_identity);
        raise log 'rls_auto_enable: RLS encendido en %', cmd.object_identity;
      exception when others then
        raise log 'rls_auto_enable: no se pudo encender RLS en %', cmd.object_identity;
      end;
    end if;
  end loop;
end $$;

do $$
begin
  if not exists (select 1 from pg_event_trigger where evtname = 'ensure_rls') then
    create event trigger ensure_rls on ddl_command_end
      execute function public.rls_auto_enable();
  end if;
end $$;

-- Las tablas creadas en local antes de que existiera el seguro. En producción ya
-- lo tenían encendido, así que esto no hace nada ahí.
alter table public.perfil_sesion enable row level security;
alter table public.invitaciones enable row level security;

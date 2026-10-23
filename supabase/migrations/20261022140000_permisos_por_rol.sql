-- Permisos por rol, en Varios > Roles. Reemplaza el interruptor por empresa de
-- 20261022120000 (pilotos_ven_reservas), que quedó corto: cada rol decide qué ve.
-- Los roles no restringidos (el Admin de base) lo ven todo y no se editan.
-- Los permisos son las secciones del menú. Solo "reservas" llega al RLS: el
-- resto esconde la sección.

alter table public.roles
  add column permisos text[] not null default '{reservas,pilotos,varios,calendar}';

create or replace function public.veo_todas_las_reservas() returns boolean
  language sql stable security definer set search_path = ''
  as $$
    select public.puedo_administrar() or exists (
      select 1 from public.perfil_roles pr
        join public.roles r on r.id = pr.rol_id
       where pr.perfil_id = auth.uid()
         and pr.empresa_id = public.mi_empresa_id()
         and 'reservas' = any(r.permisos))
  $$;

drop function public.fijar_pilotos_ven_reservas(boolean);
alter table public.empresas drop column pilotos_ven_reservas;

-- roles y perfil_roles tenían la política "empresa" para todo: cualquier usuario
-- de la empresa, piloto incluido, podía escribirlos por la API y darse Admin.
-- Desde la API (current_user = authenticated) solo escribe quien administra.
-- Las funciones security definer (responder_invitacion, crear empresa) corren
-- como su dueño y no pasan por acá.
-- Sin security definer a propósito: current_user tiene que ser el de quien llama
create function public.solo_quien_administra() returns trigger
  language plpgsql set search_path = ''
  as $$
  begin
    if current_user = 'authenticated' and not public.puedo_administrar() then
      raise exception 'no autorizado';
    end if;
    -- Que el Admin de base no se pueda restringir (ni nadie volverse Admin) desde la app
    -- if anidado: plpgsql evalúa new.restringido entero y perfil_roles no lo tiene
    if current_user = 'authenticated' and tg_table_name = 'roles' and tg_op = 'UPDATE' then
      if new.restringido is distinct from old.restringido then
        raise exception 'el tipo de rol no se cambia';
      end if;
    end if;
    return coalesce(new, old);
  end
  $$;

create trigger solo_quien_administra before insert or update or delete on public.roles
  for each row execute function public.solo_quien_administra();
create trigger solo_quien_administra before insert or update or delete on public.perfil_roles
  for each row execute function public.solo_quien_administra();

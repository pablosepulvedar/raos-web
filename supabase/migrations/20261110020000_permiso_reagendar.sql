-- Dejar una reserva por reagendar y reagendarla pasan a ser un permiso por rol,
-- con el mismo mecanismo que el resto: una palabra en `roles.permisos`, marcable
-- en Varios > Roles, y una función que lo chequea.
--
-- Se valida en la BASE además de la pantalla: esconder el botón no impide que
-- alguien llame la función por la API.

-- Los roles que hoy operan la agenda lo conservan, para no cortarle el uso a nadie.
-- Los que no tienen 'reservas' tampoco lo reciben: no ven la agenda.
update public.roles
   set permisos = permisos || '{reagendar}'
 where 'reservas' = any(permisos)
   and not ('reagendar' = any(permisos));

-- Los roles nuevos nacen igual que antes más este permiso, para que siga siendo
-- coherente con 'reservas': quien opera la agenda puede mover una salida.
alter table public.roles
  alter column permisos set default '{reservas,pilotos,varios,calendar,reagendar}';

create function public.puedo_reagendar() returns boolean
  language sql stable security definer set search_path = ''
  as $$
    select public.puedo_administrar() or exists (
      select 1 from public.perfil_roles pr
        join public.roles r on r.id = pr.rol_id
       where pr.perfil_id = auth.uid()
         and pr.empresa_id = public.mi_empresa_id()
         and 'reagendar' = any(r.permisos))
  $$;
revoke execute on function public.puedo_reagendar() from public, anon;
grant execute on function public.puedo_reagendar() to authenticated;

-- Las dos acciones se rehacen con el chequeo adentro
create or replace function public.reserva_a_espera(p_id bigint) returns void
  language plpgsql set search_path = ''
  as $$
begin
  if not public.puedo_reagendar() then raise exception 'no autorizado a reagendar'; end if;
  update public.reservas set espera_at = now(), volo = false where id = p_id;
  if not found then raise exception 'reserva no encontrada'; end if;
  -- El guía se suelta: ese día no voló, así que no se le debe pagar.
  update public.reservas_personas set perfil_id = null where reserva_id = p_id;
end $$;

create or replace function public.reserva_reagendar(p_id bigint, p_fecha date, p_horario_id bigint)
  returns void
  language plpgsql set search_path = ''
  as $$
begin
  if not public.puedo_reagendar() then raise exception 'no autorizado a reagendar'; end if;
  if p_fecha is null then raise exception 'falta la fecha nueva'; end if;
  update public.reservas
     set fecha = p_fecha, horario_id = p_horario_id, espera_at = null
   where id = p_id and espera_at is not null;
  if not found then raise exception 'esa reserva no está en espera'; end if;
end $$;

-- Dar de alta y de baja a alguien en MI empresa, sin ser superadmin.
--
-- Antes la pantalla de usuarios insertaba en `perfiles` directo desde la sesión y
-- la columna empresa_id tomaba la empresa por defecto. Esa columna ya no existe,
-- así que el alta pasa por acá.
--
-- Y lo que pedía el caso real: si el correo ya existe porque la persona vuela para
-- otra empresa, no se crea a nadie nuevo, se le dan roles en esta. Su historial en
-- la otra empresa no se toca y ninguna de las dos se entera de la otra.

-- Quien administra la empresa en la que estoy: tiene algún rol no restringido.
-- Antes cualquier miembro podía insertar perfiles; ahora se exige lo mismo que ya
-- exigía la pantalla.
create function public.puedo_administrar() returns boolean
  language sql stable security definer set search_path = ''
  as $$
    select public.es_superadmin() or exists (
      select 1 from public.perfil_roles pr
        join public.roles r on r.id = pr.rol_id
       where pr.perfil_id = auth.uid()
         and pr.empresa_id = public.mi_empresa_id()
         and not r.restringido
    )
  $$;
revoke execute on function public.puedo_administrar() from public, anon;
grant execute on function public.puedo_administrar() to authenticated;

create function public.vincular_perfil(p_user uuid, p_nombre text) returns void
  language plpgsql security definer set search_path = ''
  as $$
declare v_empresa uuid;
begin
  if not public.puedo_administrar() then raise exception 'no autorizado'; end if;
  v_empresa := public.mi_empresa_id();
  if v_empresa is null then raise exception 'sin empresa'; end if;

  -- Si ya existe (trabaja en otra empresa) no se le pisa el nombre: es suyo
  insert into public.perfiles (id, nombre, activo) values (p_user, trim(p_nombre), true)
  on conflict (id) do nothing;

  -- Si es su primera empresa, queda trabajando en esta
  insert into public.perfil_sesion (perfil_id, empresa_id) values (p_user, v_empresa)
  on conflict (perfil_id) do nothing;
end $$;
revoke execute on function public.vincular_perfil(uuid, text) from public, anon;
grant execute on function public.vincular_perfil(uuid, text) to authenticated;

-- Dar de baja es quitarlo de MI empresa, no borrarlo del mundo: puede seguir
-- volando para otra. El perfil solo se borra si no le queda ninguna.
create function public.desvincular_perfil(p_user uuid) returns text
  language plpgsql security definer set search_path = ''
  as $$
declare v_empresa uuid; v_quedan int;
begin
  if not public.puedo_administrar() then raise exception 'no autorizado'; end if;
  v_empresa := public.mi_empresa_id();
  if p_user = auth.uid() then raise exception 'no puedes quitarte a ti mismo'; end if;

  delete from public.perfil_roles where perfil_id = p_user and empresa_id = v_empresa;

  select count(*) into v_quedan from public.perfil_roles where perfil_id = p_user;
  if v_quedan = 0 then
    delete from public.perfiles where id = p_user;
    return 'borrado';
  end if;

  -- Si estaba trabajando en esta empresa, se le manda a una de las suyas
  update public.perfil_sesion s
     set empresa_id = (select pr.empresa_id from public.perfil_roles pr
                        where pr.perfil_id = p_user limit 1),
         actualizado_at = now()
   where s.perfil_id = p_user and s.empresa_id = v_empresa;
  return 'desvinculado';
end $$;
revoke execute on function public.desvincular_perfil(uuid) from public, anon;
grant execute on function public.desvincular_perfil(uuid) to authenticated;

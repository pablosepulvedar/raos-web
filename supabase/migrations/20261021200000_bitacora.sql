-- Quién hizo qué.
--
-- Hasta ahora ninguna tabla guardaba el autor: no se sabía quién creó una reserva
-- ni quién registró un pago. Y como `perfil_roles` solo tiene el estado actual,
-- quitarle "Coordinador" a alguien borraba que alguna vez lo tuvo.
--
-- Esta bitácora resuelve las dos cosas: anota altas, cambios y bajas con su autor,
-- y como también vigila `perfil_roles`, de ahí sale cuándo tuvo cada rol.
--
-- Va con disparadores y no con código en las pantallas: así no hay forma de
-- escribir en la base por un camino que se olvide de anotar.

create table public.bitacora (
  id bigint generated always as identity primary key,
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  tabla text not null,
  fila_id text not null,            -- texto porque unas tablas usan bigint y otras uuid
  accion text not null check (accion in ('alta', 'cambio', 'baja')),
  perfil_id uuid references public.perfiles(id) on delete set null,
  -- 'app' es una persona con sesión; 'sistema' es la API de integración o el
  -- webhook de Mercado Pago, que no tienen usuario detrás
  origen text not null,
  datos jsonb,                      -- la fila, en altas y bajas
  cambios jsonb,                    -- solo lo que cambió, en los cambios
  cuando timestamptz not null default now()
);

-- Redundante con el disparador ensure_rls, y a proposito: una tabla de auditoria
-- no puede depender de que el seguro exista.
alter table public.bitacora enable row level security;

create index bitacora_empresa_fecha on public.bitacora (empresa_id, cuando desc);
create index bitacora_persona on public.bitacora (perfil_id, cuando desc);
create index bitacora_fila on public.bitacora (tabla, fila_id);

-- La lee quien administra la empresa. Un guía no tiene por qué ver lo que hacen
-- los demás. Nadie la escribe a mano: solo el disparador.
create policy "administradores" on public.bitacora for select
  using (empresa_id = public.mi_empresa_id() and public.puedo_administrar());
grant select on public.bitacora to authenticated;

create function public.anotar_en_bitacora() returns trigger
  language plpgsql security definer set search_path = ''
  as $$
declare
  v_fila jsonb; v_antes jsonb; v_cambios jsonb; v_accion text; v_empresa uuid;
begin
  if tg_op = 'DELETE' then
    v_fila := to_jsonb(old); v_accion := 'baja';
  else
    v_fila := to_jsonb(new);
    v_accion := case tg_op when 'INSERT' then 'alta' else 'cambio' end;
  end if;

  v_empresa := nullif(v_fila->>'empresa_id', '')::uuid;
  if v_empresa is null then return null; end if;   -- fila sin empresa: no se anota

  if tg_op = 'UPDATE' then
    v_antes := to_jsonb(old);
    select jsonb_object_agg(k, jsonb_build_object('antes', v_antes->k, 'ahora', v_fila->k))
      into v_cambios
      from jsonb_object_keys(v_fila) k
     where v_fila->k is distinct from v_antes->k
       and k not in ('updated_at', 'created_at');
    -- Un UPDATE que no cambió nada de fondo no merece una línea
    if v_cambios is null then return null; end if;
  end if;

  insert into public.bitacora (empresa_id, tabla, fila_id, accion, perfil_id, origen, datos, cambios)
    values (
      v_empresa, tg_table_name, v_fila->>'id', v_accion,
      auth.uid(),
      case when auth.uid() is null then 'sistema' else 'app' end,
      -- En los cambios no se guarda la fila entera (ya esta el diff), pero si lo
      -- justo para saber de que se habla sin abrir la linea
      case when tg_op = 'UPDATE'
           then jsonb_strip_nulls(jsonb_build_object(
                  'nombre', v_fila->'nombre', 'fecha', v_fila->'fecha', 'monto', v_fila->'monto'))
           else v_fila end,
      v_cambios
    );
  return null;
end $$;

-- Las tablas donde importa quién tocó qué. Quedan fuera los catálogos (horarios,
-- valores, métodos de pago): cambian poco y no son operación del día.
do $$
declare t text;
begin
  foreach t in array array[
    'reservas', 'reserva_pagos', 'reserva_servicios', 'reservas_personas',
    'piloto_pagos', 'perfil_valores', 'gastos_diarios', 'fichas_riesgo',
    'perfil_roles', 'pilotos'
  ] loop
    execute format(
      'create trigger anotar after insert or update or delete on public.%I
         for each row execute function public.anotar_en_bitacora()', t);
  end loop;
end $$;

-- Cuándo tuvo cada rol. Se reconstruye de las altas y bajas de perfil_roles, así
-- que no hace falta tocar esa tabla —y con ella, el RLS de todo el sistema—.
create function public.historial_roles(p_perfil uuid)
  returns table (rol text, desde timestamptz, hasta timestamptz)
  language sql stable security definer set search_path = ''
  as $$
    select coalesce(r.nombre, b.datos->>'rol_id') as rol,
           b.cuando as desde,
           -- Por id y no por fecha: si el rol se da y se quita en la misma
           -- transaccion, las dos lineas comparten el `now()`
           (select min(b2.cuando) from public.bitacora b2
             where b2.tabla = 'perfil_roles' and b2.accion = 'baja'
               and b2.fila_id = b.fila_id and b2.id > b.id) as hasta
      from public.bitacora b
      left join public.roles r on r.id = (b.datos->>'rol_id')::bigint
     where b.tabla = 'perfil_roles' and b.accion = 'alta'
       and (b.datos->>'perfil_id')::uuid = p_perfil
       and b.empresa_id = public.mi_empresa_id()
       and public.puedo_administrar()
     order by b.cuando desc
  $$;
revoke execute on function public.historial_roles(uuid) from public, anon;
grant execute on function public.historial_roles(uuid) to authenticated;

-- "Con quién voló" en el orden en que el guía los fue tomando.
--
-- Hasta ahora la lista salía ordenada por el id del pasajero, que es el orden en
-- que se CREÓ la reserva (a veces días antes), no el orden en que se voló. Lo que
-- marca el orden real es cuándo se le asignó el guía a cada pasajero, que es lo
-- que se hace en la pantalla Hoy a medida que sale cada uno.
--
-- El dato ya existía en la bitácora de la empresa, pero leerlo de ahí en cada
-- consulta sería caro: se guarda en la fila y se rellena lo viejo desde ahí.

alter table public.reservas_personas add column asignado_at timestamptz;

create function public.marcar_asignacion() returns trigger
  language plpgsql set search_path = ''
  as $$
begin
  -- Soltar al guía borra la marca: si lo vuelven a asignar, es otro momento
  if tg_op = 'INSERT' or new.perfil_id is distinct from old.perfil_id then
    new.asignado_at := case when new.perfil_id is not null then now() end;
  end if;
  return new;
end $$;

create trigger asignacion before insert or update on public.reservas_personas
  for each row execute function public.marcar_asignacion();

-- Lo ya volado: la última vez que se le puso ESTE guía
update public.reservas_personas rp
   set asignado_at = b.cuando
  from (
    select distinct on (fila_id) fila_id::bigint as id, cuando,
           cambios->'perfil_id'->>'ahora' as guia
      from public.bitacora
     where tabla = 'reservas_personas' and cambios ? 'perfil_id'
     order by fila_id, cuando desc
  ) b
 where rp.id = b.id and rp.perfil_id is not null and b.guia = rp.perfil_id::text;

-- Y los que nacieron con guía puesto
update public.reservas_personas rp
   set asignado_at = b.cuando
  from (
    select distinct on (fila_id) fila_id::bigint as id, cuando, datos->>'perfil_id' as guia
      from public.bitacora
     where tabla = 'reservas_personas' and accion = 'alta'
     order by fila_id, cuando
  ) b
 where rp.id = b.id and rp.asignado_at is null and rp.perfil_id is not null
   and b.guia = rp.perfil_id::text;

-- En "Quién hizo qué" esta marca no es noticia: va pegada al cambio de guía,
-- que sí se anota.
create or replace function public.anotar_en_bitacora() returns trigger
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
       and k not in ('updated_at', 'created_at', 'asignado_at');
    -- Un UPDATE que no cambió nada de fondo no merece una línea
    if v_cambios is null then return null; end if;
  end if;

  insert into public.bitacora (empresa_id, tabla, fila_id, accion, perfil_id, origen, datos, cambios)
    values (
      v_empresa, tg_table_name, v_fila->>'id', v_accion,
      auth.uid(),
      case when auth.uid() is null then 'sistema' else 'app' end,
      case when tg_op = 'UPDATE'
           then jsonb_strip_nulls(jsonb_build_object(
                  'nombre', v_fila->'nombre', 'fecha', v_fila->'fecha', 'monto', v_fila->'monto'))
           else v_fila end,
      v_cambios
    );
  return null;
end $$;

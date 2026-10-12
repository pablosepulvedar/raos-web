-- API de integración: la web del cliente crea reservas al cobrar un vuelo.
-- El service_role no tiene DML sobre las tablas de negocio, así que todo pasa por
-- estas tres funciones security definer y la empresa siempre sale del token, nunca del body.

-- Valida el token (sha256 del que manda el cliente) y marca el uso
create or replace function public.api_token(p_hash text)
  returns table (empresa_id uuid, slug text)
  language plpgsql security definer set search_path = ''
  as $$
begin
  return query
    update public.api_tokens t
      set ultimo_uso_at = now()
      where t.token_hash = p_hash and t.revocado_at is null
      returning t.empresa_id, (select e.slug from public.empresas e where e.id = t.empresa_id);
end $$;

-- Lo que la web necesita para armar su formulario
create or replace function public.api_catalogo(p_empresa uuid)
  returns jsonb
  language sql stable security definer set search_path = ''
  as $$
  select jsonb_build_object(
    'horarios', coalesce((select jsonb_agg(jsonb_build_object(
        'id', h.id, 'hora', regexp_replace(lpad(h.horario::text, 4, '0'), '(\d{2})(\d{2})', '\1:\2'))
        order by h.horario) from public.horarios h where h.empresa_id = p_empresa), '[]'::jsonb),
    'servicios', coalesce((select jsonb_agg(jsonb_build_object(
        'id', v.id, 'servicio', v.servicio, 'monto', v.monto, 'descuento', v.descuento)
        order by v.servicio) from public.valores v where v.empresa_id = p_empresa), '[]'::jsonb),
    'metodos_pago', coalesce((select jsonb_agg(m.nombre order by m.nombre)
        from public.metodos_pago m where m.empresa_id = p_empresa and m.activo), '[]'::jsonb)
  ) $$;

-- Crea la reserva completa en una sola transacción: servicios, pasajeros, pago y fichas
create or replace function public.api_reserva(p_empresa uuid, p_datos jsonb)
  returns jsonb
  language plpgsql security definer set search_path = ''
  as $$
declare
  v_ref text := nullif(trim(p_datos->>'referencia'), '');
  v_id bigint;
  v_horario bigint;
  v_metodo bigint;
  v_monto integer := coalesce((p_datos#>>'{pago,monto}')::integer, 0);
  v_malos text;
  v_fichas jsonb;
begin
  -- Reintento del webhook de pago: devuelve la que ya existe, sin duplicar
  if v_ref is not null then
    select r.id into v_id from public.reservas r
      where r.empresa_id = p_empresa and r.referencia_externa = v_ref;
    if found then return jsonb_build_object('id', v_id, 'creada', false); end if;
  end if;

  if p_datos ? 'horario_id' then
    select h.id into v_horario from public.horarios h
      where h.empresa_id = p_empresa and h.id = (p_datos->>'horario_id')::bigint;
  else
    select h.id into v_horario from public.horarios h
      where h.empresa_id = p_empresa and h.horario = replace(coalesce(p_datos->>'hora', ''), ':', '')::integer;
  end if;
  if v_horario is null then
    raise exception 'horario no encontrado. Disponibles: %', (
      select string_agg(regexp_replace(lpad(h.horario::text, 4, '0'), '(\d{2})(\d{2})', '\1:\2'), ', ' order by h.horario)
      from public.horarios h where h.empresa_id = p_empresa);
  end if;

  select string_agg(t.v, ', ') into v_malos
    from jsonb_array_elements_text(coalesce(p_datos->'servicios', '[]'::jsonb)) as t(v)
    where not exists (select 1 from public.valores va where va.id = t.v::bigint and va.empresa_id = p_empresa);
  if v_malos is not null then raise exception 'servicios inexistentes: %', v_malos; end if;

  if v_monto > 0 then
    select m.id into v_metodo from public.metodos_pago m
      where m.empresa_id = p_empresa and lower(m.nombre) = lower(coalesce(p_datos#>>'{pago,metodo}', ''));
    if v_metodo is null then
      raise exception 'metodo de pago "%" no existe. Disponibles: %', coalesce(p_datos#>>'{pago,metodo}', ''),
        (select string_agg(m.nombre, ', ') from public.metodos_pago m where m.empresa_id = p_empresa and m.activo);
    end if;
  end if;

  insert into public.reservas (empresa_id, nombre, telefono, fecha, horario_id, cantidad, referencia_externa)
    values (p_empresa, trim(p_datos->>'nombre'), (p_datos->>'telefono')::bigint,
            (p_datos->>'fecha')::date, v_horario, (p_datos->>'cantidad')::integer, v_ref)
    returning id into v_id;

  insert into public.reserva_servicios (reserva_id, valor_id, empresa_id)
    select v_id, t.v::bigint, p_empresa
    from jsonb_array_elements_text(coalesce(p_datos->'servicios', '[]'::jsonb)) as t(v);

  insert into public.reservas_personas (reserva_id, nombre, edad, peso, empresa_id)
    select v_id, trim(t.p->>'nombre'), (t.p->>'edad')::integer, (t.p->>'peso')::integer, p_empresa
    from jsonb_array_elements(coalesce(p_datos->'personas', '[]'::jsonb)) as t(p)
    where nullif(trim(t.p->>'nombre'), '') is not null;

  if v_metodo is not null then
    insert into public.reserva_pagos (reserva_id, metodo_pago_id, monto, empresa_id)
      values (v_id, v_metodo, v_monto, p_empresa);
  end if;

  select coalesce(jsonb_agg(jsonb_build_object('nombre', f.nombre, 'token', f.token)), '[]'::jsonb)
    into v_fichas from public.generar_fichas(v_id) f;

  return jsonb_build_object('id', v_id, 'creada', true, 'fichas', v_fichas);
end $$;

revoke execute on function public.api_token(text), public.api_catalogo(uuid), public.api_reserva(uuid, jsonb)
  from public, anon, authenticated;
grant execute on function public.api_token(text), public.api_catalogo(uuid), public.api_reserva(uuid, jsonb)
  to service_role;

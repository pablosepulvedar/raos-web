-- Cobro en línea: cada empresa conecta su propia cuenta de Mercado Pago.
-- La plata llega a la cuenta de la empresa, Reservaps solo genera el link y
-- escucha el aviso de pago.
--
-- ponytail: el access_token se guarda en claro, protegido por RLS sin policies
-- (solo lo ve service_role) igual que api_tokens. Si algún día hay varias
-- empresas grandes, cifrarlo con pgcrypto y una llave en el entorno del worker.
create table public.pasarelas_pago (
  empresa_id uuid primary key references public.empresas(id) on delete cascade,
  proveedor text not null default 'mercadopago',
  public_key text,
  access_token text not null,
  activo boolean not null default true,
  actualizado_at timestamptz not null default now()
);
grant select, insert, update, delete on public.pasarelas_pago to service_role;

-- Un pago de Mercado Pago no se puede registrar dos veces aunque el webhook se repita
alter table public.reserva_pagos add column referencia_externa text;
create unique index reserva_pagos_referencia_externa_key
  on public.reserva_pagos (empresa_id, referencia_externa)
  where referencia_externa is not null;

-- Lo que falta por cobrar de una reserva: servicios menos descuentos, abono y pagos
create or replace function public.saldo_reserva(p_reserva bigint)
  returns jsonb
  language sql stable security definer set search_path = ''
  as $$
  select jsonb_build_object(
    'reserva_id', r.id,
    'empresa_id', r.empresa_id,
    'nombre', r.nombre,
    'cantidad', r.cantidad,
    'bruto', coalesce(bruto, 0),
    'descuento', coalesce(dcto, 0),
    'pagado', coalesce(r.abono, 0) + coalesce(pagos, 0),
    'saldo', coalesce(bruto, 0) - coalesce(dcto, 0) - coalesce(r.abono, 0) - coalesce(pagos, 0)
  )
  from public.reservas r
  left join lateral (
    select sum(v.monto) filter (where not v.descuento) as bruto,
           sum(v.monto) filter (where v.descuento) as dcto
    from public.reserva_servicios rs join public.valores v on v.id = rs.valor_id
    where rs.reserva_id = r.id
  ) s on true
  left join lateral (
    select sum(rp.monto) as pagos from public.reserva_pagos rp where rp.reserva_id = r.id
  ) p on true
  where r.id = p_reserva
  $$;
revoke execute on function public.saldo_reserva(bigint) from public, anon;
grant execute on function public.saldo_reserva(bigint) to authenticated, service_role;

-- Registra el pago que avisó la pasarela. Crea el método si la empresa no lo tenía.
-- Repetir el mismo p_externo no duplica el pago.
create or replace function public.registrar_pago_externo(
    p_empresa uuid, p_reserva bigint, p_monto integer, p_metodo text, p_externo text)
  returns jsonb
  language plpgsql security definer set search_path = ''
  as $$
declare
  v_metodo bigint;
  v_id integer;
begin
  if not exists (select 1 from public.reservas r where r.id = p_reserva and r.empresa_id = p_empresa) then
    raise exception 'la reserva no es de esta empresa';
  end if;

  select rp.id into v_id from public.reserva_pagos rp
    where rp.empresa_id = p_empresa and rp.referencia_externa = p_externo;
  if found then
    return jsonb_build_object('id', v_id, 'nuevo', false);
  end if;

  select m.id into v_metodo from public.metodos_pago m
    where m.empresa_id = p_empresa and lower(m.nombre) = lower(p_metodo);
  if not found then
    insert into public.metodos_pago (nombre, empresa_id, activo) values (p_metodo, p_empresa, true)
      returning id into v_metodo;
  end if;

  insert into public.reserva_pagos (reserva_id, metodo_pago_id, monto, empresa_id, referencia_externa)
    values (p_reserva, v_metodo, p_monto, p_empresa, p_externo)
    returning id into v_id;
  return jsonb_build_object('id', v_id, 'nuevo', true);
end $$;
revoke execute on function public.registrar_pago_externo(uuid, bigint, integer, text, text) from public, anon, authenticated;
grant execute on function public.registrar_pago_externo(uuid, bigint, integer, text, text) to service_role;

-- La empresa dueña de un subdominio, para resolver el webhook por host
create or replace function public.empresa_por_slug(p_slug text)
  returns uuid
  language sql stable security definer set search_path = ''
  as $$ select id from public.empresas where slug = p_slug $$;
revoke execute on function public.empresa_por_slug(text) from public, anon;
grant execute on function public.empresa_por_slug(text) to service_role;

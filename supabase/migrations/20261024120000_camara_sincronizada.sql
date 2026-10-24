-- La cámara vivía en dos lados que no se hablaban: la elección de cada pasajero
-- (reservas_personas.camara_*, la marca Hoy) y el servicio cobrado
-- (reserva_servicios con el valor "Cámara 360"/"Cámara Normal", lo agrega Agenda).
-- Ahora un lado arrastra al otro:
--   pasajero elige cámara      -> se agrega el servicio (si no había uno libre)
--   pasajero cambia o se borra -> se quita el servicio que tenía
--   se agrega el servicio      -> se le asigna al primer pasajero sin cámara
--   se quita el servicio       -> el pasajero que lo tenía queda sin elegir
-- Solo propaga lo que hace una persona (pg_trigger_depth = 1): el cambio que
-- provoca un trigger no rebota de vuelta.

-- Qué cámara cobra un valor. ponytail: por nombre ("cámara" + "360"), como los
-- llaman hoy las empresas; si un rubro los nombra distinto, pasar a una columna en valores.
create function public.camara_del_valor(p_valor bigint) returns text
  language sql stable set search_path = ''
  as $$
    select case when s like '%camara%360%' or s like '%360%camara%' then 'camara_360'
                when s like '%camara%' then 'camara_normal' end
      from (select translate(lower(servicio), 'á', 'a') s from public.valores
             where id = p_valor and pasajero and not descuento) v
  $$;

create function public.camara_de(p public.reservas_personas) returns text
  language sql immutable set search_path = ''
  as $$
    select case when p.camara_360 then 'camara_360' when p.camara_normal then 'camara_normal' end
  $$;

-- Servicios de esa cámara en la reserva y pasajeros que la eligieron
create function public.camaras_en(p_reserva bigint, p_tipo text, out servicios int, out pasajeros int)
  language sql stable set search_path = ''
  as $$
    select (select count(*)::int from public.reserva_servicios rs
             where rs.reserva_id = p_reserva and public.camara_del_valor(rs.valor_id) = p_tipo),
           (select count(*)::int from public.reservas_personas p
             where p.reserva_id = p_reserva and public.camara_de(p) = p_tipo)
  $$;

create function public.sincronizar_camara_pasajero() returns trigger
  language plpgsql set search_path = ''
  as $$
  declare antes text; ahora text; c record; v bigint; reserva bigint;
  begin
    if pg_trigger_depth() > 1 then return null; end if;
    antes := case when tg_op <> 'INSERT' then public.camara_de(old) end;
    ahora := case when tg_op <> 'DELETE' then public.camara_de(new) end;
    if antes is not distinct from ahora then return null; end if;
    reserva := coalesce(new.reserva_id, old.reserva_id);

    -- Soltó una cámara: sobra un servicio
    if antes is not null then
      c := public.camaras_en(reserva, antes);
      if c.servicios > c.pasajeros then
        delete from public.reserva_servicios where id = (
          select rs.id from public.reserva_servicios rs
           where rs.reserva_id = reserva and public.camara_del_valor(rs.valor_id) = antes
           order by rs.id desc limit 1);
      end if;
    end if;

    -- Eligió una: falta un servicio, salvo que hubiera uno cobrado sin dueño
    if ahora is not null then
      c := public.camaras_en(reserva, ahora);
      if c.servicios < c.pasajeros then
        select vl.id into v from public.valores vl
         where vl.empresa_id = coalesce(new.empresa_id, old.empresa_id)
           and public.camara_del_valor(vl.id) = ahora
         order by vl.id limit 1;
        if v is not null then
          insert into public.reserva_servicios (reserva_id, valor_id, empresa_id)
            values (reserva, v, new.empresa_id);
        end if;
      end if;
    end if;
    return null;
  end
  $$;

create trigger sincronizar_camara
  after insert or delete or update of camara_360, camara_normal, sin_camara on public.reservas_personas
  for each row execute function public.sincronizar_camara_pasajero();

create function public.sincronizar_camara_servicio() returns trigger
  language plpgsql set search_path = ''
  as $$
  declare tipo text; c record; reserva bigint;
  begin
    if pg_trigger_depth() > 1 then return null; end if;
    tipo := public.camara_del_valor(coalesce(new.valor_id, old.valor_id));
    if tipo is null then return null; end if;
    reserva := coalesce(new.reserva_id, old.reserva_id);
    c := public.camaras_en(reserva, tipo);

    if tg_op = 'INSERT' and c.servicios > c.pasajeros then
      -- Al primero que no tiene cámara, o que había dicho "sin cámara"
      update public.reservas_personas set camara_360 = tipo = 'camara_360',
             camara_normal = tipo = 'camara_normal', sin_camara = false
       where id = (select p.id from public.reservas_personas p
                    where p.reserva_id = reserva and public.camara_de(p) is null
                    order by p.sin_camara, p.id limit 1);
    elsif tg_op = 'DELETE' and c.servicios < c.pasajeros then
      update public.reservas_personas set camara_360 = false, camara_normal = false
       where id = (select p.id from public.reservas_personas p
                    where p.reserva_id = reserva and public.camara_de(p) = tipo
                    order by p.id desc limit 1);
    end if;
    return null;
  end
  $$;

create trigger sincronizar_camara
  after insert or delete on public.reserva_servicios
  for each row execute function public.sincronizar_camara_servicio();

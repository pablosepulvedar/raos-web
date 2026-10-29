-- 1. Borrado lógico de reservas.
-- Borrar una reserva se llevaba en cascada sus fichas, también las firmadas, que
-- hay que guardar 2 años (D.S. 19). Ahora el DELETE de un usuario de la app solo
-- la marca borrada: desaparece de todas las pantallas (política restrictiva, así
-- ninguna consulta se olvida de filtrar) y sus fichas firmadas siguen a la vista
-- en Fichas firmadas. Las sin firmar se borran: ya no hay vuelo que firmar.
-- El borrado real queda para postgres/service_role (limpiar_demo, borrar empresa).

alter table public.reservas add column borrada_at timestamptz;

create policy no_borradas on public.reservas as restrictive for select to authenticated
  using (borrada_at is null);

-- El update va en una función security definer porque la reserva marcada deja de
-- verse, y Postgres no deja escribir una fila que quien escribe no vería.
-- Solo se puede llamar desde el trigger (pg_trigger_depth), no por la API: así
-- nadie marca una reserva que su RLS no le dejaría borrar.
create function public.marcar_reserva_borrada(p_id bigint) returns void
  language plpgsql security definer set search_path = ''
  as $$
  begin
    if pg_trigger_depth() = 0 then raise exception 'solo desde el borrado de la reserva'; end if;
    update public.reservas set borrada_at = now() where id = p_id;
  end
  $$;

-- Sin security definer a propósito: current_user es quien borra
create function public.borrado_logico_reserva() returns trigger
  language plpgsql set search_path = ''
  as $$
  begin
    if current_user <> 'authenticated' then return old; end if;
    delete from public.fichas_riesgo where reserva_id = old.id and aceptada_at is null;
    perform public.marcar_reserva_borrada(old.id);
    return null;
  end
  $$;

create trigger borrado_logico
  before delete on public.reservas
  for each row execute function public.borrado_logico_reserva();

-- La reserva de cada ficha, aunque esté borrada: la ficha firmada la necesita
-- (fecha, hora). Solo para quien ve las fichas (mismas reglas que su política).
create function public.reserva_de_fichas(p_ids bigint[])
  returns table (ficha_id bigint, nombre text, fecha date, horario integer, borrada boolean)
  language sql stable security definer set search_path = ''
  as $$
    select f.id, r.nombre, r.fecha, h.horario, r.borrada_at is not null
      from public.fichas_riesgo f
      join public.reservas r on r.id = f.reserva_id
      left join public.horarios h on h.id = r.horario_id
     where f.id = any(p_ids)
       and f.empresa_id = public.mi_empresa_id()
       and public.veo_todas_las_reservas()
  $$;

-- 2. Cámara gratis.
-- Al cumpleañero la 360 no se le cobra, y desde Hoy cualquier cámara se puede
-- dar en promo ($0). La cámara se sigue marcando igual (el equipo sabe qué
-- grabar); lo que cambia es que no arrastra servicio cobrado.
alter table public.reservas_personas add column camara_promo boolean not null default false;

-- camara_de pasa a ser "la cámara que se cobra"
create or replace function public.camara_de(p public.reservas_personas) returns text
  language sql immutable set search_path = ''
  as $$
    select case when p.camara_promo then null
                when p.camara_360 then case when p.cumpleanero then null else 'camara_360' end
                when p.camara_normal then 'camara_normal' end
  $$;

-- Un servicio de cámara nuevo va al primero que no tiene ninguna cámara marcada
-- (antes: camara_de null, que ahora también incluye a los que la tienen gratis)
create or replace function public.sincronizar_camara_servicio() returns trigger
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
      update public.reservas_personas set camara_360 = tipo = 'camara_360',
             camara_normal = tipo = 'camara_normal', sin_camara = false, camara_promo = false
       where id = (select p.id from public.reservas_personas p
                    where p.reserva_id = reserva and not p.camara_360 and not p.camara_normal
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

-- Marcar cumpleañero o promo también cambia lo que se cobra
drop trigger sincronizar_camara on public.reservas_personas;
create trigger sincronizar_camara
  after insert or delete or update of camara_360, camara_normal, sin_camara, camara_promo, cumpleanero
  on public.reservas_personas
  for each row execute function public.sincronizar_camara_pasajero();

-- 3. Peso en la ficha (obligatorio en el formulario).
-- NCh3014 6.1.1: el peso del cliente más el piloto debe estar en el rango de la
-- vela, y el mínimo es 4 años o 30 kg. Se guarda en la ficha y en el pasajero.
-- p_peso va al final y con default para que el código anterior siga firmando
-- mientras llega el deploy.
alter table public.fichas_riesgo add column peso integer;

drop function public.firmar_ficha(text,text,text,integer,text,text,text,text,boolean,text,jsonb,boolean,text,text,text,text,text,text,text,text,text,text);
create function public.firmar_ficha(
  p_token text, p_nombre text, p_documento text, p_edad integer, p_nacionalidad text,
  p_emergencia_nombre text, p_emergencia_telefono text, p_emergencia_parentesco text,
  p_experiencia_previa boolean, p_prevision text, p_salud jsonb,
  p_autoriza_imagen boolean, p_instagram text, p_como_conocio text, p_gift_card text,
  p_tutor_nombre text, p_tutor_documento text,
  p_texto_version text, p_texto_hash text, p_idioma text, p_ip text, p_user_agent text,
  p_peso integer default null
) returns void
  language plpgsql security definer set search_path = ''
  as $$
declare
  f record;
  nueva_persona bigint;
begin
  select * into f from public.fichas_riesgo where token = p_token;
  if not found then raise exception 'ficha no encontrada'; end if;
  if f.aceptada_at is not null then raise exception 'ficha ya aceptada'; end if;
  if p_edad < 18 and coalesce(trim(p_tutor_nombre), '') = '' then
    raise exception 'un menor de edad necesita los datos del adulto responsable';
  end if;

  if f.persona_id is null then
    insert into public.reservas_personas (reserva_id, nombre, edad, peso, empresa_id)
      values (f.reserva_id, p_nombre, p_edad, p_peso, f.empresa_id)
      returning id into nueva_persona;
  else
    update public.reservas_personas set nombre = p_nombre, edad = p_edad, peso = coalesce(p_peso, peso)
      where id = f.persona_id;
  end if;

  update public.fichas_riesgo set
    persona_id = coalesce(persona_id, nueva_persona),
    nombre = p_nombre, documento = p_documento, edad = p_edad, peso = p_peso, nacionalidad = p_nacionalidad,
    emergencia_nombre = p_emergencia_nombre, emergencia_telefono = p_emergencia_telefono,
    emergencia_parentesco = p_emergencia_parentesco,
    experiencia_previa = p_experiencia_previa, prevision = p_prevision, salud = p_salud,
    autoriza_imagen = p_autoriza_imagen, instagram = p_instagram,
    como_conocio = p_como_conocio, gift_card = p_gift_card,
    tutor_nombre = p_tutor_nombre, tutor_documento = p_tutor_documento,
    texto_version = p_texto_version, texto_hash = p_texto_hash, idioma = p_idioma,
    ip = p_ip, user_agent = p_user_agent, aceptada_at = now()
  where token = p_token;
end $$;
grant execute on function public.firmar_ficha(text,text,text,integer,text,text,text,text,boolean,text,jsonb,boolean,text,text,text,text,text,text,text,text,text,text,integer) to anon, authenticated;

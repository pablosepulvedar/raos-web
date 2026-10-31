-- Fichas: un link por reserva y reglas para que no se pisen.
--
-- Pasó el 30-10: se mandaron los links por WhatsApp y todos abrieron el primero.
-- Firmó la primera; a los demás les dio "ficha ya aceptada". Ahora:
--   * Link personal: si el pasajero ya tiene nombre, el nombre queda fijo.
--   * Link de la reserva (reservas.ficha_token): cada uno elige su nombre de la lista,
--     o "no estoy en la lista" y se agrega a la reserva.
--   * Al firmar se rechaza un pasajero repetido (mismo nombre o RUT/pasaporte ya firmado
--     en la misma reserva) y el nombre escrito que ya está en la lista con otra ficha.
--   * La ficha se bloquea al firmar (for update): dos personas a la vez, firma una.

create function public.norm_nombre(t text) returns text
  language sql immutable set search_path = ''
  as $$ select lower(regexp_replace(translate(trim(coalesce(t, '')), 'áéíóúüñÁÉÍÓÚÜÑ', 'aeiouunAEIOUUN'), '\s+', ' ', 'g')) $$;

create function public.norm_doc(t text) returns text
  language sql immutable set search_path = ''
  as $$ select upper(regexp_replace(coalesce(t, ''), '[^0-9A-Za-z]', '', 'g')) $$;

-- "Pasajero 3" (o vacío) es un lugar sin nombre todavía
create function public.es_generico(t text) returns boolean
  language sql immutable set search_path = ''
  as $$ select coalesce(trim(t), '') = '' or trim(t) ~ '^Pasajero \d+$' $$;

alter table public.reservas add column ficha_token text unique
  default encode(extensions.gen_random_bytes(12), 'hex');

-- La ficha individual ahora dice si el nombre se puede cambiar
drop function public.ficha_por_token(text);
create function public.ficha_por_token(p_token text)
  returns table (empresa text, registro_sernatur text, fecha date, horario integer, aceptada_at timestamptz,
                 nombre text, documento text, edad integer, nacionalidad text, salud jsonb,
                 emergencia_nombre text, emergencia_telefono text, tutor_nombre text, tutor_documento text,
                 nombre_fijo boolean)
  language sql stable security definer set search_path = ''
  as $$
    select e.nombre, e.registro_sernatur, r.fecha, h.horario, f.aceptada_at,
           coalesce(case when not public.es_generico(p.nombre) then p.nombre end, f.nombre),
           f.documento, f.edad, f.nacionalidad, f.salud,
           f.emergencia_nombre, f.emergencia_telefono, f.tutor_nombre, f.tutor_documento,
           not public.es_generico(p.nombre)
    from public.fichas_riesgo f
    join public.reservas r on r.id = f.reserva_id and r.borrada_at is null
    join public.empresas e on e.id = f.empresa_id
    left join public.horarios h on h.id = r.horario_id
    left join public.reservas_personas p on p.id = f.persona_id
    where f.token = p_token
  $$;
grant execute on function public.ficha_por_token(text) to anon, authenticated;

-- El link de la reserva: datos para la cabecera y la lista de pasajeros.
-- Siempre devuelve al menos una fila (ficha_token null si todavía no hay fichas).
create function public.fichas_de_reserva(p_token text)
  returns table (empresa text, registro_sernatur text, fecha date, horario integer, reserva text,
                 ficha_token text, nombre text, firmada boolean, generico boolean)
  language sql stable security definer set search_path = ''
  as $$
    select e.nombre, e.registro_sernatur, r.fecha, h.horario, r.nombre,
           f.token, coalesce(case when not public.es_generico(p.nombre) then p.nombre end, f.nombre, p.nombre),
           f.aceptada_at is not null, public.es_generico(coalesce(p.nombre, f.nombre))
    from public.reservas r
    join public.empresas e on e.id = r.empresa_id
    left join public.horarios h on h.id = r.horario_id
    left join public.fichas_riesgo f on f.reserva_id = r.id
    left join public.reservas_personas p on p.id = f.persona_id
    where r.ficha_token = p_token and r.borrada_at is null
    order by f.id
  $$;
grant execute on function public.fichas_de_reserva(text) to anon, authenticated;

create or replace function public.firmar_ficha(
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
  persona_nombre text;
  v_nombre text;
  nueva_persona bigint;
begin
  -- for update: si dos personas firman la misma ficha a la vez, la segunda espera y ve que ya está firmada
  select * into f from public.fichas_riesgo where token = p_token for update;
  if not found then raise exception 'ficha no encontrada'; end if;
  if f.aceptada_at is not null then raise exception 'ficha ya aceptada'; end if;
  if exists (select 1 from public.reservas r where r.id = f.reserva_id and r.borrada_at is not null) then
    raise exception 'ficha no encontrada';
  end if;
  if p_edad < 18 and coalesce(trim(p_tutor_nombre), '') = '' then
    raise exception 'un menor de edad necesita los datos del adulto responsable';
  end if;

  -- El nombre que puso la empresa no se cambia desde el link
  select nombre into persona_nombre from public.reservas_personas where id = f.persona_id;
  v_nombre := case when public.es_generico(persona_nombre) then trim(p_nombre) else persona_nombre end;

  -- Ya firmó alguien con ese nombre o ese documento en la misma reserva
  if exists (select 1 from public.fichas_riesgo o
              where o.reserva_id = f.reserva_id and o.id <> f.id and o.aceptada_at is not null
                and (public.norm_nombre(o.nombre) = public.norm_nombre(v_nombre)
                     or (public.norm_doc(p_documento) <> '' and public.norm_doc(o.documento) = public.norm_doc(p_documento)))) then
    raise exception 'pasajero ya ingresado';
  end if;
  -- Escribió un nombre que la reserva ya tiene en otro lugar de la lista
  if public.es_generico(persona_nombre) and exists (
       select 1 from public.reservas_personas o
        where o.reserva_id = f.reserva_id and o.id is distinct from f.persona_id
          and not public.es_generico(o.nombre) and public.norm_nombre(o.nombre) = public.norm_nombre(v_nombre)) then
    raise exception 'nombre en la lista';
  end if;

  if f.persona_id is null then
    insert into public.reservas_personas (reserva_id, nombre, edad, peso, empresa_id)
      values (f.reserva_id, v_nombre, p_edad, p_peso, f.empresa_id)
      returning id into nueva_persona;
  else
    update public.reservas_personas set nombre = v_nombre, edad = p_edad, peso = coalesce(p_peso, peso)
      where id = f.persona_id;
  end if;

  update public.fichas_riesgo set
    persona_id = coalesce(persona_id, nueva_persona),
    nombre = v_nombre, documento = p_documento, edad = p_edad, peso = p_peso, nacionalidad = p_nacionalidad,
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

-- "No estoy en la lista": se suma a la reserva y firma en el mismo paso. Si la firma
-- falla (repetido, datos que faltan) no queda nada agregado: todo es una transacción.
create function public.firmar_ficha_nueva(
  p_reserva_token text, p_nombre text, p_documento text, p_edad integer, p_nacionalidad text,
  p_emergencia_nombre text, p_emergencia_telefono text, p_emergencia_parentesco text,
  p_experiencia_previa boolean, p_prevision text, p_salud jsonb,
  p_autoriza_imagen boolean, p_instagram text, p_como_conocio text, p_gift_card text,
  p_tutor_nombre text, p_tutor_documento text,
  p_texto_version text, p_texto_hash text, p_idioma text, p_ip text, p_user_agent text,
  p_peso integer default null
) returns text
  language plpgsql security definer set search_path = ''
  as $$
declare
  r record;
  n integer;
  persona bigint;
  v_token text;
begin
  select * into r from public.reservas where ficha_token = p_reserva_token and borrada_at is null for update;
  if not found then raise exception 'reserva no encontrada'; end if;
  select count(*) into n from public.reservas_personas where reserva_id = r.id;
  -- tope contra abusos del link público
  if n >= greatest(r.cantidad, 1) + 10 then raise exception 'demasiados pasajeros'; end if;

  insert into public.reservas_personas (reserva_id, nombre, empresa_id)
    values (r.id, 'Pasajero ' || (n + 1), r.empresa_id) returning id into persona;
  insert into public.fichas_riesgo (reserva_id, persona_id, empresa_id)
    values (r.id, persona, r.empresa_id) returning token into v_token;
  update public.reservas set cantidad = greatest(cantidad, n + 1) where id = r.id;

  perform public.firmar_ficha(v_token, p_nombre, p_documento, p_edad, p_nacionalidad,
    p_emergencia_nombre, p_emergencia_telefono, p_emergencia_parentesco,
    p_experiencia_previa, p_prevision, p_salud, p_autoriza_imagen, p_instagram, p_como_conocio, p_gift_card,
    p_tutor_nombre, p_tutor_documento, p_texto_version, p_texto_hash, p_idioma, p_ip, p_user_agent, p_peso);
  return v_token;
end $$;
grant execute on function public.firmar_ficha_nueva(text,text,text,integer,text,text,text,text,boolean,text,jsonb,boolean,text,text,text,text,text,text,text,text,text,text,integer) to anon, authenticated;

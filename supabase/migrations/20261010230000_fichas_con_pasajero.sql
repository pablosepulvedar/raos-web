-- Cada ficha queda enlazada a un pasajero desde que se genera, no recién cuando
-- el pasajero firma. Así la reserva tiene sus N pasajeros desde el principio y
-- el detalle y el día de vuelo miran siempre la misma lista.
create or replace function public.generar_fichas(p_reserva_id bigint)
  returns table (id bigint, token text, nombre text, aceptada_at timestamptz)
  language plpgsql security invoker set search_path = ''
  as $$
declare
  r record;
  faltan integer;
  suelta record;
  nueva bigint;
  n integer;
begin
  select * into r from public.reservas where reservas.id = p_reserva_id;
  if not found then raise exception 'reserva no encontrada'; end if;

  -- una ficha por pasajero ya cargado
  insert into public.fichas_riesgo (reserva_id, persona_id, nombre, edad, empresa_id)
    select p_reserva_id, p.id, p.nombre, p.edad, r.empresa_id
    from public.reservas_personas p
    where p.reserva_id = p_reserva_id
      and not exists (select 1 from public.fichas_riesgo f where f.persona_id = p.id);

  -- y el resto, hasta completar la cantidad reservada
  select greatest(r.cantidad - count(*), 0) into faltan
    from public.fichas_riesgo f where f.reserva_id = p_reserva_id;
  insert into public.fichas_riesgo (reserva_id, empresa_id)
    select p_reserva_id, r.empresa_id from generate_series(1, faltan);

  -- toda ficha sin pasajero estrena el suyo: el nombre real llega al firmar
  select count(*) into n from public.reservas_personas where reserva_id = p_reserva_id;
  for suelta in
    select f.id from public.fichas_riesgo f
    where f.reserva_id = p_reserva_id and f.persona_id is null order by f.id
  loop
    n := n + 1;
    insert into public.reservas_personas (reserva_id, nombre, empresa_id)
      values (p_reserva_id, 'Pasajero ' || n, r.empresa_id)
      returning public.reservas_personas.id into nueva;
    update public.fichas_riesgo set persona_id = nueva where public.fichas_riesgo.id = suelta.id;
  end loop;

  return query
    select f.id, f.token, coalesce(f.nombre, p.nombre), f.aceptada_at
    from public.fichas_riesgo f
    left join public.reservas_personas p on p.id = f.persona_id
    where f.reserva_id = p_reserva_id order by f.id;
end $$;

-- El último dato manda: lo que declara el pasajero al firmar pisa lo que hubiera.
create or replace function public.firmar_ficha(
  p_token text, p_nombre text, p_documento text, p_edad integer, p_nacionalidad text,
  p_emergencia_nombre text, p_emergencia_telefono text, p_emergencia_parentesco text,
  p_experiencia_previa boolean, p_prevision text, p_salud jsonb,
  p_autoriza_imagen boolean, p_instagram text, p_como_conocio text, p_gift_card text,
  p_tutor_nombre text, p_tutor_documento text,
  p_texto_version text, p_texto_hash text, p_idioma text, p_ip text, p_user_agent text
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
    insert into public.reservas_personas (reserva_id, nombre, edad, empresa_id)
      values (f.reserva_id, p_nombre, p_edad, f.empresa_id)
      returning id into nueva_persona;
  else
    update public.reservas_personas set nombre = p_nombre, edad = p_edad
      where id = f.persona_id;
  end if;

  update public.fichas_riesgo set
    persona_id = coalesce(persona_id, nueva_persona),
    nombre = p_nombre, documento = p_documento, edad = p_edad, nacionalidad = p_nacionalidad,
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

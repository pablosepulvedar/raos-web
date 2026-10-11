-- Al firmar, la ficha que todavía no está enlazada a un pasajero crea su fila en
-- reservas_personas. Así el nombre declarado alimenta la lista de pasajeros y los
-- pasos siguientes del día de vuelo (cámara, piloto) tienen a quién apuntar.
create or replace function public.firmar_ficha(
  p_token text, p_nombre text, p_documento text, p_edad integer, p_nacionalidad text,
  p_salud text, p_emergencia_nombre text, p_emergencia_telefono text,
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
    update public.reservas_personas set nombre = p_nombre, edad = coalesce(edad, p_edad)
      where id = f.persona_id and coalesce(trim(nombre), '') = '';
  end if;

  update public.fichas_riesgo set
    persona_id = coalesce(persona_id, nueva_persona),
    nombre = p_nombre, documento = p_documento, edad = p_edad, nacionalidad = p_nacionalidad,
    salud = p_salud, emergencia_nombre = p_emergencia_nombre, emergencia_telefono = p_emergencia_telefono,
    tutor_nombre = p_tutor_nombre, tutor_documento = p_tutor_documento,
    texto_version = p_texto_version, texto_hash = p_texto_hash, idioma = p_idioma,
    ip = p_ip, user_agent = p_user_agent, aceptada_at = now()
  where token = p_token;
end $$;

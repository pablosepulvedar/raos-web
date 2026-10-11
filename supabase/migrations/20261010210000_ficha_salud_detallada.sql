-- Alinea la ficha digital con la de papel que usa RAOS (registro Sernatur 79723):
-- parentesco del contacto de urgencia, experiencia previa, previsión de salud,
-- declaración de salud item por item con su detalle, consumo de alcohol o drogas,
-- autorización de uso de imagen, y de dónde llegó el pasajero.
alter table public.fichas_riesgo
  add column emergencia_parentesco text,
  add column experiencia_previa boolean not null default false,
  add column prevision text,
  add column autoriza_imagen boolean not null default false,
  add column instagram text,
  add column como_conocio text,
  add column gift_card text;

-- La declaración de salud pasa de texto libre a un item por fila, como la de papel:
-- {"alergias": {"si": true, "detalle": "polen"}, ...}
alter table public.fichas_riesgo alter column salud type jsonb using null;
comment on column public.fichas_riesgo.salud is 'Declaración de salud: una clave por fila de la ficha, con si/detalle';

drop function public.firmar_ficha(text,text,text,integer,text,text,text,text,text,text,text,text,text,text,text);

create function public.firmar_ficha(
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
    update public.reservas_personas set nombre = p_nombre, edad = coalesce(edad, p_edad)
      where id = f.persona_id and coalesce(trim(nombre), '') = '';
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
grant execute on function public.firmar_ficha(text,text,text,integer,text,text,text,text,boolean,text,jsonb,boolean,text,text,text,text,text,text,text,text,text,text) to anon, authenticated;

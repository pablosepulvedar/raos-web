-- Ficha de inscripcion y aceptacion del riesgo (D.S. 19 Economia, art. 34).
-- Una por pasajero. El pasajero la llena desde un link con token y la acepta
-- con firma electronica simple (Ley 19.799): check + evidencia de la aceptacion.

create table public.fichas_riesgo (
  id bigint generated always as identity primary key,
  reserva_id bigint not null references public.reservas(id) on delete cascade,
  persona_id bigint references public.reservas_personas(id) on delete set null,
  token text not null unique default encode(extensions.gen_random_bytes(16), 'hex'),

  -- datos que declara el pasajero
  nombre text,
  documento text,
  edad integer,
  nacionalidad text,
  salud text,
  emergencia_nombre text,
  emergencia_telefono text,
  tutor_nombre text,
  tutor_documento text,

  -- evidencia de la aceptacion
  aceptada_at timestamptz,
  texto_version text,
  texto_hash text,
  idioma text,
  ip text,
  user_agent text,

  created_at timestamptz not null default now(),
  empresa_id uuid not null default public.mi_empresa_id() references public.empresas(id) on delete cascade
);
create index on public.fichas_riesgo (reserva_id);

alter table public.fichas_riesgo enable row level security;
grant select, insert, update, delete on public.fichas_riesgo to authenticated;
create policy empresa on public.fichas_riesgo for all to authenticated
  using (empresa_id = (select public.mi_empresa_id()))
  with check (empresa_id = (select public.mi_empresa_id()));

-- El pasajero no tiene sesion: entra solo por token, a traves de estas funciones.

-- Crea las fichas que falten para la reserva (una por pasajero) y las devuelve todas.
create function public.generar_fichas(p_reserva_id bigint)
  returns table (id bigint, token text, nombre text, aceptada_at timestamptz)
  language plpgsql security invoker set search_path = ''
  as $$
declare
  r record;
  faltan integer;
begin
  select * into r from public.reservas where reservas.id = p_reserva_id;
  if not found then raise exception 'reserva no encontrada'; end if;

  -- una ficha por persona ya cargada
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

  return query
    select f.id, f.token, f.nombre, f.aceptada_at
    from public.fichas_riesgo f where f.reserva_id = p_reserva_id order by f.id;
end $$;

-- Lo que ve el pasajero al abrir su link.
create function public.ficha_por_token(p_token text)
  returns table (
    empresa text, fecha date, horario integer, aceptada_at timestamptz,
    nombre text, documento text, edad integer, nacionalidad text, salud text,
    emergencia_nombre text, emergencia_telefono text, tutor_nombre text, tutor_documento text
  )
  language sql stable security definer set search_path = ''
  as $$
    select e.nombre, r.fecha, h.horario, f.aceptada_at,
           f.nombre, f.documento, f.edad, f.nacionalidad, f.salud,
           f.emergencia_nombre, f.emergencia_telefono, f.tutor_nombre, f.tutor_documento
    from public.fichas_riesgo f
    join public.reservas r on r.id = f.reserva_id
    join public.empresas e on e.id = f.empresa_id
    left join public.horarios h on h.id = r.horario_id
    where f.token = p_token
  $$;
grant execute on function public.ficha_por_token(text) to anon, authenticated;

-- Firma. Una vez aceptada no se puede volver a editar.
create function public.firmar_ficha(
  p_token text, p_nombre text, p_documento text, p_edad integer, p_nacionalidad text,
  p_salud text, p_emergencia_nombre text, p_emergencia_telefono text,
  p_tutor_nombre text, p_tutor_documento text,
  p_texto_version text, p_texto_hash text, p_idioma text, p_ip text, p_user_agent text
) returns void
  language plpgsql security definer set search_path = ''
  as $$
declare
  f record;
begin
  select * into f from public.fichas_riesgo where token = p_token;
  if not found then raise exception 'ficha no encontrada'; end if;
  if f.aceptada_at is not null then raise exception 'ficha ya aceptada'; end if;
  if p_edad < 18 and coalesce(trim(p_tutor_nombre), '') = '' then
    raise exception 'un menor de edad necesita los datos del adulto responsable';
  end if;

  update public.fichas_riesgo set
    nombre = p_nombre, documento = p_documento, edad = p_edad, nacionalidad = p_nacionalidad,
    salud = p_salud, emergencia_nombre = p_emergencia_nombre, emergencia_telefono = p_emergencia_telefono,
    tutor_nombre = p_tutor_nombre, tutor_documento = p_tutor_documento,
    texto_version = p_texto_version, texto_hash = p_texto_hash, idioma = p_idioma,
    ip = p_ip, user_agent = p_user_agent, aceptada_at = now()
  where token = p_token;

  -- el nombre declarado tambien sirve para la lista de pasajeros
  update public.reservas_personas set nombre = p_nombre
    where id = f.persona_id and coalesce(trim(nombre), '') = '';
end $$;
grant execute on function public.firmar_ficha(text,text,text,integer,text,text,text,text,text,text,text,text,text,text,text) to anon, authenticated;

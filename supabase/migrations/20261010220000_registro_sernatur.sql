-- La ficha de papel lleva el número de registro Sernatur en el encabezado.
-- Es por empresa, así que vive en empresas y viaja con la ficha.
alter table public.empresas add column if not exists registro_sernatur text;
update public.empresas set registro_sernatur = '79723' where slug = 'raos';

-- cambia el tipo de retorno: hay que soltarla antes
drop function if exists public.ficha_por_token(text);
create function public.ficha_por_token(p_token text)
  returns table (
    empresa text, registro_sernatur text, fecha date, horario integer, aceptada_at timestamptz,
    nombre text, documento text, edad integer, nacionalidad text, salud jsonb,
    emergencia_nombre text, emergencia_telefono text, tutor_nombre text, tutor_documento text
  )
  language sql stable security definer set search_path = ''
  as $$
    select e.nombre, e.registro_sernatur, r.fecha, h.horario, f.aceptada_at,
           f.nombre, f.documento, f.edad, f.nacionalidad, f.salud,
           f.emergencia_nombre, f.emergencia_telefono, f.tutor_nombre, f.tutor_documento
    from public.fichas_riesgo f
    join public.reservas r on r.id = f.reserva_id
    join public.empresas e on e.id = f.empresa_id
    left join public.horarios h on h.id = r.horario_id
    where f.token = p_token
  $$;
grant execute on function public.ficha_por_token(text) to anon, authenticated;

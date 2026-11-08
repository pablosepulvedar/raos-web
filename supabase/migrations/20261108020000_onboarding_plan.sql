-- El cliente elige su plan al dar de alta. Solo los cuatro que se ofrecen:
-- 'fundador' y 'cortesia' los asigna el superadmin a mano, nunca el formulario.
alter table public.onboarding add column plan text
  check (plan in ('prueba', 'mensual', 'semestral', 'anual'));

-- La firma cambia de parámetros, así que se reemplaza entera.
drop function public.onboarding_firmar(
  text,text,text,text,text,text,text,text,text,text,text,text,text,text,text,text,text,text,text,text);

create function public.onboarding_firmar(
  p_token text,
  p_empresa_nombre text, p_empresa_rut text, p_giro text,
  p_direccion text, p_comuna text, p_ciudad text, p_rubro text, p_sitio_web text,
  p_contacto_nombre text, p_contacto_cargo text, p_contacto_email text, p_contacto_telefono text,
  p_comentarios text,
  p_firmante_nombre text, p_firmante_rut text,
  p_plan text,
  p_texto_version text, p_texto_hash text, p_ip text, p_user_agent text
) returns void
  language plpgsql security definer set search_path = ''
  as $$
declare o record;
begin
  select * into o from public.onboarding where token = p_token;
  if not found then raise exception 'link no encontrado'; end if;
  if o.aceptado_at is not null then raise exception 'este formulario ya fue enviado'; end if;
  if coalesce(trim(p_empresa_nombre), '') = '' then raise exception 'falta el nombre de la empresa'; end if;
  if coalesce(trim(p_firmante_nombre), '') = '' then raise exception 'falta el nombre de quien acepta'; end if;
  -- El plan llega del navegador: se valida acá, no solo en la pantalla. Si no, alguien
  -- podría mandar 'cortesia' y quedarse sin pagar.
  if p_plan is not null and p_plan not in ('prueba', 'mensual', 'semestral', 'anual') then
    raise exception 'plan no válido';
  end if;

  update public.onboarding set
    empresa_nombre = trim(p_empresa_nombre), empresa_rut = trim(p_empresa_rut), giro = trim(p_giro),
    direccion = trim(p_direccion), comuna = trim(p_comuna), ciudad = trim(p_ciudad),
    rubro = p_rubro, sitio_web = trim(p_sitio_web),
    contacto_nombre = trim(p_contacto_nombre), contacto_cargo = trim(p_contacto_cargo),
    contacto_email = lower(trim(p_contacto_email)), contacto_telefono = trim(p_contacto_telefono),
    comentarios = trim(p_comentarios),
    firmante_nombre = trim(p_firmante_nombre), firmante_rut = trim(p_firmante_rut),
    plan = p_plan,
    texto_version = p_texto_version, texto_hash = p_texto_hash,
    ip = p_ip, user_agent = p_user_agent, aceptado_at = now()
  where token = p_token;
end $$;

grant execute on function public.onboarding_firmar(
  text,text,text,text,text,text,text,text,text,text,text,text,text,text,text,text,text,text,text,text,text
) to anon, authenticated;

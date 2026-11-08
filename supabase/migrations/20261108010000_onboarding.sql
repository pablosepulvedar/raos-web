-- Alta de una empresa nueva: un link que Pablo manda al cliente para que llene sus
-- datos y acepte el contrato de confidencialidad y uso. Lo aceptado queda con la misma
-- evidencia que la ficha de riesgo (version y hash del texto, IP, navegador), porque se
-- apoya en lo mismo: el check vale como firma por la Ley 19.799.
--
-- Es un solo link y un solo formulario: mandar dos (contrato y datos) significaba que el
-- cliente abandonara en el primero.

create table public.onboarding (
  id bigint generated always as identity primary key,
  token text not null unique default encode(extensions.gen_random_bytes(16), 'hex'),
  -- para que el superadmin recuerde a quien se lo mando antes de que conteste
  etiqueta text not null,

  -- lo que llena el cliente
  empresa_nombre text,
  empresa_rut text,
  giro text,
  direccion text,
  comuna text,
  ciudad text,
  rubro text,
  sitio_web text,
  contacto_nombre text,
  contacto_cargo text,
  contacto_email text,
  contacto_telefono text,
  comentarios text,

  -- evidencia de la aceptacion
  aceptado_at timestamptz,
  firmante_nombre text,
  firmante_rut text,
  texto_version text,
  texto_hash text,
  ip text,
  user_agent text,

  -- queda enlazada cuando el superadmin crea la empresa con estos datos
  empresa_id uuid references public.empresas(id) on delete set null,

  created_at timestamptz not null default now()
);
create index on public.onboarding (created_at desc);

alter table public.onboarding enable row level security;

-- Solo el superadmin la ve. El formulario publico no toca la tabla: pasa por las
-- funciones security definer de mas abajo, que es lo unico que puede el anonimo.
create policy solo_superadmin on public.onboarding
  for all using ((select public.es_superadmin())) with check ((select public.es_superadmin()));

grant select, insert, update, delete on public.onboarding to authenticated;
-- El formulario público entra como anon y solo debe poder llamar a las dos funciones
-- de más abajo. Sin esto llega hasta la política y revienta con un error de permisos
-- sobre es_superadmin, que confunde más de lo que protege.
revoke all on public.onboarding from anon;

-- ── Lo que ve quien abre el link ──────────────────────────────────────────────
-- Devuelve lo minimo para pintar el formulario. No expone la tabla ni otros registros.
create function public.onboarding_abrir(p_token text)
  returns table (etiqueta text, aceptado boolean)
  language sql security definer set search_path = ''
  as $$
    select o.etiqueta, o.aceptado_at is not null
      from public.onboarding o where o.token = p_token
  $$;
grant execute on function public.onboarding_abrir(text) to anon, authenticated;

-- ── Firmar ────────────────────────────────────────────────────────────────────
create function public.onboarding_firmar(
  p_token text,
  p_empresa_nombre text, p_empresa_rut text, p_giro text,
  p_direccion text, p_comuna text, p_ciudad text, p_rubro text, p_sitio_web text,
  p_contacto_nombre text, p_contacto_cargo text, p_contacto_email text, p_contacto_telefono text,
  p_comentarios text,
  p_firmante_nombre text, p_firmante_rut text,
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

  update public.onboarding set
    empresa_nombre = trim(p_empresa_nombre), empresa_rut = trim(p_empresa_rut), giro = trim(p_giro),
    direccion = trim(p_direccion), comuna = trim(p_comuna), ciudad = trim(p_ciudad),
    rubro = p_rubro, sitio_web = trim(p_sitio_web),
    contacto_nombre = trim(p_contacto_nombre), contacto_cargo = trim(p_contacto_cargo),
    contacto_email = lower(trim(p_contacto_email)), contacto_telefono = trim(p_contacto_telefono),
    comentarios = trim(p_comentarios),
    firmante_nombre = trim(p_firmante_nombre), firmante_rut = trim(p_firmante_rut),
    texto_version = p_texto_version, texto_hash = p_texto_hash,
    ip = p_ip, user_agent = p_user_agent, aceptado_at = now()
  where token = p_token;
end $$;
grant execute on function public.onboarding_firmar(
  text,text,text,text,text,text,text,text,text,text,text,text,text,text,text,text,text,text,text,text
) to anon, authenticated;

-- ── Panel del superadmin ──────────────────────────────────────────────────────
create function public.sa_nuevo_onboarding(p_etiqueta text)
  returns text
  language plpgsql security definer set search_path = ''
  as $$
declare v_token text;
begin
  if not public.es_superadmin() then raise exception 'solo superadmin'; end if;
  if coalesce(trim(p_etiqueta), '') = '' then raise exception 'ponle un nombre para reconocerlo'; end if;
  insert into public.onboarding (etiqueta) values (trim(p_etiqueta)) returning token into v_token;
  return v_token;
end $$;
grant execute on function public.sa_nuevo_onboarding(text) to authenticated;

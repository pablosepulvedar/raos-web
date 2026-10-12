-- Quien ve el panel completo no puede depender de que el rol se llame "piloto":
-- en rafting se llama "guía" y en buceo "instructor". Se marca en la tabla.
alter table public.roles add column restringido boolean not null default false;

update public.roles r set restringido = true
  from public.empresas e join public.rubros ru on ru.codigo = e.rubro
  where r.empresa_id = e.id and lower(r.nombre) in (lower(ru.operador), 'coordinador');

-- Al crear la empresa, el rol del operador y el de coordinador nacen restringidos
create or replace function public.sa_guardar_empresa(p_id uuid, p_slug text, p_nombre text, p_logo_url text,
                                                     p_color text, p_activa boolean, p_rubro text default 'generico')
  returns uuid
  language plpgsql security definer set search_path = ''
  as $$
declare
  v_id uuid;
  v_operador text;
begin
  if not public.es_superadmin() then raise exception 'solo superadmin'; end if;
  if not exists (select 1 from public.rubros where codigo = p_rubro) then
    raise exception 'rubro "%" no existe', p_rubro;
  end if;
  if p_id is null then
    insert into public.empresas (slug, nombre, logo_url, color, activa, rubro)
      values (lower(trim(p_slug)), trim(p_nombre), nullif(trim(p_logo_url), ''),
              coalesce(nullif(p_color, ''), '#2e6db4'), coalesce(p_activa, true), p_rubro)
      returning id into v_id;
    select initcap(operador) into v_operador from public.rubros where codigo = p_rubro;
    insert into public.roles (nombre, empresa_id, restringido) values
      ('Admin', v_id, false), (v_operador, v_id, true), ('Coordinador', v_id, true);
  else
    update public.empresas set
      nombre = trim(p_nombre), logo_url = nullif(trim(p_logo_url), ''),
      color = coalesce(nullif(p_color, ''), color), activa = p_activa, rubro = p_rubro
      where id = p_id
      returning id into v_id;
  end if;
  return v_id;
end $$;

-- Branding del login por subdominio, sin sesión. Solo devuelve la empresa pedida (no permite listar).
create function public.empresa_publica(p_slug text)
  returns table (nombre text, logo_url text, color text)
  language sql stable security definer set search_path = ''
  as $$ select nombre, logo_url, color from public.empresas where slug = p_slug and activa $$;
grant execute on function public.empresa_publica(text) to anon, authenticated;

-- Registro de cada intento de firma, incluidos los que fallan. La ficha guarda
-- la evidencia de la firma que quedo; esto guarda lo que paso para llegar ahi.
create table public.fichas_log (
  id bigint generated always as identity primary key,
  ficha_id bigint references public.fichas_riesgo(id) on delete cascade,
  token text,
  evento text not null,
  detalle text,
  ip text,
  user_agent text,
  created_at timestamptz not null default now(),
  empresa_id uuid references public.empresas(id) on delete cascade
);
create index on public.fichas_log (ficha_id);

alter table public.fichas_log enable row level security;
grant select on public.fichas_log to authenticated;
create policy empresa on public.fichas_log for select to authenticated
  using (empresa_id = (select public.mi_empresa_id()));

-- Lo escribe el servidor en nombre del pasajero, que no tiene sesion.
-- Nadie puede leerlo ni borrarlo por esta via: solo insertar.
create function public.registrar_ficha_log(
  p_token text, p_evento text, p_detalle text, p_ip text, p_user_agent text
) returns void
  language plpgsql security definer set search_path = ''
  as $$
declare
  f record;
begin
  select id, empresa_id into f from public.fichas_riesgo where token = p_token;
  insert into public.fichas_log (ficha_id, token, evento, detalle, ip, user_agent, empresa_id)
    values (f.id, p_token, p_evento, left(p_detalle, 500), p_ip, left(p_user_agent, 300), f.empresa_id);
end $$;
grant execute on function public.registrar_ficha_log(text,text,text,text,text) to anon, authenticated;

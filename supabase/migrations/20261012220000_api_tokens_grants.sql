-- Solo el service_role (las rutas /api del servidor) toca los tokens. anon y
-- authenticated quedan fuera: RLS sin policies ya los bloquea, esto además les
-- niega el privilegio.
grant select, insert, update on public.api_tokens to service_role;
grant usage, select on sequence public.api_tokens_id_seq to service_role;

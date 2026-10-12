-- Tokens de API para que la web de cada empresa cree reservas al cobrar un vuelo.
-- Sin policies: RLS queda activo (event trigger rls_auto_enable) y solo entra service_role,
-- o sea las rutas /api/... del servidor. El token viaje guardado como hash sha256.
create table public.api_tokens (
  id bigint generated always as identity primary key,
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  nombre text not null,
  prefijo text not null,
  token_hash text not null unique,
  creado_at timestamptz not null default now(),
  ultimo_uso_at timestamptz,
  revocado_at timestamptz
);
create index api_tokens_empresa_idx on public.api_tokens (empresa_id);

-- Identificador del pago/orden en la web del cliente: evita reservas duplicadas
-- si el webhook de pago se reintenta.
alter table public.reservas add column referencia_externa text;
create unique index reservas_referencia_externa_key
  on public.reservas (empresa_id, referencia_externa)
  where referencia_externa is not null;

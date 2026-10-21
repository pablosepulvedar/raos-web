-- Google Calendar, una conexión por empresa.
--
-- La aplicación de Google es de Reservaps (client_id y client_secret viven en el
-- entorno del worker, no acá): la empresa solo aprieta "Conectar" y autoriza. Lo
-- que queda guardado es su refresh_token, que sirve para pedir acceso de lectura a
-- su calendario cada vez que importa.
--
-- ponytail: el refresh_token se guarda en claro, protegido por RLS sin policies
-- (solo lo ve service_role) igual que pasarelas_pago y api_tokens. El event trigger
-- rls_auto_enable deja la tabla con RLS activo al crearla.
create table public.calendar_conexiones (
  empresa_id uuid primary key references public.empresas(id) on delete cascade,
  refresh_token text not null,
  cuenta_email text,
  calendario_id text not null default 'primary',
  calendario_nombre text,
  -- Cómo están escritos los eventos de esta empresa. Los formatos conocidos viven
  -- en lib/calendar-plantillas.ts; 'libre' usa patron_titulo.
  plantilla text not null default 'raos',
  patron_titulo text,
  actualizado_at timestamptz not null default now()
);
grant select, insert, update, delete on public.calendar_conexiones to service_role;

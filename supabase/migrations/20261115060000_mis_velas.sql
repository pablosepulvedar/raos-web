-- Las velas del guía, en su cuenta: una lista corta que él mantiene.
--
-- Va en una tabla suya y no en `perfiles` porque `perfiles` lo lee cualquiera de
-- la empresa (la política es "compartimos empresa") y el equipo es del guía, igual
-- que su bitácora. Sin empresa_id a propósito: la vela es la misma vuele para quien
-- vuele, así que el RLS es solo "es mía" y se lee desde cualquier subdominio.
--
-- En la ficha de una salida la vela se ELIGE de esta lista. Si no tiene ninguna
-- cargada, el campo no aparece: no se escribe a mano.

create table public.mis_velas (
  id        bigint generated always as identity primary key,
  perfil_id uuid not null default auth.uid() references public.perfiles(id) on delete cascade,
  nombre    text not null check (btrim(nombre) <> ''),
  creado_at timestamptz not null default now(),
  unique (perfil_id, nombre)
);

alter table public.mis_velas enable row level security;
create policy mias on public.mis_velas for all to authenticated
  using (perfil_id = auth.uid())
  with check (perfil_id = auth.uid());
-- En producción una tabla nueva no hereda permisos para authenticated (el RLS sigue filtrando)
grant select, insert, update, delete on public.mis_velas to authenticated;

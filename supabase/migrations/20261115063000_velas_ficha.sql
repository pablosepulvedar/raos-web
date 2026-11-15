-- La ficha de cada vela: marca, modelo, año y lo que sirve para controlar el equipo.
--
-- La tabla se creó hace un rato y está vacía, así que se rehace entera en vez de
-- parchar columna por columna. `nombre` pasa a ser calculado (marca + modelo) para
-- que nadie lo escriba a mano y la lista no se llene de nombres distintos para la
-- misma vela; el año va aparte porque el mismo modelo cambia de año.
--
-- La homologación son las clases de la norma EN 926-2 (A, B, C, D), la CCC de
-- competición y las LTF alemanas viejas, más "sin homologar" para un prototipo.

drop table public.mis_velas;

create table public.mis_velas (
  id        bigint generated always as identity primary key,
  perfil_id uuid not null default auth.uid() references public.perfiles(id) on delete cascade,
  marca     text not null check (btrim(marca) <> ''),
  modelo    text not null check (btrim(modelo) <> ''),
  anio      int  check (anio is null or anio between 1970 and 2100),
  tipo      text check (tipo in ('biplaza', 'monoplaza')),
  homologacion text check (homologacion in
    ('EN A', 'EN B', 'EN C', 'EN D', 'CCC', 'LTF 1', 'LTF 1-2', 'LTF 2', 'LTF 2-3', 'Sin homologar')),
  talla     text,
  serie     text,
  revision  date,          -- la última revisión del equipo
  creado_at timestamptz not null default now(),
  -- Como se lee en la lista y como queda anotada en la salida
  nombre    text generated always as (btrim(marca) || ' ' || btrim(modelo)) stored,
  unique (perfil_id, marca, modelo, anio)
);

alter table public.mis_velas enable row level security;
create policy mias on public.mis_velas for all to authenticated
  using (perfil_id = auth.uid())
  with check (perfil_id = auth.uid());
-- En producción una tabla nueva no hereda permisos para authenticated (el RLS sigue filtrando)
grant select, insert, update, delete on public.mis_velas to authenticated;

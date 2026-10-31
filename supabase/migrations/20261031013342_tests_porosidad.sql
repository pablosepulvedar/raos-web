-- Banco de tests de porosidad (herramienta de RAOS, app/porosidad).
-- Se guardan los DATOS, no el PDF: el PDF se vuelve a armar igual desde la plantilla
-- cada vez que hay que compartirlo, así no ocupa espacio ni hace falta Storage.
-- Solo quien administra la empresa los ve (ni coordinador ni piloto).
create table public.tests_porosidad (
  id bigint generated always as identity primary key,
  empresa_id uuid not null default public.mi_empresa_id() references public.empresas(id) on delete cascade,
  piloto text not null,
  fecha text not null,             -- como se escribió en el test (dd/mm/aaaa)
  equipo text,                     -- marca y modelo, para reconocerlo en la lista
  datos jsonb not null,            -- los valores de cada campo de la plantilla
  creado_por uuid default auth.uid() references public.perfiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.tests_porosidad (empresa_id, created_at desc);

alter table public.tests_porosidad enable row level security;
create policy solo_admin on public.tests_porosidad for all to authenticated
  using (empresa_id = (select public.mi_empresa_id()) and (select public.puedo_administrar()))
  with check (empresa_id = (select public.mi_empresa_id()) and (select public.puedo_administrar()));

-- Lo que cuesta volar en cada sitio.
--
-- Hasta ahora el cuadre del día descontaba `vuelos × $15.000` escrito a fuego en
-- el código: el precio del centro de vuelo de RAOS. Dos problemas: si el día se
-- voló en otro lado el número no calza (había que inventar un ingreso para
-- cuadrar), y a las demás empresas les aparecía un descuento que no es suyo.
--
-- Ahora cada empresa carga sus sitios con su precio por vuelo y dice cuándo se
-- paga: a fin de mes (sale como provisión, como hasta hoy) o en el día (sale
-- como gasto de la jornada). El cuadre usa el sitio del día; si la empresa no
-- cargó ninguno, no hay línea.

create table public.sitios (
  id             bigint generated always as identity primary key,
  empresa_id     uuid not null default public.mi_empresa_id() references public.empresas(id) on delete cascade,
  nombre         text not null check (btrim(nombre) <> ''),
  costo          int  not null default 0 check (costo >= 0),   -- por vuelo
  cuando         text not null default 'fin_de_mes' check (cuando in ('fin_de_mes', 'al_momento')),
  predeterminado boolean not null default false,
  activo         boolean not null default true,
  creado_at      timestamptz not null default now(),
  unique (empresa_id, nombre)
);
create unique index sitios_un_predeterminado on public.sitios (empresa_id) where predeterminado;

-- Marcar uno suelta al anterior, en vez de fallar
create function public.un_solo_sitio_predeterminado() returns trigger
  language plpgsql security definer set search_path = ''
  as $$
begin
  if new.predeterminado then
    update public.sitios set predeterminado = false
     where empresa_id = new.empresa_id and predeterminado and id is distinct from new.id;
  end if;
  return new;
end $$;
create trigger un_predeterminado before insert or update on public.sitios
  for each row execute function public.un_solo_sitio_predeterminado();

alter table public.sitios enable row level security;
create policy empresa on public.sitios for all to authenticated
  using (empresa_id = (select public.mi_empresa_id()))
  with check (empresa_id = (select public.mi_empresa_id()));
grant select, insert, update, delete on public.sitios to authenticated;

-- Dónde se voló cada día. Solo se guarda cuando NO es el sitio de siempre.
create table public.dias_de_vuelo (
  empresa_id uuid not null default public.mi_empresa_id() references public.empresas(id) on delete cascade,
  fecha      date not null,
  sitio_id   bigint not null references public.sitios(id) on delete cascade,
  primary key (empresa_id, fecha)
);

alter table public.dias_de_vuelo enable row level security;
create policy empresa on public.dias_de_vuelo for all to authenticated
  using (empresa_id = (select public.mi_empresa_id()))
  with check (empresa_id = (select public.mi_empresa_id()));
grant select, insert, update, delete on public.dias_de_vuelo to authenticated;

-- RAOS, tal como opera hoy: su centro de vuelo a fin de mes y Colina, que se
-- paga en el día. Las demás empresas parten sin sitios y sin línea en el cuadre,
-- que es lo correcto: ese descuento nunca fue de ellas.
insert into public.sitios (empresa_id, nombre, costo, cuando, predeterminado)
select e.id, s.nombre, s.costo, s.cuando, s.predeterminado
  from public.empresas e,
       (values ('Las Vizcachas', 15000, 'fin_de_mes', true),
               ('Colina',         9000, 'al_momento', false)) as s(nombre, costo, cuando, predeterminado)
 where e.slug = 'raos';

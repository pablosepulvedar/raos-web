-- Bitácora de vuelo del guía: sus vuelos y sus horas.
--
-- Dos cosas que hoy no existen:
--   1. Los vuelos que hizo POR FUERA del sistema (para otra empresa, o por su cuenta).
--   2. Cuánto duró cada vuelo. Por defecto 10 minutos, que es lo que dura un biplaza
--      normal; el que quiera afinarlo escribe los suyos.
--
-- Es del guía, no de la empresa: nadie más la ve, ni su propia empresa. Por eso
-- `vuelos_externos` NO lleva empresa_id ni el disparador `anotar` de la bitácora de
-- la empresa (Varios > Quién hizo qué), y por eso `mi_bitacora()` junta los vuelos
-- de TODAS sus empresas aunque esté mirando el subdominio de una.

-- Los minutos del vuelo interno: null = los 10 de siempre, así no hay que tocar
-- las filas viejas ni inventar un default que después haya que mantener.
alter table public.reservas_personas add column minutos int
  check (minutos is null or minutos between 1 and 1440);

create table public.vuelos_externos (
  id         bigint generated always as identity primary key,
  perfil_id  uuid not null default auth.uid() references public.perfiles(id) on delete cascade,
  fecha      date not null,
  empresa    text not null check (btrim(empresa) <> ''),
  pasajero   text,
  camara     text check (camara in ('sin', 'normal', '360')),
  valor      int  check (valor is null or valor >= 0),
  minutos    int  check (minutos is null or minutos between 1 and 1440),
  creado_at  timestamptz not null default now()
);
create index vuelos_externos_perfil_fecha on public.vuelos_externos (perfil_id, fecha desc);

alter table public.vuelos_externos enable row level security;
create policy mios on public.vuelos_externos for all to authenticated
  using (perfil_id = auth.uid()) with check (perfil_id = auth.uid());
-- En producción una tabla nueva no hereda permisos para authenticated (el RLS sigue filtrando)
grant select, insert, update, delete on public.vuelos_externos to authenticated;

-- Todos sus vuelos, los del sistema y los de fuera, en una sola lista.
-- Definer porque cruza empresas: el RLS de reservas_personas solo deja ver la
-- empresa de turno, y la bitácora es de la persona, no del subdominio. El filtro
-- por auth.uid() es lo único que la abre: nadie puede pedir la de otro.
create function public.mi_bitacora(p_desde date default null, p_hasta date default null)
  returns table (origen text, id bigint, fecha date, empresa text, pasajero text,
                 camara text, valor int, minutos int)
  language sql stable security definer set search_path = ''
  as $$
    select 'interno', rp.id, r.fecha, e.nombre, rp.nombre,
           case when rp.camara_360 then '360' when rp.camara_normal then 'normal' else 'sin' end,
           null::int, coalesce(rp.minutos, 10)
      from public.reservas_personas rp
      join public.reservas r on r.id = rp.reserva_id
      join public.empresas  e on e.id = rp.empresa_id
     where rp.perfil_id = auth.uid()
       and r.borrada_at is null          -- cancelada: no se voló
       and r.espera_at is null           -- por reagendar: todavía no se vuela
       and r.fecha <= (now() at time zone 'America/Santiago')::date
       and (p_desde is null or r.fecha >= p_desde)
       and (p_hasta is null or r.fecha <= p_hasta)
    union all
    select 'externo', v.id, v.fecha, v.empresa, v.pasajero, v.camara, v.valor, coalesce(v.minutos, 10)
      from public.vuelos_externos v
     where v.perfil_id = auth.uid()
       and (p_desde is null or v.fecha >= p_desde)
       and (p_hasta is null or v.fecha <= p_hasta)
     order by 3 desc, 2 desc
  $$;
revoke execute on function public.mi_bitacora(date, date) from public, anon;
grant execute on function public.mi_bitacora(date, date) to authenticated;

-- Cambiarle los minutos a un vuelo del sistema. Definer por lo mismo que arriba
-- (puede ser de otra de sus empresas), y solo sobre los vuelos propios.
create function public.fijar_minutos(p_persona bigint, p_minutos int) returns void
  language plpgsql security definer set search_path = ''
  as $$
begin
  if p_minutos is not null and (p_minutos < 1 or p_minutos > 1440) then
    raise exception 'los minutos van entre 1 y 1440';
  end if;
  update public.reservas_personas set minutos = p_minutos
   where id = p_persona and perfil_id = auth.uid();
  if not found then raise exception 'ese vuelo no es tuyo'; end if;
end $$;
revoke execute on function public.fijar_minutos(bigint, int) from public, anon;
grant execute on function public.fijar_minutos(bigint, int) to authenticated;

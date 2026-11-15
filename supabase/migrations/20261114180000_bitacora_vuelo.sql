-- Bitácora de vuelo del guía: sus vuelos y sus horas.
--
-- Dos cosas que hoy no existen:
--   1. Los vuelos que hizo POR FUERA del sistema (para otra empresa, o por su cuenta).
--   2. Lo que un libro de vuelo anota de cada vuelo: cuánto duró, dónde despegó, con
--      qué vela, de qué tipo y las observaciones. Por defecto 10 minutos, que es lo
--      que dura un biplaza normal; el que quiera afinarlo escribe los suyos.
--
-- Es del guía, no de la empresa: nadie más la ve, ni su propia empresa. Por eso va en
-- una tabla aparte y no como columnas de `reservas_personas` (ahí lo leería cualquiera
-- que administre la empresa, y cada cambio saldría en Quién hizo qué), y por eso
-- `mi_bitacora()` junta los vuelos de TODAS sus empresas aunque esté mirando el
-- subdominio de una.
--
-- Una sola tabla para las dos cosas: una fila con `persona_id` anota un vuelo que ya
-- existe en el sistema; una fila sin `persona_id` ES un vuelo de fuera, con su fecha
-- y su empresa escritas a mano.

create table public.mis_vuelos (
  id         bigint generated always as identity primary key,
  perfil_id  uuid not null default auth.uid() references public.perfiles(id) on delete cascade,
  persona_id bigint unique references public.reservas_personas(id) on delete cascade,
  fecha      date,
  empresa    text,
  pasajero   text,
  camara     text check (camara in ('sin', 'normal', '360')),
  valor      int  check (valor is null or valor >= 0),
  minutos    int  check (minutos is null or minutos between 1 and 1440),
  sitio      text,
  vela       text,
  tipo       text check (tipo in ('biplaza', 'solo', 'instruccion')),
  nota       text,
  creado_at  timestamptz not null default now(),
  -- El de fuera no cuelga de ninguna reserva: la fecha y la empresa las pone él
  constraint vuelo_de_fuera_con_fecha_y_empresa check (
    persona_id is not null or (fecha is not null and btrim(coalesce(empresa, '')) <> ''))
);
create index mis_vuelos_perfil_fecha on public.mis_vuelos (perfil_id, fecha desc);

-- Definer porque el guía solo ve, por RLS, las filas de la empresa de turno, y la
-- bitácora cruza sus empresas. Responde únicamente por quien pregunta.
create function public.es_mi_vuelo(p_persona bigint) returns boolean
  language sql stable security definer set search_path = ''
  as $$ select exists (select 1 from public.reservas_personas rp
                        where rp.id = p_persona and rp.perfil_id = auth.uid()) $$;
revoke execute on function public.es_mi_vuelo(bigint) from public, anon;
grant execute on function public.es_mi_vuelo(bigint) to authenticated;

alter table public.mis_vuelos enable row level security;
create policy mios on public.mis_vuelos for all to authenticated
  using (perfil_id = auth.uid())
  with check (perfil_id = auth.uid()
              and (persona_id is null or public.es_mi_vuelo(persona_id)));
-- En producción una tabla nueva no hereda permisos para authenticated (el RLS sigue filtrando)
grant select, insert, update, delete on public.mis_vuelos to authenticated;

-- Todos sus vuelos, los del sistema y los de fuera, en una sola lista.
-- `ref` es con qué se guarda cada uno: el id de la persona para los del sistema
-- (la anotación se hace con upsert sobre persona_id) y el id de la fila para los de fuera.
create function public.mi_bitacora(p_desde date default null, p_hasta date default null)
  returns table (origen text, ref bigint, fecha date, empresa text, pasajero text,
                 camara text, valor int, minutos int, sitio text, vela text,
                 tipo text, nota text)
  language sql stable security definer set search_path = ''
  as $$
    select 'interno', rp.id, r.fecha, e.nombre, rp.nombre,
           case when rp.camara_360 then '360' when rp.camara_normal then 'normal' else 'sin' end,
           null::int, coalesce(mv.minutos, 10), mv.sitio, mv.vela,
           coalesce(mv.tipo, 'biplaza'), mv.nota
      from public.reservas_personas rp
      join public.reservas r on r.id = rp.reserva_id
      join public.empresas  e on e.id = rp.empresa_id
      left join public.mis_vuelos mv on mv.persona_id = rp.id and mv.perfil_id = auth.uid()
     where rp.perfil_id = auth.uid()
       and r.borrada_at is null          -- cancelada: no se voló
       and r.espera_at is null           -- por reagendar: todavía no se vuela
       and r.fecha <= (now() at time zone 'America/Santiago')::date
       and (p_desde is null or r.fecha >= p_desde)
       and (p_hasta is null or r.fecha <= p_hasta)
    union all
    select 'externo', v.id, v.fecha, v.empresa, v.pasajero, v.camara, v.valor,
           coalesce(v.minutos, 10), v.sitio, v.vela, coalesce(v.tipo, 'biplaza'), v.nota
      from public.mis_vuelos v
     where v.perfil_id = auth.uid() and v.persona_id is null
       and (p_desde is null or v.fecha >= p_desde)
       and (p_hasta is null or v.fecha <= p_hasta)
     order by 3 desc, 2 desc
  $$;
revoke execute on function public.mi_bitacora(date, date) from public, anon;
grant execute on function public.mi_bitacora(date, date) to authenticated;

-- Las empresas del sistema, solo el nombre, para elegir en el vuelo de fuera.
-- Por decisión de Pablo se ofrecen todas las inscritas, no solo las suyas.
create function public.nombres_de_empresas() returns table (nombre text)
  language sql stable security definer set search_path = ''
  as $$ select e.nombre from public.empresas e where e.activa order by e.nombre $$;
revoke execute on function public.nombres_de_empresas() from public, anon;
grant execute on function public.nombres_de_empresas() to authenticated;

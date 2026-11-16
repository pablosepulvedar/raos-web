-- La bitácora: dentro del día, el último vuelo arriba.
--
-- La migración de hace un rato la dejó del primero al último, como en Pilotos.
-- Mirándola, Pablo la prefiere al revés: lo último que voló, arriba. En Pilotos
-- se queda como está, porque ahí se sigue el día tal como pasó.

create or replace function public.mi_bitacora(p_desde date default null, p_hasta date default null)
  returns table (origen text, ref bigint, fecha date, empresa text, pasajero text,
                 camara text, valor int, minutos int, sitio text, vela text,
                 tipo text, nota text, orden timestamptz)
  language sql stable security definer set search_path = ''
  as $$
    with principales as (
      select v.tipo, v.nombre || coalesce(' ' || v.anio, '') as nombre
        from public.mis_velas v
       where v.perfil_id = auth.uid() and v.principal
    ),
    -- biplaza e instrucción van con la biplaza; un vuelo solo, con la monoplaza
    la_de_siempre as (
      select (select nombre from principales where tipo = 'biplaza')  as biplaza,
             (select nombre from principales where tipo = 'monoplaza') as monoplaza
    )
    select 'interno', rp.id, r.fecha, e.nombre, rp.nombre,
           case when rp.camara_360 then '360' when rp.camara_normal then 'normal' else 'sin' end,
           null::int, coalesce(mv.minutos, 10), mv.sitio,
           coalesce(mv.vela, case when mv.tipo = 'solo' then s.monoplaza else s.biplaza end),
           coalesce(mv.tipo, 'biplaza'), mv.nota,
           rp.asignado_at
      from public.reservas_personas rp
      join public.reservas r on r.id = rp.reserva_id
      join public.empresas  e on e.id = rp.empresa_id
      left join public.mis_vuelos mv on mv.persona_id = rp.id and mv.perfil_id = auth.uid()
      cross join la_de_siempre s
     where rp.perfil_id = auth.uid()
       and r.borrada_at is null          -- cancelada: no se voló
       and r.espera_at is null           -- por reagendar: todavía no se vuela
       and r.fecha <= (now() at time zone 'America/Santiago')::date
       and (p_desde is null or r.fecha >= p_desde)
       and (p_hasta is null or r.fecha <= p_hasta)
    union all
    select 'externo', v.id, v.fecha, v.empresa, v.pasajero, v.camara, v.valor,
           coalesce(v.minutos, 10), v.sitio,
           coalesce(v.vela, case when v.tipo = 'solo' then s.monoplaza else s.biplaza end),
           coalesce(v.tipo, 'biplaza'), v.nota,
           v.creado_at
      from public.mis_vuelos v
      cross join la_de_siempre s
     where v.perfil_id = auth.uid() and v.persona_id is null
       and (p_desde is null or v.fecha >= p_desde)
       and (p_hasta is null or v.fecha <= p_hasta)
     -- El día más nuevo arriba y, dentro del día, el último vuelo primero (decisión
     -- de Pablo: la bitácora se lee como un muro, lo último que hiciste arriba).
     -- En Pilotos es al revés, porque ahí se sigue el día tal como pasó.
     -- Lo viejo no tiene marca y queda al final, por id, que es lo que se sabe.
     order by 3 desc, 13 desc nulls last, 2 desc
  $$;
revoke execute on function public.mi_bitacora(date, date) from public, anon;
grant execute on function public.mi_bitacora(date, date) to authenticated;

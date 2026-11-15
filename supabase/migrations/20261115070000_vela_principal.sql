-- La vela principal: la que el guía usa siempre.
--
-- Una por tipo (una biplaza y una monoplaza). Las salidas que no tengan vela
-- anotada se muestran con la principal del tipo que corresponda, así el guía no
-- tiene que tocar cada vuelo: entra con su vela puesta. Si alguna vez voló con
-- otra, la cambia en esa salida y ahí queda escrita.
--
-- Los vuelos pagados son los biplaza; el monoplaza es para sus propios vuelos.

alter table public.mis_velas
  add column principal boolean not null default false,
  -- No tiene sentido una principal sin saber de qué tipo es
  add constraint principal_con_tipo check (not principal or tipo is not null);

-- Una sola principal por tipo
create unique index mis_velas_una_principal
  on public.mis_velas (perfil_id, tipo) where principal;

-- Marcar una principal suelta a la anterior, en vez de fallar
create function public.una_sola_vela_principal() returns trigger
  language plpgsql security definer set search_path = ''
  as $$
begin
  if new.principal then
    update public.mis_velas
       set principal = false
     where perfil_id = new.perfil_id and tipo = new.tipo and principal
       and id is distinct from new.id;
  end if;
  return new;
end $$;
create trigger una_sola_principal before insert or update on public.mis_velas
  for each row execute function public.una_sola_vela_principal();

-- La bitácora muestra la principal cuando la salida no tiene vela escrita
create or replace function public.mi_bitacora(p_desde date default null, p_hasta date default null)
  returns table (origen text, ref bigint, fecha date, empresa text, pasajero text,
                 camara text, valor int, minutos int, sitio text, vela text,
                 tipo text, nota text)
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
           coalesce(mv.tipo, 'biplaza'), mv.nota
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
           coalesce(v.tipo, 'biplaza'), v.nota
      from public.mis_vuelos v
      cross join la_de_siempre s
     where v.perfil_id = auth.uid() and v.persona_id is null
       and (p_desde is null or v.fecha >= p_desde)
       and (p_hasta is null or v.fecha <= p_hasta)
     order by 3 desc, 2 desc
  $$;

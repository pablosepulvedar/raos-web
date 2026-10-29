-- Lo que cada empresa le paga a Reservaps por usar la plataforma.
-- suscripciones: el plan vigente de cada empresa y hasta cuándo está pagado.
-- pagos_plataforma: cada pago recibido; registrar uno corre el vencimiento.
-- Solo el superadmin lee y escribe; la empresa solo ve su propio estado con mi_cuenta(),
-- que es lo que pinta la franja amarilla y, una semana después de vencer, la suspensión.
-- Una empresa sin fila en suscripciones no se cobra ni se suspende (p. ej. la demo).

create table public.suscripciones (
  empresa_id uuid primary key references public.empresas(id) on delete cascade,
  plan text not null check (plan in ('prueba', 'mensual', 'semestral', 'anual', 'fundador', 'cortesia')),
  precio integer not null default 0 check (precio >= 0), -- por período, el pactado (puede no ser el de lista)
  inicio date not null default (now() at time zone 'America/Santiago')::date,
  vence date not null,                                    -- pagado hasta este día inclusive
  notas text,
  updated_at timestamptz not null default now()
);

create table public.pagos_plataforma (
  id bigint generated always as identity primary key,
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  fecha date not null default (now() at time zone 'America/Santiago')::date,
  monto integer not null check (monto > 0),
  metodo text,
  hasta date not null,                                    -- hasta cuándo cubre este pago
  nota text,
  created_at timestamptz not null default now()
);
create index on public.pagos_plataforma (empresa_id, fecha desc);

alter table public.suscripciones enable row level security;
alter table public.pagos_plataforma enable row level security;
create policy solo_superadmin on public.suscripciones for all to authenticated
  using ((select public.es_superadmin())) with check ((select public.es_superadmin()));
create policy solo_superadmin on public.pagos_plataforma for all to authenticated
  using ((select public.es_superadmin())) with check ((select public.es_superadmin()));

-- Un pago corre el vencimiento hasta lo que cubre (nunca lo acorta).
-- ponytail: borrar un pago no lo devuelve atrás; si hace falta, se corrige la fecha a mano.
create function public.pago_corre_vencimiento() returns trigger
  language plpgsql set search_path = ''
  as $$
  begin
    update public.suscripciones set vence = greatest(vence, new.hasta), updated_at = now()
     where empresa_id = new.empresa_id;
    return null;
  end
  $$;
create trigger pago_corre_vencimiento
  after insert on public.pagos_plataforma
  for each row execute function public.pago_corre_vencimiento();

-- La regla, en un solo lugar: al día hasta el vencimiento, 7 días de gracia con
-- aviso y después suspendida. La cortesía nunca vence.
create function public.estado_suscripcion(p_plan text, p_vence date) returns text
  language sql stable set search_path = ''
  as $$
    select case
      when p_plan = 'cortesia' then 'cortesia'
      when hoy <= p_vence then case when p_plan = 'prueba' then 'prueba' else 'al_dia' end
      when hoy <= p_vence + 7 then 'vencida'
      else 'suspendida' end
    from (select (now() at time zone 'America/Santiago')::date hoy) h
  $$;

-- Para la franja y el bloqueo en la app de la empresa
create function public.mi_cuenta()
  returns table (estado text, vence date, suspende date)
  language sql stable security definer set search_path = ''
  as $$
    select public.estado_suscripcion(s.plan, s.vence), s.vence, s.vence + 8
      from public.suscripciones s
     where s.empresa_id = public.mi_empresa_id()
  $$;
revoke execute on function public.mi_cuenta() from public, anon;
grant execute on function public.mi_cuenta() to authenticated;

-- El mantenedor: todas las empresas, con o sin plan, y su último pago
create function public.sa_cuentas()
  returns table (empresa_id uuid, slug text, nombre text, activa boolean,
                 plan text, precio integer, inicio date, vence date, notas text,
                 estado text, ultimo_pago date, ultimo_monto integer)
  language plpgsql stable security definer set search_path = ''
  as $$
  begin
    if not public.es_superadmin() then raise exception 'solo superadmin'; end if;
    return query
      select e.id, e.slug, e.nombre, e.activa, s.plan, s.precio, s.inicio, s.vence, s.notas,
             case when s.empresa_id is null then 'sin_plan' else public.estado_suscripcion(s.plan, s.vence) end,
             p.fecha, p.monto
        from public.empresas e
        left join public.suscripciones s on s.empresa_id = e.id
        left join lateral (select pp.fecha, pp.monto from public.pagos_plataforma pp
                            where pp.empresa_id = e.id order by pp.fecha desc, pp.id desc limit 1) p on true
       order by e.nombre;
  end
  $$;

-- Las primeras empresas parten gratis (decisión de Pablo, 2026-10-28)
insert into public.suscripciones (empresa_id, plan, precio, vence, notas)
  select id, 'cortesia', 0, '2099-12-31', 'Gratis para partir'
    from public.empresas where slug in ('raos', 'almaoutdoor', 'demo', 'parapenteandino')
  on conflict (empresa_id) do nothing;

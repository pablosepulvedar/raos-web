-- El banco solo muestra guias del mismo rubro.
--
-- Antes una empresa de rafting encontraba guias de parapente. El rubro estaba a
-- la vista, asi que el error era evidente, pero obligaba a leer cada resultado
-- para descartarlo.
--
-- El rubro de un guia sale de las empresas donde trabaja, que es lo unico que el
-- sistema sabe de el. Sigue sin revelarse CUALES son esas empresas.
create or replace function public.buscar_guias(p_texto text)
  returns table (id uuid, nombre text, rubros text, ya_esta boolean, invitado boolean)
  language sql stable security definer set search_path = ''
  as $$
    select p.id, p.nombre,
      (select string_agg(distinct ru.nombre, ', ')
         from public.perfil_roles pr
         join public.empresas e on e.id = pr.empresa_id
         join public.rubros ru on ru.codigo = e.rubro
        where pr.perfil_id = p.id),
      exists (select 1 from public.perfil_roles pr
               where pr.perfil_id = p.id and pr.empresa_id = public.mi_empresa_id()),
      exists (select 1 from public.invitaciones i
               where i.perfil_id = p.id and i.empresa_id = public.mi_empresa_id()
                 and i.estado = 'pendiente')
      from public.perfiles p
     where public.puedo_administrar()
       and length(trim(p_texto)) >= 3
       and p.disponible
       and p.activo
       and p.nombre ilike '%' || trim(p_texto) || '%'
       -- Del mismo rubro que la empresa que busca
       and exists (
         select 1 from public.perfil_roles pr
          join public.empresas e on e.id = pr.empresa_id
         where pr.perfil_id = p.id
           and e.rubro = (select e2.rubro from public.empresas e2
                           where e2.id = public.mi_empresa_id()))
     order by p.nombre
     limit 20
  $$;

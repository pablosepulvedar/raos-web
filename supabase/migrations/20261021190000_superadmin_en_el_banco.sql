-- El banco excluia a los superadmin "por si acaso". Sobraba: aparecer ya lo decide
-- cada uno con perfiles.disponible, que viene apagado y solo el dueno puede
-- encender. Y Pablo es piloto de verdad, no solo el proveedor del sistema.
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
     order by p.nombre
     limit 20
  $$;

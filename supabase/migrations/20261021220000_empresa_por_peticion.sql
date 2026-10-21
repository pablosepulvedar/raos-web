-- La empresa deja de ser del usuario y pasa a ser de cada peticion.
--
-- `perfil_sesion` es por usuario, no por pestana. Con dos pestanas abiertas en dos
-- empresas, la ultima en cambiar ganaba para las dos: escribir en una podia dejar
-- el dato en la otra. En la pantalla se veia la cabecera correcta, que es lo peor
-- de todo.
--
-- Ahora cada peticion dice de que empresa habla, en la cabecera `x-empresa`, y
-- esta funcion la respeta SOLO si quien pregunta pertenece a esa empresa (o es
-- superadmin). Como la cabecera la pone el navegador, se valida igual que si la
-- hubiera escrito un extrano: no da acceso a nada que no se pudiera alcanzar con
-- cambiar_empresa().
--
-- Si no viene cabecera, o nombra una empresa ajena, se cae a la de siempre:
-- perfil_sesion. Asi el panel del superadmin (admin.<dominio>, que no es una
-- empresa) sigue funcionando igual.
create or replace function public.mi_empresa_id() returns uuid
  language sql stable security definer set search_path = ''
  as $$
    select coalesce(
      -- 1. La empresa de esta peticion, si pertenezco a ella
      (select e.id
         from public.empresas e
        where e.slug = nullif(current_setting('request.headers', true)::json->>'x-empresa', '')
          and e.activa
          and (public.es_superadmin()
               or exists (select 1 from public.perfil_roles pr
                           where pr.perfil_id = auth.uid() and pr.empresa_id = e.id))),
      -- 2. La de la sesion, si sigo perteneciendo
      (select s.empresa_id
         from public.perfil_sesion s
         join public.empresas e on e.id = s.empresa_id and e.activa
        where s.perfil_id = auth.uid()
          and (public.es_superadmin()
               or exists (select 1 from public.perfil_roles pr
                           where pr.perfil_id = auth.uid() and pr.empresa_id = s.empresa_id))),
      -- 3. Recien creado, sin sesion todavia: su unica empresa
      (select pr.empresa_id
         from public.perfil_roles pr
         join public.empresas e on e.id = pr.empresa_id and e.activa
        where pr.perfil_id = auth.uid()
        limit 1)
    )
  $$;

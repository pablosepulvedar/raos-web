-- parapenteandino tambien es parapente: su rol de piloto queda restringido como corresponde
update public.empresas set rubro = 'parapente' where slug = 'parapenteandino';
update public.roles r set restringido = true
  from public.empresas e join public.rubros ru on ru.codigo = e.rubro
  where r.empresa_id = e.id and lower(r.nombre) in (lower(ru.operador), 'coordinador');

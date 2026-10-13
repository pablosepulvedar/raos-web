-- La empresa demo es la vitrina del producto: va con la marca de Reservaps,
-- no con el azul de RAOS.
update public.empresas set
  color = '#24914c',
  logo_url = 'https://reservaps-landing.pablo-sepulveda-retamal.workers.dev/img/logo.svg'
where slug = 'demo';

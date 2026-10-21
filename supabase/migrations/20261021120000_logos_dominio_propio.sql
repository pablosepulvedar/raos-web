-- Los logos de empresa apuntaban al worker de la landing por su URL .workers.dev.
-- Al pasar reservaps-landing a dominio propio esa URL quedo desactivada (404) y
-- los logos dejaron de cargar.
update public.empresas
   set logo_url = replace(logo_url,
         'https://reservaps-landing.pablo-sepulveda-retamal.workers.dev',
         'https://reservaps.cl')
 where logo_url like 'https://reservaps-landing.pablo-sepulveda-retamal.workers.dev%';

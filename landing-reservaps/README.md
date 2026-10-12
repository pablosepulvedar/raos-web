# Landing de Reservaps

La web pública del producto (el SaaS de reservas), no la de ninguna empresa cliente.
HTML y CSS planos, sin build: `public/` se sirve tal cual.

- Worker propio: `reservaps-landing`. Deploy: `npx wrangler deploy` desde esta carpeta.
- La intranet (raíz del repo) y la landing de RAOS (`landing/`) son otros workers.
- Dominio pendiente: **reservaps.dev** (verificado libre el 2026-10-13).
  Mientras no exista, los enlaces a la demo apuntan a los workers.

## Por confirmar
- Correo de contacto: hoy `hola@reservaps.dev` (no existe hasta comprar el dominio;
  se resuelve gratis con Email Routing de Cloudflare).
- WhatsApp comercial: no definido. El +56 9 4149 5370 es de RAOS, no de Reservaps.
- Precios: no hay plan público todavía, por eso la landing no muestra tarifas.

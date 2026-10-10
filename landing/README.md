# Parapente RAOS — Landing pública

Landing estática (HTML + CSS, sin build) de Parapente RAOS. Vive dentro del repo `raos-web` pero se despliega como un **worker aparte**: `raos-landing`.

```
raos-web/              <- un solo repo en GitHub
├── app/, lib/, ...    -> worker raos / demo / ...  (intranet, un subdominio por empresa)
└── landing/           -> worker raos-landing       (esta carpeta)
```

| | landing (esta carpeta) | intranet (raíz del repo) |
|---|---|---|
| URL hoy | raos-landing.pablo-sepulveda-retamal.workers.dev | raos.pablo-sepulveda-retamal.workers.dev |
| Dominio futuro | `parapenteraos.cl` | un subdominio por empresa |
| Stack | HTML + CSS, sin build | Next.js 16 + Supabase + OpenNext |
| Worker | `raos-landing` | `raos-web` (envs `raos`, `demo`) |

Se mantienen separados para no tocar `middleware.ts`, que redirige a `/login` toda ruta sin sesión, ni mover el dashboard que hoy está en `app/page.tsx` (`/`).

La landing es **solo de RAOS y estática**: el contenido va escrito en el código, no sale de la base de datos.

## Deploy

Con Cloudflare Builds conectado (ver abajo), basta `git push`. Manual, desde esta carpeta:

```
npx wrangler@latest deploy
```

### Conectar Cloudflare Builds (pendiente)

En Cloudflare → Workers & Pages → `raos-landing` → Settings → Builds → conectar `pablosepulvedar/raos-web`:

| Campo | Valor |
|---|---|
| Production branch | `deploy-cloudflare` |
| Build command | *(vacío, no hay build)* |
| Deploy command | `npx wrangler deploy` |
| Root directory | `landing/` |
| Build watch paths → Include | `landing/*` |

Y en el worker `raos-web`, agregar `landing/**` a **Exclude paths**, para que un cambio en la landing no dispare un build de la app.

## Ver en local

Abrir `public/index.html` en el navegador, o `npx wrangler dev` desde esta carpeta.

## Datos reales ya cargados (2026-10-10)

- **WhatsApp:** +56 9 4149 5370 (`wa.me/56941495370`), confirmado por el cliente. Los enlaces traen mensaje prellenado por tipo de vuelo.
- **Credenciales:** Licencia DGAC 1541 · Registro Sernatur 79723 (vigente, [ficha](https://serviciosturisticos.sernatur.cl/61975-parapente-raos)).
- **Redes:** Instagram [@parapenteraos](https://www.instagram.com/parapenteraos/) (verificada), TikTok [@parapente.raos](https://www.tiktok.com/@parapente.raos), Facebook `facebook.com/parapenteraos`. No hay YouTube.
- **Precios:** 1 persona $65.000 · 2 personas $120.000 · 3 o más $59.000 c/u · Rafting + Parapente $90.000 p/p · Fotos y video Premium 360° $15.000.
- **Requisitos:** 25–110 kg, edad mínima 5 años, menores con representante, no en estado de embarazo.
- **Duración:** vuelo 8–15 min; actividad completa 40 min–1 h.
- **Horarios (primavera/verano):** mié–vie 13:00–18:00, sáb–dom 12:00–18:00.
- **Reserva:** mínimo 1 día de anticipación, abono $10.000 por persona, saldo el día del vuelo (efectivo, transferencia, débito o crédito).
- **Rafting:** es una **colaboración con otra empresa**, se indica así en la tarjeta del pack.
- **Promociones** (cumpleaños, miércoles 360°, promos con fecha de término): NO van en la landing, cambian demasiado seguido. Se anuncian por redes.

## Pendiente de confirmar / reemplazar

| Qué | Estado |
|---|---|
| `ramonocando1@gmail.com` | Email del registro Sernatur. Cambiar por `contacto@parapenteraos.cl` cuando exista el dominio. |
| `maps.google.com/?q=Camino+a+San+José...` | Dirección aproximada (GeoPark Las Vizcachas). Reemplazar por el pin exacto del punto de encuentro. |
| **Fotos — autorización** | Son fotos reales (ver abajo), pero en 8 de las 10 sale un pasajero identificable. Confirmar que la autorización de uso de imagen esté cubierta. Si alguna no lo está, reemplazarla por otra del mismo set. |
| **Testimonios** | Los 3 textos son de EJEMPLO. Reemplazar por reales, con autorización de cada pasajero. |
| **Cifras** | "+18.000 Aventureros felices" y "4.9/5 · +450 reseñas" vienen del diseño del cliente: confirmar. |
| **Intranet** | El botón apunta a `https://raos.pablo-sepulveda-retamal.workers.dev`. Cuando esté el dominio, al subdominio de RAOS. |

## Fotos

Las 11 imágenes de `public/img/` son fotos reales de vuelos en Las Vizcachas, sacadas de los respaldos por fecha en `E:\` (frames 1080x1920 de las cámaras 360 que se entregan a cada pasajero) y procesadas con ffmpeg:

| Archivo | Uso | Origen |
|---|---|---|
| `hero.jpg` | Fondo del hero (1920x1440) | `E:\29-03-2026\Ahyzamac...\Ahyzamac 2_000142.jpg`, recorte aéreo sin personas |
| `vuelo-biplaza.jpg`, `para-dos.jpg`, `grupos.jpg`, `rafting.jpg` | Tarjetas de vuelos (800x500) | 22-02-2026, 15-02-2026, 29-03-2026 |
| `c1.jpg` – `c4.jpg` | Collage de testimonios (480x854) | mismos sets, planos 360 "tiny planet" y de giro |
| `banda.jpg` | Fondo de "Cómo reservar" (1600x901) | 29-03-2026 |
| `og.jpg` | Vista previa al compartir (1200x630) | 22-02-2026 |

Criterio de selección: sin stickers ni logos de otras empresas, con sol, y descartando todo lo que mostrara menores de edad. Para cambiar una foto basta reemplazar el archivo conservando el nombre, y actualizar su `aria-label` en `public/index.html`.

```
ffmpeg -i origen.jpg -vf "crop=1080:675:0:720,scale=800:500:flags=lanczos" -q:v 4 public/img/destino.jpg
```

## Dominio

El sitio antiguo `parapenteraos.com` está caído (NXDOMAIN). El definitivo será **`parapenteraos.cl`**: cuando se compre, agregarlo en Cloudflare → Workers → `raos-landing` → Domains & Routes, y recién ahí añadir `<link rel="canonical">` y `og:url` en `public/index.html`.

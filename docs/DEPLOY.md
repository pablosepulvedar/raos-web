# Deploy y migraciones

## Flujo

1. Trabajar en una rama (`master` está protegida, no se puede pushear directo).
2. Abrir Pull Request contra `master`. Esto dispara `.github/workflows/deploy.yml` (job **Aplicar migraciones Supabase**), que queda en pausa esperando aprobación manual.
3. Ir a **GitHub → Actions → (el run) → Review deployments** → marcar `Production` → **Approve and deploy**. Ahí corre `supabase db push` contra producción.
4. Ese job es un **required status check** de `master` — el botón de merge del PR no se habilita hasta que pase.
5. Mergear el PR. Vercel deploya automático como siempre (auto-deploy normal, sin trucos), y para entonces la migración ya corrió.

## Por qué está armado así

- La migración corre **antes** del merge (en el PR), no después. Así se evita pelear con Vercel para que espere: Vercel simplemente sigue deployando normal en cada push a `master`, pero cuando eso pasa la DB ya está al día.
- Se descartó la idea de bloquear el auto-deploy de Vercel con "Ignored Build Step" + Deploy Hook: Vercel aplica el Ignored Build Step a TODO, incluidos los Deploy Hooks (a pesar de lo que dice la documentación vieja), así que el deploy nunca llegaba a correr. Si en Vercel quedó configurado "Don't build anything" en Settings → Build and Deployment → Ignored Build Step, hay que devolverlo a **"Automatic"**.
- El GitHub Environment `Production` (Settings → Environments) tiene **Required reviewers** = pablosepulvedar. Ahí sí se puede autoaprobar (a diferencia de un PR review, que GitHub no deja auto-aprobar).
- `VERCEL_DEPLOY_HOOK_URL` quedó sin uso, se puede borrar el secret y el Deploy Hook en Vercel si se quiere limpiar.

## Dónde están las credenciales

Todo vive como **Environment secrets** en GitHub: Settings → Environments → Production → Environment secrets.

- `SUPABASE_ACCESS_TOKEN` — token personal, generado en supabase.com/dashboard → cuenta → Access Tokens.
- `SUPABASE_DB_PASSWORD` — password de Postgres de producción (Supabase → Connect → Direct connection → Reset password si no se recuerda). Distinta de `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
- `VERCEL_DEPLOY_HOOK_URL` — Vercel → Settings → Git → Deploy Hooks (branch `master`).

## Dominio y workers

`reservaps.cl` está registrado en **NIC Chile** (Cloudflare Registrar no vende `.cl`) y
delegado a los nameservers de Cloudflare. En la zona hay dos registros `A` a `192.0.2.1`,
los dos **proxied**: `@` y `*`. Esa IP es de documentación (RFC 5737) y no existe: el
tráfico lo intercepta Cloudflare antes y lo entrega al worker que corresponda.

| Host | Worker | Carpeta |
|---|---|---|
| `reservaps.cl`, `www.reservaps.cl` | `reservaps-landing` | `landing-reservaps/` |
| `*.reservaps.cl` | `raos-web` (la app) | raíz |
| `parapenteraos.cl` (pendiente de comprar) | `raos-landing` | `landing/` |

La app es **un solo worker para todas las empresas**: el subdominio no cambia el código,
la empresa sale de la sesión (`mi_empresa_id`). Una empresa nueva queda viva con solo
crear su fila en `empresas`, sin deploy ni env nuevo. El patrón más específico gana, por
eso la raíz y `www` quedan en la landing aunque exista el comodín.

Todo se despliega desde `.github/workflows/workers.yml` con un push a `deploy-cloudflare`.
Cloudflare Builds quedó de más: desconectarlo para no desplegar dos veces.

## Panel de consumo (superadmin)

`/admin/consumo` muestra cuánto gasta la infraestructura: requests por día contra el
tramo gratis de Workers (100.000/día), desglose por worker y por subdominio, y el peso
de la base contra los 500 MB de Supabase.

Los datos salen de la GraphQL Analytics API de Cloudflare, no de los workers: abrir la
página cuesta un request, no uno por cada visita medida. Nada se guarda en la base.

Hace falta un token de Cloudflare de **solo lectura** (Mi perfil → API Tokens → Create
Token → Custom) con `Account · Account Analytics · Read` y `Zone · Analytics · Read`:

```bash
npx wrangler secret put CLOUDFLARE_ANALYTICS_TOKEN
# ACCOUNT_ID y ZONE_ID ya están cargados; se ven en el Overview de la zona
```

Dos límites de la API, por si algo sale raro: la zona no acepta rangos de más de 4
semanas y 2 días (por eso la ventana es de 28 días), y los datos son muestreados, así
que son estimaciones, no un contador exacto.

Lo de "por empresa" cuenta visitas al subdominio, incluidos archivos estáticos; lo de
"por sistema" cuenta invocaciones de worker, que es lo que se factura. Por eso los dos
números no calzan, y está dicho en la pantalla.

## Google Calendar (una sola app de Google para todas las empresas)

La aplicación de Google es de Reservaps: ninguna empresa crea nada en Google Cloud,
solo aprieta "Conectar" en Varios > Google Calendar y autoriza la lectura. Lo que se
guarda por empresa es su `refresh_token`, en la tabla `calendar_conexiones`.

Preparación, una sola vez:

1. console.cloud.google.com → proyecto nuevo → APIs y servicios → habilitar **Google Calendar API**.
2. Pantalla de consentimiento: externa, con el logo y el dominio de Reservaps.
   Alcances: `calendar.readonly` y `email`.
3. Credenciales → ID de cliente OAuth → Aplicación web. Como **URI de redirección
   autorizado** va **una sola**: `https://auth.reservaps.cl/api/auth/google/callback`.
   Google exige la URI exacta y no acepta comodines, así que la vuelta llega siempre
   a ese host; qué empresa autorizó y a qué subdominio devolverla viajan firmados en
   el `state` (`lib/oauth-estado.ts`). Una empresa nueva no necesita tocar nada acá.
4. Secretos del worker (uno solo, ya no hay envs):

```bash
npx wrangler secret put GOOGLE_CLIENT_ID
npx wrangler secret put GOOGLE_CLIENT_SECRET
npx wrangler secret put GOOGLE_REDIRECT_URI   # https://auth.reservaps.cl/api/auth/google/callback
```

Sin esos secretos la pantalla avisa que la conexión no está habilitada y el resto de la
app funciona igual.

`calendar.readonly` es un alcance sensible para Google: mientras la app esté en modo de
prueba solo pueden conectarse las cuentas agregadas como usuarios de prueba (hasta 100).
Para abrirla a cualquiera hay que pasar la verificación de Google.

## Migraciones locales

```bash
npm run db:migration <nombre>   # crea archivo nuevo en supabase/migrations/
npm run db:push                 # aplica manual a producción (evitar, usar el flujo de PR)
npm run db:pull                 # trae cambios de producción a local
npm run db:status               # compara migraciones local vs remoto
```

Requiere Docker Desktop corriendo para `npx supabase start` (stack local).

## Troubleshooting

- **El job de deploy corre OK pero no aparece nada nuevo en Vercel → Deployments**: revisar el filtro "Status" en esa página, puede estar escondiendo deployments con estado "Skipped". El Ignored Build Step aplica también a los Deploy Hooks, no solo al push directo — si el deployment queda "Skipped" en vez de "Ready", falta revisar la config de Ignored Build Step en Vercel.
- **Push a `master` rechazado (`protected branch`)**: normal, hay que pasar por PR.
- **No puedo aprobar mi propio PR**: GitHub no lo permite. La regla de branch protection de `master` tiene "Require approvals" en 0, solo exige que exista el PR.

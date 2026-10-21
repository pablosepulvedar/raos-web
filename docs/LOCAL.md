# Probar en local antes de publicar

La idea: una copia de producción en tu máquina, con los mismos usuarios y las mismas
contraseñas, para romper cosas sin romperle el día a nadie.

## Una vez

1. **Docker Desktop corriendo.** Todo el stack local vive ahí.
2. `npx supabase start` — levanta Postgres (:54322), la API (:54321) y Studio (:54323).

## Cada vez que quieras datos frescos

```bash
npm run db:clone     # vuelca producción y reinicia la base local
npm run dev          # la app en http://localhost:3000
```

`db:clone` hace tres cosas: vuelca los datos de producción a `supabase/seed.sql`,
vacía la base local y la vuelve a armar aplicando **todas las migraciones** y después
el volcado. O sea que también comprueba que tus migraciones corren de cero.

Con `npm run db:clone -- --solo-dump` se queda en el volcado, sin tocar la base.

## Entrar

Cada empresa tiene su subdominio, igual que en producción. En local el navegador
resuelve `*.localhost` solo, sin tocar el archivo hosts:

| Dirección | Qué es |
|---|---|
| http://raos.localhost:3000 | Parapente RAOS |
| http://demo.localhost:3000 | la demo |
| http://admin.localhost:3000 | el panel del superadmin |

Las contraseñas son **las mismas de producción**: el volcado trae los hashes, no las
claves en limpio, y funcionan igual.

## Probar una migración antes de publicarla

```bash
npm run db:migration <nombre>    # crea el archivo
# escribir el SQL
npm run db:reset                 # la aplica en local, sobre el clon
# probar la app en local
npm run db:push                  # recién ahora, a producción
```

`db:reset` rehace la base desde cero: migraciones y después el clon. Si tu migración
choca con los datos reales, te enteras acá y no en producción.

## Cuidado con el clon

`supabase/seed.sql` queda en tu disco con **datos reales**: nombres y teléfonos de
pasajeros, fichas firmadas y los hashes de las contraseñas de todos. Está en
`.gitignore` y no debe salir de tu máquina. Bórralo cuando no lo necesites.

Por eso mismo conviene que las pruebas destructivas las hagas acá y no en la demo:
la demo es pública.

## Qué NO se clona

- **Los secretos del worker.** `GOOGLE_*`, `CLOUDFLARE_*` y la clave de Mercado Pago
  viven en Cloudflare, no en la base. En local esas pantallas van a decir que la
  integración no está configurada, y está bien.
- **El cron anti-pausa**, que es un worker aparte.
- **Los subdominios reales.** En local todo apunta a `localhost:3000`, porque
  `NEXT_PUBLIC_TENANT_URL` del `.env` local dice `http://{slug}.localhost:3000`.

## Volver a apuntar a producción

El `.env` tiene las dos configuraciones: la de producción comentada y la local
activa. Para mirar producción desde tu máquina se comenta una y se descomenta la
otra — **nunca se borran credenciales al cambiar de entorno**.

Ojo: con el `.env` apuntando a producción, cualquier cosa que hagas en la app es de
verdad.

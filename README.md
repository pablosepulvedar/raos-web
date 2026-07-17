This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Desarrollo local (sin credenciales de producción)

Requiere Docker Desktop corriendo.

1. `npx supabase start` — levanta el stack completo de Supabase en Docker (Postgres, Auth, Storage, Realtime, API REST), aislado de producción. La primera vez imprime en consola la URL y la anon key locales.
   - API: `http://127.0.0.1:54321`
   - Studio (dashboard): `http://127.0.0.1:54323`
   - DB directa: `postgresql://postgres:postgres@127.0.0.1:54322/postgres`
2. En `.env`, dejar activas las credenciales **LOCAL** (`NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` apuntando a `127.0.0.1:54321`) y las de producción comentadas. Nunca borrar unas al cambiar de entorno, solo comentar/descomentar.
3. `auth.users` no viene precargado en local (el seed solo trae datos de `public`, sin usuarios). Para loguearte, crea un usuario de prueba en Studio local → Authentication → Add user.
4. `npm run dev` — la app ahora habla con el stack de Docker, no con producción.

> **Nota (analytics / Windows):** en `supabase/config.toml` está `[analytics] enabled = false`. El contenedor de analytics (Logflare) no arranca en Windows (requiere exponer el daemon de Docker en `tcp://localhost:2375`) y tumba todo el `supabase start`. Desactivarlo solo apaga los logs del Studio local; no afecta datos, migraciones, la app ni producción (este archivo es solo para el stack local del CLI). En macOS/Linux podés volver a ponerlo en `true` si querés esos logs.

Migraciones y deploy: ver [docs/DEPLOY.md](docs/DEPLOY.md).

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

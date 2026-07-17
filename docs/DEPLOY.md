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

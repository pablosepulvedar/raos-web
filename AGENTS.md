<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Este repo contiene dos cosas, no una

```
raos-web/
├── app/, lib/, components/   -> la intranet (Next.js). Workers: raos, demo, ...
│                                un subdominio por empresa.
└── landing/                  -> landing pública de RAOS (HTML + CSS, sin build).
                                 Worker aparte: raos-landing.
```

- **No muevas la landing dentro de `app/`.** Se mantiene separada a propósito: `middleware.ts` redirige a `/login` toda ruta sin sesión, y el dashboard vive en `app/page.tsx` (`/`). Meterla ahí obliga a tocar ambas cosas y haría que el worker `demo` sirviera la landing de RAOS.
- Cada worker se despliega desde el mismo repo con distinto *Root directory* en Cloudflare Builds: `/` para la intranet, `landing/` para la landing.
- Detalles de la landing (datos del cliente, fotos, pendientes): `landing/README.md`.

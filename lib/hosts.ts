// Qué subdominios existen de verdad.
//
// `*.reservaps.cl` apunta al mismo worker, así que cualquier nombre inventado
// ejecuta la aplicación completa. No es un hueco —sin sesión no se ve nada— pero
// los escáneres aparecieron a las pocas horas de publicar el dominio y cada
// intento gasta una invocación.
//
// La lista se pide una vez por isolate y se guarda unos minutos: preguntar a la
// base en cada request costaría más que el problema que resuelve.

const TTL = 5 * 60_000

// No son empresas pero tienen que seguir vivos:
//   admin -> el panel del superadmin
//   auth  -> el host fijo al que Google devuelve el OAuth (lib/oauth-estado.ts)
const RESERVADOS = new Set(['admin', 'auth'])

// Solo se filtra el dominio del comodín. Lo demás (localhost, workers.dev, una
// previsualización) pasa sin preguntar.
const DOMINIO = '.reservaps.cl'

let cache: { slugs: Set<string>; vence: number } | null = null

async function slugsActivos(): Promise<Set<string> | null> {
  if (cache && cache.vence > Date.now()) return cache.slugs

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const clave = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !clave) return null

  try {
    const res = await fetch(`${url}/rest/v1/rpc/slugs_activos`, {
      method: 'POST',
      headers: { apikey: clave, Authorization: `Bearer ${clave}`, 'Content-Type': 'application/json' },
      body: '{}',
    })
    if (!res.ok) return null
    const slugs: string[] = await res.json()
    if (!Array.isArray(slugs) || slugs.length === 0) return null
    cache = { slugs: new Set(slugs), vence: Date.now() + TTL }
    return cache.slugs
  } catch {
    return null
  }
}

// Ante la duda, deja pasar: un fallo al consultar la lista no puede dejar a las
// empresas sin sistema. El filtro es para ahorrar ruido, no una barrera de
// seguridad —esa es el RLS—.
export async function hostConocido(host: string): Promise<boolean> {
  const limpio = (host || '').split(':')[0].toLowerCase()
  if (!limpio.endsWith(DOMINIO)) return true

  const sub = limpio.slice(0, -DOMINIO.length)
  if (!sub || sub.includes('.')) return false     // a.b.reservaps.cl no existe
  if (RESERVADOS.has(sub)) return true

  const slugs = await slugsActivos()
  if (!slugs) return true
  return slugs.has(sub)
}

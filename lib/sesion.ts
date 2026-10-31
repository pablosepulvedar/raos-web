// Cuánto dura una sesión. Supabase la renueva sola mientras el navegador la use, así
// que sin esto una sesión podía durar semanas. Contamos desde el inicio de sesión
// real (el `amr` del token: cuándo se escribió la contraseña), no desde la última
// renovación. ponytail: Supabase Pro trae "time-box sessions", que lo hace en el
// servidor de Auth; con eso este archivo sobra.
export const HORAS_SESION = 24

type Sesion = { access_token: string; refresh_token: string }

// La cookie sb-<ref>-auth-token puede venir en trozos (.0, .1, ...) y con prefijo base64-
export function leerSesion(cookies: { name: string; value: string }[]): Sesion | null {
  const partes = cookies
    .filter(c => /^sb-.+-auth-token(\.\d+)?$/.test(c.name))
    .sort((a, b) => Number(a.name.split('.').pop()) - Number(b.name.split('.').pop()))
  if (!partes.length) return null
  let valor = partes.map(c => c.value).join('')
  try {
    valor = decodeURIComponent(valor)
    if (valor.startsWith('base64-')) valor = new TextDecoder().decode(base64(valor.slice(7)))
    const s = JSON.parse(valor)
    return s?.access_token ? s : null
  } catch {
    return null
  }
}

const base64 = (b64url: string) => {
  const b = b64url.replace(/-/g, '+').replace(/_/g, '/')
  return Uint8Array.from(atob(b + '='.repeat((4 - (b.length % 4)) % 4)), ch => ch.charCodeAt(0))
}

// Segundos (epoch) del inicio de sesión, o null si el token no lo dice
export function inicioSesion(accessToken: string): number | null {
  try {
    const payload = JSON.parse(new TextDecoder().decode(base64(accessToken.split('.')[1])))
    const ts = (payload.amr ?? []).map((a: { timestamp?: number }) => a.timestamp).filter(Number.isFinite)
    return ts.length ? Math.min(...ts) : null
  } catch {
    return null
  }
}

export const sesionVencida = (accessToken: string, ahora = Date.now() / 1000, horas = HORAS_SESION) => {
  const inicio = inicioSesion(accessToken)
  return inicio !== null && ahora - inicio > horas * 3600
}

// Anula la sesión en Supabase (no solo en este navegador). El access token puede
// estar vencido, así que primero se canjea el refresh token por uno vigente.
// Si algo falla, igual se borran las cookies: el navegador queda sin sesión.
export async function anularSesion(s: Sesion) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!, apikey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  try {
    const r = await fetch(`${url}/auth/v1/token?grant_type=refresh_token`, {
      method: 'POST', headers: { apikey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: s.refresh_token }),
    })
    const token = r.ok ? (await r.json()).access_token : s.access_token
    await fetch(`${url}/auth/v1/logout?scope=local`, { method: 'POST', headers: { apikey, Authorization: `Bearer ${token}` } })
  } catch {
    // sin red hacia Supabase: basta con borrar las cookies
  }
}

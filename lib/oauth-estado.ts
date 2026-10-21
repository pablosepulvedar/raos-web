// Estado firmado del OAuth de Google.
// Google exige registrar cada redirect_uri exacta y no acepta comodines, así que
// la vuelta llega siempre al mismo host (GOOGLE_REDIRECT_URI) y no al subdominio
// de la empresa. Ahí no hay sesión ni cookie que valgan: la empresa y el
// subdominio de vuelta viajan en el `state`, firmado para que nadie los cambie.
//
// ponytail: se firma con el service_role key, que ya es secreto del worker. Si
// algún día conviene rotarla aparte, poner un OAUTH_STATE_SECRET propio.
const b64url = (b: ArrayBuffer | Uint8Array) =>
  btoa(String.fromCharCode(...new Uint8Array(b as ArrayBuffer)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')

async function firma(datos: string) {
  const clave = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(process.env.SUPABASE_SERVICE_ROLE_KEY!),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'],
  )
  return b64url(await crypto.subtle.sign('HMAC', clave, new TextEncoder().encode(datos)))
}

export async function firmarEstado(empresaId: string, origen: string) {
  const cuerpo = b64url(new TextEncoder().encode(
    JSON.stringify({ e: empresaId, o: origen, v: Date.now() + 10 * 60_000 }),
  ))
  return `${cuerpo}.${await firma(cuerpo)}`
}

export async function leerEstado(state: string | null) {
  const [cuerpo, mac] = (state ?? '').split('.')
  if (!cuerpo || !mac) return null
  if (mac !== await firma(cuerpo)) return null
  try {
    const d = JSON.parse(new TextDecoder().decode(
      Uint8Array.from(atob(cuerpo.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0)),
    )) as { e: string; o: string; v: number }
    if (Date.now() > d.v) return null
    // El origen va firmado, pero igual se comprueba: una redirección abierta no
    // debe depender de que la firma nunca se filtre.
    const raiz = new URL(process.env.GOOGLE_REDIRECT_URI!).hostname.split('.').slice(-2).join('.')
    const host = new URL(d.o).hostname
    if (host !== raiz && !host.endsWith(`.${raiz}`)) return null
    return d
  } catch {
    return null
  }
}

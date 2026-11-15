// El manual muestra TODO lo que hace el sistema, así que no es público: se entra
// desde la app, ya con sesión. La app firma un pase corto (vencimiento + HMAC con
// un secreto que comparten los dos workers) y acá se canjea por una cookie.
//
// El resto de la landing sigue siendo estática y gratis: `run_worker_first` solo
// manda /manual/* a este worker.

const HORAS = 12

const bytes = (s) => new TextEncoder().encode(s)

async function esperado(vence, secreto) {
  const clave = await crypto.subtle.importKey(
    'raw', bytes(secreto), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'],
  )
  const mac = await crypto.subtle.sign('HMAC', clave, bytes(vence))
  return [...new Uint8Array(mac)].map(b => b.toString(16).padStart(2, '0')).join('')
}

// Comparación sin filtrar por tiempo cuál es el primer carácter que no calza
const iguales = (a, b) => {
  if (a.length !== b.length) return false
  let d = 0
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return d === 0
}

async function sirve(pase, secreto) {
  const [vence, firma] = (pase || '').split('.')
  if (!vence || !firma || !secreto) return false
  if (!/^\d{10,16}$/.test(vence) || Number(vence) < Date.now()) return false
  return iguales(firma, await esperado(vence, secreto))
}

const AVISO = `<!doctype html>
<html lang="es"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Manual de Reservaps</title>
<style>
 body { margin:0; min-height:100vh; display:flex; align-items:center; justify-content:center;
        background:#06513a; color:#eafff3; font:16px/1.6 system-ui, sans-serif; padding:24px }
 .caja { max-width:430px }
 h1 { font-size:22px; margin:0 0 12px }
 a { display:inline-block; margin-top:18px; background:#c6ff3a; color:#06513a; font-weight:700;
     text-decoration:none; padding:12px 18px; border-radius:12px }
</style></head>
<body><div class="caja">
 <h1>El manual se abre desde el sistema</h1>
 <p>Está dentro de Reservaps porque explica todo lo que hace el sistema. Entra con tu cuenta y
 ábrelo con el botón <b>Ayuda</b>, abajo a la izquierda de cualquier pantalla.</p>
 <p>¿Todavía no eres cliente? Mira <b>qué incluye</b>, pantalla por pantalla.</p>
 <a href="https://reservaps.cl/presentacion/">Ver qué incluye</a>
</div></body></html>`

export default {
  async fetch(peticion, env) {
    const url = new URL(peticion.url)
    if (!url.pathname.startsWith('/manual')) return env.ASSETS.fetch(peticion)

    const cookie = (peticion.headers.get('cookie') || '').match(/(?:^|;\s*)manual=([^;]+)/)?.[1]
    if (await sirve(cookie, env.MANUAL_SECRET)) return env.ASSETS.fetch(peticion)

    const pase = url.searchParams.get('t')
    if (await sirve(pase, env.MANUAL_SECRET)) {
      url.searchParams.delete('t')          // que no quede el pase en la barra ni en los enlaces
      return new Response(null, {
        status: 302,
        headers: {
          Location: url.pathname + url.search,
          'Set-Cookie': `manual=${pase}; Path=/manual; Max-Age=${HORAS * 3600}; HttpOnly; Secure; SameSite=Lax`,
        },
      })
    }

    return new Response(AVISO, { status: 403, headers: { 'content-type': 'text/html; charset=utf-8' } })
  },
}

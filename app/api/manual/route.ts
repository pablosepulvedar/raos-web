import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { MANUAL } from '@/lib/manual'

// El manual explica todo lo que hace el sistema, así que no es público. Acá se
// comprueba la sesión y se firma un pase corto que el worker de la landing
// canjea por una cookie (landing-reservaps/src/manual.js).
const HORAS = 12

export async function GET(peticion: Request) {
  const sb = await createClient()
  const { data } = await sb.auth.getUser()
  const url = new URL(peticion.url)
  if (!data.user) return NextResponse.redirect(new URL('/login', url.origin))

  const secreto = process.env.MANUAL_SECRET
  if (!secreto) return NextResponse.redirect(MANUAL)     // sin secreto, mejor abrirlo que romperlo

  const vence = String(Date.now() + HORAS * 3_600_000)
  const clave = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(secreto), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'],
  )
  const mac = await crypto.subtle.sign('HMAC', clave, new TextEncoder().encode(vence))
  const firma = [...new Uint8Array(mac)].map(b => b.toString(16).padStart(2, '0')).join('')

  const cap = url.searchParams.get('cap')
  // El # no viaja al servidor, pero el navegador se lo lleva igual al redirigir
  return NextResponse.redirect(`${MANUAL}?t=${vence}.${firma}${cap ? `#${cap}` : ''}`)
}

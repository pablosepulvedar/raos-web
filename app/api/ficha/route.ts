import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { FICHA_TEXTO, FICHA_VERSION, type Idioma } from '@/lib/ficha-texto'

// Firma de la ficha. El pasajero no tiene sesión: entra solo con su token.
// La evidencia (ip, navegador, hash del texto) la pone el servidor, nunca el cliente.
export async function POST(request: NextRequest) {
  const b = await request.json()
  const idioma: Idioma = b.idioma === 'en' ? 'en' : 'es'

  if (!b.token || !b.acepta) {
    return NextResponse.json({ error: 'Falta aceptar la declaración' }, { status: 400 })
  }

  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(FICHA_TEXTO[idioma]))
  const hash = [...new Uint8Array(digest)].map(x => x.toString(16).padStart(2, '0')).join('')

  const ip =
    request.headers.get('cf-connecting-ip') ||
    request.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
    ''

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false } }
  )

  const { error } = await supabase.rpc('firmar_ficha', {
    p_token: b.token,
    p_nombre: b.nombre,
    p_documento: b.documento,
    p_edad: b.edad,
    p_nacionalidad: b.nacionalidad,
    p_salud: b.salud,
    p_emergencia_nombre: b.emergencia_nombre,
    p_emergencia_telefono: b.emergencia_telefono,
    p_tutor_nombre: b.tutor_nombre,
    p_tutor_documento: b.tutor_documento,
    p_texto_version: FICHA_VERSION,
    p_texto_hash: hash,
    p_idioma: idioma,
    p_ip: ip,
    p_user_agent: request.headers.get('user-agent') || '',
  })

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ ok: true })
}

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { FICHA_VERSION, fichaTexto, type Idioma } from '@/lib/ficha-texto'

// Firma de la ficha. El pasajero no tiene sesión: entra solo con su token.
// La evidencia (ip, navegador, hash del texto) la pone el servidor, nunca el cliente.
export async function POST(request: NextRequest) {
  const b = await request.json()
  const idioma: Idioma = b.idioma === 'en' ? 'en' : 'es'

  if (!b.token || !b.acepta) {
    return NextResponse.json({ error: 'Falta aceptar la declaración' }, { status: 400 })
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false } }
  )

  // El texto nombra a la empresa, así que el hash se calcula sobre el texto que
  // realmente se mostró, no sobre la plantilla.
  const { data: fichas } = await supabase.rpc('ficha_por_token', { p_token: b.token })
  const empresa = fichas?.[0]?.empresa
  if (!empresa) return NextResponse.json({ error: 'Ficha no encontrada' }, { status: 404 })

  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(fichaTexto(idioma, empresa)))
  const hash = [...new Uint8Array(digest)].map(x => x.toString(16).padStart(2, '0')).join('')

  const ip =
    request.headers.get('cf-connecting-ip') ||
    request.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
    ''

  const { error } = await supabase.rpc('firmar_ficha', {
    p_token: b.token,
    p_nombre: b.nombre,
    p_documento: b.documento,
    p_edad: b.edad,
    p_nacionalidad: b.nacionalidad,
    p_emergencia_nombre: b.emergencia_nombre,
    p_emergencia_telefono: b.emergencia_telefono,
    p_emergencia_parentesco: b.emergencia_parentesco,
    p_experiencia_previa: !!b.experiencia_previa,
    p_prevision: b.prevision,
    p_salud: b.salud,
    p_autoriza_imagen: !!b.autoriza_imagen,
    p_instagram: b.instagram,
    p_como_conocio: b.como_conocio,
    p_gift_card: b.gift_card,
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

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { FICHA_VERSION, fichaTexto, type Idioma } from '@/lib/ficha-texto'
import { faltantesFicha } from '@/lib/ficha-obligatorios'

// Firma de la ficha. El pasajero no tiene sesión: entra solo con su token.
// La evidencia (ip, navegador, hash del texto) la pone el servidor, nunca el cliente.
// Dos formas de llegar: `token` (la ficha de un pasajero) o `reserva_token` + `nuevo`
// (el link de la reserva, cuando el pasajero no estaba en la lista y se agrega).

// Lo que responde la base, dicho para el pasajero
const MENSAJE: Record<string, string> = {
  'ficha ya aceptada': 'Esta ficha ya la firmó otra persona. Si no eres tú, vuelve atrás y elige tu nombre en la lista.',
  'pasajero ya ingresado': 'Ese pasajero ya se ingresó en esta reserva (mismo nombre o RUT/pasaporte). Si eres otra persona, revisa tus datos.',
  'nombre en la lista': 'Tu nombre ya aparece en la lista de esta reserva: vuelve atrás y selecciónalo.',
  'demasiados pasajeros': 'Esta reserva ya no admite más pasajeros por este link. Escríbele a la empresa.',
  'ficha no encontrada': 'Este link ya no es válido. Pídele uno nuevo a la empresa.',
  'reserva no encontrada': 'Este link ya no es válido. Pídele uno nuevo a la empresa.',
}
export async function POST(request: NextRequest) {
  const b = await request.json()
  const idioma: Idioma = b.idioma === 'en' ? 'en' : 'es'

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false } }
  )

  const ip =
    request.headers.get('cf-connecting-ip') ||
    request.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
    ''
  const userAgent = request.headers.get('user-agent') || ''

  // Queda registro de cada intento, haya firmado o no.
  const log = (evento: string, detalle: string) =>
    supabase.rpc('registrar_ficha_log', {
      p_token: b.token, p_evento: evento, p_detalle: detalle,
      p_ip: ip, p_user_agent: userAgent,
    })

  const nuevo = !b.token && !!b.reserva_token && !!b.nuevo
  if ((!b.token && !nuevo) || !b.acepta) {
    if (b.token) await log('error', 'No marcó la declaración')
    return NextResponse.json({ error: 'Falta aceptar la declaración' }, { status: 400 })
  }

  // Lo mismo que exige el formulario: el navegador no es de fiar
  const faltan = faltantesFicha({ ...b, esMenor: Number(b.edad) < 18 || !!String(b.tutor_nombre ?? '').trim() })
  if (faltan.length) {
    await log('error', `Faltan: ${faltan.join(', ')}`)
    return NextResponse.json({ error: 'Faltan datos obligatorios', faltan }, { status: 400 })
  }

  // El texto nombra a la empresa, así que el hash se calcula sobre el texto que
  // realmente se mostró, no sobre la plantilla.
  const { data: fichas } = nuevo
    ? await supabase.rpc('fichas_de_reserva', { p_token: b.reserva_token })
    : await supabase.rpc('ficha_por_token', { p_token: b.token })
  const empresa = fichas?.[0]?.empresa
  if (!empresa) {
    if (!nuevo) await log('error', 'Token no encontrado')
    return NextResponse.json({ error: 'Ficha no encontrada' }, { status: 404 })
  }

  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(fichaTexto(idioma, empresa)))
  const hash = [...new Uint8Array(digest)].map(x => x.toString(16).padStart(2, '0')).join('')

  const { data: tokenNuevo, error } = await supabase.rpc(nuevo ? 'firmar_ficha_nueva' : 'firmar_ficha', {
    ...(nuevo ? { p_reserva_token: b.reserva_token } : { p_token: b.token }),
    p_nombre: b.nombre,
    p_documento: b.documento,
    p_edad: b.edad,
    p_peso: Number(b.peso),
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
    p_user_agent: userAgent,
  })

  if (error) {
    if (!nuevo) await log('error', error.message)
    return NextResponse.json({ error: MENSAJE[error.message] ?? error.message, codigo: error.message }, { status: 400 })
  }

  // El que se agregó recién tiene ficha ahora: el registro va a esa
  if (nuevo) b.token = tokenNuevo
  await log('firmada', `${b.nombre} · ${b.documento} · ${idioma} · ${FICHA_VERSION}`)
  return NextResponse.json({ ok: true })
}
